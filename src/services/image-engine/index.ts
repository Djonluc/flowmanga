import { DiscoveryEngine } from "./DiscoveryEngine";
import { AutocompleteEngine } from "./AutocompleteEngine";
import { CollectionEngine } from "./CollectionEngine";
import { RecommendationEngine } from "./RecommendationEngine";
import { HealthMonitor } from "./HealthMonitor";

import { DanbooruClient } from "./providers/DanbooruClient";
// import { GelbooruClient } from "./providers/GelbooruClient"; // DISABLED — not ready
import { Rule34Client } from "./providers/Rule34Client";
import { SankakuClient } from "./providers/SankakuClient";
import { EHentaiClient } from "./providers/EHentaiClient";

// Singleton instances
export const imageDiscovery = new DiscoveryEngine();
export const imageAutocomplete = new AutocompleteEngine();
export const imageCollection = new CollectionEngine();
export const imageHealth = HealthMonitor.getInstance();

// Export the class directly for stateless usage
export { RecommendationEngine };

// Initialize default providers
const providers = [
  new DanbooruClient(),
  // new GelbooruClient(),  // DISABLED — not ready
  new Rule34Client(),
  new SankakuClient(),
  new EHentaiClient(),
];

providers.forEach(p => {
  imageDiscovery.registerProvider(p);
  imageAutocomplete.registerProvider(p);
});

// Adapter for legacy UI integration
export function mapImageMediaToSearchResult(media: import("./types").ImageMedia): import("../sources/types").SourceSearchResult {
  return {
    id: media.id,
    title: `Image ${media.id}`,
    url: media.sourceUrl,
    imageUrl: media.fullUrl || media.sampleUrl,
    previewUrl: media.thumbnailUrl || media.previewUrl,
    fullResUrl: media.fullUrl,
    sample_url: media.sampleUrl,
    file_url: media.fullUrl,
    source: media.providerId,
    provider: media.providerId,
    contentType: "gallery",
    mediaDomain: "image",
    tags: media.tags || [],
    rating: media.rating,
    mediaType: media.mediaType,
    mediaStatus: media.mediaStatus,
    relatedGroupId: media.relatedGroupId,
    relatedIndex: media.relatedIndex,
    parentId: media.parentId,
    poolIds: media.poolIds,
    bookIds: media.bookIds,
    sequence: media.sequence,
    isPremium: media.isPremium,
    redirectToSignup: media.redirectToSignup,
    hasChildren: media.hasChildren,
    fileType: media.fileType,
    fileSize: media.fileSize,
    videoDuration: media.videoDuration,
    sourceText: media.source,
    author: media.author,
  };
}

export async function getRecommendations(media: import("../sources/types").SourceSearchResult): Promise<import("../sources/types").SourceSearchResult[]> {
  const target: import("./types").ImageMedia = {
    id: media.id,
    sourceUrl: media.url || "",
    fullUrl: media.imageUrl || "",
    previewUrl: media.previewUrl || "",
    thumbnailUrl: media.previewUrl || "",
    providerId: media.source || "unknown",
    tags: media.tags || [],
    rating: media.rating === "explicit" || media.rating === "questionable" || media.rating === "safe"
      ? media.rating
      : "safe",
    mediaType: "image",
    contentCategory: "gallery"
  };

  const candidates = await imageDiscovery.search(target.tags.slice(0, 3).join(" "), { limit: 40, page: 1, ratingFilter: "all" });
  const ranked = RecommendationEngine.rankRecommendations(target, candidates, 8);
  return ranked.map(mapImageMediaToSearchResult);
}

export * from "./types";
export * from "./parser/TagParser";
