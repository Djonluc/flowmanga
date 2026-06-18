/**
 * Flow Image Platform - Core Types
 * A completely decoupled, high-performance architecture for image collection and browsing.
 */

export interface PlatformImage {
  id: string; // Globally unique ID (e.g. "danbooru-12345")
  sourceId: string; // The ID on the source platform
  providerId: string; // e.g., "danbooru", "gelbooru"
  
  // URLs
  thumbnailUrl: string; // Smallest version, highly compressed
  sampleUrl: string; // Medium version, suitable for grid view or slideshow
  fullUrl: string; // Original, uncompressed version
  
  // Dimensions
  width: number;
  height: number;
  aspectRatio: number; // width / height
  
  // Metadata
  tags: string[]; // Flat list of all tags for easy searching
  rating: 'safe' | 'questionable' | 'explicit';
  score: number;
  sourceUrl?: string; // Optional URL back to the source post
  createdAt?: number; // timestamp
  
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
  getById?(id: string): Promise<PlatformImage | null>;
  
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
