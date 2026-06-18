export type ContentRating = "safe" | "questionable" | "explicit" | "unknown";
export type MediaType = "image" | "video" | "gif" | "html";
export type ContentCategory = "image" | "gallery" | "manga" | "book";

export type ProviderStatus = "working" | "degraded" | "auth_required" | "disabled" | "unknown";

export interface ImageMedia {
  id: string; // Globally unique ID, usually {providerId}-{sourceId}
  sourceId: string; // ID from the provider
  providerId: string; // 'danbooru', 'sankaku', etc.
  title: string;
  
  // Media URLs
  thumbnailUrl: string;
  previewUrl: string;
  sampleUrl: string; // Web-friendly size
  fullUrl: string; // Original, highest resolution
  
  // Metadata
  width?: number;
  height?: number;
  tags: string[];
  artistTags: string[];
  characterTags: string[];
  copyrightTags: string[];
  metaTags: string[];
  generalTags: string[];
  
  rating: ContentRating;
  score: number;
  createdAt: string; // ISO string
  
  // App-specific routing
  mediaType: MediaType;
  contentCategory: ContentCategory;
  sourceUrl: string; // Link to original post
  
  // Extended gallery/manga info
  pageCount?: number;
}

export interface StructuredQuery {
  raw: string;
  positiveTags: string[];
  negativeTags: string[];
  targetSource?: string;
  ratingFilter?: "sfw" | "all";
}

export interface SourceCapabilities {
  supportsNegativeTags: boolean;
  maxTagsPerRequest: number;
  supportsSort: boolean;
  supportsScore: boolean;
  nativeRecommendations: boolean;
  status?: ProviderStatus;
  authentication?: boolean;
  requiresCookies?: boolean;
  authUrl?: string;
}

export interface ProviderConfig {
  baseUrl: string;
  customHeaders?: Record<string, string>;
  auth?: {
    apiKey?: string;
    userId?: string;
  };
}

export interface EngineSearchOptions {
  limit?: number;
  page?: number; // 1-indexed for the engine
  ratingFilter?: "sfw" | "all";
}

export interface AutocompleteResult {
  tag: string;
  postCount: number;
  category: "general" | "character" | "artist" | "copyright" | "meta";
  source: string;
}
