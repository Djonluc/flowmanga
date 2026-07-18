import { BaseProvider } from './BaseProvider';
import type { PlatformImage, SearchQuery } from '../types';
import { useSettingsStore } from '../../stores/useSettingsStore';
import {
  getSankakuRequestHeaders,
  getSankakuPublicRequestHeaders,
  hasSankakuAuth,
  getSankakuGroupInfo,
  getSankakuMediaType,
  getSankakuMediaStatus,
  getSankakuSourceUrl,
  mapSankakuRating,
  mapSankakuTags,
  isSankakuApprovedPost,
  isSankakuAuthenticationRejected,
  isSankakuCoolingDown,
  isSankakuRateLimited,
  isSankakuRequestRejected,
  normalizeSankakuSearchTag,
  normalizeSankakuTag,
  parseSankakuTypedTag,
  parseSankakuCreatedAt,
  SANKAKU_LOGIN_URL,
  sankakuApiUrls,
  sankakuKeysetApiUrls,
  noteSankakuRateLimit,
  runSankakuRequest,
  unwrapSankakuPosts,
  type SankakuKeysetResponse,
  type SankakuPost,
} from '../../services/Sankaku';

export class SankakuProvider extends BaseProvider {
  id = 'sankaku';
  name = 'Sankaku Complex';

  capabilities = {
    maxTags: 10,
    supportsNegative: true,
    supportsScore: true,
    authentication: true,
    requiresCookies: true,
    authUrl: SANKAKU_LOGIN_URL,
    status: 'working',
    search: true,
    tagSearch: true,
  };
  domains = ['sankakucomplex.com'];
  private readonly keysetCursors = new Map<string, string | null>();
  private readonly keysetCache = new Map<string, { expiresAt: number; posts: SankakuPost[] }>();
  private readonly keysetRequests = new Map<string, Promise<SankakuPost[] | null>>();
  private readonly autocompleteCache = new Map<string, { expiresAt: number; tags: string[] }>();

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async requestJson<T>(url: string): Promise<T> {
    const authenticatedHeaders = getSankakuRequestHeaders();
    try {
      return await runSankakuRequest(() => this.fetchJson<T>(url, authenticatedHeaders, {
        retries: 1,
        timeoutMs: 12000,
        headlessFallback: false,
        transport: 'rust',
      }));
    } catch (error) {
      noteSankakuRateLimit(error);
      // An old access token poisons endpoints which are otherwise available to
      // anonymous users. Retry without credentials before declaring the source
      // unavailable; never print cookies or bearer tokens to the console.
      if (hasSankakuAuth(authenticatedHeaders) && isSankakuAuthenticationRejected(error)) {
        console.warn(`[SankakuProvider] Saved session was rejected for ${new URL(url).pathname}; retrying the public feed. (${this.describeError(error)})`);
        return runSankakuRequest(() => this.fetchJson<T>(url, getSankakuPublicRequestHeaders(), {
          retries: 1,
          timeoutMs: 12000,
          headlessFallback: false,
          transport: 'rust',
        }));
      }
      throw error;
    }
  }

  private async fetchSankakuJson<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    let lastError: unknown;

    for (const endpoint of sankakuApiUrls(path)) {
      const url = new URL(endpoint);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
      try {
        return await this.requestJson<T>(url.toString());
      } catch (error) {
        lastError = error;
        noteSankakuRateLimit(error);
        if (isSankakuRateLimited(error)) throw error;
        console.warn(`[SankakuProvider] ${new URL(endpoint).host}${new URL(endpoint).pathname} failed; trying fallback. (${this.describeError(error)})`);
      }
    }

    throw lastError || new Error('Sankaku request failed');
  }

  private buildTags(query: SearchQuery): string[] {
    const predicateTags = ['rating', 'order', 'sort', 'score']
      .map(key => query.predicates[key] ? `${key}:${query.predicates[key]}` : '')
      .filter(Boolean);
    const positiveTags = query.positiveTags
      .map(normalizeSankakuSearchTag)
      .filter(tag => tag && tag !== '_sort:new_');
    const negativeTags = query.negativeTags.map(tag => `-${normalizeSankakuSearchTag(tag)}`);
    const tags = [...predicateTags, ...positiveTags];
    // Safe mode is sent through `filter_content=true` below. Adding a
    // rating:safe tag would unnecessarily consume the anonymous one-tag limit.
    // Non-premium Sankaku rejects complex searches with
    // snackbar__insufficient_privileges. Prioritize positive/rating terms and
    // enforce overflow exclusions locally after mapping the response.
    const allowance = this.capabilities.maxTags;
    const apiTags = Array.from(new Set(tags)).slice(0, allowance);
    // Negative terms are privilege-sensitive even when the documented
    // anonymous positive-tag allowance has not been reached. Keep every
    // exclusion local so public searches remain accepted.
    const omitted = positiveTags.length + negativeTags.length + predicateTags.length - apiTags.length;
    if (omitted > 0) {
      console.debug(`[SankakuProvider] Kept ${apiTags.length} API terms and moved ${omitted} overflow terms to local filtering.`);
    }
    return apiTags;
  }

  private async fetchKeysetPosts(tags: string[], page: number): Promise<SankakuPost[] | null> {
    const key = tags.join(' ');
    const cursorKey = `${key}:${Math.max(1, page)}`;
    const cached = this.keysetCache.get(cursorKey);
    if (cached && (cached.expiresAt > Date.now() || isSankakuCoolingDown())) return cached.posts;

    const inFlight = this.keysetRequests.get(cursorKey);
    if (inFlight) return inFlight;

    const request = this.fetchKeysetPostsUncached(key, page, cursorKey);
    this.keysetRequests.set(cursorKey, request);
    try {
      const posts = await request;
      if (posts) {
        // Page one of Latest is a live feed. Cursor pages and searches remain
        // cached to prevent duplicate requests while a grid is rendering.
        const livePageOne = page === 1 && /(^|\s)order:(?:recent|random)(?:\s|$)/i.test(key);
        const cacheMs = livePageOne ? 0 : 60_000;
        this.keysetCache.set(cursorKey, { posts, expiresAt: Date.now() + cacheMs });
      }
      return posts;
    } finally {
      this.keysetRequests.delete(cursorKey);
    }
  }

  private async fetchKeysetPostsUncached(key: string, page: number, cursorKey: string): Promise<SankakuPost[] | null> {
    const next = page > 1 ? this.keysetCursors.get(`${key}:${page - 1}`) : undefined;
    if (page > 1 && !next) return null;

    for (const endpoint of sankakuKeysetApiUrls('/v2/posts/keyset')) {
      const url = new URL(endpoint);
      url.searchParams.set('tags', key);
      url.searchParams.set('limit', '40');
      url.searchParams.set('page', String(Math.max(1, page)));
      url.searchParams.set('lang', 'en');
      url.searchParams.set('default_threshold', '1');
      url.searchParams.set('hide_posts_in_books', 'in-larger-tags');
      if (!useSettingsStore.getState().showAdultContent) url.searchParams.set('filter_content', 'true');
      if (next) url.searchParams.set('next', next);

      try {
        console.info(`[SankakuProvider] keyset request page=${page} host=${url.host} tags=${key || '(none)'} cursor=${next ? 'present' : 'none'}`);
        const response = await this.requestJson<SankakuKeysetResponse>(url.toString());
        const posts = Array.isArray(response?.data) ? response.data : [];
        this.keysetCursors.set(cursorKey, response?.meta?.next || null);
        const first = posts[0];
        const last = posts.at(-1);
        console.info(`[SankakuProvider] keyset response page=${page} posts=${posts.length} next=${response?.meta?.next ? 'present' : 'none'} first=${first?.id ?? 'none'}@${parseSankakuCreatedAt(first?.created_at) ?? 'unknown'} last=${last?.id ?? 'none'}@${parseSankakuCreatedAt(last?.created_at) ?? 'unknown'}`);
        return posts;
      } catch (error) {
        noteSankakuRateLimit(error);
        if (isSankakuRateLimited(error)) throw error;
        console.warn(`[SankakuProvider] Keyset host ${new URL(endpoint).host} failed; trying fallback. (${this.describeError(error)})`);
      }
    }

    return null;
  }

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    return this.searchInternal(query, page);
  }

  private async searchInternal(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    if (query.predicates.source && query.predicates.source !== this.id) return [];

    const tags = this.buildTags(query);
    const isLatest = query.positiveTags.includes('_sort:new_');
    if (isLatest) tags.push('order:recent');

    console.info(`[SankakuProvider] search page=${Math.max(1, page)} mode=${isLatest ? 'latest' : 'search'} tags=${tags.join(' ') || '(none)'}`);

    try {
      const keysetPosts = await this.fetchKeysetPosts(tags, Math.max(1, page));
      if (keysetPosts) return this.filterQueryTags(this.filterTypedTags(this.mapPosts(keysetPosts), query), query);

      const response = await this.fetchSankakuJson<unknown>('/v2/posts', {
        tags: tags.join(' '),
        limit: 40,
        page: Math.max(1, page),
        lang: 'en',
        ...(useSettingsStore.getState().showAdultContent ? {} : { filter_content: 'true' }),
      });
      return this.filterQueryTags(this.filterTypedTags(this.mapPosts(unwrapSankakuPosts(response)), query), query);
    } catch (error) {
      if (isSankakuRateLimited(error)) {
        console.info(`[${this.name}] Request deferred until Sankaku's rate limit resets.`);
        return [];
      }
      if (isSankakuRequestRejected(error)) {
        console.warn(`[${this.name}] Request rejected after authenticated/public and host fallbacks. page=${page} tags=${tags.join(' ') || '(none)'} error=${this.describeError(error)}`);
      } else {
        console.warn(`[${this.name}] Search failed:`, error);
      }
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    return this.search({
      raw: 'order:random',
      positiveTags: ['order:random'],
      negativeTags: [],
      predicates: {},
    }, page);
  }

  async getById(id: string): Promise<PlatformImage | null> {
    try {
      // The per-post endpoint carries richer media fields than the list API,
      // including playable files for sessions allowed to view them.
      const response = await this.fetchSankakuJson<unknown>(`/posts/${encodeURIComponent(id)}`);
      const post = unwrapSankakuPosts(response)[0] || (response as SankakuPost);
      return post?.id !== undefined ? this.mapPost(post) : null;
    } catch (error) {
      console.warn(`[SankakuProvider] Direct post lookup failed for ${id}; trying list lookup. (${this.describeError(error)})`);
      try {
        const response = await this.fetchSankakuJson<unknown>('/v2/posts', {
          tags: `id_range:${id}`,
          limit: 1,
          lang: 'en',
        });
        const post = unwrapSankakuPosts(response)[0] || (response as SankakuPost);
        return post?.id !== undefined ? this.mapPost(post) : null;
      } catch (fallbackError) {
        console.warn('[SankakuProvider] getById failed:', fallbackError);
        return null;
      }
    }
  }

  async getLatest(page: number): Promise<PlatformImage[]> {
    return this.search({
      raw: '_sort:new_',
      positiveTags: ['_sort:new_'],
      negativeTags: [],
      predicates: {},
    }, page);
  }

  async autocompleteTags(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];
    const cacheKey = `${useSettingsStore.getState().showAdultContent ? 'all' : 'safe'}:${query.toLowerCase()}`;
    const cached = this.autocompleteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.tags;

    try {
      const response = await this.fetchSankakuJson<unknown>('/tags/autosuggest', {
        limit: 20,
        tag: query,
        rating: useSettingsStore.getState().showAdultContent ? '' : 's',
      });
      let tags = Array.isArray(response) && Array.isArray(response[1])
        ? response[1].filter((tag): tag is string => typeof tag === 'string')
        : Array.isArray(response) && Array.isArray((response[1] as { value?: unknown })?.value)
          ? (response[1] as { value: unknown[] }).value.filter((tag): tag is string => typeof tag === 'string')
        : Array.isArray(response)
          ? response
            .map(tag => typeof tag === 'string' ? tag : (tag as { name?: string; name_en?: string })?.name_en || (tag as { name?: string })?.name || '')
            .filter(Boolean)
          : [];

      if (tags.length === 0) {
        const fallback = await this.fetchSankakuJson<unknown>('/tags/autosuggestCreating', {
          tag: query,
          show_meta: 0,
          target: 'post',
        });
        tags = Array.isArray(fallback)
          ? fallback.map(tag => (tag as { tagName?: string; name?: string; name_en?: string })?.tagName || (tag as { name?: string })?.name || (tag as { name_en?: string })?.name_en || '').filter(Boolean)
          : [];
      }

      const normalized = Array.from(new Set(tags.map(tag => String(tag).trim().replace(/\s+/g, '_')).filter(Boolean))).slice(0, 20);
      this.autocompleteCache.set(cacheKey, { tags: normalized, expiresAt: Date.now() + 5 * 60_000 });
      return normalized;
    } catch (error) {
      console.warn('[SankakuProvider] Autocomplete failed:', error);
      return [];
    }
  }

  private mapPosts(posts: SankakuPost[]): PlatformImage[] {
    const approved = posts.filter(post => post.id !== undefined && isSankakuApprovedPost(post));
    const playable = approved.filter(post => {
      if (getSankakuMediaType(post) !== 'video') {
        return Boolean(post.file_url || post.sample_url || post.preview_url || post.gif_preview_url);
      }
      return Boolean([post.video_url, post.stream_url, post.file_url, post.sample_url]
        .some(url => /\.(mp4|webm)(?:\?|$)/i.test(url || '')));
    });
    const skipped = approved.length - playable.length;
    if (skipped > 0) {
      const loginRequired = approved.filter(post => post.redirect_to_signup).length;
      console.info(`[SankakuProvider] skipped ${skipped}/${approved.length} posts without usable media URLs${loginRequired ? `; loginRequired=${loginRequired}` : ''}`);
    }
    return playable
      .map(post => this.mapPost(post));
  }

  private filterTypedTags(images: PlatformImage[], query: SearchQuery): PlatformImage[] {
    const positive = query.positiveTags.map(parseSankakuTypedTag).filter((tag): tag is NonNullable<ReturnType<typeof parseSankakuTypedTag>> => Boolean(tag));
    const negative = query.negativeTags.map(parseSankakuTypedTag).filter((tag): tag is NonNullable<ReturnType<typeof parseSankakuTypedTag>> => Boolean(tag));
    if (positive.length === 0 && negative.length === 0) return images;

    const getValues = (image: PlatformImage, category: NonNullable<ReturnType<typeof parseSankakuTypedTag>>['category']): string[] => {
      if (category === 'artist') return image.artistTags || [];
      if (category === 'character') return image.characterTags || [];
      if (category === 'copyright') return image.copyrightTags || [];
      return image.metaTags || [];
    };

    return images.filter(image => {
      const matches = (tag: NonNullable<ReturnType<typeof parseSankakuTypedTag>>) => getValues(image, tag.category)
        .some(value => normalizeSankakuTag(value) === tag.tag);
      return positive.every(matches) && negative.every(tag => !matches(tag));
    });
  }

  private filterQueryTags(images: PlatformImage[], query: SearchQuery): PlatformImage[] {
    const normalize = (tag: string) => normalizeSankakuSearchTag(tag).toLowerCase();
    const negative = query.negativeTags
      .filter(tag => !parseSankakuTypedTag(tag))
      .map(normalize);
    if (negative.length === 0) return images;

    return images.filter(image => {
      const tags = new Set((image.tags || []).map(tag => normalizeSankakuTag(tag).toLowerCase()));
      // Positive terms were matched by Sankaku itself. Rechecking them here
      // can incorrectly discard valid posts when anonymous payloads contain a
      // reduced tag list. Local filtering is only needed for exclusions that
      // were intentionally omitted from the API request.
      return negative.every(tag => !tags.has(tag));
    });
  }

  private mapPost(post: SankakuPost): PlatformImage {
    const tags = mapSankakuTags(post.tags, post.tag_names);
    const playableUrl = post.video_url || post.stream_url || post.file_url;
    const previewUrl = post.gif_preview_url || post.preview_url || post.sample_url || playableUrl || '';
    const sampleUrl = playableUrl || post.sample_url || previewUrl;
    const fullUrl = playableUrl || sampleUrl;
    const width = post.width || post.sample_width || post.preview_width || 0;
    const height = post.height || post.sample_height || post.preview_height || 0;
    const group = getSankakuGroupInfo(post);

    return {
      id: `${this.id}-${post.id}`,
      sourceId: String(post.id),
      providerId: this.id,
      thumbnailUrl: sampleUrl,
      previewUrl,
      sampleUrl,
      fullUrl,
      mediaStatus: getSankakuMediaStatus(post),
      width,
      height,
      aspectRatio: width > 0 && height > 0 ? width / height : 1,
      tags: tags.all,
      artistTags: tags.artist,
      characterTags: tags.character,
      copyrightTags: tags.copyright,
      generalTags: tags.general,
      metaTags: tags.meta,
      rating: mapSankakuRating(post.rating),
      score: post.total_score ?? post.score ?? 0,
      sourceUrl: getSankakuSourceUrl(String(post.id)),
      createdAt: parseSankakuCreatedAt(post.created_at) || Date.now(),
      mediaType: getSankakuMediaType(post),
      relatedGroupId: group.relatedGroupId,
      relatedIndex: group.relatedIndex,
      parentId: group.parentId,
      poolIds: group.poolIds,
      bookIds: group.bookIds,
      sequence: group.relatedIndex,
      isPremium: post.is_premium,
      redirectToSignup: post.redirect_to_signup,
      hasChildren: post.has_children,
      fileType: post.file_type,
      fileSize: post.file_size,
      videoDuration: post.video_duration,
      source: post.source,
      author: typeof post.author === 'string' ? post.author : post.author?.name,
      isLocal: false,
    };
  }
}
