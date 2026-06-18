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
  sourceUrl: string; // URL back to the original post
  createdAt: number; // Unix timestamp
  
  // Local State
  isLocal: boolean;
  localPath?: string;
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
  query: string; // e.g., "source:danbooru cat_ears"
  createdAt: number;
  lastPlayedAt?: number;
}
