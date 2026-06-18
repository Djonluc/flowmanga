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
    supportsSort: true,
    supportsScore: true,
    nativeRecommendations: false,
    status: "working",
    authentication: false, // Auth is optional — API is public
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

    const apiTags = [...query.positiveTags, ...query.negativeTags.map(n => `-${n}`)];
    
    // Rule34 is primarily NSFW, but we can attempt to filter
    if (options.ratingFilter === "sfw") {
      apiTags.push("rating:safe");
    }

    const tagsQueryString = apiTags.map(TagParser.normalizeBooruTag).join(" ");

    const data = await this.fetchJson<Rule34Post[]>("/index.php", {
      page: "dapi",
      s: "post",
      q: "index",
      json: "1",
      tags: tagsQueryString,
      pid: String((options.page || 1) - 1), // 0-indexed
      limit: String(options.limit || 40),
      ...auth
    });

    return this.mapPosts(data || []);
  }

  async getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]> {
    return this.search({
      raw: "",
      positiveTags: ["sort:score:desc"],
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

        const tags = (post.tags || "").split(" ").filter(Boolean);

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
          tags: tags,
          generalTags: tags,
          characterTags: [],
          artistTags: [],
          copyrightTags: [],
          metaTags: [],
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
