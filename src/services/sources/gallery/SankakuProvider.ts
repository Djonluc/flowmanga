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
  SourceContent,
  SourceImage,
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
    seriesBrowse: true,
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

  private normalizePostTags(item: any): string[] {
    if (!Array.isArray(item?.tags)) return [];
    return item.tags
      .map((tag: any) =>
        typeof tag === "string"
          ? tag
          : tag.name_en || tag.name || tag.tagName || tag.name_ja,
      )
      .filter(Boolean);
  }

  private normalizeMediaUrl(url: string): string {
    if (!url) return "";
    return url.startsWith("//") ? `https:${url}` : url;
  }

  private mapSankakuPosts(items: any[]): SourceSearchResult[] {
    return items
      .filter(Boolean)
      .map((item) => {
        const tags = this.normalizePostTags(item);
        item.tag_string = tags.join(" ");
        const mapped = mapBooruPosts([item], "sankaku", "https://www.sankakucomplex.com")[0];
        if (!mapped) return null;
        const fileUrl = this.normalizeMediaUrl(item.file_url || item.sample_url || "");
        const previewUrl = this.normalizeMediaUrl(item.preview_url || item.preview_file_url || item.sample_url || "");
        const mediaType: MediaType =
          String(item.file_type || item.content_type || fileUrl).toLowerCase().includes("video") ||
          /\.(mp4|webm|mov)(?:$|\?)/i.test(fileUrl)
            ? "video"
            : /\.(gif)(?:$|\?)/i.test(fileUrl)
              ? "gif"
              : "image";

        return {
          ...mapped,
          id: `sankaku-${item.id || mapped.id}`,
          title: tags.slice(0, 3).join(" ") || `Sankaku #${item.id || "item"}`,
          provider: this.id,
          source: this.id,
          tags,
          previewUrl: previewUrl || mapped.previewUrl || mapped.coverUrl,
          coverUrl: previewUrl || mapped.coverUrl,
          imageUrl: fileUrl || mapped.imageUrl,
          fullResUrl: this.normalizeMediaUrl(item.file_url) || mapped.fullResUrl,
          file_url: fileUrl || mapped.file_url,
          sample_url: this.normalizeMediaUrl(item.sample_url) || mapped.sample_url,
          mediaDomain: "image" as MediaDomain,
          contentType: "gallery" as ContentType,
          url: item.id
            ? `https://www.sankakucomplex.com/posts/${item.id}`
            : mapped.url,
          mediaType,
        } as SourceSearchResult & { mediaType: MediaType };
      })
      .filter((item): item is SourceSearchResult => Boolean(item));
  }

  async fetchSeries(url: string, _signal?: AbortSignal) {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/books\/([a-zA-Z0-9]+)/) || parsed.pathname.match(/\/pool\/show\/(\d+)/);
    if (!match) throw new Error("Invalid Sankaku Book/Pool URL");
    const bookId = match[1];

    const data = await booruGet(this.baseUrl, `/v2/posts?`, {
      tags: `pool:${bookId}`,
      limit: 100,
    }, "okhttp/4.12.0");

    const items = Array.isArray(data) ? data : [];
    if (items.length === 0) throw new Error("No pages found in this book");

    const firstPost = items[0];
    const coverUrl = this.normalizeMediaUrl(firstPost.preview_url || firstPost.file_url || firstPost.sample_url || "");
    const tags = this.normalizePostTags(firstPost);

    return {
        title: `Sankaku Book #${bookId}`,
        description: `Sankaku book ${bookId}`,
        coverUrl,
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

  async fetchContent(url: string): Promise<SourceContent> {
    try {
      const parsed = new URL(url);
      
      const bookMatch = parsed.pathname.match(/\/books\/([a-zA-Z0-9]+)/) || parsed.pathname.match(/\/pool\/show\/(\d+)/);
      if (bookMatch) {
        const bookId = bookMatch[1];
        const data = await booruGet(this.baseUrl, `/v2/posts?`, {
            tags: `pool:${bookId}`,
            limit: 100,
        }, "okhttp/4.12.0");

        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) return { images: [], metadata: { sourceUrl: url } };

        items.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

        const images = items.map((item: any, idx: number): SourceImage | null => {
            const imgUrl = item.file_url || item.sample_url || item.jpeg_url;
            if (!imgUrl) return null;
            const normalizedUrl = this.normalizeMediaUrl(imgUrl);
            return {
                url: normalizedUrl,
                pageNumber: idx + 1,
                mediaType: /\.(mp4|webm|mov)(?:$|\?)/i.test(normalizedUrl) ? "video" : "image",
            };
        }).filter((img): img is SourceImage => Boolean(img));

        const firstPost = items[0];
        return {
            images,
            metadata: {
                title: `Sankaku Book #${bookId}`,
                coverUrl: this.normalizeMediaUrl(firstPost.preview_url || firstPost.file_url),
                sourceId: bookId,
                sourceUrl: url,
                tags: this.normalizePostTags(firstPost),
                mediaCount: images.length,
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

      const imageUrl = this.normalizeMediaUrl(item.file_url || item.sample_url || url);
      const mediaType: MediaType = /\.(mp4|webm|mov)(?:$|\?)/i.test(imageUrl) ? "video" : "image";

      return {
        images: [
          {
            url: imageUrl,
            pageNumber: 1,
            mediaType,
          },
        ],
        metadata: {
          title: `Sankaku #${id}`,
          coverUrl: this.normalizeMediaUrl(item.preview_url || item.file_url),
          sourceId: String(item.id),
          sourceUrl: url,
          tags: this.normalizePostTags(item),
          mediaCount: 1,
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

    const data: any = await booruGet(this.baseUrl, "/v2/posts/keyset?", params, "okhttp/4.12.0");

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

    return this.mapSankakuPosts(items);
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
    const includeTags = tags.filter((tag) => !tag.startsWith("-"));
    const excludeTags = tags
      .filter((tag) => tag.startsWith("-"))
      .map((tag) => tag.slice(1).toLowerCase());
    const maxAllowedTags = options.contentFilter === "sfw" ? 1 : 2;
    const apiTags = includeTags.slice(0, maxAllowedTags);
    const filterTags = includeTags.slice(maxAllowedTags).map((t) => t.toLowerCase());

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
         return filterTags.every(ft => itemTags.includes(ft)) &&
           !excludeTags.some(et => itemTags.includes(et));
      });
    }

    if (excludeTags.length > 0 && filterTags.length === 0) {
      results = results.filter(item => {
        const itemTags = (item.tags || []).map(t => t.toLowerCase());
        return !excludeTags.some(et => itemTags.includes(et));
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
        }, "okhttp/4.12.0");

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
