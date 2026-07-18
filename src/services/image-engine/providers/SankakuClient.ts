import { BaseProvider } from './BaseProvider';
import { TagParser } from '../parser/TagParser';
import type { ImageMedia, StructuredQuery, EngineSearchOptions, SourceCapabilities } from '../types';
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
  parseSankakuCreatedAtIso,
  SANKAKU_LOGIN_URL,
  sankakuApiUrls,
  sankakuKeysetApiUrls,
  noteSankakuRateLimit,
  runSankakuRequest,
  unwrapSankakuPosts,
  type SankakuKeysetResponse,
  type SankakuPost,
} from '../../../services/Sankaku';

export class SankakuClient extends BaseProvider {
  readonly id = 'sankaku';
  readonly name = 'Sankaku Complex';
  readonly baseUrl = 'https://chan.sankakucomplex.com';

  readonly capabilities: SourceCapabilities = {
    supportsNegativeTags: true,
    maxTagsPerRequest: 10,
    supportsSort: true,
    supportsScore: true,
    nativeRecommendations: true,
    status: 'auth_required',
    authentication: true,
    requiresCookies: true,
    authUrl: SANKAKU_LOGIN_URL,
  };
  private readonly keysetCursors = new Map<string, string | null>();
  private readonly keysetCache = new Map<string, { expiresAt: number; posts: SankakuPost[] }>();
  private readonly keysetRequests = new Map<string, Promise<SankakuPost[] | null>>();

  private async requestJson<T>(url: string, params: Record<string, string | number> = {}): Promise<T> {
    const headers = getSankakuRequestHeaders();
    try {
      return await runSankakuRequest(() => this.fetchJson<T>(url, params, headers, { retries: 1, timeoutMs: 12000, headlessFallback: false }));
    } catch (error) {
      noteSankakuRateLimit(error);
      if (hasSankakuAuth(headers) && isSankakuAuthenticationRejected(error)) {
        console.warn(`[SankakuClient] Saved session rejected for ${new URL(url).pathname}; retrying public feed.`);
        return runSankakuRequest(() => this.fetchJson<T>(url, params, getSankakuPublicRequestHeaders(), { retries: 1, timeoutMs: 12000, headlessFallback: false }));
      }
      throw error;
    }
  }

  private async fetchSankakuJson<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    let lastError: unknown;
    for (const endpoint of sankakuApiUrls(path)) {
      try {
        return await this.requestJson<T>(endpoint, params);
      } catch (error) {
        lastError = error;
        noteSankakuRateLimit(error);
        if (isSankakuRequestRejected(error) || isSankakuRateLimited(error)) throw error;
        console.warn(`[SankakuClient] Endpoint failed, trying fallback: ${endpoint}`);
      }
    }
    throw lastError || new Error('Sankaku request failed');
  }

  private async fetchKeysetPosts(tags: string, page: number): Promise<SankakuPost[] | null> {
    const normalizedPage = Math.max(1, page);
    const cursorKey = `${tags}:${normalizedPage}`;
    const cached = this.keysetCache.get(cursorKey);
    if (cached && (cached.expiresAt > Date.now() || isSankakuCoolingDown())) return cached.posts;

    const inFlight = this.keysetRequests.get(cursorKey);
    if (inFlight) return inFlight;

    const request = this.fetchKeysetPostsUncached(tags, normalizedPage, cursorKey);
    this.keysetRequests.set(cursorKey, request);
    try {
      const posts = await request;
      if (posts) {
        const cacheMs = /(^|\s)order:recent(?:\s|$)/i.test(tags) ? 15_000 : 60_000;
        this.keysetCache.set(cursorKey, { posts, expiresAt: Date.now() + cacheMs });
      }
      return posts;
    } finally {
      this.keysetRequests.delete(cursorKey);
    }
  }

  private async fetchKeysetPostsUncached(tags: string, normalizedPage: number, cursorKey: string): Promise<SankakuPost[] | null> {
    const next = normalizedPage > 1 ? this.keysetCursors.get(`${tags}:${normalizedPage - 1}`) : undefined;
    if (normalizedPage > 1 && !next) return null;

    for (const endpoint of sankakuKeysetApiUrls('/v2/posts/keyset')) {
      const url = new URL(endpoint);
      url.searchParams.set('tags', tags);
      url.searchParams.set('limit', '40');
      url.searchParams.set('page', String(normalizedPage));
      url.searchParams.set('lang', 'en');
      url.searchParams.set('default_threshold', '1');
      url.searchParams.set('hide_posts_in_books', 'in-larger-tags');
      if (/(^|\s)rating:safe(?:\s|$)/i.test(tags)) url.searchParams.set('filter_content', 'true');
      if (next) url.searchParams.set('next', next);

      try {
        const response = await this.requestJson<SankakuKeysetResponse>(url.toString());
        this.keysetCursors.set(cursorKey, response?.meta?.next || null);
        return Array.isArray(response?.data) ? response.data : [];
      } catch (error) {
        noteSankakuRateLimit(error);
        if (isSankakuRequestRejected(error) || isSankakuRateLimited(error)) throw error;
        console.warn(`[SankakuClient] Keyset endpoint failed, trying fallback: ${endpoint}`, error);
      }
    }

    return null;
  }

  async search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]> {
    return this.searchInternal(query, options);
  }

  private async searchInternal(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]> {
    const allowance = this.capabilities.maxTagsPerRequest;
    const apiTags: string[] = [];
    const localFilterNegativeTags: string[] = [];
    const localFilterPositiveTags: string[] = [];

    for (const tag of query.positiveTags) {
      if (apiTags.length < allowance) apiTags.push(normalizeSankakuSearchTag(tag));
      else localFilterPositiveTags.push(tag);
    }
    // Safe mode is carried by `filter_content=true`, leaving the anonymous
    // one-tag allowance available for the actual catalog term.
    localFilterNegativeTags.push(...query.negativeTags);

    const tagsQueryString = apiTags.map(TagParser.normalizeBooruTag).join(' ');
    const targetLimit = options.limit || 20;
    const hasLocalFilters = localFilterNegativeTags.length > 0 || localFilterPositiveTags.length > 0;
    const limit = hasLocalFilters ? 100 : Math.min(100, targetLimit);
    const requestedPage = Math.max(1, options.page || 1);
    const maxApiPages = hasLocalFilters ? 5 : 1;
    let currentApiPage = hasLocalFilters ? ((requestedPage - 1) * maxApiPages) + 1 : requestedPage;
    let accumulatedResults: ImageMedia[] = [];

    for (let attempt = 0; attempt < maxApiPages && accumulatedResults.length < targetLimit; attempt++) {
      try {
        const keysetPosts = await this.fetchKeysetPosts(tagsQueryString, currentApiPage);
        const data = keysetPosts || await this.fetchSankakuJson<unknown>('/v2/posts', {
          tags: tagsQueryString,
          page: currentApiPage,
          limit,
          lang: 'en',
          ...(options.ratingFilter === 'sfw' ? { filter_content: 'true' } : {}),
        });
        const posts = keysetPosts || unwrapSankakuPosts(data);
        if (posts.length === 0) break;

        let results = this.mapPosts(posts);
        if (hasLocalFilters) {
          results = results.filter(post => {
            const postTags = new Set(post.tags.map(TagParser.normalizeBooruTag));
            return localFilterPositiveTags.every(tag => postTags.has(TagParser.normalizeBooruTag(tag)))
              && localFilterNegativeTags.every(tag => !postTags.has(TagParser.normalizeBooruTag(tag)));
          });
        }

        accumulatedResults = [
          ...accumulatedResults,
          ...results.filter(result => !accumulatedResults.some(existing => existing.id === result.id)),
        ];
        currentApiPage += 1;
      } catch (error) {
        if (isSankakuRateLimited(error)) {
          console.info(`[SankakuClient] Request deferred until Sankaku's rate limit resets.`);
          break;
        }
        console.warn(`[SankakuClient] API fetch failed on page ${currentApiPage}:`, error);
        break;
      }
    }

    return accumulatedResults.slice(0, targetLimit);
  }

  async getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]> {
    return this.search({
      raw: 'order:random',
      positiveTags: ['order:random'],
      negativeTags: [],
      ratingFilter: options.ratingFilter,
    }, { ...options, limit: options.limit || 40 });
  }

  async getLatest(options: EngineSearchOptions): Promise<ImageMedia[]> {
    return this.search({
      raw: 'order:recent',
      positiveTags: ['order:recent'],
      negativeTags: [],
      ratingFilter: options.ratingFilter,
    }, options);
  }

  async getRecommendations(image: ImageMedia): Promise<ImageMedia[]> {
    const tags = [
      ...(image.characterTags || []),
      ...(image.artistTags || []),
      ...(image.copyrightTags || []),
      ...(image.generalTags || []),
    ].filter(Boolean).slice(0, 4);
    if (tags.length === 0) return [];

    const related = await this.search({
      raw: tags.join(' '),
      positiveTags: tags,
      negativeTags: [],
      ratingFilter: 'all',
    }, { limit: 24, page: 1, ratingFilter: 'all' });
    return related.filter(candidate => candidate.id !== image.id);
  }

  private mapPosts(posts: SankakuPost[]): ImageMedia[] {
    return posts
      .filter(post => post.id !== undefined && isSankakuApprovedPost(post))
      .map(post => {
        const preview = post.preview_url || post.sample_url || post.file_url || '';
        const sample = post.sample_url || post.file_url || preview;
        const full = post.file_url || sample;
        const tags = mapSankakuTags(post.tags, post.tag_names);
        const group = getSankakuGroupInfo(post);
        const width = post.width || post.sample_width || post.preview_width;
        const height = post.height || post.sample_height || post.preview_height;

        return {
          id: `${this.id}-${post.id}`,
          sourceId: String(post.id),
          providerId: this.id,
          title: `Sankaku ${post.id}`,
          thumbnailUrl: this.ensureAbsoluteUrl(sample),
          previewUrl: this.ensureAbsoluteUrl(preview),
          sampleUrl: this.ensureAbsoluteUrl(sample),
          fullUrl: this.ensureAbsoluteUrl(full),
          mediaStatus: getSankakuMediaStatus(post),
          width,
          height,
          tags: tags.all,
          generalTags: tags.general,
          characterTags: tags.character,
          artistTags: tags.artist,
          copyrightTags: tags.copyright,
          metaTags: tags.meta,
          rating: mapSankakuRating(post.rating),
          score: post.total_score ?? post.score ?? 0,
          createdAt: parseSankakuCreatedAtIso(post.created_at),
          mediaType: getSankakuMediaType(post),
          contentCategory: 'image',
          sourceUrl: getSankakuSourceUrl(String(post.id)),
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
        };
      });
  }
}
