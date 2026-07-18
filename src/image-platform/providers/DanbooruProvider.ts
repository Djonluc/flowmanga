import { BaseProvider } from "./BaseProvider";
import type { PlatformImage, SearchQuery } from "../types";
import { useSettingsStore } from "../../stores/useSettingsStore";

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
    const { showAdultContent } = useSettingsStore.getState();
    const apiTags: string[] = [];

    // Always enforce sfw if requested in predicates, and give it highest priority!
    if (query.predicates["rating"] === "safe" || query.predicates["rating"] === "sfw" || !showAdultContent) {
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
    const { showAdultContent } = useSettingsStore.getState();
    // Danbooru deprecated order:random because it's too expensive. 
    // They now support the random:N tag. We use random:40.
    const baseTags = showAdultContent ? ["random:40"] : ["random:40", "rating:s"];
    return this.search({ raw: baseTags.join(" "), positiveTags: baseTags, negativeTags: [], predicates: {} }, page);
  }

  async autocompleteTags(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];
    
    // Danbooru autocomplete allows wildcard at the end
    const url = `https://danbooru.donmai.us/tags.json?search[name_matches]=*${encodeURIComponent(query)}*&limit=10`;
    
    try {
      const data = await this.fetchJson<any>(url);
      if (!Array.isArray(data)) return [];
      
      return data.map(tag => {
        const tagName = tag.name;
        if (tag.category === 1) return `artist:${tagName}`;
        if (tag.category === 3) return `series:${tagName}`;
        if (tag.category === 4) return `character:${tagName}`;
        return tagName;
      }).filter(Boolean);
    } catch (e) {
      console.warn("[DanbooruProvider] autocomplete failed", e);
      return [];
    }
  }

  async getById(id: string): Promise<PlatformImage | null> {
    try {
      const url = `https://danbooru.donmai.us/posts/${id}.json`;
      const data = await this.fetchJson<any>(url);
      if (!data || !data.id) return null;
      const posts = this.mapPosts([data]);
      return posts.length > 0 ? posts[0] : null;
    } catch (e) {
      console.warn("[DanbooruProvider] getById failed", e);
      return null;
    }
  }

  private mapPosts(posts: any[]): PlatformImage[] {
    return posts
      .filter(p => p.id && (p.file_url || p.large_file_url || p.preview_file_url))
      .filter(p => !p.file_url?.includes("download-preview.png")) // Ignore restricted Gold posts
      .map(p => {
        const fullUrl = p.file_url || p.large_file_url || p.preview_file_url || "";
        const sampleUrl = p.large_file_url || p.file_url || p.preview_file_url || "";
        const preview = p.preview_file_url || sampleUrl;
        // Keep the sharper sample as the primary grid image. The preview URL is
        // retained separately as a reliable fallback for restricted posts.
        const thumbnailUrl = sampleUrl;

        let rating: "safe" | "questionable" | "explicit" = "safe";
        if (p.rating === "e") rating = "explicit";
        if (p.rating === "q") rating = "questionable";

        return {
          id: `danbooru-${p.id}`,
          sourceId: String(p.id),
          providerId: this.id,
          thumbnailUrl,
          previewUrl: preview,
          sampleUrl,
          fullUrl,
          width: p.image_width,
          height: p.image_height,
          aspectRatio: p.image_width && p.image_height ? p.image_width / p.image_height : 1,
          tags: (() => {
            const apiTags: string[] = [];
            if (p.tag_string_artist) apiTags.push(...p.tag_string_artist.split(" ").map((t: string) => `artist:${t}`));
            if (p.tag_string_copyright) apiTags.push(...p.tag_string_copyright.split(" ").map((t: string) => `series:${t}`));
            if (p.tag_string_character) apiTags.push(...p.tag_string_character.split(" ").map((t: string) => `character:${t}`));
            if (p.tag_string_general) apiTags.push(...p.tag_string_general.split(" "));
            if (apiTags.length === 0 && p.tag_string) apiTags.push(...p.tag_string.split(" "));
            return apiTags;
          })(),
          rating,
          score: p.score || 0,
          sourceUrl: `https://danbooru.donmai.us/posts/${p.id}`,
          createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
          mediaType: this.getMediaType(fullUrl),
          isLocal: false
        };
      });
  }
}
