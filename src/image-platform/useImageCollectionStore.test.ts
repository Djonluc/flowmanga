import { describe, expect, it } from 'vitest';
import { parseLocalMediaIdentity } from './LocalMediaIndex';

describe('parseLocalMediaIdentity', () => {
  it('preserves provider names containing hyphens', () => {
    expect(parseLocalMediaIdentity('e-hentai-4066124.webp', 'unused')).toEqual({
      stem: 'e-hentai-4066124',
      providerId: 'e-hentai',
      sourceId: '4066124',
    });
  });

  it('maps normal provider downloads back to their source IDs', () => {
    expect(parseLocalMediaIdentity('sankaku-XEa1LXBw.mp4', 'unused')).toEqual({
      stem: 'sankaku-XEa1LXBw',
      providerId: 'sankaku',
      sourceId: 'XEa1LXBw',
    });
  });

  it('uses the normalized local path as a stable identity for arbitrary files', () => {
    expect(parseLocalMediaIdentity('cover image.png', 'd:/images/cover image.png')).toEqual({
      stem: 'cover image',
      providerId: 'local',
      sourceId: 'd:/images/cover image.png',
    });
  });
});
