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
    
    let favs: { tag: string }[] = [];
    let mode = 'dynamic';
    try {
      const { getDb } = await import('../../services/db');
      const db = getDb();
      favs = await db.select<{tag: string}>("SELECT tag FROM FavoriteTags");
      
      const { useSettingsStore } = await import('../../stores/useSettingsStore');
      mode = useSettingsStore.getState().recommendationMode;
    } catch (e) {
      console.warn("Could not load settings/favorites for recommendation engine", e);
    }
    
    const normalizeTag = (t: string) => t.toLowerCase().replace(/[\s_\-]+/g, '').trim();

    let dominantNames: string[] = [];
    let supportingNames: string[] = [];

    if (mode === 'strict_favorites') {
      dominantNames = favs.map(f => normalizeTag(f.tag));
      supportingNames = [];
    } else if (mode === 'strict_interests') {
      dominantNames = dominantTags.map(t => normalizeTag(t.name));
      supportingNames = supportingTags.map(t => normalizeTag(t.name));
    } else {
      // dynamic - use curated interests as dominant, and mix favorites into supporting
      dominantNames = dominantTags.map(t => normalizeTag(t.name));
      supportingNames = Array.from(new Set([
        ...supportingTags.map(t => normalizeTag(t.name)),
        ...favs.map(f => normalizeTag(f.tag))
      ])).filter(t => !dominantNames.includes(t));
    }

    if (dominantNames.length === 0) {
      // Not enough data to score properly, return all with 0 score
      return images.map(img => ({
        ...img,
        recommendation: { score: 0, matchedDominant: [], matchedSupporting: [], explanation: "Not enough data to personalize" }
      }));
    }

    const scoredImages: ScoredImage[] = [];

    for (const img of images) {
      // Normalize image tags: replace underscores/spaces/dashes and remove namespaces (e.g. 'character:')
      const tags = (img.tags || []).map(t => 
        typeof t === 'string' ? normalizeTag(t.replace(/^.*:/, '')) : ''
      );
      
      // Use exact match to prevent substring bugs (e.g. 'female' matching 'male')
      const matchedDominant = tags.filter(t => dominantNames.includes(t));
      const matchedSupporting = tags.filter(t => supportingNames.includes(t));
      
      // ABSOLUTE RULE: An image MUST have a dominant tag to be recommended.
      if (matchedDominant.length === 0) {
        continue;
      }
      
      let score = 0;
      
      // Base score from dominant tags
      score += 70 + (matchedDominant.length * 5); // 75, 80...

      // Bonus score from supporting tags
      if (matchedSupporting.length > 0) {
        score += (matchedSupporting.length * 5);
      }

      // If strict mode is enabled, strictly enforce supporting tag requirements if they exist
      if (strictMode) {
        if (supportingNames.length > 0 && matchedSupporting.length < 1) {
          continue;
        }
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
