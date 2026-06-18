import { BaseProvider } from "./BaseProvider";
import type { PlatformImage, SearchQuery } from "../types";

export class NekosProvider extends BaseProvider {
  id = "nekosapi";
  name = "Nekos API";
  capabilities = {
    maxTags: 5,
    supportsNegative: false,
    supportsScore: false,
    authentication: false,
    search: true,
    tagSearch: true,
  };
  
  // They serve images mostly from cdn.nekosapi.com
  domains = ["nekosapi.com", "api.nekosapi.com", "cdn.nekosapi.com"];

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    const limit = 20;
    const offset = (page - 1) * limit;
    
    // Convert array of positive tags to a comma separated string if any
    let tagParam = "";
    if (query.positiveTags.length > 0) {
      tagParam = `&tags=${query.positiveTags.join(",")}`;
    }

    // NekosAPI specific query parameters
    let apiUrl = `https://api.nekosapi.com/v4/images?limit=${limit}&offset=${offset}${tagParam}`;

    // Note: If SFW is strictly required based on settings, we might append rating
    const { useSettingsStore } = await import("../../stores/useSettingsStore");
    const { showAdultContent } = useSettingsStore.getState();
    if (!showAdultContent) {
      apiUrl += `&rating=safe`;
    }

    try {
      const data = await this.fetchJson<any>(apiUrl);
      if (!data || !data.items) return [];

      return data.items.map((item: any) => ({
        id: `nekos-${item.id}`,
        sourceId: item.id.toString(),
        providerId: this.id,
        thumbnailUrl: item.url,
        sampleUrl: item.url,
        fullUrl: item.url,
        width: item.width || 0,
        height: item.height || 0,
        aspectRatio: (item.width || 1) / (item.height || 1),
        tags: Array.isArray(item.tags) ? item.tags : [],
        rating: item.rating || "safe",
        score: 0,
        sourceUrl: item.source_url || `https://nekosapi.com/image/${item.id}`,
        createdAt: Date.now(),
        isLocal: false,
      }));
    } catch (e) {
      console.error("[NekosProvider] Search error:", e);
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    const limit = 20;
    // To ensure freshness we can fetch random items for discovery
    let apiUrl = `https://api.nekosapi.com/v4/images/random?limit=${limit}`;
    
    const { useSettingsStore } = await import("../../stores/useSettingsStore");
    const { showAdultContent } = useSettingsStore.getState();
    if (!showAdultContent) {
      apiUrl += `&rating=safe`;
    }

    try {
      // The random endpoint might return an array directly rather than { items: [...] } depending on v4 spec
      const data = await this.fetchJson<any>(apiUrl);
      
      // Handle both cases gracefully
      const items = Array.isArray(data) ? data : (data.items || []);
      
      return items.map((item: any) => ({
        id: `nekos-${item.id}`,
        sourceId: item.id.toString(),
        providerId: this.id,
        thumbnailUrl: item.url,
        sampleUrl: item.url,
        fullUrl: item.url,
        width: item.width || 0,
        height: item.height || 0,
        aspectRatio: (item.width || 1) / (item.height || 1),
        tags: Array.isArray(item.tags) ? item.tags : [],
        rating: item.rating || "safe",
        score: 0,
        sourceUrl: item.source_url || `https://nekosapi.com/image/${item.id}`,
        createdAt: Date.now(),
        isLocal: false,
      }));
    } catch (e) {
      console.error("[NekosProvider] Discovery error:", e);
      return [];
    }
  }

  async getLatest(page: number): Promise<PlatformImage[]> {
    return this.search({ raw: "", positiveTags: [], negativeTags: [], predicates: {} }, page);
  }
}
