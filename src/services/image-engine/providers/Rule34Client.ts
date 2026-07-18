import { BaseProvider } from "./BaseProvider";
import { TagParser } from "../parser/TagParser";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { parseRule34TagInfo } from "../../Rule34TagMetadata";
import type { 
  ImageMedia, 
  StructuredQuery, 
  EngineSearchOptions,
  SourceCapabilities,
  ContentRating
} from "../types";

export interface Rule34Post {
  id: number;
  parent_id?: number;
  pool_id?: number;
  score: number;
  directory: number;
  image: string;
  width: number;
  height: number;
  tags: string;
  rating: string;
  file_url: string;
  sample_url: string;
  preview_url: string;
  tag_info?: unknown;
}

export class Rule34Client extends BaseProvider {
  readonly id = "rule34";
  readonly name = "Rule34";
  readonly baseUrl = "https://api.rule34.xxx";
  readonly domains = ["rule34.xxx"];
  readonly mediaDomain = "image";
  readonly isEnabled = true;

  readonly capabilities: SourceCapabilities = {
    supportsNegativeTags: true,
    maxTagsPerRequest: 4,
    supportsSort: false,
    supportsScore: true,
    nativeRecommendations: false,
    status: "auth_required",
    authentication: true, // Rule34 API requires user_id + api_key since mid-2025
    authUrl: "https://rule34.xxx/index.php?page=account&s=options"
  };

  private getAuthParams(): Record<string, string> {
    const auth = useSettingsStore.getState().booruAuth?.[this.id];
    // Auth is optional — include if available, otherwise use public API
    if (auth?.userId && auth?.apiKey) {
      return {
        user_id: auth.userId,
        api_key: auth.apiKey
      };
    }
    return {};
  }

  async search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]> {
    const auth = this.getAuthParams();
    const { showAdultContent } = useSettingsStore.getState();

    // Rule34 API requires authentication since mid-2025 — abort if no credentials
    if (!auth.user_id || !auth.api_key) {
      console.warn(`[Rule34Client] No API credentials. Go to Settings → Sources to add your Rule34 User ID and API Key.`);
      return [];
    }

    const allowance = this.capabilities.maxTagsPerRequest || 4;
    const apiTags: string[] = [];
    const localFilterNegativeTags: string[] = [];
    const localFilterPositiveTags: string[] = [];

    // Prioritize safe/explicit tag if adult content is off
    if (!showAdultContent || options.ratingFilter === "sfw") {
      apiTags.push("rating:safe");
    }

    for (const p of query.positiveTags) {
      if (apiTags.length < allowance) apiTags.push(p);
      else localFilterPositiveTags.push(p);
    }
    for (const n of query.negativeTags) {
      if (apiTags.length < allowance) apiTags.push(`-${n}`);
      else localFilterNegativeTags.push(n);
    }

    // Rule34 API does not support sort: tags — strip them
    const cleanTags = apiTags.filter(t => !t.startsWith("sort:"));
    const tagsQueryString = cleanTags.map(TagParser.normalizeBooruTag).join(" ");

    const hasLocalFilters = localFilterNegativeTags.length > 0 || localFilterPositiveTags.length > 0;
    const targetLimit = options.limit || 40;
    const limit = hasLocalFilters ? 100 : targetLimit;

    let accumulatedResults: ImageMedia[] = [];
    const requestedPage = options.page || 1;
    
    // If we have local filters, one logical "page" maps to up to 5 API pages
    const maxApiPages = hasLocalFilters ? 5 : 1;
    let currentApiPage = hasLocalFilters ? ((requestedPage - 1) * maxApiPages) + 1 : requestedPage;
    let attempts = 0;

    while (attempts < maxApiPages && accumulatedResults.length < targetLimit) {
      attempts++;
      try {
        console.log(`[Rule34Client] Requesting tags: ${tagsQueryString}`);
        const data = await this.fetchJson<any>("/index.php", {
          page: "dapi",
          s: "post",
          q: "index",
          json: "1",
          tags: tagsQueryString,
          fields: "tag_info",
          pid: String(currentApiPage - 1), // 0-indexed
          limit: String(limit),
          ...auth
        });

        if (!Array.isArray(data)) {
          console.warn("[Rule34Client] Unexpected response (not an array):", data);
          if (typeof data === "string") {
            console.error(`[Rule34Client] API Error Message: ${data}`);
          }
          break;
        }

        if (data.length === 0) {
          break; // End of API feed
        }

        console.log(`[Rule34Client] Success: Received ${data.length} images.`);

        // Gather all unique tags from the entire result set
        const allUniqueTags = new Set<string>();
        data.forEach(post => {
          (post.tags || "").split(" ").forEach((t: string) => {
            if (t) allUniqueTags.add(t);
          });
        });

        // Bulk resolve tags
        const tagTypes = await this.resolveTags(Array.from(allUniqueTags));

        let results = this.mapPosts(data, tagTypes);

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
        console.error("[Rule34Client] API request failed on page " + currentApiPage + ":", e);
        break;
      }
    }

    if (hasLocalFilters && accumulatedResults.length > targetLimit) {
      accumulatedResults = accumulatedResults.slice(0, targetLimit);
    }

    return accumulatedResults;
  }

  async getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]> {
    const { showAdultContent } = useSettingsStore.getState();
    return this.search({
      raw: "",
      positiveTags: showAdultContent ? [] : ["rating:safe"],
      negativeTags: [],
      ratingFilter: options.ratingFilter
    }, { ...options, limit: options.limit || 40 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRecommendations(_image: ImageMedia): Promise<ImageMedia[]> {
    return [];
  }

  private mapPosts(posts: Rule34Post[], tagTypes: Map<string, string>): ImageMedia[] {
    if (!Array.isArray(posts)) return [];
    
    return posts
      .filter(p => p.id && p.file_url)
      .map(post => {
        let preview = post.preview_url || post.file_url;
        let sample = post.sample_url || post.file_url;
        let full = post.file_url;

        if (preview.startsWith("//")) preview = `https:${preview}`;
        if (sample.startsWith("//")) sample = `https:${sample}`;
        if (full.startsWith("//")) full = `https:${full}`;

        const metaTagKeywords = new Set([
          "video", "animated", "sound", "webm", "mp4", "gif", "3d", "highres", 
          "absurdres", "comic", "translation_request", "translated", "english", 
          "japanese", "text", "watermark", "signature", "patreon", "patreon_username",
          "twitter_username", "artist_name", "artist_request", "fanbox", "monochrome",
          "sketch", "colored"
        ]);

        const allTags = (post.tags || "").split(" ").filter(Boolean);
        const generalTags: string[] = [];
        const metaTags: string[] = [];
        const characterTags: string[] = [];
        const artistTags: string[] = [];
        const copyrightTags: string[] = [];
        const postTagTypes = parseRule34TagInfo(post.tag_info);

        allTags.forEach(t => {
          const lowerTag = t.toLowerCase();
          const type = postTagTypes.get(lowerTag) || tagTypes.get(lowerTag);
          
          if (type === "1" || type === "artist") {
            artistTags.push(t);
          } else if (type === "3" || type === "copyright") {
            copyrightTags.push(t);
          } else if (type === "4" || type === "character") {
            characterTags.push(t);
          } else if (type === "5" || type === "meta") {
            metaTags.push(t);
          } else if (type === "0" || type === "general") {
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

        const ratingMap: Record<string, ContentRating> = {
          "safe": "safe",
          "questionable": "questionable",
          "explicit": "explicit",
        };

        const isVideo = full.match(/\.(mp4|webm)$/i);
        const isGif = full.match(/\.(gif)$/i);

        return {
          id: `${this.id}-${post.id}`,
          sourceId: String(post.id),
          providerId: this.id,
          title: `Rule34 ${post.id}`,
          thumbnailUrl: this.ensureAbsoluteUrl(sample),
          previewUrl: this.ensureAbsoluteUrl(preview),
          sampleUrl: this.ensureAbsoluteUrl(sample),
          fullUrl: this.ensureAbsoluteUrl(full),
          width: post.width || 0,
          height: post.height || 0,
          tags: [...new Set(allTags)],
          generalTags: [...new Set(generalTags)],
          characterTags: [...new Set(characterTags)],
          artistTags: [...new Set(artistTags)],
          copyrightTags: [...new Set(copyrightTags)],
          metaTags: [...new Set(metaTags)],
          rating: ratingMap[post.rating] || "explicit", // Default to explicit for rule34
          score: post.score || 0,
          createdAt: new Date().toISOString(), // Rule34 JSON doesn't always provide created_at easily
          mediaType: isVideo ? "video" : isGif ? "gif" : "image",
          contentCategory: "image",
          sourceUrl: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`,
          relatedGroupId: post.pool_id
            ? `${this.id}-pool-${post.pool_id}`
            : post.parent_id
              ? `${this.id}-parent-${post.parent_id}`
              : undefined,
        };
      });
  }
}
