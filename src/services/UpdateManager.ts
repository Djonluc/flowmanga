import { useLibraryStore } from '../stores/useLibraryStore';
import { useDownloadStore } from '../stores/useDownloadStore';
import { ScraperService } from './ScraperService';
import { readTextFile } from '@tauri-apps/plugin-fs';

export class UpdateManager {
    static async resolveSeriesUrl(seriesId: string): Promise<string | null> {
        const library = useLibraryStore.getState();
        const series = library.series.find(s => s.id === seriesId);
        if (!series) return null;

        // 1. Check Store/DB
        let seriesUrl = series.seriesUrl;
        let mangaId = series.mangaId;

        // 2. Try to load from metadata.json on disk
        try {
            const content = await readTextFile(`${series.path}/metadata.json`);
            const metadata = JSON.parse(content);
            seriesUrl = metadata.sourceUrl || metadata.seriesUrl || metadata.source?.url || seriesUrl;
            mangaId = metadata.mangaId || metadata.source?.mangaId || mangaId;
        } catch (e) {
            // Ignore missing metadata
        }

        // 3. Smart Fallbacks
        if (seriesUrl) return seriesUrl;
        
        if (mangaId) {
            if (mangaId.startsWith('http')) return mangaId;
            if (mangaId.length === 36 || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mangaId)) {
                return `https://mangadex.org/title/${mangaId}`;
            }
        }

        return null;
    }

    static async checkForUpdates(seriesId: string, limit?: number) {
        const library = useLibraryStore.getState();
        const series = library.series.find(s => s.id === seriesId);
        if (!series) return 0;

        // console.log(`[UpdateManager] Checking updates for ${series.title}...`);

        try {
            // 1. Resolve Source Info
            const seriesUrl = await this.resolveSeriesUrl(seriesId);
            let mangaId = series.mangaId;
            let provider = series.source?.toLowerCase() || 'mangadex';

            try {
                const content = await readTextFile(`${series.path}/metadata.json`);
                const metadata = JSON.parse(content);
                mangaId = metadata.mangaId || metadata.source?.mangaId || mangaId;
                provider = metadata.source?.provider || provider;
            } catch (e) {}

            if (!mangaId || mangaId === 'local') {
                // If it's a URL-based series, the URL is the ID
                if (seriesUrl?.startsWith('http')) {
                    mangaId = seriesUrl;
                } else {
                    // console.log(`[UpdateManager] Skipping local series: ${series.title}`);
                    return 0; 
                }
            }

            // 2. Fetch Remote Feed
            let remoteFeed: any[] = [];
            if (provider.includes('mangadex')) {
                remoteFeed = await ScraperService.getChapterFeed(mangaId);
            } else {
                // For other sources, we scrape the series page again
                let result;
                try {
                    result = await ScraperService.scrapeChapter(seriesUrl || mangaId);
                } catch (e) {
                    console.warn(`[UpdateManager] Direct scrape failed for ${series.title}, trying search fallback...`);
                    // Fallback: Search by title if we have no valid URL or it's failing
                    const searchResults = await ScraperService.search(series.title);
                    const bestMatch = searchResults.find(r => 
                        r.title.toLowerCase().includes(series.title.toLowerCase()) ||
                        series.title.toLowerCase().includes(r.title.toLowerCase())
                    );
                    
                    if (bestMatch && bestMatch.source.includes('mangadex')) {
                         // console.log(`[UpdateManager] Restore fallback found for ${series.title}: ${bestMatch.id}`);
                        // Update the series in DB so it doesn't fail next time
                        const db = (await import('./db')).getDb();
                        await db.execute('UPDATE Series SET mangaId = ?, source = ? WHERE id = ?', [bestMatch.id, 'mangadex.org', series.id]);
                        remoteFeed = await ScraperService.getChapterFeed(bestMatch.id);
                    } else {
                        throw e; // Fail if search also found nothing
                    }
                }

                if (!remoteFeed && result?.series) {
                    remoteFeed = result.series.chapters.map(ch => ({
                        id: ch.id,
                        attributes: { chapter: ch.number, title: ch.title },
                        chUrl: ch.url,
                        source: ch.source
                    }));
                }
            }
            
            if (remoteFeed.length === 0) {
                // console.log(`[UpdateManager] ${series.title} is up to date.`);
                return 0;
            }

             // console.log(`[UpdateManager] Found ${remoteFeed.length} potential chapters, checking vs local...`);

            // 3. Find Missing Chapters (All gaps, not just latest)
            const existingChapterNums = new Set(series.books.map(b => b.meta.chapter));
            
            let missingChapters = remoteFeed.filter(remote => {
                const remoteNum = remote.attributes.chapter || '0';
                return !existingChapterNums.has(remoteNum.toString());
            });
            
            // Sort by chapter number ascending
            missingChapters.sort((a, b) => {
                const numA = parseFloat(a.attributes.chapter || '0');
                const numB = parseFloat(b.attributes.chapter || '0');
                return numA - numB;
            });

            if (limit && limit > 0) {
                missingChapters = missingChapters.slice(0, limit);
            }

            if (missingChapters.length === 0) {
                console.log(`[UpdateManager] ${series.title} is up to date.`);
                return 0;
            }

            // 4. Deduplicate missingChapters by number
            const uniqueMissing = [];
            const seenMissing = new Set();
            for (const ch of missingChapters) {
                const num = ch.attributes?.chapter || ch.number || '0';
                if (!seenMissing.has(num)) {
                    seenMissing.add(num);
                    uniqueMissing.push(ch);
                }
            }
            missingChapters = uniqueMissing;

            // console.log(`[UpdateManager] Found ${missingChapters.length} new chapters to download for ${series.title}`);

            // Load metadata for the job
            let jobMetadata = {};
            try {
                const content = await readTextFile(`${series.path}/metadata.json`);
                jobMetadata = JSON.parse(content);
            } catch (e) {}

            // 5. Queue Download Job
            const updateJob: any = {
                id: `${mangaId}-update-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                title: `Update: ${series.title} (${missingChapters.length} ch)`,
                coverUrl: series.cover || undefined,
                totalChapters: missingChapters.length,
                metadata: {
                    ...jobMetadata,
                    lastChecked: new Date().toISOString(),
                },
                chapterList: missingChapters, 
                path: series.path
            };

            useDownloadStore.getState().addJob(updateJob);
            return missingChapters.length;

        } catch (error) {
            console.error(`[UpdateManager] Failed to update ${series.title}:`, error);
            return -1;
        }
    }

    static async downloadChapters(seriesId: string, chapters: any[]) {
        if (chapters.length === 0) return 0;
        
        const library = useLibraryStore.getState();
        const series = library.series.find(s => s.id === seriesId);
        if (!series) return 0;

        try {
            let jobMetadata = {};
            try {
                const content = await readTextFile(`${series.path}/metadata.json`);
                jobMetadata = JSON.parse(content);
            } catch (e) {}

            const mangaId = series.mangaId || 'local';

            // DEDUPLICATE CHAPTERS HERE BY NUMBER to prevent duplicate downloads
            const uniqueChapters = [];
            const seenNumbers = new Set();
            for (const ch of chapters) {
                const num = ch.attributes?.chapter || ch.number || '0';
                if (!seenNumbers.has(num)) {
                    seenNumbers.add(num);
                    uniqueChapters.push(ch);
                }
            }

            const downloadJob: any = {
                id: `${mangaId}-targeted-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                title: `Manual Download: ${series.title} (${uniqueChapters.length} ch)`,
                coverUrl: series.cover || undefined,
                totalChapters: uniqueChapters.length,
                metadata: {
                    ...jobMetadata,
                    lastChecked: new Date().toISOString(),
                },
                chapterList: uniqueChapters, 
                path: series.path
            };

            useDownloadStore.getState().addJob(downloadJob);
            return uniqueChapters.length;
        } catch (error) {
            console.error(`[UpdateManager] Failed to queue targeted download for ${series.title}:`, error);
            return -1;
        }
    }

    static async checkAllTracked() {
        const library = useLibraryStore.getState();
        // Since we don't have 'tracked' in DB yet, we can check all mangadex ones
        // Or strictly ones with `metadata.tracked = true`. 
        // Checking file IO for every series is heavy.
        // For now, let's just loop all series that look like mangadex?
        // Or maybe just let user trigger specific ones.
        // User asked for "Background Auto Check".
        // Ideally we upgrade DB to store `tracked` flag.
        
        // Let's iterate all series and try to read metadata (chunked/throttled).
        for (const series of library.series) {
            await this.checkForUpdates(series.id);
            // Throttle
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}
