import { BaseProvider } from "./BaseProvider";
import { TagParser } from "../parser/TagParser";
import type { 
  ImageMedia, 
  StructuredQuery, 
  EngineSearchOptions,
  SourceCapabilities,
  ContentRating
} from "../types";

interface SafebooruPost {
  id: number;
  created_at: string;
  score: number;
  rating: string;
  file_url: string;
  sample_url: string;
  preview_url: string;
  tags: string;
  width: number;
  height: number;
  image: string;
  directory: number;
}

export class SafebooruClient extends BaseProvider {
  readonly id = "safebooru";
  readonly name = "Safebooru";
  readonly baseUrl = "https://safebooru.org";
  readonly domains = ["safebooru.org"];
  readonly mediaDomain = "image";
  readonly isEnabled = true;

  readonly capabilities: SourceCapabilities = {
    supportsNegativeTags: true,
    maxTagsPerRequest: 100,
    supportsSort: true,
    supportsScore: true,
    nativeRecommendations: false,
    status: "working"
  };

  async search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]> {
    const apiTags = [...query.positiveTags, ...query.negativeTags.map(n => `-${n}`)];
    
    // Safebooru is exclusively SFW, no need to inject SFW tags

    const tagsQueryString = apiTags.map(TagParser.normalizeBooruTag).join(" ");

    const data = await this.fetchJson<SafebooruPost[] | { post?: SafebooruPost[] }>("/index.php", {
      page: "dapi",
      s: "post",
      q: "index",
      json: 1,
      tags: tagsQueryString,
      pid: (options.page || 1) - 1, // 0-indexed
      limit: options.limit || 40,
    });

    const posts = Array.isArray(data) ? data : (data as { post?: SafebooruPost[] })?.post || [];
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

  private mapPosts(posts: SafebooruPost[]): ImageMedia[] {
    if (!Array.isArray(posts)) return [];
    
    return posts
      .filter(p => p.id && (p.file_url || p.image))
      .map(post => {
        // Safebooru JSON can be weird, sometimes it gives relative URLs
        let preview = post.preview_url || `//safebooru.org/thumbnails/${post.directory}/thumbnail_${post.image}`;
        let sample = post.sample_url || `//safebooru.org/samples/${post.directory}/sample_${post.image}`;
        let full = post.file_url || `//safebooru.org/images/${post.directory}/${post.image}`;

        if (preview.startsWith("//")) preview = `https:${preview}`;
        if (sample.startsWith("//")) sample = `https:${sample}`;
        if (full.startsWith("//")) full = `https:${full}`;

        const tags = (post.tags || "").split(" ").filter(Boolean);

        const ratingMap: Record<string, ContentRating> = {
          "s": "safe",
          "q": "questionable",
          "e": "explicit",
          "general": "safe",
          "sensitive": "questionable"
        };

        const isVideo = full.match(/\.(mp4|webm)$/i);
        const isGif = full.match(/\.(gif)$/i);

        return {
          id: `${this.id}-${post.id}`,
          sourceId: String(post.id),
          providerId: this.id,
          title: `Safebooru ${post.id}`,
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
          rating: ratingMap[post.rating] || "safe", // Safebooru defaults safe
          score: post.score || 0,
          createdAt: post.created_at ? new Date(parseInt(post.created_at as unknown as string) * 1000).toISOString() : new Date().toISOString(),
          mediaType: isVideo ? "video" : isGif ? "gif" : "image",
          contentCategory: "image",
          sourceUrl: `${this.baseUrl}/index.php?page=post&s=view&id=${post.id}`,
        };
      });
  }
}
