import { describe, expect, it } from 'vitest';
import { hasExcludedTag, hasExcludedText, mergeExcludedTags, normalizeExcludedTags } from './TagExclusions';

describe('TagExclusions', () => {
  it('normalizes and deduplicates exclusions', () => {
    expect(normalizeExcludedTags(['  Blue Hair ', 'blue hair', '', 'CAT']))
      .toEqual(['blue hair', 'cat']);
    expect(mergeExcludedTags(['Cat'], ['cat', 'Dog'])).toEqual(['cat', 'dog']);
  });

  it('matches equivalent spacing, underscore, and hyphen forms', () => {
    expect(hasExcludedTag(['blue_hair'], ['blue hair'])).toBe(true);
    expect(hasExcludedTag(['blue-hair'], ['blue_hair'])).toBe(true);
  });

  it('matches plain exclusions against E-Hentai namespaced tags', () => {
    expect(hasExcludedTag(['female:blue_hair'], ['blue hair'])).toBe(true);
    expect(hasExcludedTag(['parody:example_series'], ['example series'])).toBe(true);
  });

  it('keeps namespaced exclusions precise', () => {
    expect(hasExcludedTag(['female:blue_hair'], ['male:blue_hair'])).toBe(false);
  });

  it('matches exclusions in descriptive text', () => {
    expect(hasExcludedText('A Blue-Hair Character', ['blue hair'])).toBe(true);
    expect(hasExcludedText('A red-haired character', ['blue hair'])).toBe(false);
  });
});
