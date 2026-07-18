import { invoke } from '@tauri-apps/api/core';
import { getSankakuMediaType, getSankakuRequestHeaders, mapSankakuTags, sankakuApiUrls, unwrapSankakuPosts, SANKAKU_BOOKS_URL, SANKAKU_LOGIN_URL, type SankakuPost } from '../../Sankaku';
import type {
  ContentType,
  MediaDomain,
  MediaType,
  ReaderMode,
  SourceCapabilities,
  SourceChapter,
  SourceContent,
  SourceMetadata,
  SourceProvider,
  SourceSearchOptions,
  SourceSearchResult,
  SourceSeries,
} from '../types';

interface SankakuBook {
  id?: number | string;
  title?: string;
  name?: string;
  description?: string;
  cover_url?: string;
  thumbnail_url?: string;
  rating?: string;
  tags?: Array<{ name?: string; name_en?: string; type?: number | string }>;
  posts?: SankakuPost[];
  pages?: SankakuPost[];
  items?: SankakuPost[];
  post_ids?: Array<number | string>;
  postIds?: Array<number | string>;
  page_count?: number;
  post_count?: number;
}

export class SankakuBooksProvider implements SourceProvider {
  readonly id = 'sankaku-books';
  readonly name = 'Sankaku Books';
  readonly domains = ['www.sankakucomplex.com', 'chan.sankakucomplex.com', 'sankakucomplex.com'];
  readonly contentType: ContentType = 'doujin';
  readonly mediaTypes: MediaType[] = ['image', 'gif', 'video'];
  readonly mediaDomain: MediaDomain = 'manga';
  readonly defaultPersistence = 'ask' as const;
  readonly readerModes: ReaderMode[] = ['vertical', 'single', 'gallery'];

  readonly capabilities: SourceCapabilities = {
    search: true,
    tagSearch: true,
    seriesBrowse: true,
    chapterFeed: true,
    pagination: true,
    authentication: true,
    requiresCookies: true,
    authUrl: SANKAKU_LOGIN_URL,
  };

  matchesUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      return this.domains.some(domain => hostname.includes(domain)) && /\/books?(?:\/|$)/i.test(new URL(url).pathname);
    } catch {
      return false;
    }
  }

  private async fetchJson(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const headers = getSankakuRequestHeaders();
    let lastError: unknown;
    for (const endpoint of sankakuApiUrls(path)) {
      const url = new URL(endpoint);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
      try {
        return await invoke<unknown>('fetch_json', {
          url: url.toString(),
          method: 'GET',
          headers,
          proxyUrl: null,
        });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Sankaku Books request failed');
  }

  private unwrapBooks(value: unknown): SankakuBook[] {
    if (Array.isArray(value)) return value as SankakuBook[];
    if (value && typeof value === 'object') {
      const record = value as { data?: unknown; books?: unknown };
      if (Array.isArray(record.books)) return record.books as SankakuBook[];
      if (Array.isArray(record.data)) return record.data as SankakuBook[];
    }
    return [];
  }

  private unwrapBook(value: unknown): SankakuBook | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as { data?: unknown; book?: unknown };
    if (record.book && typeof record.book === 'object') return record.book as SankakuBook;
    if (record.data && !Array.isArray(record.data) && typeof record.data === 'object') return record.data as SankakuBook;
    return value as SankakuBook;
  }

  async search(query: string, options: SourceSearchOptions = {}): Promise<SourceSearchResult[]> {
    try {
      const searchTags = options.contentFilter === 'sfw' && !/rating:/i.test(query)
        ? `${query} rating:safe`.trim()
        : query;
      const books = this.unwrapBooks(await this.fetchJson('/books', {
        tags: searchTags,
        page: options.page || 1,
        limit: options.limit || 24,
        lang: 'en',
      }));
      return books.map(book => this.mapBook(book));
    } catch (error) {
      console.warn('[SankakuBooks] Search failed:', error);
      return [];
    }
  }

  async searchByTags(tags: string[], options: SourceSearchOptions = {}): Promise<SourceSearchResult[]> {
    return this.search(tags.join(' '), options);
  }

  async getTrending(options: SourceSearchOptions = {}): Promise<SourceSearchResult[]> {
    return this.search('order:popular', options);
  }

  async getLatest(options: SourceSearchOptions = {}): Promise<SourceSearchResult[]> {
    return this.search('order:recent', options);
  }

  async getAutocomplete(query: string): Promise<string[]> {
    return [query].filter(Boolean);
  }

  async fetchContent(url: string): Promise<SourceContent> {
    const id = this.extractBookId(url);
    if (!id) throw new Error('Could not extract Sankaku book ID');

    const book = this.unwrapBook(await this.fetchJson(`/books/${encodeURIComponent(id)}`, { lang: 'en' }));
    if (!book) throw new Error('Sankaku book was not found');

    const posts = await this.resolveBookPosts(book);
    const images = posts
      .filter(post => post.file_url || post.sample_url || post.preview_url)
      .map((post, index) => ({
        url: post.file_url || post.sample_url || post.preview_url || '',
        pageNumber: Number(post.sequence) || index + 1,
        mediaType: getSankakuMediaType(post),
      }));

    const tags = mapSankakuTags(book.tags);
    const metadata: SourceMetadata = {
      title: book.title || book.name || `Sankaku Book ${id}`,
      description: book.description || '',
      coverUrl: book.cover_url || book.thumbnail_url || images[0]?.url || '',
      sourceId: String(id),
      sourceUrl: `${SANKAKU_BOOKS_URL}/${id}`,
      tags: tags.all,
      mediaCount: images.length || book.page_count || book.post_count,
    };

    return { images, metadata };
  }

  private async resolveBookPosts(book: SankakuBook): Promise<SankakuPost[]> {
    const embeddedPosts = [book.posts, book.pages, book.items]
      .find(value => Array.isArray(value) && value.length > 0) || [];
    if (embeddedPosts.length > 0) return embeddedPosts;

    const postIds = Array.from(new Set([
      ...(book.post_ids || []),
      ...(book.postIds || []),
    ].map(String).filter(Boolean)));
    if (postIds.length === 0) return [];

    const resolved = await Promise.all(postIds.map(async postId => {
      try {
        const response = await this.fetchJson('/v2/posts', {
          tags: `id_range:${encodeURIComponent(postId)}`,
          limit: 1,
          lang: 'en',
        });
        return unwrapSankakuPosts(response)[0] || null;
      } catch (error) {
        console.warn(`[SankakuBooks] Could not resolve book post ${postId}:`, error);
        return null;
      }
    }));

    return resolved.filter((post): post is SankakuPost => Boolean(post));
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    const content = await this.fetchContent(url);
    const id = this.extractBookId(url) || 'unknown';
    return {
      title: content.metadata?.title || `Sankaku Book ${id}`,
      description: content.metadata?.description || '',
      coverUrl: content.metadata?.coverUrl || '',
      seriesUrl: url,
      source: this.id,
      tags: content.metadata?.tags,
      chapters: [{
        id,
        number: '1',
        title: 'Book pages',
        url,
        source: this.id,
      }],
    };
  }

  async fetchChapterFeed(seriesId: string): Promise<SourceChapter[]> {
    return [{
      id: seriesId,
      number: '1',
      title: 'Book pages',
      url: `${SANKAKU_BOOKS_URL}/${seriesId}`,
      source: this.id,
    }];
  }

  private mapBook(book: SankakuBook): SourceSearchResult {
    const id = String(book.id ?? '');
    const tags = mapSankakuTags(book.tags);
    const url = `${SANKAKU_BOOKS_URL}/${id}`;
    return {
      id: `${this.id}-${id}`,
      title: book.title || book.name || `Sankaku Book ${id}`,
      description: book.description,
      coverUrl: book.cover_url || book.thumbnail_url,
      previewUrl: book.cover_url || book.thumbnail_url,
      source: this.id,
      provider: this.id,
      contentType: this.contentType,
      mediaDomain: this.mediaDomain,
      url,
      sourceUrl: url,
      tags: tags.all,
      generalTags: tags.general,
      characterTags: tags.character,
      artistTags: tags.artist,
      copyrightTags: tags.copyright,
      metaTags: tags.meta,
      rating: book.rating || 'unknown',
      mediaCount: book.page_count || book.post_count,
    };
  }

  private extractBookId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const pathMatch = parsed.pathname.match(/\/books?\/([^/]+)/i);
      if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
    } catch {
      // Fall through to the identifier-only format used by some imports.
    }

    const idMatch = url.trim().match(/(?:^|:)\s*([A-Za-z0-9_-]+)\s*$/);
    return idMatch?.[1] || null;
  }
}
