import type { PlatformImage } from '../types';
import { TagIntelligenceService, type UserInterest } from './TagIntelligenceService';
import type { ForYouQualityMode } from '../../stores/useSettingsStore';

export interface RecommendationReason {
  score: number;
  matchedDominant: string[];
  matchedSupporting: string[];
  explanation: string;
}

export type ScoredImage = PlatformImage & { recommendation: RecommendationReason };

export interface RecommendationContext {
  dominant: string[];
  supporting: string[];
  artists: string[];
  characters: string[];
  series: string[];
  favorites: string[];
  qualityMode: ForYouQualityMode;
}

interface CurateOptions {
  qualityMode?: ForYouQualityMode;
  limit?: number;
  context?: RecommendationContext;
}

const normalizeTag = (tag: string): string =>
  tag.toLowerCase().replace(/^[^:]+:/, '').replace(/[\s_-]+/g, '').trim();

const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const typedTags = (image: PlatformImage, field: keyof Pick<PlatformImage, 'artistTags' | 'characterTags' | 'copyrightTags'>): string[] => {
  const explicit = image[field] || [];
  const namespace = field === 'artistTags' ? 'artist:' : field === 'characterTags' ? 'character:' : 'copyright:';
  const fromFlat = (image.tags || [])
    .filter(tag => tag.toLowerCase().startsWith(namespace))
    .map(tag => tag.slice(namespace.length));
  return unique([...explicit, ...fromFlat].map(normalizeTag));
};

const allTags = (image: PlatformImage): string[] => unique([
  ...(image.tags || []).map(normalizeTag),
  ...typedTags(image, 'artistTags'),
  ...typedTags(image, 'characterTags'),
  ...typedTags(image, 'copyrightTags'),
]);

const intersect = (values: string[], interests: string[]): string[] =>
  unique(values.filter(value => interests.includes(value)));

const matchesForImage = (image: PlatformImage, context: RecommendationContext) => {
  const tags = allTags(image);
  const artistTags = typedTags(image, 'artistTags');
  const characterTags = typedTags(image, 'characterTags');
  const seriesTags = typedTags(image, 'copyrightTags');

  const categoryTags = unique([
    ...tags,
    ...artistTags,
    ...characterTags,
    ...seriesTags,
  ]);

  return {
    matchedDominant: intersect(categoryTags, context.dominant),
    matchedSupporting: intersect(categoryTags, context.supporting),
    matchedArtists: intersect(artistTags, context.artists),
    matchedCharacters: intersect(characterTags, context.characters),
    matchedSeries: intersect(seriesTags, context.series),
  };
};

const hasUsableMedia = (image: PlatformImage): boolean => Boolean(
  image.thumbnailUrl || image.sampleUrl || image.previewUrl || image.fullUrl,
);

export class RecommendationEngine {
  static async loadContext(): Promise<RecommendationContext> {
    const [dominant, supporting, artists, characters, series] = await Promise.all([
      TagIntelligenceService.getInterests('dominant_tag'),
      TagIntelligenceService.getInterests('supporting_tag'),
      TagIntelligenceService.getInterests('artist'),
      TagIntelligenceService.getInterests('character'),
      TagIntelligenceService.getInterests('series'),
    ]);

    let favorites: { tag: string }[] = [];
    let qualityMode: ForYouQualityMode = 'broad';
    let recommendationMode = 'dynamic';

    try {
      const { getDb } = await import('../../services/db');
      favorites = await getDb().select<{ tag: string }[]>('SELECT tag FROM FavoriteTags');

      const { useSettingsStore } = await import('../../stores/useSettingsStore');
      const settings = useSettingsStore.getState();
      qualityMode = settings.forYouQualityMode ?? (settings.strictForYouMode ? 'strict' : 'broad');
      recommendationMode = settings.recommendationMode;
    } catch (error) {
      console.warn('[RecommendationEngine] Could not load recommendation settings:', error);
    }

    const names = (items: UserInterest[]) => items.map(item => normalizeTag(item.name));
    const dominantNames = names(dominant);
    const supportingNames = names(supporting);
    const favoriteNames = favorites.map(item => normalizeTag(item.tag));
    const coreNames = recommendationMode === 'strict_favorites'
      ? favoriteNames
      : recommendationMode === 'strict_interests'
        ? unique([...dominantNames, ...supportingNames, ...names(artists), ...names(characters), ...names(series)])
        : dominantNames;

    return {
      dominant: unique(coreNames),
      supporting: unique([...supportingNames, ...favoriteNames]).filter(tag => !dominantNames.includes(tag)),
      artists: names(artists),
      characters: names(characters),
      series: names(series),
      favorites: favoriteNames,
      qualityMode,
    };
  }

  private static scoreImages(images: PlatformImage[], context: RecommendationContext): ScoredImage[] {
    const hasCoreInterests = context.dominant.length > 0
      || context.artists.length > 0
      || context.characters.length > 0
      || context.series.length > 0;
    const hasAnyInterests = hasCoreInterests || context.supporting.length > 0 || context.artists.length > 0 || context.characters.length > 0 || context.series.length > 0;
    const scored: ScoredImage[] = [];

    for (const image of images) {
      if (!hasUsableMedia(image)) continue;

      const matches = matchesForImage(image, context);
      const totalMatches = matches.matchedDominant.length + matches.matchedSupporting.length + matches.matchedArtists.length + matches.matchedCharacters.length + matches.matchedSeries.length;

      const matchedCore = unique([
        ...matches.matchedDominant,
        ...matches.matchedArtists,
        ...matches.matchedCharacters,
        ...matches.matchedSeries,
      ]);

      // Strict mode is a quality gate: a result needs a core-interest match.
      if (context.qualityMode === 'strict' && (!hasCoreInterests || matchedCore.length === 0)) continue;
      // Broad mode still excludes completely unrelated content when the user has
      // enough profile data to make a meaningful recommendation.
      if (context.qualityMode === 'broad' && hasAnyInterests && totalMatches === 0) continue;

      const sourceScore = Math.max(0, Math.min(Number(image.score) || 0, 100));
      const resolutionBonus = image.width > 0 && image.height > 0 ? 2 : 0;
      let score = 8 + resolutionBonus + Math.min(sourceScore / 10, 8);
      score += matches.matchedDominant.length > 0 ? 56 + matches.matchedDominant.length * 7 : 0;
      score += matches.matchedSupporting.length * 7;
      score += matches.matchedArtists.length * 14;
      score += matches.matchedCharacters.length * 12;
      score += matches.matchedSeries.length * 10;

      const matchedLabels = [
        ...matches.matchedDominant,
        ...matches.matchedArtists,
        ...matches.matchedCharacters,
        ...matches.matchedSeries,
        ...matches.matchedSupporting,
      ];
      const explanation = matchedLabels.length > 0
        ? `Matches your interests: ${matchedLabels.slice(0, 3).join(', ')}`
        : 'Exploratory recommendation';

      scored.push({
        ...image,
        recommendation: {
          score: Math.min(Math.round(score), 100),
          matchedDominant: matches.matchedDominant,
          matchedSupporting: unique([
            ...matches.matchedSupporting,
            ...matches.matchedArtists,
            ...matches.matchedCharacters,
            ...matches.matchedSeries,
          ]),
          explanation,
        },
      });
    }

    return scored.sort((a, b) => b.recommendation.score - a.recommendation.score);
  }

  /**
   * Re-ranks the complete candidate pool so source, artist, and character
   * diversity is applied globally instead of once per provider request.
   */
  private static diversify(images: ScoredImage[], limit?: number): ScoredImage[] {
    const deduped = Array.from(new Map(images.map(image => [image.id, image])).values());
    const target = Math.min(limit ?? deduped.length, deduped.length);
    if (target <= 1) return deduped.slice(0, target);

    const sourceCap = Math.max(2, Math.ceil(target * 0.4));
    const artistCap = Math.max(2, Math.ceil(target * 0.2));
    const characterCap = Math.max(2, Math.ceil(target * 0.2));
    const selected: ScoredImage[] = [];
    const remaining = [...deduped];
    const sourceCounts = new Map<string, number>();
    const artistCounts = new Map<string, number>();
    const characterCounts = new Map<string, number>();

    const groupsFor = (image: PlatformImage) => ({
      source: image.providerId || 'unknown',
      artists: typedTags(image, 'artistTags'),
      characters: typedTags(image, 'characterTags'),
    });

    while (remaining.length > 0 && selected.length < target) {
      const hasOpenAlternative = remaining.some(candidate => {
        const groups = groupsFor(candidate);
        return (sourceCounts.get(groups.source) || 0) < sourceCap
          && groups.artists.every(group => (artistCounts.get(group) || 0) < artistCap)
          && groups.characters.every(group => (characterCounts.get(group) || 0) < characterCap);
      });

      let bestIndex = 0;
      let bestAdjustedScore = Number.NEGATIVE_INFINITY;
      remaining.forEach((candidate, index) => {
        const groups = groupsFor(candidate);
        const saturated = (sourceCounts.get(groups.source) || 0) >= sourceCap
          || groups.artists.some(group => (artistCounts.get(group) || 0) >= artistCap)
          || groups.characters.some(group => (characterCounts.get(group) || 0) >= characterCap);

        if (saturated && hasOpenAlternative) return;

        const sourcePenalty = (sourceCounts.get(groups.source) || 0) * 8;
        const artistPenalty = groups.artists.reduce((sum, group) => sum + (artistCounts.get(group) || 0) * 10, 0);
        const characterPenalty = groups.characters.reduce((sum, group) => sum + (characterCounts.get(group) || 0) * 9, 0);
        const adjustedScore = candidate.recommendation.score - sourcePenalty - artistPenalty - characterPenalty;

        if (adjustedScore > bestAdjustedScore) {
          bestAdjustedScore = adjustedScore;
          bestIndex = index;
        }
      });

      const [selectedImage] = remaining.splice(bestIndex, 1);
      selected.push(selectedImage);
      const groups = groupsFor(selectedImage);
      sourceCounts.set(groups.source, (sourceCounts.get(groups.source) || 0) + 1);
      groups.artists.forEach(group => artistCounts.set(group, (artistCounts.get(group) || 0) + 1));
      groups.characters.forEach(group => characterCounts.set(group, (characterCounts.get(group) || 0) + 1));
    }

    return selected;
  }

  static async curate(images: PlatformImage[], options: CurateOptions = {}): Promise<ScoredImage[]> {
    const context = options.context || await this.loadContext();
    const effectiveContext = options.qualityMode ? { ...context, qualityMode: options.qualityMode } : context;
    return this.diversify(this.scoreImages(images, effectiveContext), options.limit);
  }

  static async scoreAndFilter(images: PlatformImage[], strictMode = false): Promise<ScoredImage[]> {
    const context = await this.loadContext();
    return this.scoreImages(images, {
      ...context,
      qualityMode: strictMode ? 'strict' : context.qualityMode,
    });
  }
}
