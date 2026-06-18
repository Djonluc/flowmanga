import type { PlatformImage } from '../types';
import { TagIntelligenceService } from './TagIntelligenceService';

export interface RecommendationReason {
  score: number;
  matchedDominant: string[];
  matchedSupporting: string[];
  explanation: string;
}

export type ScoredImage = PlatformImage & { recommendation: RecommendationReason };

export class RecommendationEngine {
  /**
   * Scores an array of images based on the user's dominant and supporting tags.
   * Filters out images that don't match any dominant interests if strict mode is enabled.
   */
  static async scoreAndFilter(images: PlatformImage[], strictMode = false): Promise<ScoredImage[]> {
    const dominantTags = await TagIntelligenceService.getInterests('dominant_tag');
    const supportingTags = await TagIntelligenceService.getInterests('supporting_tag');
    
    const dominantNames = dominantTags.map(t => t.name.toLowerCase());
    const supportingNames = supportingTags.map(t => t.name.toLowerCase());

    if (dominantNames.length === 0) {
      // Not enough data to score properly, return all with 0 score
      return images.map(img => ({
        ...img,
        recommendation: { score: 0, matchedDominant: [], matchedSupporting: [], explanation: "Not enough data to personalize" }
      }));
    }

    const scoredImages: ScoredImage[] = [];

    for (const img of images) {
      const tags = (img.tags || []).map(t => t.toLowerCase());
      
      const matchedDominant = tags.filter(t => dominantNames.some(d => t.includes(d)));
      const matchedSupporting = tags.filter(t => supportingNames.some(s => t.includes(s)));
      
      let score = 0;
      
      // Base score from dominant tags
      if (matchedDominant.length > 0) {
        score += 70 + (matchedDominant.length * 5); // 75, 80...
      }

      // Bonus score from supporting tags
      if (matchedSupporting.length > 0) {
        score += (matchedSupporting.length * 5);
      }

      // If strict mode is enabled, reject images without dominant tags
      if (strictMode && matchedDominant.length === 0) {
        continue;
      }

      let explanation = "";
      if (matchedDominant.length > 0) {
        explanation = `Matches your core interests: ${matchedDominant.slice(0, 2).join(', ')}`;
        if (matchedSupporting.length > 0) {
          explanation += ` and supporting interests like ${matchedSupporting.slice(0, 1).join('')}`;
        }
      } else if (matchedSupporting.length > 0) {
        explanation = `Matches secondary interests: ${matchedSupporting.slice(0, 2).join(', ')}`;
      }

      scoredImages.push({
        ...img,
        recommendation: {
          score: Math.min(score, 100),
          matchedDominant,
          matchedSupporting,
          explanation
        }
      });
    }

    // Sort by highest score first
    return scoredImages.sort((a, b) => b.recommendation.score - a.recommendation.score);
  }
}
