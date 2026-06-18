import { BaseProvider } from "./BaseProvider";
import { TagParser } from "../parser/TagParser";
import type { 
  ImageMedia, 
  StructuredQuery, 
  EngineSearchOptions,
  SourceCapabilities,
  ContentRating
} from "../types";

interface YanderePost {
  id: number;
  created_at: number;
  score: number;
  rating: string;
  file_url: string;
  sample_url: string;
  preview_url: string;
  tags: string;
  width: number;
  height: number;
}

export class YandeReClient extends BaseProvider {
  readonly id = "yandere";
  readonly name = "Yande.re";
  readonly baseUrl = "https://yande.re";
  readonly domains = ["yande.re"];
  readonly mediaDomain = "image";
  readonly isEnabled = true;

  readonly capabilities: SourceCapabilities = {
    supportsNegativeTags: true,
    maxTagsPerRequest: 6,
    supportsSort: true,
    supportsScore: true,
    nativeRecommendations: false,
    status: "working"
  };

  async search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]> {
    const apiTags = [...query.positiveTags, ...query.negativeTags.map(n => `-${n}`)];
    
    if (options.ratingFilter === "sfw") {
      apiTags.push("rating:safe");
    }

    const tagsQueryString = apiTags.map(TagParser.normalizeBooruTag).join(" ");

    const data = await this.fetchJson<YanderePost[]>("/post.json", {
      tags: tagsQueryString,
      page: options.page || 1,
      limit: options.limit || 40,
    });

    return this.mapPosts(data || []);
  }

  async getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]> {
    return this.search({
      raw: "",
      positiveTags: ["order:rank"], // popular
      negativeTags: [],
      ratingFilter: options.ratingFilter
    }, { ...options, limit: options.limit || 40 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRecommendations(_image: ImageMedia): Promise<ImageMedia[]> {
    return [];
  }

  private mapPosts(posts: YanderePost[]): ImageMedia[] {
    if (!Array.isArray(posts)) return [];
    
    return posts
      .filter(p => p.id && p.file_url)
      .map(post => {
        const preview = post.preview_url || post.file_url;
        const sample = post.sample_url || post.file_url;
        const full = post.file_url;

        const tags = (post.tags || "").split(" ").filter(Boolean);

        const ratingMap: Record<string, ContentRating> = {
          "s": "safe",
          "q": "questionable",
          "e": "explicit",
        };

        const isVideo = full.match(/\.(mp4|webm)$/i);
        const isGif = full.match(/\.(gif)$/i);

        return {
          id: `${this.id}-${post.id}`,
          sourceId: String(post.id),
          providerId: this.id,
          title: `Yande.re ${post.id}`,
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
          createdAt: new Date(post.created_at * 1000).toISOString(),
          mediaType: isVideo ? "video" : isGif ? "gif" : "image",
          contentCategory: "image",
          sourceUrl: `${this.baseUrl}/post/show/${post.id}`,
        };
      });
  }
}
