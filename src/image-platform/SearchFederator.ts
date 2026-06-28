import type { ImageProvider, PlatformImage, SearchQuery } from "./types";
import { useSettingsStore } from "../stores/useSettingsStore";

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
      const blockedTags = useGalleryStore.getState().blockedTags.map((t: string) => t.toLowerCase().trim());
      
      if (blockedTags.length === 0) return images;

      return images.filter(img => {
        const imgTags = (img.tags || []).map(t => t.toLowerCase().trim());
        const hasBlockedTag = imgTags.some(t => blockedTags.some(b => t.includes(b)));
        return !hasBlockedTag;
      });
    } catch (e) {
      console.warn("[SearchFederator] Failed to filter blocked tags", e);
      return images; 
    }
  }

  /** Deprioritizes images that have already been seen and strictly excludes saved images. */
  private async filterExclusions(images: PlatformImage[]): Promise<PlatformImage[]> {
    if (images.length === 0) return [];
    try {
      const { getDb } = await import("../services/db");
      const db = getDb();
      const ids = images.map(img => img.id);
      const placeholders = ids.map(() => '?').join(',');
      
      // 1. Strictly exclude saved images
      const savedRows = await db.select<{id: string}>(`SELECT id FROM FlowSavedImages WHERE id IN (${placeholders})`, ids);
      const savedSet = new Set(savedRows.map(r => r.id));
      
      const notSavedImages = images.filter(img => !savedSet.has(img.id));
      if (notSavedImages.length === 0) return [];
      
      // 2. Strictly exclude images seen in the last 24 hours
      const notSavedIds = notSavedImages.map(img => img.id);
      const nsPlaceholders = notSavedIds.map(() => '?').join(',');
      const seenRows = await db.select<{id: string}>(`
        SELECT id FROM FlowSeenImages 
        WHERE id IN (${nsPlaceholders})
        AND seenAt >= datetime('now', '-1 day')
      `, notSavedIds);
      const seenSet = new Set(seenRows.map(r => r.id));

      const unseen = notSavedImages.filter(img => !seenSet.has(img.id));
      
      return unseen;
    } catch (e) {
      console.warn("[SearchFederator] Failed to filter exclusions", e);
      return images;
    }
  }

  async getActiveProviders(): Promise<ImageProvider[]> {
    const { useSettingsStore } = await import("../stores/useSettingsStore");
    const { isSourceEnabled } = useSettingsStore.getState();
    return this.getProviders().filter(p => isSourceEnabled(p.id));
  }

  async getById(providerId: string, sourceId: string): Promise<PlatformImage | null> {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.getById) return null;
    return provider.getById(sourceId);
  }

  /** Injects media type filters if the user wants exclusively videos or gifs */
  private getMediaFilterQuery(baseQuery?: SearchQuery): SearchQuery {
    const query = baseQuery || { raw: "", positiveTags: [], negativeTags: [], predicates: {} };
    const { globalMediaFilter } = useSettingsStore.getState();
    if (globalMediaFilter === 'all' || globalMediaFilter === 'image') return query;

    const newTags = [...query.positiveTags, "animated"];
    return {
      ...query,
      positiveTags: Array.from(new Set(newTags)),
      raw: query.raw ? `${query.raw} animated` : "animated"
    };
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

    const finalQuery = this.getMediaFilterQuery(query);

    // Fetch from all active providers concurrently
    const promises = activeProviders.map(p => 
      p.search(finalQuery, page)
        .then(async res => {
          const filtered = this.filterAdult(res);
          const blockFiltered = await this.filterBlocked(filtered);
          const prioritized = await this.filterExclusions(blockFiltered);
          if (onChunk && prioritized.length > 0) onChunk(prioritized);
          return prioritized;
        })
        .catch((e: any) => {
          console.warn(`[SearchFederator] Provider ${p.id} timed out or failed gracefully: ${e.message}`);
          return []; // Fail gracefully for individual providers
        })
    );

    const resultsArray = await Promise.all(promises);
    return onChunk ? resultsArray.flat() : this.interleaveResults(resultsArray);
  }

  async getLatest(page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const activeProviders = await this.getActiveProviders();
    if (activeProviders.length === 0) return [];
    
    const { globalMediaFilter } = useSettingsStore.getState();
    const isAnimatedFilter = globalMediaFilter === 'video' || globalMediaFilter === 'gif';

    const promises = activeProviders.map(p => {
      const fetchPromise = isAnimatedFilter 
        ? p.search(this.getMediaFilterQuery(), page)
        : p.getLatest(page);

      return fetchPromise
        .then(async res => {
          const filtered = this.filterAdult(res);
          const blockFiltered = await this.filterBlocked(filtered);
          if (onChunk && blockFiltered.length > 0) onChunk(blockFiltered);
          return blockFiltered;
        })
        .catch((e: any) => {
          console.warn(`[SearchFederator] Latest provider ${p.id} timed out or failed gracefully: ${e.message}`);
          return [];
        })
    });

    const resultsArray = await Promise.all(promises);
    return onChunk ? resultsArray.flat() : this.interleaveResults(resultsArray);
  }

  async getCurated(page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const activeProviders = await this.getActiveProviders();
    if (activeProviders.length === 0) return [];

    let discoveryTags: string[] = [];
    let blockedTags: string[] = [];
    try {
      const { getDb } = await import("../services/db");
      const db = getDb();
      const { useSettingsStore } = await import("../stores/useSettingsStore");
      const mode = useSettingsStore.getState().recommendationMode;

      // Pull implicit interests (tags the engine thinks you like based on viewing habits)
      const interests = await db.select<{name: string}>(`
        SELECT name FROM UserInterests 
        ORDER BY isPinned DESC, score DESC, RANDOM() 
        LIMIT 20
      `);
      
      // Pull explicit favorites (tags you've explicitly starred)
      const favs = await db.select<{tag: string}>(`
        SELECT tag FROM FavoriteTags 
        ORDER BY RANDOM() 
        LIMIT 20
      `);

      let combinedTags: string[] = [];
      if (mode === 'strict_favorites') {
        combinedTags = favs.map(f => f.tag);
      } else if (mode === 'strict_interests') {
        combinedTags = interests.map(i => i.name);
      } else {
        // dynamic
        combinedTags = Array.from(new Set([
          ...favs.map(f => f.tag),
          ...interests.map(i => i.name)
        ]));
      }
      
      // Shuffle and pick up to 4 tags to search concurrently
      discoveryTags = combinedTags
        .sort(() => 0.5 - Math.random())
        .slice(0, 4);

      const fallbacks = [
        "genshin_impact", "honkai_star_rail", "original", "anime", "landscape", 
        "scenery", "cyberpunk", "fantasy", "digital_art", "illustration", 
        "vocaloid", "hatsune_miku", "sky", "clouds", "nature", "night", 
        "stars", "retro", "pixel_art", "sketch", "monochrome", "street", 
        "city", "water", "sea", "ocean", "sunlight", "sunset", "gothic", 
        "steampunk", "cybernetic", "mecha", "space", "underwater", "concept_art"
      ];

      if (discoveryTags.length < 4) {
        const shuffledFallbacks = [...fallbacks].sort(() => 0.5 - Math.random());
        for (const tag of shuffledFallbacks) {
          if (discoveryTags.length >= 4) break;
          if (!discoveryTags.includes(tag)) {
            discoveryTags.push(tag);
          }
        }
      }
      const { useGalleryStore } = await import("../stores/useGalleryStore");
      blockedTags = useGalleryStore.getState().blockedTags;
    } catch (e) {
      console.warn("Failed to load interests for curation", e);
    }

    if (discoveryTags.length === 0) {
      return this.getLatest(page, onChunk);
    }

    // for each tag across all providers, then interleave the results.
    const allPromises: Promise<PlatformImage[]>[] = [];
    const { RecommendationEngine } = await import('./services/RecommendationEngine');
    const isStrict = useSettingsStore.getState().strictForYouMode;

    discoveryTags.forEach(tag => {
      activeProviders.forEach(p => {
        const query = this.getMediaFilterQuery({ raw: tag, positiveTags: [tag], negativeTags: blockedTags, predicates: {} });
        
        // Add random jitter to the page number so 'For You' feeds are always fresh on refresh
        const jitter = Math.floor(Math.random() * 10);
        const fetchPage = page + jitter;

        allPromises.push(
          p.search(query, fetchPage)
            .then(async res => {
              const filtered = this.filterAdult(res);
              const blockFiltered = await this.filterBlocked(filtered);
              const prioritized = await this.filterExclusions(blockFiltered);
              
              const scored = await RecommendationEngine.scoreAndFilter(prioritized, isStrict);
              const finalChunk = scored.map(s => {
                 const img = { ...s };
                 delete (img as any).recommendation;
                 return img;
              });

              if (onChunk && finalChunk.length > 0) onChunk(finalChunk);
              return finalChunk;
            })
            .catch((e: any) => {
              console.warn(`[SearchFederator] Curated provider ${p.id} timed out or failed gracefully: ${e.message}`);
              return [];
            })
        );
      });
    });

    const resultsArray = await Promise.all(allPromises);
    const finalResults = onChunk ? resultsArray.flat() : this.interleaveResults(resultsArray);
    
    if (finalResults.length > 0) {
      return finalResults;
    }

    // Fallback if somehow everything fails (Only if not in Strict Mode)
    return isStrict ? [] : this.getLatest(page, onChunk);
  }

  async getDiscovery(page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const activeProviders = await this.getActiveProviders();
    if (activeProviders.length === 0) return [];

    const { globalMediaFilter } = useSettingsStore.getState();
    const isAnimatedFilter = globalMediaFilter === 'video' || globalMediaFilter === 'gif';

    const promises = activeProviders.map(p => {
      const fetchPromise = isAnimatedFilter
        ? p.search(this.getMediaFilterQuery(), page)
        : p.getDiscovery(page);

      return fetchPromise
        .then(async res => {
          const filtered = this.filterAdult(res);
          const blockFiltered = await this.filterBlocked(filtered);
          const prioritized = await this.filterExclusions(blockFiltered);
          if (onChunk && prioritized.length > 0) onChunk(prioritized);
          return prioritized;
        })
        .catch(e => {
          console.warn(`[SearchFederator] Discovery provider ${p.id} timed out or failed gracefully:`, e);
          return [];
        })
    });

    const resultsArray = await Promise.all(promises);
    return onChunk ? resultsArray.flat() : this.interleaveResults(resultsArray);
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
      p.autocompleteTags(lastTerm)
        .catch((e: any) => {
          console.warn(`[SearchFederator] Autocomplete failed for ${p.id}:`, e);
          return [] as string[];
        })
    );

    const resultsArray = await Promise.all(promises);
    const allTags = resultsArray.flat();
    
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
}

import { DanbooruProvider } from "./providers/DanbooruProvider";
// import { GelbooruProvider } from "./providers/GelbooruProvider"; // DISABLED — not ready
import { Rule34Provider } from "./providers/Rule34Provider";
import { SankakuProvider } from "./providers/SankakuProvider";
import { NekosProvider } from "./providers/NekosProvider";
import { KonachanProvider } from "./providers/KonachanProvider";
import { ZerochanProvider } from "./providers/ZerochanProvider";

// Singleton instance for easy application-wide access
export const federator = new SearchFederator();
federator.registerProvider(new DanbooruProvider());
// federator.registerProvider(new GelbooruProvider()); // DISABLED — not ready
federator.registerProvider(new Rule34Provider());
federator.registerProvider(new SankakuProvider());
federator.registerProvider(new NekosProvider());
federator.registerProvider(new KonachanProvider());
federator.registerProvider(new ZerochanProvider());

