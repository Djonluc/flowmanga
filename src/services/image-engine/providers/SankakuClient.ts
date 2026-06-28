import { BaseProvider } from "./BaseProvider";
import { TagParser } from "../parser/TagParser";
import type { 
  ImageMedia, 
  StructuredQuery, 
  EngineSearchOptions,
  SourceCapabilities,
  ContentRating
} from "../types";
import { useSettingsStore } from "../../../stores/useSettingsStore";

interface SankakuPost {
  id?: number;
  created_at?: string; // e.g. JSON struct or string
  rating?: string;
  file_url?: string;
  sample_url?: string;
  preview_url?: string;
  tags?: Array<{ name: string; type: number; name_en?: string }>;
  width?: number;
  height?: number;
  file_type?: string; // e.g. "video/mp4", "image/jpeg"
}

export class SankakuClient extends BaseProvider {
  readonly id = "sankaku";
  readonly name = "Sankaku Complex";
  readonly baseUrl = "https://chan.sankakucomplex.com";
  
  readonly capabilities: SourceCapabilities = {
    supportsNegativeTags: true,
    maxTagsPerRequest: 4, // Typical anonymous limit for Sankaku
    supportsSort: true,
    supportsScore: true,
    nativeRecommendations: true,
    status: "auth_required",
    authentication: true,
    requiresCookies: true,
    authUrl: "https://chan.sankakucomplex.com/en/user/login"
  };

  private getAuthHeaders(): Record<string, string> {
    const auth = useSettingsStore.getState().booruAuth?.[this.id];
    const headers: Record<string, string> = {};
    
    if (auth?.sessionCookies) {
      headers["Cookie"] = auth.sessionCookies;
    }
    
    if (auth?.localStorage) {
      const token = auth.localStorage["access_token"];
      if (token && token.length > 10) {
        // Remove quotes if JSON stringified
        headers["Authorization"] = `Bearer ${token.replace(/^"|"$/g, '')}`;
      }
    }
    
    return headers;
  }

  async search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]> {
    const allowance = 4;
    const apiTags: string[] = [];
    const localFilterNegativeTags: string[] = [];
    const localFilterPositiveTags: string[] = [];
    
    for (const p of query.positiveTags) {
      if (apiTags.length < allowance) apiTags.push(p);
      else localFilterPositiveTags.push(p);
    }
    for (const n of query.negativeTags) {
      if (apiTags.length < allowance) apiTags.push(`-${n}`);
      else localFilterNegativeTags.push(n);
    }
    
    if (options.ratingFilter === "sfw") {
      apiTags.push("rating:safe");
    }

    const tagsQueryString = apiTags.map(TagParser.normalizeBooruTag).join(" ");
    
    const hasLocalFilters = localFilterNegativeTags.length > 0 || localFilterPositiveTags.length > 0;
    const targetLimit = options.limit || 20;
    const limit = hasLocalFilters ? 100 : targetLimit;

    const headers = this.getAuthHeaders();
    if (!headers["Cookie"] && !headers["Authorization"]) {
      console.warn(`[SankakuClient] Missing session credentials. Aborting to avoid ban.`);
      return [];
    }
    
    let accumulatedResults: ImageMedia[] = [];
    const requestedPage = options.page || 1;
    
    // If we have local filters, one logical "page" maps to up to 5 API pages
    const maxApiPages = hasLocalFilters ? 5 : 1;
    let currentApiPage = hasLocalFilters ? ((requestedPage - 1) * maxApiPages) + 1 : requestedPage;
    let attempts = 0;

    while (attempts < maxApiPages && accumulatedResults.length < targetLimit) {
      attempts++;
      try {
        const data = await this.fetchJson<SankakuPost[] | { data?: SankakuPost[] }>("https://sankakuapi.com/posts", {
          tags: tagsQueryString,
          page: currentApiPage,
          limit,
        }, headers);

        // Handle both array and paginated object responses
        const posts = Array.isArray(data) ? data : (data as { data?: SankakuPost[] })?.data || [];
        
        if (posts.length === 0) {
          break; // End of API feed
        }
        
        // Gather all unique tags
        const allUniqueTags = new Set<string>();
        posts.forEach(post => {
          if (Array.isArray(post.tags)) {
            post.tags.forEach(t => {
              const name = t.name_en || t.name;
              if (name) allUniqueTags.add(name);
            });
          }
        });

        const tagTypes = await this.resolveTags(Array.from(allUniqueTags));

        let results = this.mapPosts(posts, tagTypes);

        if (hasLocalFilters) {
          results = results.filter(post => {
            const postTags = new Set(post.tags.map(t => t.toLowerCase()));
            for (const pt of localFilterPositiveTags) {
              if (!postTags.has(TagParser.normalizeBooruTag(pt))) return false;
            }
            for (const nt of localFilterNegativeTags) {
              if (postTags.has(TagParser.normalizeBooruTag(nt))) return false;
            }
            return true;
          });
        }

        accumulatedResults = accumulatedResults.concat(results);
        
        if (accumulatedResults.length >= targetLimit) {
          break;
        }

        currentApiPage++;
      } catch (e) {
        console.warn(`[SankakuClient] API fetch failed on page ${currentApiPage}`, e);
        break;
      }
    }

    if (hasLocalFilters && accumulatedResults.length > targetLimit) {
      accumulatedResults = accumulatedResults.slice(0, targetLimit);
    }

    return accumulatedResults;
  }

  async getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]> {
    const headers = this.getAuthHeaders();
    if (!headers["Cookie"] && !headers["Authorization"]) return [];

    return this.search({
      raw: "",
      positiveTags: ["order:quality"],
      negativeTags: [],
      ratingFilter: options.ratingFilter
    }, { ...options, limit: options.limit || 40 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRecommendations(_image: ImageMedia): Promise<ImageMedia[]> {
    return [];
  }

  private mapPosts(posts: SankakuPost[], tagTypes: Map<string, string>): ImageMedia[] {
    if (!Array.isArray(posts)) return [];
    
    return posts
      .filter(p => p.id && (p.file_url || p.sample_url || p.preview_url))
      .map(post => {
        const preview = post.preview_url || post.sample_url || post.file_url || "";
        const sample = post.sample_url || post.file_url || preview;
        const full = post.file_url || sample;

        const ratingMap: Record<string, ContentRating> = {
          "s": "safe",
          "q": "questionable",
          "e": "explicit",
        };

        const isVideo = post.file_type?.startsWith("video/") || full.match(/\.(mp4|webm)$/i);
        const isGif = post.file_type === "image/gif" || full.match(/\.(gif)$/i);

        const allTags: string[] = [];
        const artistTags: string[] = [];
        const characterTags: string[] = [];
        const copyrightTags: string[] = [];
        const generalTags: string[] = [];
        const metaTags: string[] = [];

        if (Array.isArray(post.tags)) {
          post.tags.forEach(t => {
            const name = t.name_en || t.name;
            allTags.push(name);
            
            // Allow resolved type to override local if needed, although local is usually right
            const typeValue = tagTypes.has(name.toLowerCase()) ? parseInt(tagTypes.get(name.toLowerCase())!) : t.type;
            
            switch (typeValue) {
              case 1: artistTags.push(name); break;
              case 3: copyrightTags.push(name); break;
              case 4: characterTags.push(name); break;
              case 5: metaTags.push(name); break;
              case 0: generalTags.push(name); break;
              default: generalTags.push(name); break;
            }
          });
        }

        return {
          id: `${this.id}-${post.id}`,
          sourceId: String(post.id),
          providerId: this.id,
          title: `Sankaku ${post.id}`,
          thumbnailUrl: this.ensureAbsoluteUrl(preview),
          previewUrl: this.ensureAbsoluteUrl(preview),
          sampleUrl: this.ensureAbsoluteUrl(sample),
          fullUrl: this.ensureAbsoluteUrl(full),
          width: post.width,
          height: post.height,
          tags: allTags,
          generalTags,
          characterTags,
          artistTags,
          copyrightTags,
          metaTags,
          rating: ratingMap[post.rating || ""] || "unknown",
          score: 0,
          createdAt: typeof post.created_at === "string" ? post.created_at : new Date().toISOString(),
          mediaType: isVideo ? "video" : isGif ? "gif" : "image",
          contentCategory: "image",
          sourceUrl: `https://chan.sankakucomplex.com/post/show/${post.id}`,
        };
      });
  }
}
