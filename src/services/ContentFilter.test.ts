import { describe, expect, it } from 'vitest';
import { ContentFilter } from './ContentFilter';

describe('ContentFilter image safety', () => {
  it('recognizes normalized explicit vocabulary', () => {
    expect(ContentFilter.isAdultTag('explicit_nudity')).toBe(true);
    expect(ContentFilter.isAdultTag('blue_hair')).toBe(false);
  });

  it('blocks explicit and questionable ratings regardless of source', () => {
    expect(ContentFilter.isAdultPlatformImage({ rating: 'explicit' })).toBe(true);
    expect(ContentFilter.isAdultPlatformImage({ rating: 'q' })).toBe(true);
    expect(ContentFilter.isAdultPlatformImage({ rating: 'safe' })).toBe(false);
  });

  it('uses tag and title metadata when a rating is missing', () => {
    expect(ContentFilter.isAdultPlatformImage({ tags: ['explicit_nudity'] })).toBe(true);
    expect(ContentFilter.isAdultPlatformImage({ title: 'An NSFW collection' })).toBe(true);
    expect(ContentFilter.isAdultPlatformImage({ title: 'A quiet landscape', tags: ['scenery'] })).toBe(false);
  });
});
