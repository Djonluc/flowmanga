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
    
    // Check if this is a request for purely new images
    const isNewImagesRequest = apiTags.includes("_sort:new_");
    if (isNewImagesRequest) {
      apiTags.splice(apiTags.indexOf("_sort:new_"), 1);
    } else if (!apiTags.some(t => t.startsWith("order:"))) {
      // For standard searches, fallback to high-quality results
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
          tags: post.tags ? post.tags.map((t: any) => {
            const tagName = (t.name_en || t.name || "").trim().replace(/ /g, "_");
            if (t.type === 1) return `artist:${tagName}`;
            if (t.type === 3) return `series:${tagName}`;
            if (t.type === 4) return `character:${tagName}`;
            return tagName;
          }).filter(Boolean) : [],
          rating: post.rating === "e" ? "explicit" : post.rating === "q" ? "questionable" : "safe",
          score: post.total_score || 0,
          sourceUrl: `https://chan.sankakucomplex.com/post/${post.id}`,
          createdAt: post.created_at ? new Date(post.created_at.s ? post.created_at.s * 1000 : post.created_at).getTime() : Date.now(),
          mediaType: this.getMediaType(post.file_url),
          isLocal: false
        };
      });
    } catch (e: any) {
      console.warn(`[${this.name}] Search gracefully timed out or failed: ${e.message}`);
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    return this.search({ raw: "order:random", positiveTags: ["order:random"], negativeTags: [], predicates: {} }, page);
  }

  async getById(id: string): Promise<PlatformImage | null> {
    const { useSettingsStore } = await import("../../stores/useSettingsStore");
    const { getSessionHeaders } = useSettingsStore.getState();
    const headers = await getSessionHeaders(this.id);
    
    try {
      const url = `https://sankakuapi.com/posts/${id}`;
      const data = await this.fetchJson<any>(url, { headers });
      if (!data || !data.id) return null;
      
      const posts = [data].map((post: any) => {
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
          tags: post.tags ? post.tags.map((t: any) => {
            const tagName = (t.name_en || t.name || "").trim().replace(/ /g, "_");
            if (t.type === 1) return `artist:${tagName}`;
            if (t.type === 3) return `series:${tagName}`;
            if (t.type === 4) return `character:${tagName}`;
            return tagName;
          }).filter(Boolean) : [],
          rating: post.rating === "e" ? "explicit" : post.rating === "q" ? "questionable" : "safe",
          score: post.total_score || 0,
          sourceUrl: `https://chan.sankakucomplex.com/post/${post.id}`,
          createdAt: post.created_at ? new Date(post.created_at.s ? post.created_at.s * 1000 : post.created_at).getTime() : Date.now(),
          mediaType: this.getMediaType(post.file_url),
          isLocal: false
        };
      });
      return posts.length > 0 ? posts[0] : null;
    } catch (e) {
      console.warn("[SankakuProvider] getById failed", e);
      return null;
    }
  }

  async getLatest(page: number): Promise<PlatformImage[]> {
    // Pass a special internal tag to bypass the default order:quality injection
    // and naturally return the most recently uploaded images.
    return this.search({ raw: "_sort:new_", positiveTags: ["_sort:new_"], negativeTags: [], predicates: {} }, page);
  }
}
