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
 * Danbooru API Provider
 * Robust implementation for Danbooru.donmai.us
 */
export class DanbooruProvider implements SourceProvider {
  readonly id = "danbooru";
  readonly name = "Danbooru";
  readonly domains = ["danbooru.donmai.us", "cdn.donmai.us"];
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
    authUrl: "https://danbooru.donmai.us/profile",
  };

  private readonly baseUrl = "https://danbooru.donmai.us";

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

      const post = await booruGet(this.baseUrl, "/posts.json", { id });
      const item = Array.isArray(post) ? post[0] : post;
      if (!item) {
        return { images: [], metadata: { sourceUrl: url } };
      }

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
            item.tag_string?.split(" ").slice(0, 3).join(" ") ||
            `Danbooru #${id}`,
          coverUrl:
            item.preview_file_url || item.large_file_url || item.file_url,
          sourceId: String(item.id),
          sourceUrl: url,
          tags: item.tag_string?.split(" ") || [],
          rating:
            item.rating === "s"
              ? "safe"
              : item.rating === "q"
                ? "questionable"
                : "explicit",
        },
      };
    } catch (e) {
      console.error("[DanbooruProvider] fetchContent failed:", e);
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
    const maxTags = options.contentFilter === "sfw" ? 1 : 2;
    const tagArray = query.split(" ").filter(Boolean).slice(0, maxTags);
    const tags = buildBooruTags(
      tagArray.join(" "),
      options.contentFilter || "all",
    );

    const data = await booruGet(this.baseUrl, "/posts.json", {
      tags,
      page,
      limit: options.limit || 20,
      auth: options.auth,
    });

    return mapBooruPosts(data, "danbooru", this.baseUrl);
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

    const maxTags = options.contentFilter === "sfw" ? 1 : 2;
    const limitedTags = tags.slice(0, maxTags);

    const normalized = buildBooruTagsFromArray(
      limitedTags,
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

    const data = await booruGet(this.baseUrl, "/posts.json", {
      tags,
      page,
      limit,
    });

    return mapBooruPosts(data, "danbooru", this.baseUrl);
  }

  async getTrending(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const data = await booruGet(this.baseUrl, "/explore/posts/popular.json", {
      limit: options.limit || 20,
      scale: "day",
    });
    return mapBooruPosts(data, "danbooru", this.baseUrl);
  }

  async getRandom(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const tags = buildBooruTags("", options.contentFilter || "all");
    const data = await booruGet(this.baseUrl, "/posts/random.json", {
      tags,
    });
    const results = Array.isArray(data) ? data : [data];
    return mapBooruPosts(results, "danbooru", this.baseUrl);
  }

  async getAutocomplete(query: string): Promise<string[]> {
    const data = await booruGet(this.baseUrl, "/tags/autocomplete.json", {
      "search[name_matches]": `*${query}*`,
      limit: 10,
    });

    if (!Array.isArray(data)) return [];
    return data.map((t: any) => t.name).filter(Boolean);
  }

  async getRelatedTags(tag: string): Promise<string[]> {
    const data = await booruGet(this.baseUrl, "/related_tag.json", {
      query: tag,
    });

    if (data && Array.isArray(data.tags)) {
      return data.tags.map((t: any) => t[0]).filter(Boolean);
    }
    return [];
  }
}
