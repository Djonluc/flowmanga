import { BaseProvider } from "./BaseProvider";
import type { PlatformImage, SearchQuery } from "../types";
import { useSettingsStore } from "../../stores/useSettingsStore";

export class KonachanProvider extends BaseProvider {
  id = "konachan";
  name = "Konachan";
  capabilities = {
    maxTags: 6, // Konachan allows up to 6 tags
    supportsNegative: true,
    supportsScore: true,
    authentication: false, // Moebooru supports auth, but let's keep it simple for now
    requiresCookies: false,
    authUrl: "https://konachan.com/user/login",
    status: "working",
    search: true,
    tagSearch: true,
  };
  domains = ["konachan.com"];

  private normalizeTag(tag: string): string {
    return tag.toLowerCase().trim().replace(/ /g, "_");
  }

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    const { showAdultContent } = useSettingsStore.getState();
    const apiTags: string[] = [];

    // Enforce safe rating if adult content is disabled or requested
    if (query.predicates["rating"] === "safe" || query.predicates["rating"] === "sfw" || !showAdultContent) {
      apiTags.push("rating:safe");
    } else if (query.predicates["rating"] === "explicit") {
      apiTags.push("rating:explicit");
    } else if (query.predicates["rating"] === "questionable") {
      apiTags.push("rating:questionable");
    }

    // Add positive tags
    for (const tag of query.positiveTags) {
      if (apiTags.length < this.capabilities.maxTags) {
        apiTags.push(this.normalizeTag(tag));
      }
    }
    // Add negative tags
    for (const tag of query.negativeTags) {
      if (apiTags.length < this.capabilities.maxTags) {
        apiTags.push(`-${this.normalizeTag(tag)}`);
      }
    }

    // Default to sorting by ID descending if no sort is specified
    if (!apiTags.some(t => t.startsWith("order:"))) {
      apiTags.push("order:id");
    }

    const tagStr = apiTags.join(" ");
    const url = `https://konachan.com/post.json?tags=${encodeURIComponent(tagStr)}&page=${page}&limit=40`;

    try {
      const data = await this.fetchJson<any[]>(url);
      if (!Array.isArray(data)) return [];
      return this.mapPosts(data);
    } catch (e) {
      console.warn("[KonachanProvider] API fetch failed", e);
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    const { showAdultContent } = useSettingsStore.getState();
    // Konachan supports order:random
    const baseTags = showAdultContent ? ["order:random"] : ["order:random", "rating:safe"];
    return this.search({ raw: baseTags.join(" "), positiveTags: baseTags, negativeTags: [], predicates: {} }, page);
  }

  async autocompleteTags(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];
    
    // Moebooru autocomplete
    const url = `https://konachan.com/tag.json?name=*${encodeURIComponent(query)}*&limit=10`;
    
    try {
      const data = await this.fetchJson<any[]>(url);
      if (!Array.isArray(data)) return [];
      
      return data.map(tag => {
        const tagName = tag.name;
        // Konachan tag types: 0=General, 1=Artist, 3=Copyright/Series, 4=Character
        if (tag.type === 1) return `artist:${tagName}`;
        if (tag.type === 3) return `series:${tagName}`;
        if (tag.type === 4) return `character:${tagName}`;
        return tagName;
      }).filter(Boolean);
    } catch (e) {
      console.warn("[KonachanProvider] autocomplete failed", e);
      return [];
    }
  }

  async getById(id: string): Promise<PlatformImage | null> {
    try {
      const url = `https://konachan.com/post.json?tags=id:${id}`;
      const data = await this.fetchJson<any[]>(url);
      if (!Array.isArray(data) || data.length === 0) return null;
      const posts = this.mapPosts(data);
      return posts.length > 0 ? posts[0] : null;
    } catch (e) {
      console.warn("[KonachanProvider] getById failed", e);
      return null;
    }
  }

  private mapPosts(posts: any[]): PlatformImage[] {
    return posts
      .filter(p => p.id && (p.file_url || p.sample_url || p.preview_url))
      .map(p => {
        const fullUrl = p.file_url || p.sample_url || p.preview_url || "";
        const sampleUrl = p.sample_url || p.file_url || p.preview_url || "";
        const thumbnailUrl = p.preview_url || sampleUrl;

        let rating: "safe" | "questionable" | "explicit" = "safe";
        if (p.rating === "e") rating = "explicit";
        if (p.rating === "q") rating = "questionable";

        return {
          id: `konachan-${p.id}`,
          sourceId: String(p.id),
          providerId: this.id,
          thumbnailUrl,
          sampleUrl,
          fullUrl,
          width: p.width,
          height: p.height,
          aspectRatio: p.width && p.height ? p.width / p.height : 1,
          tags: p.tags ? p.tags.split(" ") : [],
          rating,
          score: p.score || 0,
          sourceUrl: `https://konachan.com/post/show/${p.id}`,
          createdAt: p.created_at ? p.created_at * 1000 : Date.now(),
          mediaType: this.getMediaType(fullUrl),
          isLocal: false
        };
      });
  }
}
