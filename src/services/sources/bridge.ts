/**
 * FlowManga Source Bridge
 * 
 * Converts SourceProvider output (SourceContent, SourceSeries) into
 * the existing ScrapeResult format used by useScraperStore, DownloadService,
 * and ImportModal. This ensures zero breaking changes during the migration
 * from the monolithic ScraperService to the modular provider system.
 */

import type { SourceContent, SourceSeries, SourceProvider } from './types';
import type { ScrapeResult, ScrapedImage, SeriesScrapeResult, SeriesScrapedChapter } from '../ScraperService';

/**
 * Convert a provider's SourceContent into the legacy ScrapeResult format.
 */
export function bridgeContent(content: SourceContent, provider: SourceProvider): ScrapeResult {
  const images: ScrapedImage[] | undefined = content.images
    ? content.images.map(img => ({
        url: img.url,
        pageNumber: img.pageNumber,
        encryptionKey: img.encryptionKey,
      }))
    : undefined;

  const text = content.text;

  const metadata = content.metadata
    ? {
        title: content.metadata.title,
        coverUrl: content.metadata.coverUrl,
        description: content.metadata.description,
        author: content.metadata.author,
        tags: content.metadata.tags,
        mangaId: content.metadata.sourceId,
        chapterTitle: undefined as string | undefined,
      }
    : undefined;

  return { images, text, metadata };
}

/**
 * Convert a provider's SourceSeries into the legacy ScrapeResult format.
 */
export function bridgeSeries(series: SourceSeries, _provider: SourceProvider): ScrapeResult {
  const uniqueChapters: SeriesScrapedChapter[] = [];
  const seenNumbers = new Set<string>();

  for (const ch of series.chapters) {
    const num = ch.number || "0";
    if (!seenNumbers.has(num)) {
      seenNumbers.add(num);
      uniqueChapters.push({
        id: ch.id,
        number: ch.number,
        url: ch.url,
        title: ch.title,
        source: ch.source || _provider.id,
      });
    }
  }

  const legacySeries: SeriesScrapeResult = {
    title: series.title,
    description: series.description,
    coverUrl: series.coverUrl,
    seriesUrl: series.seriesUrl,
    source: series.source,
    tags: series.tags,
    chapters: uniqueChapters,
  };

  const bridgedResult: ScrapeResult = { series: legacySeries };

  const withMeta = series as SourceSeries & { metadata?: { mangaId?: string } };
  bridgedResult.metadata = {
    title: series.title,
    coverUrl: series.coverUrl,
    description: series.description,
    tags: series.tags ?? [],
    mangaId: withMeta.metadata?.mangaId,
  };

  return bridgedResult;
}

/**
 * Smart bridge: if the content includes series-level data, returns a series result.
 * Otherwise returns an image-level result. Used when a provider's fetchContent
 * may return either type depending on the URL structure.
 */
export function bridgeAuto(
  content: SourceContent,
  series: SourceSeries | null,
  provider: SourceProvider
): ScrapeResult {
  if (series && series.chapters.length > 0) {
    // Series page — return chapter feed
    const result = bridgeSeries(series, provider);
    // Also attach metadata from the series for ImportModal
    result.metadata = {
      title: series.title,
      description: series.description,
      coverUrl: series.coverUrl,
      tags: series.tags,
      mangaId: series.seriesUrl,
    };
    return result;
  }

  // Chapter/album page — return images
  return bridgeContent(content, provider);
}
