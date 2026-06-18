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

export interface GelbooruPost {
  id: number;
  created_at: string;
  score: number;
  width: number;
  height: number;
  md5: string;
  directory: string;
  image: string;
  rating: string;
  source: string;
  change: number;
  owner: string;
  creator_id: number;
  parent_id: number;
  sample: number;
  preview_height: number;
  preview_width: number;
  tags: string;
  title: string;
  has_notes: string;
  has_comments: string;
  file_url: string;
  preview_url: string;
  sample_url: string;
  sample_height: number;
  sample_width: number;
  status: string;
  post_locked: number;
  has_children: string;
}

export class GelbooruClient extends BaseProvider {
  readonly id = "gelbooru";
  readonly name = "Gelbooru";
  readonly baseUrl = "https://gelbooru.com";
  readonly domains = ["gelbooru.com"];
  readonly mediaDomain = "image";
  readonly isEnabled = true;

  readonly capabilities: SourceCapabilities = {
    supportsNegativeTags: true,
    maxTagsPerRequest: 4, // Typical anonymous limit, might be higher with auth
    supportsSort: true,
    supportsScore: true,
    nativeRecommendations: false,
    status: "auth_required",
    authentication: true,
    authUrl: "https://gelbooru.com/index.php?page=account&s=options"
  };

  private getAuthParams(): Record<string, string> {
    const auth = useSettingsStore.getState().booruAuth?.[this.id];
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
    if (!auth.user_id) {
      console.warn(`[GelbooruClient] Missing API credentials. Aborting to avoid Cloudflare ban.`);
      return [];
    }

    const apiTags = [...query.positiveTags, ...query.negativeTags.map(n => `-${n}`)];
    
    if (options.ratingFilter === "sfw") {
      apiTags.push("rating:safe");
    }

    const tagsQueryString = apiTags.map(TagParser.normalizeBooruTag).join(" ");

    const data = await this.fetchJson<{ post?: GelbooruPost[] }>("/index.php", {
      page: "dapi",
      s: "post",
      q: "index",
      json: "1",
      tags: tagsQueryString,
      pid: String((options.page || 1) - 1), // Gelbooru uses 0-indexed pagination
      limit: String(options.limit || 40),
      ...auth
    });

    const posts = data?.post || [];
    return this.mapPosts(posts);
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

  private mapPosts(posts: GelbooruPost[]): ImageMedia[] {
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
          title: `Gelbooru ${post.id}`,
          thumbnailUrl: this.ensureAbsoluteUrl(preview),
          previewUrl: this.ensureAbsoluteUrl(preview),
          sampleUrl: this.ensureAbsoluteUrl(sample),
          fullUrl: this.ensureAbsoluteUrl(full),
          width: post.width,
          height: post.height,
          tags: tags,
          generalTags: tags,
          characterTags: [],
          artistTags: [],
          copyrightTags: [],
          metaTags: [],
          rating: ratingMap[post.rating] || "unknown",
          score: post.score || 0,
          createdAt: post.created_at ? new Date(post.created_at).toISOString() : new Date().toISOString(),
          mediaType: isVideo ? "video" : isGif ? "gif" : "image",
          contentCategory: "image",
          sourceUrl: `${this.baseUrl}/index.php?page=post&s=view&id=${post.id}`,
        };
      });
  }
}
