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

export class LuaComicProvider implements SourceProvider {
  readonly id = 'luacomic';
  readonly name = 'LuaComic (Under Construction)';
  readonly domains = ['luacomic.org'];
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
    return url.includes('luacomic.org');
  }

  async fetchContent(url: string): Promise<SourceContent> {
    const images = await invoke<string[]>('scrape_images_headless', { url });
    return {
      images: images.map((u, i) => ({ url: u, pageNumber: i + 1 })),
      metadata: { sourceUrl: url }
    };
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    try {
      console.log(`[LuaComic] Fetching series: ${url}`);
      const res = await invoke<any>('scrape_series_headless', { url });
      
      if (!res || !res.title) {
        throw new Error("Invalid response from scraper engine");
      }

      const chapters = (res.chapterLinks || []).map((link: string, i: number) => ({
        id: link,
        number: (res.chapterLinks.length - i).toString(),
        url: link,
        source: 'luacomic.org'
      }));

      console.log(`[LuaComic] Found ${chapters.length} chapters`);

      return {
        title: res.title,
        description: res.description,
        coverUrl: res.cover_url,
        seriesUrl: url,
        source: 'luacomic.org',
        chapters
      };
    } catch (error) {
      console.error(`[LuaComic] Failed to fetch series:`, error);
      throw error;
    }
  }

  private parseMadaraList(html: string, limit: number, defaultSource: string): SourceSearchResult[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const results: SourceSearchResult[] = [];
    const items = doc.querySelectorAll('.page-item-detail, .manga-item, .c-tabs-item__content'); 
    
    if (items.length > 0) {
        items.forEach(item => {
            const a = item.querySelector('h3 a, .post-title a') as HTMLAnchorElement;
            const img = item.querySelector('img') as HTMLImageElement;
            if (a && a.getAttribute('href')) {
                const href = a.getAttribute('href')!;
                let coverUrl = img ? (img.getAttribute('data-src') || img.getAttribute('src') || undefined) : undefined;
                if (coverUrl && coverUrl.startsWith('//')) coverUrl = 'https:' + coverUrl;
                results.push({
                    id: href,
                    title: a.textContent?.trim() || 'Manhua',
                    source: defaultSource,
                    contentType: 'manga',
                    url: href,
                    coverUrl,
                    tags: ['Full Color', 'Manhua']
                });
            }
        });
    } else {
        doc.querySelectorAll('.item-thumb a, .manga-poster a, .series-box a').forEach(a => {
            const href = a.getAttribute('href');
            if (href && (href.includes('/manga/') || href.includes('/comic/'))) {
                const img = a.querySelector('img');
                const titleStr = a.getAttribute('title') || img?.getAttribute('alt') || 'Manhua';
                let coverUrl = img ? (img.getAttribute('data-src') || img.getAttribute('src') || undefined) : undefined;
                if (coverUrl && coverUrl.startsWith('//')) coverUrl = 'https:' + coverUrl;
                results.push({
                    id: href,
                    title: titleStr.trim(),
                    source: defaultSource,
                    contentType: 'manga',
                    url: href,
                    coverUrl,
                    tags: ['Full Color', 'Manhua']
                });
            }
        });
    }

    const unique = Array.from(new Map(results.map(r => [r.id, r])).values());
    return unique.slice(0, limit);
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
