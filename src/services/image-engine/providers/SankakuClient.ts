import { BaseProvider } from './BaseProvider';
import { TagParser } from '../parser/TagParser';
import type { ImageMedia, StructuredQuery, EngineSearchOptions, SourceCapabilities } from '../types';
import {
  getSankakuAuthHeaders,
  getSankakuGroupInfo,
  getSankakuMediaType,
  getSankakuMediaStatus,
  getSankakuSourceUrl,
  mapSankakuRating,
  mapSankakuTags,
  parseSankakuCreatedAtIso,
  SANKAKU_LOGIN_URL,
  sankakuApiUrls,
  unwrapSankakuPosts,
  type SankakuPost,
} from '../../../services/Sankaku';

export class SankakuClient extends BaseProvider {
  readonly id = 'sankaku';
  readonly name = 'Sankaku Complex';
  readonly baseUrl = 'https://chan.sankakucomplex.com';

  readonly capabilities: SourceCapabilities = {
    supportsNegativeTags: true,
    maxTagsPerRequest: 8,
    supportsSort: true,
    supportsScore: true,
    nativeRecommendations: true,
    status: 'auth_required',
    authentication: true,
    requiresCookies: true,
    authUrl: SANKAKU_LOGIN_URL,
  };

  private async fetchSankakuJson<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const headers = getSankakuAuthHeaders();
    let lastError: unknown;
    for (const endpoint of sankakuApiUrls(path)) {
      try {
        return await this.fetchJson<T>(endpoint, params, headers);
      } catch (error) {
        lastError = error;
        console.warn(`[SankakuClient] Endpoint failed, trying fallback: ${endpoint}`);
      }
    }
    throw lastError || new Error('Sankaku request failed');
  }

  async search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]> {
    const allowance = this.capabilities.maxTagsPerRequest;
    const apiTags: string[] = [];
    const localFilterNegativeTags: string[] = [];
    const localFilterPositiveTags: string[] = [];

    for (const tag of query.positiveTags) {
      if (apiTags.length < allowance) apiTags.push(tag);
      else localFilterPositiveTags.push(tag);
    }
    for (const tag of query.negativeTags) {
      if (apiTags.length < allowance) apiTags.push(`-${tag}`);
      else localFilterNegativeTags.push(tag);
    }

    if (options.ratingFilter === 'sfw' && !apiTags.some(tag => /^rating:/i.test(tag))) {
      apiTags.push('rating:safe');
    }

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
        const data = await this.fetchSankakuJson<unknown>('/posts', {
          tags: tagsQueryString,
          page: currentApiPage,
          limit,
          lang: 'en',
        });
        const posts = unwrapSankakuPosts(data);
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
      .filter(post => post.id !== undefined)
      .map(post => {
        const preview = post.preview_url || post.sample_url || post.file_url || '';
        const sample = post.sample_url || post.file_url || preview;
        const full = post.file_url || sample;
        const tags = mapSankakuTags(post.tags);
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
