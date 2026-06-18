import { BaseProvider } from "./BaseProvider";
import type { PlatformImage, SearchQuery } from "../types";

export class Rule34Provider extends BaseProvider {
  id = "rule34";
  name = "Rule34";
  
  capabilities = {
    maxTags: 100, // Rule34 allows high tag count
    supportsNegative: true,
    supportsScore: true,
    authentication: false, // Doesn't typically require auth for API
    status: "working",
    search: true,
    tagSearch: true,
  };
  domains = ["rule34.xxx"];

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    const { useSettingsStore } = await import("../../stores/useSettingsStore");
    const { showAdultContent } = useSettingsStore.getState();

    // If the query specifically targets another provider, skip this one
    if (query.predicates["source"] && query.predicates["source"] !== this.id) {
      return [];
    }

    const apiTags = [...query.positiveTags];

    // Add negative tags using -tag syntax
    query.negativeTags.forEach(tag => {
      apiTags.push(`-${tag}`);
    });

    // If adult content is disabled, filter to safe posts only
    if (!showAdultContent) {
      apiTags.push("rating:safe");
    }

    if (!apiTags.some(t => t.startsWith("sort:"))) {
      apiTags.push("sort:score:desc");
    }

    const tagStr = apiTags.join(" ");
    const pid = page - 1; // 0-indexed pages
    
    const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagStr)}&pid=${pid}&limit=40`;
    
    try {
      const response = await this.fetchJson<any[]>(url);
      
      if (!Array.isArray(response)) {
        return [];
      }

      return response.map(post => {
        const fileUrl = post.file_url;
        const sampleUrl = post.sample_url || fileUrl;
        const previewUrl = post.preview_url || sampleUrl;

        return {
          id: `${this.id}-${post.id}`,
          sourceId: post.id.toString(),
          providerId: this.id,
          thumbnailUrl: previewUrl,
          sampleUrl: sampleUrl,
          fullUrl: fileUrl,
          width: post.width,
          height: post.height,
          aspectRatio: post.width / post.height,
          tags: post.tags.split(" ").filter(Boolean),
          rating: post.rating === "e" ? "explicit" : post.rating === "q" ? "questionable" : "safe",
          score: post.score,
          sourceUrl: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`,
          createdAt: post.created_at ? new Date(post.created_at * 1000).getTime() : Date.now(),
          mediaType: this.getMediaType(fileUrl),
          isLocal: false
        };
      });
    } catch (e) {
      console.error(`[${this.name}] Search failed:`, e);
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    const { useSettingsStore } = await import("../../stores/useSettingsStore");
    const { showAdultContent } = useSettingsStore.getState();
    // Pass an empty query — rating filter will be applied inside search()
    return this.search({
      raw: showAdultContent ? "sort:random" : "sort:random rating:safe",
      positiveTags: showAdultContent ? ["sort:random"] : ["sort:random", "rating:safe"],
      negativeTags: [],
      predicates: {}
    }, page);
  }
}
