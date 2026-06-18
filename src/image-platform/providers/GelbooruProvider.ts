import { BaseProvider } from "./BaseProvider";
import type { PlatformImage, SearchQuery } from "../types";

export class GelbooruProvider extends BaseProvider {
  id = "gelbooru";
  name = "Gelbooru";
  capabilities = {
    maxTags: 100, // Gelbooru allows a huge number of tags
    supportsNegative: true,
    supportsScore: true,
    authentication: true,
    requiresCookies: false,
    authUrl: "https://gelbooru.com/index.php?page=account&s=options",
    status: "working",
    search: true,
    tagSearch: true,
  };
  domains = ["gelbooru.com"];
  private baseUrl = "https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=40";

  private normalizeTag(tag: string): string {
    return tag.toLowerCase().trim().replace(/ /g, "_");
  }

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    try {
      const { useSettingsStore } = await import("../../stores/useSettingsStore");
      const { booruAuth, showAdultContent } = useSettingsStore.getState();
      const gelbooruUserId = booruAuth?.['gelbooru']?.userId;
      const gelbooruApiKey = booruAuth?.['gelbooru']?.apiKey;

      const apiTags: string[] = [];
      for (const tag of query.positiveTags) {
        apiTags.push(this.normalizeTag(tag));
      }
      for (const tag of query.negativeTags) {
        apiTags.push(`-${this.normalizeTag(tag)}`);
      }

      if (query.predicates["rating"] === "safe" || query.predicates["rating"] === "sfw" || !showAdultContent) {
        apiTags.push("rating:general");
      } else if (query.predicates["rating"] === "explicit") {
        apiTags.push("rating:explicit");
      }

      if (!apiTags.some(t => t.startsWith("sort:"))) {
        apiTags.push("sort:score:desc");
      }

      const pid = page - 1;
      let url = `${this.baseUrl}&tags=${encodeURIComponent(apiTags.join(" "))}&pid=${pid}`;
      
      if (gelbooruUserId && gelbooruApiKey) {
        url += `&user_id=${gelbooruUserId}&api_key=${gelbooruApiKey}`;
      }

      const data = await this.fetchJson<{ post?: any[] }>(url);

      if (!data || !data.post) return [];

      return this.mapPosts(data.post);
    } catch (e) {
      console.warn("[GelbooruProvider] API fetch failed", e);
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    try {
      const { useSettingsStore } = await import("../../stores/useSettingsStore");
      const { booruAuth, showAdultContent } = useSettingsStore.getState();
      const gelbooruUserId = booruAuth?.['gelbooru']?.userId;
      const gelbooruApiKey = booruAuth?.['gelbooru']?.apiKey;
      
      const tags = showAdultContent ? "sort:random" : "sort:random rating:general";
      let url = `${this.baseUrl}&tags=${encodeURIComponent(tags)}&pid=${page - 1}`;
      if (gelbooruUserId && gelbooruApiKey) {
        url += `&user_id=${gelbooruUserId}&api_key=${gelbooruApiKey}`;
      }

      const data = await this.fetchJson<{ post?: any[] }>(url);
      if (!data || !data.post) return [];
      return this.mapPosts(data.post);
    } catch (e) {
      console.warn("[GelbooruProvider] Discovery fetch failed", e);
      return [];
    }
  }

  private mapPosts(posts: any[]): PlatformImage[] {
    return posts
      .filter(p => p.file_url)
      .map(p => {
        let rating: "safe" | "questionable" | "explicit" = "safe";
        if (p.rating === "explicit" || p.rating === "e") rating = "explicit";
        if (p.rating === "questionable" || p.rating === "q") rating = "questionable";

        return {
          id: `gelbooru-${p.id}`,
          sourceId: String(p.id),
          providerId: this.id,
          thumbnailUrl: p.preview_url || p.file_url,
          sampleUrl: p.sample_url || p.file_url,
          fullUrl: p.file_url,
          width: p.width || 0,
          height: p.height || 0,
          aspectRatio: (p.width && p.height) ? (p.width / p.height) : 1,
          tags: (p.tags || "").split(" "),
          rating,
          score: p.score || 0,
          sourceUrl: `https://gelbooru.com/index.php?page=post&s=view&id=${p.id}`,
          createdAt: new Date(p.created_at || Date.now()).getTime(),
          mediaType: this.getMediaType(p.file_url),
          isLocal: false
        };
      });
  }
}
