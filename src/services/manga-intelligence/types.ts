export interface MangaTagCategory {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface MangaTagRelationship {
  id: string;
  parentTag: string;
  childTag: string;
  type: "belongs_to" | "implies" | "related";
}

export interface MangaTagSynonym {
  canonicalTag: string;
  synonym: string;
}

export interface MangaTagAlias {
  alias: string;
  canonicalTag: string;
  confidence: number;
}

export interface MangaInterestProfile {
  id: string;
  type: "dominant" | "supporting";
  name: string;
  weight: number;
  createdAt?: string;
}

export interface MangaFollowedEntity {
  id: string;
  type: "manga" | "character" | "author" | "publisher" | "studio" | "franchise" | "genre" | "tag" | "series";
  name: string;
  entityId?: string;
  followedAt?: string;
}

export interface SmartRecommendation {
  item: any; // Raw candidate item (e.g., from ScraperService)
  score: number;
  matchReasons: string[];
}
