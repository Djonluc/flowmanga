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
 * Gelbooru API Provider
 * Implementation for Gelbooru.com using standard DAPI.
 */
export class GelbooruProvider implements SourceProvider {
  readonly id = "gelbooru";
  readonly name = "Gelbooru";
  readonly domains = ["gelbooru.com", "img3.gelbooru.com"];
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
    authUrl: "https://gelbooru.com/index.php?page=account&s=options",
  };

  private readonly baseUrl = "https://gelbooru.com";

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
      if (!id) {
        return { images: [], metadata: { sourceUrl: url } };
      }

      const data = await booruGet(this.baseUrl, "/index.php", {
        page: "dapi",
        s: "post",
        q: "index",
        id,
        json: 1,
      });

      const items = Array.isArray(data) ? data : data.post || [];
      const item = Array.isArray(items) ? items[0] : items;

      if (!item) {
        return { images: [], metadata: { sourceUrl: url } };
      }

      return {
        images: [
          {
            url: item.file_url || item.sample_url || item.preview_url || url,
            pageNumber: 1,
          },
        ],
        metadata: {
          title:
            item.tags?.split(" ").slice(0, 3).join(" ") || `Gelbooru #${id}`,
          coverUrl: item.preview_url || item.sample_url || item.file_url,
          sourceId: String(item.id),
          sourceUrl: url,
          tags: item.tags?.split(" ") || [],
          rating: this.normalizeRating(item.rating),
        },
      };
    } catch (e) {
      console.error("[GelbooruProvider] fetchContent failed:", e);
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

    const page = (options.page || 1) - 1; // Gelbooru pid is 0-indexed
    const tags = buildBooruTags(query, options.contentFilter || "all");

    const data = await booruGet(this.baseUrl, "/index.php", {
      page: "dapi",
      s: "post",
      q: "index",
      tags,
      pid: page,
      limit: options.limit || 20,
      json: 1,
      auth: options.auth,
    });

    // Gelbooru DAPI returns { post: [...] } or an array directly
    const items = Array.isArray(data) ? data : data.post || [];
    return mapBooruPosts(items, "gelbooru", this.baseUrl);
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
    // Optional: support showing deleted images if requested via tags or options
    const tags = options.contentFilter === "all" ? "" : "rating:safe";
    return this.search(tags, options);
  }

  async getTrending(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    // Gelbooru doesn't have a direct "popular" JSON endpoint in DAPI,
    // but we can sort by score if supported or just get latest.
    return this.search("sort:score:desc", options);
  }

  async getRandom(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    return this.search("sort:random", options);
  }

  async getAutocomplete(query: string): Promise<string[]> {
    const data = await booruGet(this.baseUrl, "/index.php", {
      page: "dapi",
      s: "tag",
      q: "index",
      name_pattern: `%${query}%`,
      limit: 10,
      json: 1,
    });

    const items = Array.isArray(data) ? data : data.tag || [];
    return items.map((t: any) => t.name).filter(Boolean);
  }

  async getRelatedTags(tag: string): Promise<string[]> {
    // Standard DAPI doesn't have related tags, but we can search for the tag and see common neighbors
    return [];
  }

  // ─── DAPI Extension Endpoints ─────────────────────────────────────

  /**
   * Fetch comments for a specific post.
   * Currently unused in UI but implemented for full DAPI compliance.
   */
  async getComments(postId: string) {
    return booruGet(this.baseUrl, "/index.php", {
      page: "dapi",
      s: "comment",
      q: "index",
      post_id: postId,
      json: 1,
    });
  }

  /**
   * Fetch user metadata.
   * Currently unused in UI but implemented for full DAPI compliance.
   */
  async getUser(userId: string) {
    return booruGet(this.baseUrl, "/index.php", {
      page: "dapi",
      s: "user",
      q: "index",
      id: userId,
      json: 1,
    });
  }

  private normalizeRating(rating: string): string {
    switch (rating?.toLowerCase()) {
      case "safe":
      case "s":
        return "safe";
      case "questionable":
      case "q":
        return "questionable";
      case "explicit":
      case "e":
        return "explicit";
      default:
        return "unknown";
    }
  }
}
