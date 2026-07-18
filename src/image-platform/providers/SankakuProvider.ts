import { BaseProvider } from './BaseProvider';
import type { PlatformImage, SearchQuery } from '../types';
import { useSettingsStore } from '../../stores/useSettingsStore';
import {
  getSankakuAuthHeaders,
  getSankakuGroupInfo,
  getSankakuMediaType,
  getSankakuMediaStatus,
  getSankakuSourceUrl,
  mapSankakuRating,
  mapSankakuTags,
  parseSankakuCreatedAt,
  SANKAKU_LOGIN_URL,
  sankakuApiUrls,
  unwrapSankakuPosts,
  type SankakuPost,
} from '../../services/Sankaku';

export class SankakuProvider extends BaseProvider {
  id = 'sankaku';
  name = 'Sankaku Complex';

  capabilities = {
    maxTags: 4,
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

  private async fetchSankakuJson<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const headers = getSankakuAuthHeaders();
    let lastError: unknown;

    for (const endpoint of sankakuApiUrls(path)) {
      const url = new URL(endpoint);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
      try {
        return await this.fetchJson<T>(url.toString(), headers);
      } catch (error) {
        lastError = error;
        console.warn(`[SankakuProvider] Endpoint failed, trying fallback: ${endpoint}`);
      }
    }

    throw lastError || new Error('Sankaku request failed');
  }

  private buildTags(query: SearchQuery): string[] {
    const tags = [...query.positiveTags, ...query.negativeTags.map(tag => `-${tag}`)];
    if (!useSettingsStore.getState().showAdultContent && !tags.some(tag => /^rating:/i.test(tag))) {
      tags.push('rating:safe');
    }
    return tags.filter(tag => tag && tag !== '_sort:new_');
  }

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    if (query.predicates.source && query.predicates.source !== this.id) return [];

    const tags = this.buildTags(query);
    const isLatest = query.positiveTags.includes('_sort:new_');
    if (isLatest) tags.push('order:recent');

    try {
      const response = await this.fetchSankakuJson<unknown>('/posts', {
        tags: tags.join(' '),
        limit: 40,
        page: Math.max(1, page),
        lang: 'en',
      });
      return this.mapPosts(unwrapSankakuPosts(response));
    } catch (error) {
      console.warn(`[${this.name}] Search failed:`, error);
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
      const response = await this.fetchSankakuJson<unknown>(`/posts/${encodeURIComponent(id)}`);
      const post = unwrapSankakuPosts(response)[0] || (response as SankakuPost);
      return post?.id !== undefined ? this.mapPost(post) : null;
    } catch (error) {
      console.warn('[SankakuProvider] getById failed:', error);
      return null;
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

    try {
      const response = await this.fetchSankakuJson<unknown>('/tags', {
        limit: 20,
        name: `${query}*`,
        lang: 'en',
      });
      const tags = Array.isArray(response)
        ? response
        : (response && typeof response === 'object' && Array.isArray((response as { data?: unknown }).data)
          ? (response as { data: Array<{ name?: string; name_en?: string; type?: number }> }).data
          : []);

      return tags.map(tag => {
        const name = (tag.name_en || tag.name || '').trim().replace(/\s+/g, '_');
        if (tag.type === 1) return `artist:${name}`;
        if (tag.type === 3) return `series:${name}`;
        if (tag.type === 4) return `character:${name}`;
        return name;
      }).filter(Boolean);
    } catch (error) {
      console.warn('[SankakuProvider] Autocomplete failed:', error);
      return [];
    }
  }

  private mapPosts(posts: SankakuPost[]): PlatformImage[] {
    return posts
      .filter(post => post.id !== undefined)
      .map(post => this.mapPost(post));
  }

  private mapPost(post: SankakuPost): PlatformImage {
    const tags = mapSankakuTags(post.tags);
    const previewUrl = post.preview_url || post.sample_url || post.file_url || '';
    const sampleUrl = post.sample_url || post.file_url || previewUrl;
    const fullUrl = post.file_url || sampleUrl;
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
