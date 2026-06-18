import type { ImageMedia } from "./types";

export class RecommendationEngine {
  /**
   * Calculates the Jaccard Index (Intersection over Union) of two tag arrays.
   */
  static calculateTagSimilarity(tagsA: string[], tagsB: string[]): number {
    if (!tagsA.length || !tagsB.length) return 0;
    
    const setA = new Set(tagsA.map(t => t.toLowerCase()));
    const setB = new Set(tagsB.map(t => t.toLowerCase()));
    
    let intersection = 0;
    for (const a of setA) {
      if (setB.has(a)) intersection++;
    }
    
    const union = setA.size + setB.size - intersection;
    return intersection / union;
  }

  /**
   * Sorts and filters a candidate pool of images against a target image
   * based on tag similarity, prioritizing images with identical provider/source
   * if tags are sparse.
   */
  static rankRecommendations(target: ImageMedia, candidates: ImageMedia[], limit: number = 8): ImageMedia[] {
    const targetTags = target.tags || [];
    
    const scored = candidates
      .filter(c => c.id !== target.id) // exclude self
      .map(candidate => {
        let score = this.calculateTagSimilarity(targetTags, candidate.tags || []);
        
        // Minor boost for same provider/source if similarity is very close
        if (candidate.providerId === target.providerId) {
          score += 0.05;
        }

        return { item: candidate, score };
      });

    // Sort descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(s => s.item);
  }
}
