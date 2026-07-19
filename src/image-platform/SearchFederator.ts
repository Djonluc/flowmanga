import type { ImageProvider, PlatformImage, SearchQuery } from "./types";
import { useSettingsStore } from "../stores/useSettingsStore";
import { hasExcludedTag, mergeExcludedTags } from "../services/TagExclusions";
import { getActiveForYouProfile } from "./forYouProfiles";
import { ContentFilter } from "../services/ContentFilter";
import { mapQueryForProvider } from "./ProviderTagMapper";
import { MediaFingerprintService } from "./MediaFingerprintService";
import { resolveProviderTags } from "./ProviderTagResolver";

export class SearchFederator {
  private providers: Map<string, ImageProvider> = new Map();

  registerProvider(provider: ImageProvider) {
    this.providers.set(provider.id, provider);
  }

  getProviders(): ImageProvider[] {
    return Array.from(this.providers.values());
  }

  /** Filters out adult images when the user has adult content disabled. */
  private filterAdult(images: PlatformImage[]): PlatformImage[] {
    const { showAdultContent } = useSettingsStore.getState();
    if (showAdultContent) return images;
    return images.filter(img => img.rating === 'safe' || !img.rating);
  }

  /** Strictly removes any image that contains a user's blocked tag. */
  private async filterBlocked(images: PlatformImage[]): Promise<PlatformImage[]> {
    if (images.length === 0) return [];
    try {
      const { useGalleryStore } = await import("../stores/useGalleryStore");
      const blockedTags = mergeExcludedTags(
        useGalleryStore.getState().blockedTags,
        useSettingsStore.getState().excludedTags,
      );
      
      if (blockedTags.length === 0) return images;

      const blockedCounts = blockedTags
        .map(tag => ({ tag, count: images.filter(image => hasExcludedTag(image.tags || [], [tag])).length }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count);
      if (blockedCounts.length > 0) {
        console.info(`[SearchFederator] blocked ${images.length - images.filter(img => !hasExcludedTag(img.tags || [], blockedTags)).length}/${images.length} images; reasons=${blockedCounts.slice(0, 12).map(item => `${item.tag}:${item.count}`).join(',')}`);
      }

      return images.filter(img => {
        return !hasExcludedTag(img.tags || [], blockedTags);
      });
    } catch (e) {
      console.warn("[SearchFederator] Failed to filter blocked tags", e);
      return images; 
    }
  }

  /** Excludes saved media and anything exposed in an image-platform feed in the last 48 hours. */
  private async filterExclusions(images: PlatformImage[]): Promise<PlatformImage[]> {
    if (images.length === 0) return [];
    try {
      const { getDb } = await import("../services/db");
      const db = getDb();
      const ids = images.map(img => img.id);
      const placeholders = ids.map(() => '?').join(',');
      
      // 1. Strictly exclude saved images
      const savedRows = await db.select<{id: string}[]>(`SELECT id FROM FlowSavedImages WHERE id IN (${placeholders})`, ids);
      const savedSet = new Set(savedRows.map(r => r.id));
      
      const notSavedImages = images.filter(img => !savedSet.has(img.id));
      if (notSavedImages.length === 0) return [];
      
      // 2. Strictly exclude images exposed in any tab during the last 48 hours.
      const notSavedIds = notSavedImages.map(img => img.id);
      const nsPlaceholders = notSavedIds.map(() => '?').join(',');
      const seenRows = await db.select<{id: string}[]>(`
        SELECT id FROM FlowSeenImages 
        WHERE id IN (${nsPlaceholders})
        AND seenAt >= datetime('now', '-48 hours')
      `, notSavedIds);
      const seenSet = new Set(seenRows.map(r => r.id));

      const unseen = notSavedImages.filter(img => !seenSet.has(img.id));
      if (seenSet.size > 0) {
        console.info(`[SearchFederator] suppressed ${seenSet.size}/${notSavedImages.length} items seen within 48 hours`);
      }
      return MediaFingerprintService.filterRecentDuplicates(unseen);
    } catch (e) {
      console.warn("[SearchFederator] Failed to filter exclusions", e);
      return images;
    }
  }

  async getActiveProviders(): Promise<ImageProvider[]> {
    const { useSettingsStore } = await import("../stores/useSettingsStore");
    const { isSourceEnabled } = useSettingsStore.getState();
    // Sankaku has a public feed; a captured session unlocks additional
    // restricted content but should not make the entire source disappear.
    return this.getProviders().filter(p => isSourceEnabled(p.id));
  }

  async getById(providerId: string, sourceId: string): Promise<PlatformImage | null> {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.getById) return null;
    return provider.getById(sourceId);
  }

  /** Injects media type filters if the user wants exclusively videos or gifs */
  private getMediaFilterQuery(baseQuery?: SearchQuery, providerId?: string): SearchQuery {
    const query = baseQuery || { raw: "", positiveTags: [], negativeTags: [], predicates: {} };
    const { globalMediaFilter } = useSettingsStore.getState();
    if (globalMediaFilter === 'all' || globalMediaFilter === 'image') return query;

    // Sankaku's `animated` tag is mostly GIFs. Its canonical `video` tag
    // yields actual MP4/WebM posts and prevents video-only feeds from being
    // reduced to the occasional video in an otherwise GIF-heavy page.
    const mediaTag = providerId === 'sankaku' && globalMediaFilter === 'video' ? 'video' : 'animated';
    const newTags = [...query.positiveTags, mediaTag];
    return {
      ...query,
      positiveTags: Array.from(new Set(newTags)),
      raw: query.raw ? `${query.raw} ${mediaTag}` : mediaTag
    };
  }

  private async prepareProviderQuery(query: SearchQuery, provider: ImageProvider): Promise<SearchQuery> {
    const resolved = await resolveProviderTags(query, provider);
    return this.getMediaFilterQuery(mapQueryForProvider(resolved, provider.id), provider.id);
  }

  private filterMediaType(images: PlatformImage[]): PlatformImage[] {
    const { globalMediaFilter } = useSettingsStore.getState();
    if (globalMediaFilter === 'all') return images;
    return images.filter(image => image.mediaType === globalMediaFilter);
  }

  /**
   * Resolves provider requests concurrently while forwarding each completed
   * provider batch immediately. The returned array keeps provider order for
   * the final merge, but the UI no longer waits for the slowest source.
   */
  private async resolveProviderRequests(
    requests: Array<{ providerId: string; request: Promise<PlatformImage[]> }>,
    onChunk?: (images: PlatformImage[]) => void,
  ): Promise<PlatformImage[][]> {
    const results: PlatformImage[][] = Array.from({ length: requests.length }, () => []);

    await Promise.all(requests.map(({ providerId, request }, index) =>
      request
        .then((images) => {
          results[index] = images;
          const grouped = this.groupRelatedResults(images);
          if (onChunk && grouped.length > 0) onChunk(grouped);
          return images;
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[SearchFederator] Provider ${providerId} failed; continuing with other sources: ${message}`);
          results[index] = [];
          return [];
        }),
    ));

    return results;
  }

  /**
   * Executes a search query. 
   * If the query has a `source` predicate (e.g., `source:danbooru`), it routes only to that provider.
   * Otherwise, it queries all registered providers in parallel and interleaves the results.
   */
  async search(query: SearchQuery, page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const targetSource = query.predicates["source"];
    let activeProviders: ImageProvider[] = [];

    if (targetSource) {
      const provider = this.providers.get(targetSource);
      if (provider) {
        const { useSettingsStore } = await import("../stores/useSettingsStore");
        if (useSettingsStore.getState().isSourceEnabled(provider.id)) {
          activeProviders.push(provider);
        }
      }
    } else {
      activeProviders = await this.getActiveProviders();
    }

    if (activeProviders.length === 0) return [];

    // Fetch from all active providers concurrently. Each completed provider
    // is emitted immediately; the final merge still preserves grouping.
    const requests = activeProviders.map(p => ({
      providerId: p.id,
      request: this.prepareProviderQuery(query, p).then(providerQuery => p.search(providerQuery, page))
        .then(async res => {
          const filtered = this.filterAdult(this.filterMediaType(res));
          const blockFiltered = await this.filterBlocked(filtered);
          // Search is a complete tag catalog. Seen posts remain available so
          // results can run from the newest match into older pages.
          return blockFiltered;
        }),
    }));

    const resultsArray = await this.resolveProviderRequests(requests, onChunk);
    const grouped = this.groupRelatedResults(resultsArray.flat());
    return onChunk ? grouped : this.groupRelatedResults(this.interleaveResults(resultsArray));
  }

  async getLatest(page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const activeProviders = await this.getActiveProviders();
    if (activeProviders.length === 0) return [];
    
    const { globalMediaFilter } = useSettingsStore.getState();
    const isAnimatedFilter = globalMediaFilter === 'video' || globalMediaFilter === 'gif';

    const requests = activeProviders.map(p => {
      const fetchPromise = isAnimatedFilter 
        ? this.prepareProviderQuery({ raw: '', positiveTags: [], negativeTags: [], predicates: {} }, p).then(query => p.search(query, page))
        : p.getLatest(page);

      return {
        providerId: p.id,
        request: fetchPromise
        .then(async res => {
          const filtered = this.filterAdult(this.filterMediaType(res));
          const blockFiltered = await this.filterBlocked(filtered);
          console.info(`[SearchFederator] latest provider=${p.id} page=${page} raw=${res.length} adultVisible=${filtered.length} afterBlocked=${blockFiltered.length}`);
          // Latest is a chronological archive, not a novelty feed. Previously
          // seen and saved posts must remain visible in their real position.
          return blockFiltered;
        }),
      };
    });

    const resultsArray = await this.resolveProviderRequests(requests, onChunk);
    const grouped = this.groupRelatedResults(resultsArray.flat());
    return onChunk ? grouped : this.groupRelatedResults(this.interleaveResults(resultsArray));
  }

  async getCurated(page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const activeProviders = await this.getActiveProviders();
    if (activeProviders.length === 0) return [];

    let discoveryTags: string[] = [];
    let blockedTags: string[] = [];
    let profileExcludedTags: string[] = [];
    let sankakuProfileTag: string | undefined;
    let sankakuCoreTags: string[] = [];
    try {
      const { getDb } = await import("../services/db");
      const db = getDb();
      const { useSettingsStore } = await import("../stores/useSettingsStore");
      const settings = useSettingsStore.getState();
      const mode = settings.recommendationMode;
      const storedProfile = settings.forYouProfiles?.find(item => item.id === settings.activeForYouProfileId);
      const profile = storedProfile && (!storedProfile.adultOnly || settings.showAdultContent)
        ? getActiveForYouProfile(storedProfile, settings.showAdultContent)
        : undefined;
      sankakuProfileTag = profile?.sankakuTag?.trim();
      const profileCoreTags = profile?.coreTags || [];
      sankakuCoreTags = profileCoreTags;
      const profileSupportingTags = [...(profile?.supportingTags || [])];
      const profileRequiredCoreTags = profile?.requiredCoreTags || [];
      const profileRequiredSupportingTags = profile?.requiredSupportingTags || [];
      const profileTypedTags = [
        ...(profile?.artistTags || []).map(tag => `artist:${tag}`),
        ...(profile?.characterTags || []).map(tag => `character:${tag}`),
        ...(profile?.seriesTags || []).map(tag => `series:${tag}`),
      ];
      const profileRequiredTypedTags = [
        ...(profile?.requiredArtistTags || []).map(tag => `artist:${tag}`),
        ...(profile?.requiredCharacterTags || []).map(tag => `character:${tag}`),
        ...(profile?.requiredSeriesTags || []).map(tag => `series:${tag}`),
      ];
      profileExcludedTags = profile?.excludedTags || [];

      // Pull implicit interests (tags the engine thinks you like based on viewing habits)
      const interests = await db.select<{name: string}[]>(`
        SELECT name FROM UserInterests
        WHERE type IN ('dominant_tag', 'supporting_tag', 'artist', 'character', 'series')
        ORDER BY isPinned DESC, score DESC, RANDOM() 
        LIMIT 20
      `);
      
      // Pull explicit favorites (tags you've explicitly starred)
      const favs = await db.select<{tag: string}[]>(`
        SELECT tag FROM FavoriteTags 
        ORDER BY RANDOM() 
        LIMIT 20
      `);
      const suppressedFavoriteNames = new Set((settings.suppressedFavoriteSupportTags || []).map(tag => tag.toLowerCase()));
      const favoriteSupportTags = favs
        .map(favorite => favorite.tag)
        .filter(tag => !suppressedFavoriteNames.has(tag.toLowerCase()));
      profileSupportingTags.push(...favoriteSupportTags);

      let combinedTags: string[] = [...profileCoreTags];
      if (mode === 'strict_favorites') {
        combinedTags = [...profileCoreTags, ...favoriteSupportTags];
      } else if (mode === 'strict_interests') {
        combinedTags = [...profileCoreTags, ...interests.map(i => i.name)];
      } else {
        // dynamic
        combinedTags = Array.from(new Set([
          ...profileCoreTags,
          ...favoriteSupportTags,
          ...interests.map(i => i.name)
        ]));
      }
      
      // A selected profile always contributes a core query. Required tags are
      // included in every query; unpinned tags are sampled for variety.
      if (profile) {
        const strictTheme = settings.forYouQualityMode === 'strict' || settings.forYouQualityMode === 'themed';
        const optionalCore = profileCoreTags.filter(tag => !profileRequiredCoreTags.includes(tag));
        const optionalSupporting = profileSupportingTags.filter(tag => !profileRequiredSupportingTags.includes(tag));
        const requiredBase = Array.from(new Set([
          ...profileRequiredCoreTags,
          ...profileRequiredSupportingTags,
          ...profileRequiredTypedTags,
        ]));
        const coreChoices = [...optionalCore].sort(() => 0.5 - Math.random());
        const supportingChoices = [...optionalSupporting].sort(() => 0.5 - Math.random());
        const typedChoices = [...profileTypedTags]
          .filter(tag => !profileRequiredTypedTags.includes(tag))
          .sort(() => 0.5 - Math.random());

        if (profileCoreTags.length > 0) {
          discoveryTags = Array.from({ length: 4 }, (_, index) => {
            const core = coreChoices[index % Math.max(1, coreChoices.length)] || profileRequiredCoreTags[0] || profileCoreTags[0];
            const secondary = strictTheme && profileSupportingTags.length > 0
              ? supportingChoices[index % Math.max(1, supportingChoices.length)] || profileRequiredSupportingTags[0] || profileSupportingTags[0]
              : undefined;
            const typed = typedChoices[index % Math.max(1, typedChoices.length)];
            return Array.from(new Set([
              ...requiredBase,
              core,
              ...(secondary ? [secondary] : []),
              ...(typed ? [typed] : []),
            ])).join(' ');
          });
        }
      } else {
        discoveryTags = combinedTags
          .sort(() => 0.5 - Math.random())
          .slice(0, 4);
      }

      const fallbacks = [
        "genshin_impact", "honkai_star_rail", "original", "anime", "landscape", 
        "scenery", "cyberpunk", "fantasy", "digital_art", "illustration", 
        "vocaloid", "hatsune_miku", "sky", "clouds", "nature", "night", 
        "stars", "retro", "pixel_art", "sketch", "monochrome", "street", 
        "city", "water", "sea", "ocean", "sunlight", "sunset", "gothic", 
        "steampunk", "cybernetic", "mecha", "space", "underwater", "concept_art"
      ];

      if (!profile && discoveryTags.length < 4) {
        const shuffledFallbacks = [...fallbacks].sort(() => 0.5 - Math.random());
        for (const tag of shuffledFallbacks) {
          if (discoveryTags.length >= 4) break;
          if (!discoveryTags.includes(tag)) {
            discoveryTags.push(tag);
          }
        }
      }
      const { useGalleryStore } = await import("../stores/useGalleryStore");
      blockedTags = mergeExcludedTags(
        useGalleryStore.getState().blockedTags,
        useSettingsStore.getState().excludedTags,
        profileExcludedTags,
      );
    } catch (e) {
      console.warn("Failed to load interests for curation", e);
    }

    if (discoveryTags.length === 0) {
      return useSettingsStore.getState().activeForYouProfileId
        ? []
        : this.getLatest(page, onChunk);
    }

    // for each tag across all providers, then interleave the results.
    const requests: Array<{ providerId: string; request: Promise<PlatformImage[]> }> = [];
    const { RecommendationEngine } = await import('./services/RecommendationEngine');
    const recommendationContext = await RecommendationEngine.loadContext();

    // Sankaku rejects some multi-tag searches for public/basic sessions with
    // `snackbar__insufficient_privileges`. Keep its request to one core tag,
    // rotating across feed pages so every configured core still contributes.
    // A source-specific tag takes precedence when the profile defines one.
    const selectedSankakuTag = sankakuProfileTag;
    const sankakuChoices = sankakuCoreTags.length > 0 ? sankakuCoreTags : discoveryTags;
    const sankakuChoiceIndex = (Math.max(1, page) - 1) % Math.max(1, sankakuChoices.length);
    const sankakuSeed = selectedSankakuTag || sankakuChoices[sankakuChoiceIndex];

    const providerDiscoveryTags = sankakuSeed && !discoveryTags.includes(sankakuSeed)
      ? [...discoveryTags, sankakuSeed]
      : discoveryTags;
    providerDiscoveryTags.forEach(tag => {
      activeProviders.forEach(p => {
        if (p.id === 'sankaku' && tag !== sankakuSeed) return;
        const allPositiveTags = tag.split(/\s+/).filter(Boolean);
        // For You intentionally mixes 10% current posts with 90% randomized
        // matching posts. Random requests stay on page one because Sankaku
        // returns a fresh randomized set and cursor chains are order-specific.
        const sankakuFreshPage = p.id === 'sankaku' && (Math.max(1, page) - 1) % 10 === 0;
        const positiveTags = p.id === 'sankaku'
          ? [...allPositiveTags, `order:${sankakuFreshPage ? 'recent' : 'random'}`]
          : allPositiveTags;
        const effectiveTag = positiveTags.join(' ');
        const query = this.prepareProviderQuery({ raw: effectiveTag, positiveTags, negativeTags: blockedTags, predicates: {} }, p);
        
        // Sankaku rate-limits page jumps aggressively. Keep its requests
        // sequential so a refresh reaches current results reliably.
        const jitter = p.id === 'sankaku' ? 0 : Math.floor(Math.random() * 10);
        const fetchPage = p.id === 'sankaku' ? 1 : page + jitter;

        requests.push({
          providerId: p.id,
          request: query.then(providerQuery => p.search(providerQuery, fetchPage))
            .then(async res => {
              const filtered = this.filterAdult(this.filterMediaType(res));
              const blockFiltered = await this.filterBlocked(filtered);
              const prioritized = await this.filterExclusions(blockFiltered);
              console.info(`[SearchFederator] curated provider=${p.id} page=${fetchPage} tag=${effectiveTag} raw=${res.length} adultVisible=${filtered.length} afterBlocked=${blockFiltered.length} ranked=${prioritized.length}`);
              
              return prioritized;
            }),
        });
      });
    });

    const candidatePool: PlatformImage[] = [];
    const emittedCuratedIds = new Set<string>();
    let curationQueue = Promise.resolve();
    const streamedRequests = requests.map(({ providerId, request }) => ({
      providerId,
      request: request.then(async (prioritized) => {
        candidatePool.push(...prioritized);

        if (onChunk && prioritized.length > 0) {
          const currentCuration = curationQueue.then(async () => {
            const partial = await RecommendationEngine.curate(candidatePool, {
              context: recommendationContext,
              limit: 48,
            });
            const partialResults = this.groupRelatedResults(partial)
              .map(({ recommendation, ...image }) => {
                void recommendation;
                return image;
              })
              .filter(image => !emittedCuratedIds.has(image.id));

            partialResults.forEach(image => emittedCuratedIds.add(image.id));
            if (partialResults.length > 0) onChunk(partialResults);
          });
          curationQueue = currentCuration.catch(() => undefined);
          await currentCuration;
        }

        return prioritized;
      }),
    }));

    const resultsArray = await this.resolveProviderRequests(streamedRequests);
    candidatePool.splice(0, candidatePool.length, ...resultsArray.flat());
    const curated = await RecommendationEngine.curate(candidatePool, {
      context: recommendationContext,
      // Keep the first batch useful without allowing one source or creator to
      // occupy the whole viewport. More candidates arrive on the next page.
      limit: 48,
    });
    const finalResults = this.groupRelatedResults(curated).map(({ recommendation, ...image }) => {
      void recommendation;
      return image;
    });
    if (onChunk) {
      const newFinalResults = finalResults.filter(image => !emittedCuratedIds.has(image.id));
      newFinalResults.forEach(image => emittedCuratedIds.add(image.id));
      if (newFinalResults.length > 0) onChunk(newFinalResults);
    }
    
    if (finalResults.length > 0) {
      return finalResults;
    }

    // Fallback if somehow everything fails (Only if not in Strict Mode)
    return recommendationContext.profile
      || recommendationContext.qualityMode === 'strict'
      || recommendationContext.qualityMode === 'themed'
      ? []
      : this.getLatest(page, onChunk);
  }

  async getDiscovery(page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const activeProviders = await this.getActiveProviders();
    if (activeProviders.length === 0) return [];

    const { globalMediaFilter } = useSettingsStore.getState();
    const isAnimatedFilter = globalMediaFilter === 'video' || globalMediaFilter === 'gif';

    const requests = activeProviders.map(p => {
      const fetchPromise = isAnimatedFilter
        ? this.prepareProviderQuery({ raw: '', positiveTags: [], negativeTags: [], predicates: {} }, p).then(query => p.search(query, page))
        : p.getDiscovery(page);

      return {
        providerId: p.id,
        request: fetchPromise
        .then(async res => {
          const filtered = this.filterAdult(this.filterMediaType(res));
          const blockFiltered = await this.filterBlocked(filtered);
          const prioritized = await this.filterExclusions(blockFiltered);
          console.info(`[SearchFederator] discover provider=${p.id} page=${page} raw=${res.length} adultVisible=${filtered.length} afterBlocked=${blockFiltered.length} ranked=${prioritized.length}`);
          return prioritized;
        }),
      };
    });

    const resultsArray = await this.resolveProviderRequests(requests, onChunk);
    const grouped = this.groupRelatedResults(resultsArray.flat());
    return onChunk ? grouped : this.groupRelatedResults(this.interleaveResults(resultsArray));
  }

  /**
   * Autocomplete tags across active providers.
   */
  async autocompleteTags(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const targetSourceMatch = query.match(/source:([a-zA-Z0-9_-]+)/);
    let activeProviders: ImageProvider[] = [];

    if (targetSourceMatch) {
      const targetSource = targetSourceMatch[1];
      const provider = this.providers.get(targetSource);
      if (provider) {
        const { useSettingsStore } = await import("../stores/useSettingsStore");
        if (useSettingsStore.getState().isSourceEnabled(provider.id)) {
          activeProviders.push(provider);
        }
      }
    } else {
      activeProviders = await this.getActiveProviders();
    }

    if (activeProviders.length === 0) return [];

    // Extract the last word being typed as the query
    const terms = query.split(/[ ,+]+/);
    const lastTerm = terms[terms.length - 1];
    if (!lastTerm || lastTerm.includes(':')) return [];

    const promises = activeProviders.map(p => 
      (p.autocompleteTags ? p.autocompleteTags(lastTerm) : Promise.resolve([]))
        .catch((e: unknown) => {
          console.warn(`[SearchFederator] Autocomplete failed for ${p.id}:`, e);
          return [] as string[];
        })
    );

    const resultsArray = await Promise.all(promises);
    const allTags = resultsArray.flat().filter(tag => (
      useSettingsStore.getState().showAdultContent || !ContentFilter.isAdultTag(tag)
    ));
    
    // Deduplicate and return top 10
    return [...new Set(allTags)].slice(0, 10);
  }

  /**
   * Interleaves results from multiple providers so the feed feels heterogeneous.
   * (e.g., [Danbooru1, Gelbooru1, Danbooru2, Gelbooru2, ...])
   */
  private interleaveResults(resultsArray: PlatformImage[][]): PlatformImage[] {
    const interleaved: PlatformImage[] = [];
    const maxLen = Math.max(...resultsArray.map(arr => arr.length));

    for (let i = 0; i < maxLen; i++) {
      for (const arr of resultsArray) {
        if (i < arr.length) {
          interleaved.push(arr[i]);
        }
      }
    }

    return interleaved;
  }

  /** Keep parent, pool, and book members adjacent in the legacy image feed. */
  private groupRelatedResults(items: PlatformImage[]): PlatformImage[] {
    const groups = new Map<string, PlatformImage[]>();
    for (const item of items) {
      if (!item.relatedGroupId) continue;
      const group = groups.get(item.relatedGroupId) || [];
      group.push(item);
      groups.set(item.relatedGroupId, group);
    }

    for (const group of groups.values()) {
      group.sort((a, b) => (a.relatedIndex ?? Number.MAX_SAFE_INTEGER) - (b.relatedIndex ?? Number.MAX_SAFE_INTEGER));
    }

    const emitted = new Set<string>();
    const output: PlatformImage[] = [];
    for (const item of items) {
      if (emitted.has(item.id)) continue;
      const group = item.relatedGroupId ? groups.get(item.relatedGroupId) : undefined;
      for (const member of group || [item]) {
        if (!emitted.has(member.id)) {
          output.push(member);
          emitted.add(member.id);
        }
      }
    }
    return output;
  }
}

import { DanbooruProvider } from "./providers/DanbooruProvider";
// import { GelbooruProvider } from "./providers/GelbooruProvider"; // DISABLED — not ready
import { Rule34Provider } from "./providers/Rule34Provider";
import { SankakuProvider } from "./providers/SankakuProvider";
import { NekosProvider } from "./providers/NekosProvider";
import { KonachanProvider } from "./providers/KonachanProvider";
import { ZerochanProvider } from "./providers/ZerochanProvider";
import { EHentaiProvider } from "./providers/EHentaiProvider";

// Singleton instance for easy application-wide access
export const federator = new SearchFederator();
federator.registerProvider(new DanbooruProvider());
// federator.registerProvider(new GelbooruProvider()); // DISABLED — not ready
federator.registerProvider(new Rule34Provider());
federator.registerProvider(new SankakuProvider());
federator.registerProvider(new NekosProvider());
federator.registerProvider(new KonachanProvider());
federator.registerProvider(new ZerochanProvider());
federator.registerProvider(new EHentaiProvider());
