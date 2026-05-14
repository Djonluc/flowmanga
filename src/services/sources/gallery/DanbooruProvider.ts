import { invoke } from "@tauri-apps/api/core";
import type { 
  ContentType, 
  MediaType, 
  ReaderMode, 
  SourceCapabilities, 
  SourceProvider, 
  SourceSearchResult,
  SourceSearchOptions
} from '../types';

/**
 * Danbooru API Provider
 * Robust implementation for Danbooru.donmai.us
 */
export class DanbooruProvider implements SourceProvider {
  readonly id = "danbooru";
  readonly name = "Danbooru";
  readonly domains = ["danbooru.donmai.us", "cdn.donmai.us"];
  readonly contentType: ContentType = "gallery";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "discovery" as const;
  readonly readerModes: ReaderMode[] = ["gallery", "slideshow", "single"];

  readonly capabilities: SourceCapabilities = {
    search: true,
    tagSearch: true,
    random: true,
    trending: true,
    autocomplete: true
  };

  private readonly baseUrl = "https://danbooru.donmai.us";

  private async danbooruGet(endpoint: string, params: Record<string, any> = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (!endpoint.endsWith('.json')) {
      url.pathname = `${url.pathname}.json`;
    }

    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
    });

    const urlStr = url.toString();

    try {
      const response: any = await invoke("fetch_json", {
        url: urlStr,
        method: "GET",
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FlowManga/2.2.0 (djonstnix; https://github.com/djonstnix/flowmanga)'
        }
      });

      return response || [];
    } catch (e) {
      console.error(`[DanbooruProvider] API Error for ${urlStr}:`, e);
      return [];
    }
  }

  async search(query: string, options: SourceSearchOptions = {}): Promise<SourceSearchResult[]> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 200);

    let tags = query;
    if (options.contentFilter === 'sfw') {
      tags = `${tags} rating:s`.trim();
    }

    const data = await this.danbooruGet("/posts.json", {
      tags,
      page,
      limit
    });

    return this.mapResults(data);
  }

  async getLatest(options: SourceSearchOptions = {}): Promise<SourceSearchResult[]> {
    return this.search("", options);
  }

  async getTrending(options: SourceSearchOptions = {}): Promise<SourceSearchResult[]> {
    const data = await this.danbooruGet("/explore/posts/popular.json", {
      limit: options.limit || 20,
      scale: 'day'
    });
    return this.mapResults(data);
  }

  async getRandom(options: SourceSearchOptions = {}): Promise<SourceSearchResult[]> {
    const data = await this.danbooruGet("/posts/random.json", {
      tags: options.contentFilter === 'sfw' ? 'rating:s' : ''
    });
    const results = Array.isArray(data) ? data : [data];
    return this.mapResults(results);
  }

  async getAutocomplete(query: string): Promise<string[]> {
    const data = await this.danbooruGet("/tags/autocomplete.json", {
      "search[name_matches]": `*${query}*`,
      limit: 10
    });
    if (!Array.isArray(data)) return [];
    return data.map((t: any) => t.name);
  }

  async getRelatedTags(tag: string): Promise<string[]> {
    const data = await this.danbooruGet("/related_tag.json", {
      query: tag
    });
    if (data && data.tags) {
      return data.tags.map((t: any) => t[0]);
    }
    return [];
  }

  private mapResults(data: any): SourceSearchResult[] {
    const items = Array.isArray(data) ? data : [];
    return items
      .filter(item => item && (item.file_url || item.large_file_url))
      .map(item => {
        const fullUrl = item.large_file_url || item.file_url;
        // Prefer native high-res format over optimized previews if available
        const safeFullUrl = fullUrl.match(/\.(avif|webp)$/i) ? (item.file_url || fullUrl) : fullUrl;


        return {
          id: `danbooru-${item.id}`,
          title: item.tag_string ? item.tag_string.split(' ').slice(0, 3).join(' ') : 'Untitled',
          coverUrl: item.preview_file_url || item.large_file_url || item.file_url,
          previewUrl: item.preview_file_url || item.large_file_url || item.file_url,
          imageUrl: safeFullUrl,
          tags: item.tag_string ? item.tag_string.split(' ') : [],
          source: "danbooru",
          contentType: "gallery" as ContentType,
          url: `${this.baseUrl}/posts/${item.id}`,
          rating: item.rating === 's' ? 'safe' : (item.rating === 'q' ? 'questionable' : 'explicit'),
          dominantColor: '#7c3aed'
        };
      });
  }
}
