import { invoke } from '@tauri-apps/api/core';
import type { 
  SourceProvider, 
  SourceContent, 
  SourceSeries, 
  SourceChapter, 
  SourceSearchResult, 
  SourceCapabilities, 
  ContentType, 
  MediaType, 
  ReaderMode 
} from '../types';

export class BlueLockProvider implements SourceProvider {
  readonly id = 'bluelock';
  readonly name = 'Blue Lock Official';
  readonly domains = ['blue-lock-manga.com'];
  readonly contentType: ContentType = 'manga';
  readonly mediaTypes: MediaType[] = ['image'];
  readonly defaultPersistence = 'library' as const;
  readonly readerModes: ReaderMode[] = ['vertical'];

  readonly capabilities: SourceCapabilities = {
    search: false,
    tagSearch: false,
    seriesBrowse: true,
    chapterFeed: true,
    pagination: false,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    return url.includes('blue-lock-manga.com');
  }

  async fetchContent(url: string): Promise<SourceContent> {
    const html = await invoke<string>('fetch_html', { url, headers: null });
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images: string[] = [];
    doc.querySelectorAll('.entry-content img, .entry-inner img').forEach(img => {
      const src = img.getAttribute('src');
      if (src && !images.includes(src)) images.push(src);
    });
    return {
      images: images.map((u, i) => ({ url: u, pageNumber: i + 1 })),
      metadata: { sourceUrl: url }
    };
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    const html = await invoke<string>('fetch_html', { url, headers: null });
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const chapters: SourceChapter[] = [];
    doc.querySelectorAll('a[href*="/chapter-"]').forEach(a => {
        const href = a.getAttribute('href');
        if (href) {
            chapters.push({
                id: href,
                number: href.match(/chapter-(\d+)/)?.[1] || '0',
                url: href,
                title: a.textContent?.trim() || 'Chapter',
                source: 'blue-lock-manga.com'
            });
        }
    });

    return {
      title: 'Blue Lock',
      description: 'Blue Lock Official Manga',
      coverUrl: '',
      seriesUrl: url,
      source: 'blue-lock-manga.com',
      chapters: chapters.reverse()
    };
  }

  async fetchChapterFeed(seriesUrl: string): Promise<SourceChapter[]> {
    const series = await this.fetchSeries(seriesUrl);
    return series.chapters;
  }
}
