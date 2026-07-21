import { describe, expect, it } from 'vitest';
import { shouldUseAnonymousCors } from './SmartImage';

describe('SmartImage local asset handling', () => {
  it('does not enable CORS for Tauri local asset URLs', () => {
    expect(shouldUseAnonymousCors('http://asset.localhost/C%3A%5CUsers%5Cperson%5Ccover.jpg')).toBe(false);
    expect(shouldUseAnonymousCors('asset://localhost/C%3A/cover.jpg')).toBe(false);
  });

  it('keeps anonymous CORS for remote images used by canvas filters', () => {
    expect(shouldUseAnonymousCors('https://cdn.example.test/cover.jpg')).toBe(true);
  });
});
