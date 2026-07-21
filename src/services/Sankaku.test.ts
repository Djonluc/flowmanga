import { describe, expect, it } from 'vitest';
import {
  canonicalizeSankakuTag,
  getSankakuGroupInfo,
  getSankakuMediaStatus,
  getSankakuMediaType,
  isSankakuApprovedPost,
  mapSankakuTags,
  normalizeSankakuSearchTag,
  parseSankakuCreatedAt,
  parseSankakuTypedTag,
} from './Sankaku';

describe('Sankaku helpers', () => {
  it('uses Sankaku canonical aliases without broadening unrelated tags', () => {
    expect(canonicalizeSankakuTag('femboy')).toBe('trap');
    expect(normalizeSankakuSearchTag('-femboys')).toBe('-trap');
    expect(canonicalizeSankakuTag('blue hair')).toBe('blue_hair');
  });

  it('parses typed tags into Sankaku categories', () => {
    expect(parseSankakuTypedTag('studio:Example Circle')).toEqual({
      category: 'artist',
      tag: 'Example_Circle',
    });
    expect(parseSankakuTypedTag('-series:Example')).toEqual({
      category: 'copyright',
      tag: 'Example',
    });
  });

  it('maps structured tag metadata and removes duplicates', () => {
    const tags = mapSankakuTags([
      { tagName: 'artist_name', type: 1 },
      { tagName: 'character_name', type: 4 },
      { tagName: 'animated', type: 9 },
    ], ['artist_name', 'blue_hair']);

    expect(tags.artist).toEqual(['artist_name']);
    expect(tags.character).toEqual(['character_name']);
    expect(tags.meta).toEqual(['animated']);
    expect(tags.general).toEqual(['blue_hair']);
    expect(tags.all).toHaveLength(4);
  });

  it('keeps pending posts while rejecting explicit removal states', () => {
    expect(isSankakuApprovedPost({ status: 'pending' })).toBe(true);
    expect(isSankakuApprovedPost({ status: 'active' })).toBe(true);
    expect(isSankakuApprovedPost({ status: 'deleted' })).toBe(false);
    expect(isSankakuApprovedPost({ status: 'hidden' })).toBe(false);
  });

  it('detects playable video and gif media', () => {
    expect(getSankakuMediaType({ file_type: 'video/mp4', file_url: 'https://example.test/file' })).toBe('video');
    expect(getSankakuMediaType({ sample_url: 'https://example.test/preview.webm?token=1' })).toBe('video');
    expect(getSankakuMediaType({ file_url: 'https://example.test/animated.gif' })).toBe('gif');
  });

  it('distinguishes login, session, premium, and available media', () => {
    expect(getSankakuMediaStatus({ preview_url: 'https://example.test/preview.jpg' })).toBe('available');
    expect(getSankakuMediaStatus({ redirect_to_signup: true })).toBe('login_required');
    expect(getSankakuMediaStatus({ redirect_to_signup: true, flowmanga_auth_rejected: true })).toBe('session_access_required');
    expect(getSankakuMediaStatus({ is_premium: true })).toBe('premium_required');
  });

  it('builds stable gallery grouping metadata', () => {
    expect(getSankakuGroupInfo({ book_id: 12, pool_id: 34, parent_id: 56, sequence: 2 }))
      .toEqual({
        relatedGroupId: 'sankaku-book-12',
        relatedIndex: 2,
        parentId: '56',
        poolIds: ['34'],
        bookIds: ['12'],
      });
  });

  it('normalizes Sankaku timestamps to milliseconds', () => {
    expect(parseSankakuCreatedAt(1_700_000_000)).toBe(1_700_000_000_000);
    expect(parseSankakuCreatedAt({ s: 1_700_000_000 })).toBe(1_700_000_000_000);
    expect(parseSankakuCreatedAt('2024-01-01T00:00:00Z')).toBe(Date.parse('2024-01-01T00:00:00Z'));
  });
});
