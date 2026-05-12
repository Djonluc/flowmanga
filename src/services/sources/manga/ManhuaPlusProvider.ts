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

export class ManhuaPlusProvider implements SourceProvider {
  readonly id = 'manhuaplus';
  readonly name = 'ManhuaPlus';
  readonly domains = ['manhuaplus.org'];
  readonly contentType: ContentType = 'manga';
  readonly mediaTypes: MediaType[] = ['image'];
  readonly defaultPersistence = 'library' as const;
  readonly readerModes: ReaderMode[] = ['vertical', 'single'];

  readonly capabilities: SourceCapabilities = {
    search: false,
    tagSearch: false,
    seriesBrowse: false,
    chapterFeed: false,
    pagination: false,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    return url.includes('manhuaplus.org');
  }

  async fetchContent(url: string): Promise<SourceContent> {
    let images: string[] = [];
    let attempts = 0;
    while (attempts < 3) {
      // Alternate between list style and normal
      const targetUrl = attempts === 0 
        ? (url.includes('?') ? `${url}&style=list` : `${url}?style=list`)
        : url;
        
      images = await invoke<string[]>('scrape_images_headless', { 
        url: targetUrl,
        options: {
            scrollIterations: 20,
            waitAfterScroll: 2000,
            selectors: [".reading-content img", ".chapter-content img", "img[data-src]"]
        }
      });
      if (images.length > 0) break;
      attempts++;
      if (attempts < 3) await new Promise(r => setTimeout(r, 3000));
    }
    
    if (images.length === 0) throw new Error("No images found for chapter");

    return {
      images: images.map((u, i) => ({ url: u, pageNumber: i + 1 })),
      metadata: { sourceUrl: url }
    };
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    const res = await invoke<any>('scrape_series_headless', { url });
    const links: string[] = res.chapter_links || res.chapterLinks || [];
    return {
      title: (res.title || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim(),
      description: (res.description || '').trim(),
      coverUrl: res.cover_url || res.coverUrl || "",
      seriesUrl: url,
      source: 'manhuaplus.org',
      chapters: links.map((link: string, i: number) => ({
        id: link,
        number: (links.length - i).toString(),
        url: link,
        source: 'manhuaplus.org'
      }))
    };
  }

  async fetchChapterFeed(seriesUrl: string): Promise<SourceChapter[]> {
    const series = await this.fetchSeries(seriesUrl);
    return series.chapters;
  }

  async search(_query: string, _page: number = 1, _limit: number = 20): Promise<SourceSearchResult[]> {
    return [];
  }

  async searchByTags(_tags: string[], _page: number = 1, _limit: number = 20): Promise<SourceSearchResult[]> {
    return [];
  }

  async fetchPopular(_page: number = 1, _limit: number = 20): Promise<SourceSearchResult[]> {
    return [];
  }

  async fetchLatest(_page: number = 1, _limit: number = 20): Promise<SourceSearchResult[]> {
    return [];
  }
}
