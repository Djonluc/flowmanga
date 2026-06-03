import {
  booruGet,
  buildBooruTags,
  buildBooruTagsFromArray,
  mapBooruPosts,
} from "./BooruProviderBase";
import type {
  ContentType,
  MediaType,
  MediaDomain,
  ReaderMode,
  SourceCapabilities,
  SourceProvider,
  SourceSearchResult,
  SourceSearchOptions,
} from "../types";

/**
 * Sankaku Complex API Provider
 * Utilizes the Sankaku API for fetching content.
 */
export class SankakuProvider implements SourceProvider {
  readonly id = "sankaku";
  readonly name = "Sankaku Complex";
  readonly domains = ["sankakucomplex.com", "chan.sankakucomplex.com", "sankakuapi.com"];
  readonly contentType: ContentType = "gallery";
  readonly mediaDomain: MediaDomain = "image";
  readonly mediaTypes: MediaType[] = ["image", "gif", "video"];
  readonly defaultPersistence = "discovery" as const;
  readonly readerModes: ReaderMode[] = ["gallery", "slideshow", "single"];

  readonly capabilities: SourceCapabilities = {
    search: true,
    tagSearch: true,
    seriesBrowse: false,
    chapterFeed: false,
    pagination: true,
    authentication: true,
    authUrl: "https://chan.sankakucomplex.com/user/login",
  };

  private readonly baseUrl = "https://sankakuapi.com";
  
  // State for keyset pagination if 'page' is used sequentially
  private nextCursor: string | null = null;
  private lastSearchQuery: string = "";

  matchesUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace("www.", "");
      return this.domains.some((domain) => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  async fetchSeries(url: string, signal?: AbortSignal) {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/books\/([a-zA-Z0-9]+)/) || parsed.pathname.match(/\/pool\/show\/(\d+)/);
    if (!match) throw new Error("Invalid Sankaku Book/Pool URL");
    const bookId = match[1];

    const data = await booruGet(this.baseUrl, `/v2/posts?`, {
      tags: `pool:${bookId}`,
      limit: 100,
    }, typeof navigator !== "undefined" ? navigator.userAgent : undefined);

    const items = Array.isArray(data) ? data : [];
    if (items.length === 0) throw new Error("No pages found in this book");

    const firstPost = items[0];
    const coverUrl = firstPost.preview_url || firstPost.file_url || firstPost.sample_url || "";
    const tags = Array.isArray(firstPost.tags) ? firstPost.tags.map((t: any) => typeof t === 'string' ? t : t.name_en || t.name) : [];

    return {
        title: `Sankaku Book #${bookId}`,
        description: `Sankaku Pool / Book ${bookId}`,
        coverUrl: coverUrl.startsWith('//') ? `https:${coverUrl}` : coverUrl,
        seriesUrl: url,
        source: this.id,
        tags: tags.filter(Boolean),
        chapters: [
            {
                id: bookId,
                number: "1",
                url: url,
                title: "Full Book",
            }
        ]
    };
  }

  async fetchContent(url: string) {
    try {
      const parsed = new URL(url);
      
      const bookMatch = parsed.pathname.match(/\/books\/([a-zA-Z0-9]+)/) || parsed.pathname.match(/\/pool\/show\/(\d+)/);
      if (bookMatch) {
        const bookId = bookMatch[1];
        const data = await booruGet(this.baseUrl, `/v2/posts?`, {
            tags: `pool:${bookId}`,
            limit: 100,
        }, typeof navigator !== "undefined" ? navigator.userAgent : undefined);

        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) return { images: [], metadata: { sourceUrl: url } };

        items.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

        const images = items.map((item: any, idx: number) => {
            const imgUrl = item.file_url || item.sample_url || item.jpeg_url;
            if (!imgUrl) return null;
            return {
                url: imgUrl.startsWith('//') ? `https:${imgUrl}` : imgUrl,
                pageNumber: idx + 1,
            };
        }).filter(Boolean);

        const firstPost = items[0];
        return {
            images,
            metadata: {
                title: `Sankaku Book #${bookId}`,
                coverUrl: firstPost.preview_url || firstPost.file_url,
                sourceId: bookId,
                sourceUrl: url,
            }
        };
      }

      const id = parsed.pathname.match(/\/posts\/([^/?]+)/)?.[1] || parsed.searchParams.get("id");
      if (!id) {
        return { images: [], metadata: { sourceUrl: url } };
      }

      const post: any = await booruGet(this.baseUrl, `/v2/posts/${id}?`, {});
      const item = Array.isArray(post) ? post[0] : post;
      
      if (!item) {
        return { images: [], metadata: { sourceUrl: url } };
      }

      const imageUrl = item.file_url || item.sample_url || url;

      return {
        images: [
          {
            url: imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl,
            pageNumber: 1,
          },
        ],
        metadata: {
          title: `Sankaku #${id}`,
          coverUrl: item.preview_url || item.file_url,
          sourceId: String(item.id),
          sourceUrl: url,
          tags: Array.isArray(item.tags) ? item.tags.map((t: any) => typeof t === 'string' ? t : t.name) : [],
        },
      };
    } catch (e) {
      console.error("[SankakuProvider] fetchContent failed:", e);
      return { images: [], metadata: { sourceUrl: url } };
    }
  }

  async search(
    query: string,
    pageOrOptions?: number | SourceSearchOptions,
    limit?: number,
  ): Promise<SourceSearchResult[]> {
    let options: SourceSearchOptions = {};

    if (typeof pageOrOptions === "number") {
      options.page = pageOrOptions;
      options.limit = limit;
    } else if (pageOrOptions) {
      options = pageOrOptions;
    }

    const page = options.page || 1;
    const tags = buildBooruTags(query, options.contentFilter || "all");

    // Reset cursor if page is 1 or query changed
    if (page === 1 || this.lastSearchQuery !== query) {
      this.nextCursor = null;
      this.lastSearchQuery = query;
    }

    const params: Record<string, any> = {
      lang: "en",
      tags,
      limit: options.limit || 40,
    };

    if (this.nextCursor) {
      params.next = this.nextCursor;
    }

    // Pass authentication params if they exist
    if (options.auth) {
      params.auth = options.auth;
    }

    const data: any = await booruGet(this.baseUrl, "/v2/posts/keyset?", params, typeof navigator !== "undefined" ? navigator.userAgent : undefined);

    let items = [];
    if (data && Array.isArray(data.data)) {
      items = data.data;
      if (data.meta && data.meta.next) {
        this.nextCursor = data.meta.next;
      }
    } else if (Array.isArray(data)) {
      items = data;
    } else {
      items = [data];
    }

    // Convert sankaku tag object arrays to simple string arrays for compatibility
    items.forEach((item: any) => {
        if (Array.isArray(item.tags)) {
            item.tag_string = item.tags.map((t: any) => t.name || t.tagName).join(' ');
        }
    });

    return mapBooruPosts(items, "sankaku", "https://chan.sankakucomplex.com");
  }

  async searchByTags(
    tags: string[],
    pageOrOptions?: number | SourceSearchOptions,
    limit?: number,
  ): Promise<SourceSearchResult[]> {
    let options: SourceSearchOptions = {};

    if (typeof pageOrOptions === "number") {
      options.page = pageOrOptions;
      options.limit = limit;
    } else if (pageOrOptions) {
      options = pageOrOptions;
    }

    // Sankaku API restricts multi-tag searches for non-premium users. (Max 2 tags total).
    // To bypass this, we query the API using the maximum allowed tags,
    // request a larger batch, and then strictly filter the results client-side for the remaining tags.
    const maxAllowedTags = options.contentFilter === "sfw" ? 1 : 2;
    const apiTags = tags.slice(0, maxAllowedTags);
    const filterTags = tags.slice(maxAllowedTags).map((t) => t.toLowerCase());

    const normalized = buildBooruTagsFromArray(
      apiTags,
      options.contentFilter || "all",
    );
    
    // Request a larger batch to compensate for items that will be filtered out
    const fetchOptions = { ...options, limit: Math.max(options.limit || 40, 100) };
    let results = await this.search(normalized, fetchOptions);

    // Client-side strict AND filtering
    if (filterTags.length > 0) {
      results = results.filter(item => {
         const itemTags = (item.tags || []).map(t => t.toLowerCase());
         return filterTags.every(ft => itemTags.includes(ft));
      });
    }

    return results;
  }

  async getLatest(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    return this.search("order:created_at", options);
  }

  async getTrending(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    return this.search("order:popular", options);
  }

  async getRandom(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    return this.search("order:random", options);
  }

  async getAutocomplete(query: string): Promise<string[]> {
    try {
        const data: any = await booruGet(this.baseUrl, `/tags?`, {
          name: query,
          limit: 10,
        }, typeof navigator !== "undefined" ? navigator.userAgent : undefined);

        if (!Array.isArray(data)) return [];
        return data.map((t: any) => t.name).filter(Boolean);
    } catch (e) {
        return [];
    }
  }

  async getRelatedTags(tag: string): Promise<string[]> {
    // Sankaku doesn't have a simple related tags endpoint, returning empty for now
    return [];
  }
}
