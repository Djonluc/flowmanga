import { BaseProvider } from "./BaseProvider";
import type { PlatformImage, SearchQuery } from "../types";

export class Rule34Provider extends BaseProvider {
  id = "rule34";
  name = "Rule34";
  
  capabilities = {
    maxTags: 100,
    supportsNegative: true,
    supportsScore: true,
    authentication: true, // Rule34 API requires credentials since mid-2025
    authUrl: "https://rule34.xxx/index.php?page=account&s=options",
    status: "auth_required",
    search: true,
    tagSearch: true,
  };
  domains = ["rule34.xxx"];

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    const { useSettingsStore } = await import("../../stores/useSettingsStore");
    const { showAdultContent, booruAuth } = useSettingsStore.getState();

    // Rule34 API requires credentials since mid-2025
    const auth = booruAuth?.['rule34'];
    if (!auth?.userId || !auth?.apiKey) {
      console.warn("[Rule34Provider] No API credentials. Go to Settings → Sources to add your Rule34 User ID and API Key.");
      return [];
    }

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

    // NOTE: Rule34 API does not support sort: tags — sort is not a valid API param
    // Remove any sort: tags that may have come from the query
    const filteredTags = apiTags.filter(t => !t.startsWith("sort:"));

    const tagStr = filteredTags.join(" ");
    const pid = page - 1; // 0-indexed pages
    
    const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagStr)}&pid=${pid}&limit=40&user_id=${encodeURIComponent(auth.userId)}&api_key=${encodeURIComponent(auth.apiKey)}`;
    
    try {
      console.log(`[Rule34Provider] Requesting: ${url.replace(/api_key=[^&]*/, "api_key=***")}`);
      const response = await this.fetchJson<any>(url);
      
      if (!Array.isArray(response)) {
        console.warn("[Rule34Provider] Unexpected response from API (not an array):", response);
        // Rule34 often returns a plain string for errors, like "Missing authentication."
        if (typeof response === "string") {
          console.error(`[Rule34Provider] API Error Message: ${response}`);
        }
        return [];
      }

      console.log(`[Rule34Provider] Success: Received ${response.length} images.`);

      // Gather all unique tags from the result set for bulk resolution
      const allUniqueTags = new Set<string>();
      response.forEach((post: any) => {
        (post.tags || "").split(" ").filter(Boolean).forEach((t: string) => allUniqueTags.add(t));
      });

      // Bulk resolve tag types via the configured API
      const tagTypes = await this.resolveTags(Array.from(allUniqueTags));

      return response.map(post => {
        const fileUrl = post.file_url;
        const sampleUrl = post.sample_url || fileUrl;
        const previewUrl = post.preview_url || sampleUrl;

        const allTags = (post.tags || "").split(" ").filter(Boolean);
        const generalTags: string[] = [];
        const metaTags: string[] = [];
        const characterTags: string[] = [];
        const artistTags: string[] = [];
        const copyrightTags: string[] = [];

        const metaTagKeywords = new Set([
          "video", "animated", "sound", "webm", "mp4", "gif", "3d", "highres", 
          "absurdres", "comic", "translation_request", "translated", "english", 
          "japanese", "text", "watermark", "signature", "patreon", "patreon_username",
          "twitter_username", "artist_name", "artist_request", "fanbox", "monochrome",
          "sketch", "colored"
        ]);

        allTags.forEach((t: string) => {
          const lowerTag = t.toLowerCase();
          const type = tagTypes.get(lowerTag);
          
          if (type === "1") {
            artistTags.push(t);
          } else if (type === "3") {
            copyrightTags.push(t);
          } else if (type === "4") {
            characterTags.push(t);
          } else if (type === "5") {
            metaTags.push(t);
          } else if (type === "0") {
            generalTags.push(t);
          } else if (lowerTag.endsWith("_(artist)")) {
            artistTags.push(t);
          } else if (metaTagKeywords.has(lowerTag)) {
            metaTags.push(t);
          } else if (lowerTag.endsWith("_(character)")) {
            characterTags.push(t);
          } else if (lowerTag.endsWith("_(series)") || lowerTag.endsWith("_(copyright)")) {
            copyrightTags.push(t);
          } else {
            generalTags.push(t);
          }
        });

        return {
          id: `${this.id}-${post.id}`,
          sourceId: post.id.toString(),
          providerId: this.id,
          thumbnailUrl: sampleUrl, // Use sampleUrl instead of previewUrl for sharper thumbnails
          sampleUrl: sampleUrl,
          fullUrl: fileUrl,
          width: post.width,
          height: post.height,
          aspectRatio: post.width / post.height,
          tags: [...new Set(allTags)],
          artistTags: [...new Set(artistTags)],
          characterTags: [...new Set(characterTags)],
          copyrightTags: [...new Set(copyrightTags)],
          generalTags: [...new Set(generalTags)],
          metaTags: [...new Set(metaTags)],
          rating: post.rating === "e" ? "explicit" : post.rating === "q" ? "questionable" : "safe",
          score: post.score,
          sourceUrl: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`,
          createdAt: post.created_at ? new Date(post.created_at * 1000).getTime() : Date.now(),
          mediaType: this.getMediaType(fileUrl),
          isLocal: false
        } as any;
      });
    } catch (e) {
      console.error(`[${this.name}] Search failed:`, e);
      return [];
    }
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    const { useSettingsStore } = await import("../../stores/useSettingsStore");
    const { showAdultContent } = useSettingsStore.getState();
    return this.search({
      raw: "",
      positiveTags: showAdultContent ? [] : ["rating:safe"],
      negativeTags: [],
      predicates: {}
    }, page);
  }

  async autocompleteTags(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];
    
    const url = `https://api.rule34.xxx/autocomplete.php?q=${encodeURIComponent(query)}`;
    
    try {
      const data = await this.fetchJson<any>(url);
      if (!Array.isArray(data)) return [];
      
      return data.map(item => item.value).filter(Boolean);
    } catch (e) {
      console.warn("[Rule34Provider] autocomplete failed", e);
      return [];
    }
  }
}
