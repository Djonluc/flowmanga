import { BaseProvider } from "./BaseProvider";
import { TagParser } from "../parser/TagParser";
import type { 
  ImageMedia, 
  StructuredQuery, 
  EngineSearchOptions,
  SourceCapabilities,
  ContentRating
} from "../types";

interface DanbooruPost {
  id?: number;
  created_at?: string;
  score?: number;
  rating?: string;
  file_url?: string;
  large_file_url?: string;
  preview_file_url?: string;
  source?: string;
  tag_string?: string;
  tag_string_general?: string;
  tag_string_character?: string;
  tag_string_copyright?: string;
  tag_string_artist?: string;
  tag_string_meta?: string;
  image_width?: number;
  image_height?: number;
  media_asset?: {
    variants?: Array<{
      type: string;
      url: string;
      width: number;
      height: number;
    }>;
  };
}

export class DanbooruClient extends BaseProvider {
  readonly id = "danbooru";
  readonly name = "Danbooru";
  readonly baseUrl = "https://danbooru.donmai.us";
  
  readonly capabilities: SourceCapabilities = {
    supportsNegativeTags: true,
    maxTagsPerRequest: 2, // Standard anonymous limit
    supportsSort: true,
    supportsScore: true,
    nativeRecommendations: false, // Danbooru 2 API has /post_versions, but no simple "related" endpoint without auth
    status: "working"
  };

  async search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]> {
    // Determine tag allowance based on rating filter (rating:s counts as a tag)
    const allowance = options.ratingFilter === "sfw" ? 1 : 2;
    
    // Pass only the allowed number of tags to Danbooru natively
    // We prioritize positive tags, then negative tags
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
      apiTags.push("rating:s");
    }

    const tagsQueryString = apiTags.map(TagParser.normalizeBooruTag).join(" ");
    
    const hasLocalFilters = localFilterNegativeTags.length > 0 || localFilterPositiveTags.length > 0;
    const targetLimit = options.limit || 20;
    const limit = hasLocalFilters ? 200 : targetLimit;
    
    let accumulatedResults: ImageMedia[] = [];
    const requestedPage = options.page || 1;
    
    // If we have local filters, one logical "page" maps to up to 5 API pages (1000 items)
    const maxApiPages = hasLocalFilters ? 5 : 1;
    let currentApiPage = hasLocalFilters ? ((requestedPage - 1) * maxApiPages) + 1 : requestedPage;
    let attempts = 0;

    while (attempts < maxApiPages && accumulatedResults.length < targetLimit) {
      attempts++;
      try {
        const data = await this.fetchJson<DanbooruPost[]>("/posts.json", {
          tags: tagsQueryString,
          page: currentApiPage,
          limit,
        });

        // Break if the API returns completely empty (end of feed)
        if (!Array.isArray(data) || data.length === 0) {
          break;
        }

        let results = this.mapPosts(data);

        // Client-side fallback filtering
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
        
        // Stop fetching early if we hit the limit without needing all API pages
        if (accumulatedResults.length >= targetLimit) {
          break;
        }

        currentApiPage++;
      } catch (e) {
        console.warn(`[DanbooruClient] API fetch failed on page ${currentApiPage}`, e);
        break;
      }
    }

    if (hasLocalFilters && accumulatedResults.length > targetLimit) {
      accumulatedResults = accumulatedResults.slice(0, targetLimit);
    }

    return accumulatedResults;
  }

  async getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]> {
    return this.search({
      raw: "",
      positiveTags: [],
      negativeTags: [],
      ratingFilter: options.ratingFilter
    }, { ...options, limit: options.limit || 40 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRecommendations(_image: ImageMedia): Promise<ImageMedia[]> {
    // Danbooru doesn't have a great unauthenticated recommendations endpoint
    // We will rely on the RecommendationEngine's Jaccard tag similarity instead.
    return [];
  }

  private mapPosts(posts: DanbooruPost[]): ImageMedia[] {
    if (!Array.isArray(posts)) return [];
    
    return posts
      .filter(p => {
        if (!p.id) return false;
        
        const hasFile = p.file_url && p.file_url.length > 0;
        const hasVariants = p.media_asset?.variants && p.media_asset.variants.length > 0;
        
        // If neither file_url nor variants exist, it's heavily restricted
        if (!hasFile && !hasVariants) return false;
        
        // Danbooru uses this placeholder for Gold-tier/Restricted posts for anonymous users
        if (p.file_url && p.file_url.includes("download-preview.png")) return false;
        if (p.large_file_url && p.large_file_url.includes("download-preview.png")) return false;
        if (p.preview_file_url && p.preview_file_url.includes("download-preview.png")) return false;
        
        // Exclude rating:e if user requested sfw natively, just to be safe
        if (p.rating === "e") return false;
        
        return true;
      })
      .map(post => {
        let preview = post.preview_file_url || post.file_url || "";
        let sample = post.large_file_url || post.file_url || "";
        let full = post.file_url || "";

        if (post.media_asset?.variants) {
          const variants = post.media_asset.variants;
          const getVariant = (types: string[]) => {
            const v = variants.find(v => types.includes(v.type));
            return v ? v.url : null;
          };
          preview = getVariant(['180x180', '360x360']) || preview;
          sample = getVariant(['sample', '720x720']) || sample;
          full = getVariant(['original']) || full;
        }

        const toTags = (str?: string) => (str || "").split(" ").filter(Boolean);

        const ratingMap: Record<string, ContentRating> = {
          "s": "safe",
          "q": "questionable",
          "e": "explicit",
        };

        return {
          id: `${this.id}-${post.id}`,
          sourceId: String(post.id),
          providerId: this.id,
          title: `Danbooru ${post.id}`,
          thumbnailUrl: this.ensureAbsoluteUrl(preview),
          previewUrl: this.ensureAbsoluteUrl(preview),
          sampleUrl: this.ensureAbsoluteUrl(sample),
          fullUrl: this.ensureAbsoluteUrl(full),
          width: post.image_width,
          height: post.image_height,
          tags: toTags(post.tag_string),
          generalTags: toTags(post.tag_string_general),
          characterTags: toTags(post.tag_string_character),
          artistTags: toTags(post.tag_string_artist),
          copyrightTags: toTags(post.tag_string_copyright),
          metaTags: toTags(post.tag_string_meta),
          rating: ratingMap[post.rating || ""] || "unknown",
          score: post.score || 0,
          createdAt: post.created_at || new Date().toISOString(),
          mediaType: full.match(/\.(mp4|webm)$/i) ? "video" : full.match(/\.(gif)$/i) ? "gif" : "image",
          contentCategory: "image",
          sourceUrl: `${this.baseUrl}/posts/${post.id}`,
        };
      });
  }
}
