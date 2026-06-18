import { BaseProvider } from "./BaseProvider";
import type { PlatformImage, SearchQuery } from "../types";

export class DanbooruProvider extends BaseProvider {
  id = "danbooru";
  name = "Danbooru";
  capabilities = {
    maxTags: 2,
    supportsNegative: true,
    supportsScore: true,
    authentication: false,
    requiresCookies: false,
    authUrl: "https://danbooru.donmai.us/profile",
    status: "working",
    search: true,
    tagSearch: true,
  };
  domains = ["danbooru.donmai.us"];

  private normalizeTag(tag: string): string {
    return tag.toLowerCase().trim().replace(/ /g, "_");
  }

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    const apiTags: string[] = [];

    // Always enforce sfw if requested in predicates, and give it highest priority!
    if (query.predicates["rating"] === "safe" || query.predicates["rating"] === "sfw") {
      apiTags.push("rating:s");
    }

    // Pass the remaining tags to the API, up to the limit
    for (const tag of query.positiveTags) {
      if (apiTags.length < this.capabilities.maxTags) {
        apiTags.push(this.normalizeTag(tag));
      }
    }
    for (const tag of query.negativeTags) {
      if (apiTags.length < this.capabilities.maxTags) {
        apiTags.push(`-${this.normalizeTag(tag)}`);
      }
    }

    const tagStr = apiTags.join(" ");
    const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagStr)}&page=${page}&limit=40`;

    try {
      const data = await this.fetchJson<any[]>(url);
      if (!Array.isArray(data)) return [];
      return this.mapPosts(data);
    } catch (e) {
      console.warn("[DanbooruProvider] API fetch failed", e);
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    return this.search({ raw: "order:random", positiveTags: ["order:random"], negativeTags: [], predicates: {} }, page);
  }

  private mapPosts(posts: any[]): PlatformImage[] {
    return posts
      .filter(p => p.id && (p.file_url || p.large_file_url || p.preview_file_url))
      .filter(p => !p.file_url?.includes("download-preview.png")) // Ignore restricted Gold posts
      .map(p => {
        const fullUrl = p.large_file_url || p.file_url || p.preview_file_url || "";
        const sampleUrl = p.large_file_url || p.preview_file_url || fullUrl || "";
        const thumbnailUrl = p.preview_file_url || sampleUrl || "";

        let rating: "safe" | "questionable" | "explicit" = "safe";
        if (p.rating === "e") rating = "explicit";
        if (p.rating === "q") rating = "questionable";

        return {
          id: `danbooru-${p.id}`,
          sourceId: String(p.id),
          providerId: this.id,
          thumbnailUrl,
          sampleUrl,
          fullUrl,
          width: p.image_width,
          height: p.image_height,
          aspectRatio: p.image_width && p.image_height ? p.image_width / p.image_height : 1,
          tags: p.tag_string ? p.tag_string.split(" ") : [],
          rating,
          score: p.score || 0,
          sourceUrl: `https://danbooru.donmai.us/posts/${p.id}`,
          createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
          isLocal: false
        };
      });
  }
}
