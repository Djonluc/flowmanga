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
    // Sankaku is inherently adult-only — skip entirely if adult content is disabled
    const { showAdultContent } = useSettingsStore.getState();
    if (!showAdultContent) return [];

    if (query.predicates["source"] && query.predicates["source"] !== this.id) {
      return [];
    }

    const apiTags = [...query.positiveTags];
    query.negativeTags.forEach(tag => apiTags.push(`-${tag}`));
    
    const isNewImagesRequest = apiTags.includes("_sort:new_");
    if (isNewImagesRequest) {
      apiTags.splice(apiTags.indexOf("_sort:new_"), 1);
    }
    // We removed order:quality fallback because it drastically limits results for obscure searches

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
          const allTags: string[] = [];
          const artistTags: string[] = [];
          const seriesTags: string[] = [];
          const characterTags: string[] = [];
          const metaTags: string[] = [];
          const generalTags: string[] = [];

          if (post.tags) {
            post.tags.forEach((t: any) => {
              const tagName = (t.name_en || t.name || "").trim().replace(/ /g, "_");
              if (!tagName) return;
              allTags.push(tagName);
              
              if (t.type === 1) artistTags.push(tagName);
              else if (t.type === 3) seriesTags.push(tagName);
              else if (t.type === 4) characterTags.push(tagName);
              else if (t.type === 5) metaTags.push(tagName);
              else generalTags.push(tagName);
            });
          }

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
            tags: [...new Set(allTags)],
            artistTags: [...new Set(artistTags)],
            characterTags: [...new Set(characterTags)],
            copyrightTags: [...new Set(seriesTags)],
            generalTags: [...new Set(generalTags)],
            metaTags: [...new Set(metaTags)],
            rating: post.rating === "e" ? "explicit" : post.rating === "q" ? "questionable" : "safe",
            score: post.total_score || 0,
            sourceUrl: `https://chan.sankakucomplex.com/post/${post.id}`,
            createdAt: post.created_at ? new Date(post.created_at.s ? post.created_at.s * 1000 : post.created_at).getTime() : Date.now(),
            mediaType: this.getMediaType(post.file_url),
            isLocal: false
          } as any;
      });
    } catch (e: any) {
      console.warn(`[${this.name}] Search gracefully timed out or failed: ${e.message}`);
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    const { showAdultContent } = useSettingsStore.getState();
    if (!showAdultContent) return [];
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
          const allTags: string[] = [];
          const artistTags: string[] = [];
          const seriesTags: string[] = [];
          const characterTags: string[] = [];
          const metaTags: string[] = [];
          const generalTags: string[] = [];

          if (post.tags) {
            post.tags.forEach((t: any) => {
              const tagName = (t.name_en || t.name || "").trim().replace(/ /g, "_");
              if (!tagName) return;
              allTags.push(tagName);
              
              if (t.type === 1) artistTags.push(tagName);
              else if (t.type === 3) seriesTags.push(tagName);
              else if (t.type === 4) characterTags.push(tagName);
              else if (t.type === 5) metaTags.push(tagName);
              else generalTags.push(tagName);
            });
          }

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
          tags: [...new Set(allTags)],
          artistTags: [...new Set(artistTags)],
          characterTags: [...new Set(characterTags)],
          copyrightTags: [...new Set(seriesTags)],
          generalTags: [...new Set(generalTags)],
          metaTags: [...new Set(metaTags)],
          rating: post.rating === "e" ? "explicit" : post.rating === "q" ? "questionable" : "safe",
          score: post.total_score || 0,
          sourceUrl: `https://chan.sankakucomplex.com/post/${post.id}`,
          createdAt: post.created_at ? new Date(post.created_at.s ? post.created_at.s * 1000 : post.created_at).getTime() : Date.now(),
          mediaType: this.getMediaType(post.file_url),
          isLocal: false
        } as any;
      });
      return posts.length > 0 ? posts[0] : null;
    } catch (e) {
      console.warn("[SankakuProvider] getById failed", e);
      return null;
    }
  }

  async getLatest(page: number): Promise<PlatformImage[]> {
    const { showAdultContent } = useSettingsStore.getState();
    if (!showAdultContent) return [];
    // Pass a special internal tag to bypass the default order:quality injection
    // and naturally return the most recently uploaded images.
    return this.search({ raw: "_sort:new_", positiveTags: ["_sort:new_"], negativeTags: [], predicates: {} }, page);
  }

  async autocompleteTags(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];
    
    const headers = this.getAuthHeaders();
    // Provide a User-Agent that doesn't get blocked by Sankaku
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    
    const url = `https://sankakuapi.com/tags?limit=10&name=${encodeURIComponent(query)}*`;
    
    try {
      const data = await this.fetchJson<any>(url, { headers });
      if (!Array.isArray(data)) return [];
      
      return data.map(tag => {
        const tagName = (tag.name_en || tag.name || "").trim().replace(/ /g, "_");
        if (tag.type === 1) return `artist:${tagName}`;
        if (tag.type === 3) return `series:${tagName}`;
        if (tag.type === 4) return `character:${tagName}`;
        return tagName;
      }).filter(Boolean);
    } catch (e) {
      console.warn("[SankakuProvider] autocomplete failed", e);
      return [];
    }
  }
}
