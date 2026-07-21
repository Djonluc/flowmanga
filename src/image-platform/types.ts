/**
 * Flow Image Platform - Core Types
 * A completely decoupled, high-performance architecture for image collection and browsing.
 */

export interface PlatformImage {
  id: string; // Globally unique ID (e.g. "danbooru-12345")
  sourceId: string; // The ID on the source platform
  providerId: string; // e.g., "danbooru", "gelbooru"
  
  // URLs
  thumbnailUrl: string; // Preferred grid image; providers may use their sharp sample URL
  previewUrl?: string; // Lower-resolution fallback when the preferred URL fails
  sampleUrl: string; // Medium version, suitable for grid view or slideshow
  fullUrl: string; // Original, uncompressed version
  mediaStatus?: 'available' | 'login_required' | 'session_access_required' | 'premium_required' | 'unavailable';
  
  // Dimensions
  width: number;
  height: number;
  aspectRatio: number; // width / height
  
  // Metadata
  tags: string[]; // Flat list of all tags for easy searching
  artistTags?: string[];
  characterTags?: string[];
  copyrightTags?: string[];
  generalTags?: string[];
  metaTags?: string[];
  rating: 'safe' | 'questionable' | 'explicit' | 'unknown';
  score: number;
  sourceUrl?: string; // Optional URL back to the source post
  createdAt?: number; // timestamp

  // Optional source relationships and access metadata.
  title?: string;
  relatedGroupId?: string;
  relatedIndex?: number;
  relatedGroupSize?: number;
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
  
  // Local State
  isLocal?: boolean; // Whether the image was ingested locally instead of from a remote provider
  localPath?: string; // Absolute path to the downloaded file if it exists locally
  folderId?: string;
  mediaType?: 'image' | 'video' | 'gif'; // Cached media type detection
}

export interface SearchQuery {
  raw: string; // The original user input (e.g. "source:danbooru boy -gun")
  positiveTags: string[];
  negativeTags: string[];
  predicates: Record<string, string>; // e.g. { "source": "danbooru" }
}

export interface ImageProvider {
  id: string;
  name: string;
  
  // Core Methods
  search(query: SearchQuery, page: number): Promise<PlatformImage[]>;
  getLatest(page: number): Promise<PlatformImage[]>;
  getDiscovery(page: number): Promise<PlatformImage[]>;
  getById?(id: string, options?: { forceRefresh?: boolean }): Promise<PlatformImage | null>;
  autocompleteTags?(query: string): Promise<string[]>;
  
  // Capabilities
  capabilities: {
    maxTags: number;
    supportsNegative: boolean;
    supportsScore: boolean;
  };
}

export interface SmartPlaylist {
  id: string;
  name: string;
  query: SmartQuery;
  createdAt: number;
  lastPlayedAt?: number;
}

export interface SmartQuery {
  and: string[];
  or: string[];
  exclude: string[];
  allowedMediaTypes?: ('image' | 'video' | 'gif')[]; // Which media types are allowed in this playlist
}
