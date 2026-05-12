/**
 * FlowManga Source Provider System — Type Definitions
 *
 * This module defines the interface contract for all source providers.
 * Each scraper source (MangaDex, ManhwaRead, Rule34, etc.) implements
 * the SourceProvider interface and registers itself with the SourceRegistry.
 */

// ─── Content Classification ─────────────────────────────────────────

/**
 * Defines the fundamental content archetype of a source.
 * This drives reader mode selection, Library integration behavior,
 * and persistence rules.
 */
export type ContentType = "manga" | "comic" | "doujin" | "gallery" | "album";

/**
 * Supported media formats across all sources.
 */
export type MediaType = "image" | "gif" | "video" | "animated";

// ─── Provider Interface ─────────────────────────────────────────────

/**
 * Core contract for all source providers.
 *
 * Each provider encapsulates all knowledge about a specific source:
 * how to fetch content, what content type it serves, what features
 * it supports, and how it should integrate with the UI.
 */
export interface SourceProvider {
  /** Unique identifier for this provider (e.g. 'mangadex', 'rule34') */
  readonly id: string;

  /** Human-readable display name */
  readonly name: string;

  /** Domain(s) this provider handles (without www.) */
  readonly domains: string[];

  /** What kind of content this source provides */
  readonly contentType: ContentType;

  /** Supported media formats */
  readonly mediaTypes: MediaType[];

  /** Feature capability flags */
  readonly capabilities: SourceCapabilities;

  /** Whether content should persist to Library by default */
  readonly defaultPersistence: "library" | "discovery" | "ask";

  /** Reader modes compatible with this source's content */
  readonly readerModes: ReaderMode[];

  /** Whether the source is currently active and usable */
  readonly isEnabled?: boolean;

  // ─── URL Matching ───

  /** Returns true if the given URL belongs to this provider */
  matchesUrl(url: string): boolean;

  // ─── Content Fetching ───

  /** Fetch images/pages from a chapter, album, or gallery page */
  fetchContent(url: string): Promise<SourceContent>;

  /** Fetch series/album metadata and chapter listing (optional) */
  fetchSeries?(url: string): Promise<SourceSeries>;

  /** Get chapter feed for a known series by its source-specific ID */
  fetchChapterFeed?(seriesId: string): Promise<SourceChapter[]>;

  // ─── Search ───

  /** Search for content by text query */
  search?(
    query: string,
    page?: number,
    limit?: number,
  ): Promise<SourceSearchResult[]>;

  /** Search by tags (for booru-style sources) */
  searchByTags?(
    tags: string[],
    page?: number,
    limit?: number,
  ): Promise<SourceSearchResult[]>;

  /** Fetch trending/popular content (for discovery) */
  fetchPopular?(
    page?: number,
    limit?: number,
    coloredOnly?: boolean,
  ): Promise<SourceSearchResult[]>;

  /** Fetch latest updates (for discovery) */
  fetchLatest?(
    page?: number,
    limit?: number,
    coloredOnly?: boolean,
  ): Promise<SourceSearchResult[]>;
}

// ─── Capability Flags ───────────────────────────────────────────────

export interface SourceCapabilities {
  /** Provider supports text-based search */
  search: boolean;
  /** Provider supports tag-based filtering */
  tagSearch: boolean;
  /** Provider has a browsable series listing */
  seriesBrowse: boolean;
  /** Provider can return a chapter feed for a series ID */
  chapterFeed: boolean;
  /** Provider supports paginated results */
  pagination: boolean;
  /** Provider requires or supports authentication */
  authentication: boolean;
}

// ─── Reader Mode ────────────────────────────────────────────────────

export type ReaderMode =
  | "vertical"
  | "single"
  | "dual"
  | "gallery"
  | "slideshow";

// ─── Content Types ──────────────────────────────────────────────────

export interface SourceContent {
  images: SourceImage[];
  metadata?: SourceMetadata;
}

export interface SourceImage {
  url: string;
  pageNumber: number;
  mediaType?: MediaType;
  encryptionKey?: string;
}

export interface SourceMetadata {
  title?: string;
  description?: string;
  coverUrl?: string;
  author?: string;
  tags?: string[];
  sourceId?: string;
  sourceUrl?: string;
  rating?: string;
  mediaCount?: number;
}

export interface SourceSeries {
  title: string;
  description: string;
  coverUrl: string;
  seriesUrl: string;
  source: string;
  tags?: string[];
  chapters: SourceChapter[];
}

export interface SourceChapter {
  id: string;
  number: string;
  url: string;
  title?: string;
  source?: string;
}

export interface SourceSearchResult {
  id: string;
  title: string;
  coverUrl?: string;
  tags?: string[];
  description?: string;
  source: string;
  contentType: ContentType;
  url: string;
}
