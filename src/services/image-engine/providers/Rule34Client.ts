import { BaseProvider } from "./BaseProvider";
import { TagParser } from "../parser/TagParser";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import type { 
  ImageMedia, 
  StructuredQuery, 
  EngineSearchOptions,
  SourceCapabilities,
  ContentRating
} from "../types";

export interface Rule34Post {
  id: number;
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

    const apiTags = [...query.positiveTags, ...query.negativeTags.map(n => `-${n}`)];

    // When adult content is off, restrict to safe posts only
    if (!showAdultContent || options.ratingFilter === "sfw") {
      apiTags.push("rating:safe");
    }

    // Rule34 API does not support sort: tags — strip them
    const cleanTags = apiTags.filter(t => !t.startsWith("sort:"));
    const tagsQueryString = cleanTags.map(TagParser.normalizeBooruTag).join(" ");

    try {
      console.log(`[Rule34Client] Requesting tags: ${tagsQueryString}`);
      const data = await this.fetchJson<any>("/index.php", {
        page: "dapi",
        s: "post",
        q: "index",
        json: "1",
        tags: tagsQueryString,
        pid: String((options.page || 1) - 1), // 0-indexed
        limit: String(options.limit || 40),
        ...auth
      });

      if (!Array.isArray(data)) {
        console.warn("[Rule34Client] Unexpected response (not an array):", data);
        if (typeof data === "string") {
          console.error(`[Rule34Client] API Error Message: ${data}`);
        }
        return [];
      }

      console.log(`[Rule34Client] Success: Received ${data.length} images.`);
      return this.mapPosts(data);
    } catch (e) {
      console.error("[Rule34Client] API request failed:", e);
      return [];
    }
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

  private mapPosts(posts: Rule34Post[]): ImageMedia[] {
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

        allTags.forEach(t => {
          if (metaTagKeywords.has(t.toLowerCase())) {
            metaTags.push(t);
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
          thumbnailUrl: this.ensureAbsoluteUrl(preview),
          previewUrl: this.ensureAbsoluteUrl(preview),
          sampleUrl: this.ensureAbsoluteUrl(sample),
          fullUrl: this.ensureAbsoluteUrl(full),
          width: post.width || 0,
          height: post.height || 0,
          tags: allTags,
          generalTags: generalTags,
          characterTags: [],
          artistTags: [],
          copyrightTags: [],
          metaTags: metaTags,
          rating: ratingMap[post.rating] || "explicit", // Default to explicit for rule34
          score: post.score || 0,
          createdAt: new Date().toISOString(), // Rule34 JSON doesn't always provide created_at easily
          mediaType: isVideo ? "video" : isGif ? "gif" : "image",
          contentCategory: "image",
          sourceUrl: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`,
        };
      });
  }
}
