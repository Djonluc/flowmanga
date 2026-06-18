import { BaseProvider } from "./BaseProvider";
import type { PlatformImage, SearchQuery } from "../types";
import { useSettingsStore } from "../../stores/useSettingsStore";

export class SankakuProvider extends BaseProvider {
  id = "sankaku";
  name = "Sankaku Complex";
  
  capabilities = {
    maxTags: 2, // Sankaku limits free users
    supportsNegative: true,
    supportsScore: true,
    authentication: true,
    requiresCookies: true,
    authUrl: "https://sankakucomplex.com",
    status: "working",
    search: true,
    tagSearch: true,
  };
  domains = ["sankakucomplex.com"];

  private getAuthHeaders(): Record<string, string> {
    const auth = useSettingsStore.getState().booruAuth?.[this.id];
    const headers: Record<string, string> = {};
    
    if (auth?.sessionCookies) {
      headers["Cookie"] = auth.sessionCookies;
    }
    
    if (auth?.localStorage) {
      const token = auth.localStorage["access_token"];
      if (token && token.length > 10) {
        headers["Authorization"] = `Bearer ${token.replace(/^"|"$/g, '')}`;
      }
    }
    
    return headers;
  }

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    if (query.predicates["source"] && query.predicates["source"] !== this.id) {
      return [];
    }

    const apiTags = [...query.positiveTags];
    query.negativeTags.forEach(tag => apiTags.push(`-${tag}`));
    
    if (!apiTags.some(t => t.startsWith("order:"))) {
      apiTags.push("order:quality");
    }

    const tagStr = apiTags.join(" ");
    
    const headers = this.getAuthHeaders();
    if (!headers["Cookie"] && !headers["Authorization"]) {
      console.warn(`[SankakuProvider] Missing session credentials. Cannot fetch without ban risk.`);
      return [];
    }
    
    const url = `https://sankakuapi.com/posts?tags=${encodeURIComponent(tagStr)}&limit=40&page=${page}`;
    
    try {
      const response = await this.fetchJson<any>(url, { headers });
      
      const data = Array.isArray(response) ? response : response?.data;
      if (!data || !Array.isArray(data)) return [];

      return data
        .filter((post: any) => post.file_url || post.sample_url || post.preview_url)
        .map((post: any) => {
        return {
          id: `${this.id}-${post.id}`,
          sourceId: post.id.toString(),
          providerId: this.id,
          thumbnailUrl: post.preview_url || post.sample_url || post.file_url,
          sampleUrl: post.sample_url || post.file_url,
          fullUrl: post.file_url,
          width: post.width,
          height: post.height,
          aspectRatio: post.width / post.height,
          tags: post.tags ? post.tags.map((t: any) => t.name_en || t.name) : [],
          rating: post.rating === "e" ? "explicit" : post.rating === "q" ? "questionable" : "safe",
          score: post.total_score || 0,
          sourceUrl: `https://chan.sankakucomplex.com/post/${post.id}`,
          createdAt: post.created_at ? new Date(post.created_at.s ? post.created_at.s * 1000 : post.created_at).getTime() : Date.now(),
          isLocal: false
        };
      });
    } catch (e) {
      console.error(`[${this.name}] Search failed:`, e);
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    return this.search({ raw: "order:random", positiveTags: ["order:random"], negativeTags: [], predicates: {} }, page);
  }
}
