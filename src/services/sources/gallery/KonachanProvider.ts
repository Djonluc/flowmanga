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

export class KonachanProvider implements SourceProvider {
  readonly id = "konachan";
  readonly name = "Konachan";
  readonly domains = ["konachan.com", "konachan.net"];
  readonly contentType: ContentType = "gallery";
  readonly mediaDomain: MediaDomain = "image";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "discovery" as const;
  readonly readerModes: ReaderMode[] = ["gallery", "slideshow", "single"];

  readonly capabilities: SourceCapabilities = {
    search: true,
    tagSearch: true,
    seriesBrowse: false,
    chapterFeed: false,
    pagination: true,
    authentication: true,
    authUrl: "https://konachan.com/user/edit",
  };

  private readonly baseUrl = "https://konachan.com";

  matchesUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace("www.", "");
      return this.domains.some((domain) => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  async fetchContent(url: string) {
    try {
      const parsed = new URL(url);
      const id =
        parsed.searchParams.get("id") ||
        parsed.pathname.match(/\/(\d+)(?:$|\/)/)?.[1];
      if (!id) return { images: [], metadata: { sourceUrl: url } };

      const data = await booruGet(this.baseUrl, "/post.json", { id });
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) return { images: [], metadata: { sourceUrl: url } };

      return {
        images: [
          {
            url:
              item.file_url ||
              item.large_file_url ||
              item.jpeg_url ||
              item.preview_url ||
              url,
            pageNumber: 1,
          },
        ],
        metadata: {
          title:
            item.tags?.split(" ").slice(0, 3).join(" ") || `Konachan #${id}`,
          coverUrl: item.preview_url || item.sample_url || item.file_url,
          sourceId: String(item.id),
          sourceUrl: url,
          tags: item.tags?.split(" ") || [],
          rating:
            item.rating === "s"
              ? "safe"
              : item.rating === "q"
                ? "questionable"
                : "explicit",
        },
      };
    } catch (error) {
      console.error("[KonachanProvider] fetchContent failed:", error);
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
    const safeLimit = Math.min(options.limit || 24, 200);
    const tags = buildBooruTags(query, options.contentFilter || "all");
    const data = await booruGet(this.baseUrl, "/post.json", {
      tags,
      page,
      limit: safeLimit,
      auth: options.auth,
    });
    return mapBooruPosts(data, "konachan", this.baseUrl);
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

    const normalized = buildBooruTagsFromArray(
      tags,
      options.contentFilter || "all",
    );
    return this.search(normalized, options);
  }

  async getLatest(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 24, 200);
    const tags = buildBooruTags(
      "order:created_at",
      options.contentFilter || "all",
    );
    const data = await booruGet(this.baseUrl, "/post.json", {
      tags,
      page,
      limit,
    });
    return mapBooruPosts(data, "konachan", this.baseUrl);
  }

  async getTrending(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 24, 200);
    const tags = buildBooruTags("order:score", options.contentFilter || "all");
    const data = await booruGet(this.baseUrl, "/post.json", {
      tags,
      page,
      limit,
    });
    return mapBooruPosts(data, "konachan", this.baseUrl);
  }

  async getRandom(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const tags = buildBooruTags("order:random", options.contentFilter || "all");
    const limit = options.limit || 12;
    const data = await booruGet(this.baseUrl, "/post.json", { tags, limit });
    if (data && (Array.isArray(data) ? data.length > 0 : data.id)) {
      return mapBooruPosts(data, "konachan", this.baseUrl);
    }
    return [];
  }

  async getAutocomplete(query: string): Promise<string[]> {
    const data = await booruGet(this.baseUrl, "/tag.json", {
      name_pattern: `*${query}*`,
      limit: 10,
    });
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => item.name).filter(Boolean);
  }

  async getRelatedTags(tag: string): Promise<string[]> {
    const data = await booruGet(this.baseUrl, "/tag/related.json", {
      tags: tag,
    });
    if (data && typeof data === "object") {
      // Moebooru /tag/related.json returns something like: {"tag1": [...], "tag2": [...]} or just an array
      // It depends on the format, but usually it's an object with the tag name as key or an array of objects
      const tagList = Array.isArray(data) ? data : Object.values(data)[0] || [];
      if (Array.isArray(tagList)) {
        return tagList.map((t: any) => t[0] || t.name).filter(Boolean);
      }
    }
    return [];
  }
}
