import { ScraperService } from './ScraperService';
import type { Series } from '../stores/useLibraryStore';

export class AutomationService {
    /**
     * Checks if a series has new chapters available on its source.
     * Returns true if the remote chapter count is higher than the local one.
     */
    static async checkSeriesForUpdates(series: Series): Promise<boolean> {
        if (!series.seriesUrl && !series.mangaId) return false;

        try {
            // Case 1: MangaDex (Preferred)
            if (series.mangaId || (series.seriesUrl && series.seriesUrl.includes('mangadex.org'))) {
                const mId = series.mangaId || series.seriesUrl?.match(/title\/([a-f0-9-]{36})/)?.[1];
                if (mId) {
                    const feed = await ScraperService.getChapterFeed(mId);
                    // Filter for English chapters only to match our local library filter
                    const englishChapters = feed.filter(c => c.attributes.translatedLanguage === 'en');
                    return englishChapters.length > series.books.length;
                }
            }

            // Case 2: Other Generic Scrapers (Requires scraping the series page)
            if (series.seriesUrl) {
                const scrapeResult = await ScraperService.scrapeChapter(series.seriesUrl);
                if (scrapeResult && scrapeResult.series && scrapeResult.series.chapters) {
                    return scrapeResult.series.chapters.length > series.books.length;
                }
            }

            return false;
        } catch (e) {
            console.warn(`[AutomationService] Update check failed for ${series.title}:`, e);
            return false;
        }
    }
}
