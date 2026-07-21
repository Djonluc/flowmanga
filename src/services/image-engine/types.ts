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
  mediaStatus?: 'available' | 'login_required' | 'session_access_required' | 'premium_required' | 'unavailable';
  
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

  // Posts from the same pool, parent/child set, or source-defined sequence.
  // Used to keep related images adjacent in discovery and viewer navigation.
  relatedGroupId?: string;
  relatedIndex?: number;
  
  // Extended gallery/manga info
  pageCount?: number;

  // Source relationships and access metadata.
  parentId?: string;
  poolIds?: string[];
  bookIds?: string[];
  sequence?: number;
  isPremium?: boolean;
  redirectToSignup?: boolean;
  hasChildren?: boolean;
  fileType?: string;
  fileSize?: number;
  videoDuration?: number;
  source?: string;
  author?: string;
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

export interface LegacyImageProvider {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly capabilities: SourceCapabilities;
  search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]>;
  getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]>;
  getLatest(options: EngineSearchOptions): Promise<ImageMedia[]>;
  getRecommendations(image: ImageMedia): Promise<ImageMedia[]>;
  autocomplete(tag: string): Promise<AutocompleteResult[]>;
}
