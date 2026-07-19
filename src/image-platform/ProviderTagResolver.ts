import { TagIntelligenceService } from './services/TagIntelligenceService';
import type { ImageProvider, SearchQuery } from './types';

const cache = new Map<string, string>();
const CONTROL_TAG = /^(?:order|sort|score|rating|random):/i;

const comparable = (tag: string) => tag
  .replace(/^(artist|character|series|copyright|general):/i, '')
  .replace(/[_\s-]+/g, '')
  .toLowerCase();

/** Resolves known canonical aliases against a provider's live tag vocabulary. */
export async function resolveProviderTags(query: SearchQuery, provider: ImageProvider): Promise<SearchQuery> {
  if (!provider.autocompleteTags) return query;

  const resolve = async (tag: string): Promise<string> => {
    if (CONTROL_TAG.test(tag)) return tag;
    const key = `${provider.id}:${tag.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const category = tag.match(/^(artist|character|series|copyright|general):/i)?.[1]?.toLowerCase();
    const raw = tag.replace(/^(artist|character|series|copyright|general):/i, '');
    try {
      const aliases = await TagIntelligenceService.expandTags([raw]);
      for (const alias of aliases.slice(0, 4)) {
        const suggestions = await provider.autocompleteTags(alias.tag.replace(/_/g, ' '));
        const exact = suggestions.find(suggestion => comparable(suggestion) === comparable(alias.tag));
        if (exact) {
          const value = exact.replace(/^(artist|character|series|copyright|general):/i, '');
          const resolved = category ? `${category}:${value}` : exact;
          cache.set(key, resolved);
          console.debug(`[TagResolver] ${provider.id} ${tag} -> ${resolved}`);
          return resolved;
        }
      }
    } catch (error) {
      console.debug(`[TagResolver] ${provider.id} lookup failed for ${tag}:`, error);
    }
    cache.set(key, tag);
    return tag;
  };

  return {
    ...query,
    positiveTags: await Promise.all(query.positiveTags.map(resolve)),
    negativeTags: await Promise.all(query.negativeTags.map(resolve)),
  };
}
