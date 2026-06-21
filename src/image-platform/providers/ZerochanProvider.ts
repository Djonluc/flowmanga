import { BaseProvider } from "./BaseProvider";
import type { PlatformImage, SearchQuery } from "../types";

export class ZerochanProvider extends BaseProvider {
  id = "zerochan";
  name = "Zerochan";
  capabilities = {
    maxTags: 2, // Zerochan is very strict, usually supports 1-2 tags via URL
    supportsNegative: false,
    supportsScore: false,
    authentication: false,
    requiresCookies: false,
    authUrl: "https://www.zerochan.net/login",
    status: "working",
    search: true,
    tagSearch: true,
  };
  domains = ["zerochan.net"];

  private normalizeTag(tag: string): string {
    // Zerochan uses Space Capitalized strings or exact matches usually, but URL encode works
    return tag.trim();
  }

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    const apiTags: string[] = [];

    for (const tag of query.positiveTags) {
      if (apiTags.length < this.capabilities.maxTags) {
        apiTags.push(this.normalizeTag(tag));
      }
    }

    if (apiTags.length === 0) {
      return this.getDiscovery(page);
    }

    // Zerochan combines multiple tags with a comma in the URL
    const tagStr = apiTags.join(",");
    const url = `https://www.zerochan.net/${encodeURIComponent(tagStr)}?json=1&p=${page}`;

    try {
      const data = await this.fetchJson<{items?: any[]}>(url);
      if (!data || !data.items) return [];
      return this.mapPosts(data.items);
    } catch (e) {
      console.warn("[ZerochanProvider] API fetch failed", e);
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    // Zerochan's homepage json returns the latest/trending posts
    const url = `https://www.zerochan.net/?json=1&p=${page}`;
    try {
      const data = await this.fetchJson<{items?: any[]}>(url);
      if (!data || !data.items) return [];
      return this.mapPosts(data.items);
    } catch (e) {
      console.warn("[ZerochanProvider] Discovery fetch failed", e);
      return [];
    }
  }

  async autocompleteTags(query: string): Promise<string[]> {
    // Zerochan doesn't have an easily open autocomplete API without auth, return empty for now
    return [];
  }

  async getById(id: string): Promise<PlatformImage | null> {
    try {
      const url = `https://www.zerochan.net/${id}?json=1`;
      const data = await this.fetchJson<any>(url);
      if (!data || !data.id) return null;
      const posts = this.mapPosts([data]);
      return posts.length > 0 ? posts[0] : null;
    } catch (e) {
      console.warn("[ZerochanProvider] getById failed", e);
      return null;
    }
  }

  private mapPosts(posts: any[]): PlatformImage[] {
    return posts
      .filter(p => p.id && p.thumbnail)
      .map(p => {
        const thumbnailUrl = p.thumbnail;
        
        // Zerochan thumbnails are often limited to 240px width.
        // We can guess the full URL using their static format:
        const primaryTag = p.tag ? p.tag.replace(/ /g, "+") : "Zerochan";
        const guessedFullUrl = `https://static.zerochan.net/${primaryTag}.full.${p.id}.jpg`;

        return {
          id: `zerochan-${p.id}`,
          sourceId: String(p.id),
          providerId: this.id,
          thumbnailUrl,
          sampleUrl: guessedFullUrl, // Try using the full image as sample
          fullUrl: guessedFullUrl,
          width: p.width || 0,
          height: p.height || 0,
          aspectRatio: p.width && p.height ? p.width / p.height : 1,
          tags: p.tags || [],
          rating: "safe", // Zerochan is mostly SFW but can have ecchi. They don't expose rating easily.
          score: 0,
          sourceUrl: `https://www.zerochan.net/${p.id}`,
          createdAt: Date.now(), // Zerochan API doesn't return created_at easily in this endpoint
          mediaType: this.getMediaType(guessedFullUrl),
          isLocal: false
        };
      });
  }
}
