import { describe, expect, it } from 'vitest';
import type { ImageProvider, PlatformImage } from '../../image-platform/types';
import { UnifiedProviderAdapter } from './UnifiedProviderAdapter';

const image: PlatformImage = {
  id: 'example-1', sourceId: '1', providerId: 'example', thumbnailUrl: 'thumb', sampleUrl: 'sample', fullUrl: 'full',
  width: 100, height: 200, aspectRatio: 0.5, tags: ['blue_hair'], artistTags: ['artist'], rating: 'safe', score: 3,
  mediaType: 'video', mediaStatus: 'session_access_required', createdAt: 1_700_000_000_000,
};

const provider: ImageProvider = {
  id: 'example', name: 'Example', domains: ['example.test'], isEnabled: true,
  capabilities: { maxTags: 2, supportsNegative: true, supportsScore: true, authentication: true },
  async search() { return [image]; }, async getLatest() { return [image]; }, async getDiscovery() { return [image]; },
  async autocompleteTags() { return ['blue_hair']; },
};

describe('UnifiedProviderAdapter', () => {
  it('maps canonical providers into the legacy Gallery Hub contract', async () => {
    const adapter = new UnifiedProviderAdapter(provider);
    const [mapped] = await adapter.getLatest({ page: 1 });
    expect(mapped).toMatchObject({ id: 'example-1', mediaType: 'video', mediaStatus: 'session_access_required', artistTags: ['artist'] });
    expect(adapter.capabilities.authentication).toBe(true);
  });

  it('delegates search and autocomplete to the canonical provider', async () => {
    const adapter = new UnifiedProviderAdapter(provider);
    expect(await adapter.search({ raw: 'blue_hair', positiveTags: ['blue_hair'], negativeTags: [] }, { page: 2 })).toHaveLength(1);
    expect(await adapter.autocomplete('blue')).toEqual([{ tag: 'blue_hair', postCount: 0, category: 'general', source: 'example' }]);
  });
});
