import { describe, expect, it } from 'vitest';
import { isDownloadablePageImage } from './PageImageFilter';

describe('DownloadService page filtering', () => {
  it('rejects placeholders and decorative SVG assets', () => {
    expect(isDownloadablePageImage({ url: 'https://cdn.example/loading_comments.svg' })).toBe(false);
    expect(isDownloadablePageImage({ url: 'https://cdn.example/images/spinner.png' })).toBe(false);
    expect(isDownloadablePageImage({ url: 'data:image/png;base64,abc' })).toBe(false);
  });

  it('accepts real remote chapter images', () => {
    expect(isDownloadablePageImage({ url: 'https://cdn.example/manga/chapter-12/page-001.webp' })).toBe(true);
    expect(isDownloadablePageImage({ url: 'https://img.example/uploads/12345' })).toBe(true);
  });
});
