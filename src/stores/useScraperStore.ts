import { create } from 'zustand';
import { ScraperService, type ScrapedImage, type ScrapeResult } from '../services/ScraperService';
import { useSettingsStore } from './useSettingsStore';

interface ScraperState {
    url: string;
    isScraping: boolean;
    isDownloading: boolean;
    scrapedImages: ScrapedImage[];
    metadata: (ScrapeResult['metadata'] & { author?: string, tags?: string[], source?: string, sourceUrl?: string }) | null;
    chapterFeed: any[];
    selectedChapterKeys: string[]; 
    estimatedSize: string;
    progress: number;
    error: string | null;
    downloadPath: string | null;
    failedCount: number;
    autoOpenModal: boolean;
    
    setUrl: (url: string) => void;
    setAutoOpenModal: (val: boolean) => void;
    scrape: () => Promise<void>;
    download: () => Promise<'started' | 'prompted' | 'error'>;
    performQueueDownload: (mangaRoot: string, force: boolean, metadataOverride?: any) => Promise<void>;
    setSelectedChapters: (keys: string[]) => void;
    reset: () => void;
}

export const useScraperStore = create<ScraperState>((set, get) => ({
    url: '',
    isScraping: false,
    isDownloading: false,
    scrapedImages: [],
    metadata: null,
    chapterFeed: [],
    selectedChapterKeys: [],
    estimatedSize: '0 MB',
    progress: 0,
    error: null,
    downloadPath: null,
    failedCount: 0,
    autoOpenModal: false,
    
    setUrl: (url) => set({ url, error: null }),
    setAutoOpenModal: (autoOpenModal) => set({ autoOpenModal }),
    
    scrape: async () => {
        const { url } = get();
        if (!url) return;
        
        set({ isScraping: true, error: null, scrapedImages: [], metadata: null, chapterFeed: [], selectedChapterKeys: [] });
        
        try {
            const result = await ScraperService.scrapeChapter(url);
            
            let feed: any[] = [];
            let metadata: any = result.metadata || null;

            if (result.series) {
                // Headless/Mangago series
                metadata = {
                    title: result.series.title,
                    description: result.series.description,
                    coverUrl: result.series.coverUrl,
                    source: result.series.source,
                    sourceUrl: result.series.seriesUrl,
                    tags: result.series.tags,
                    mangaId: result.series.seriesUrl // Use URL as ID for non-MangaDex
                };
                feed = result.series.chapters.map(ch => ({
                    id: ch.id,
                    number: ch.number,
                    chUrl: ch.url,
                    source: ch.source,
                    attributes: { chapter: ch.number } // Compatibility with existing UI
                }));
            } else if (result.metadata?.mangaId && /^[a-f0-9-]{36}$/i.test(result.metadata.mangaId)) {
                // MangaDex (UUID-based mangaId only)
                feed = await ScraperService.getChapterFeed(result.metadata.mangaId);
                metadata.source = 'mangadex.org';
                metadata.sourceUrl = url;
            }

            // Ensure source/sourceUrl are always set from the input URL
            if (metadata && !metadata.source) {
                try { metadata.source = new URL(url).hostname.replace('www.', ''); } catch (_) {}
            }
            if (metadata && !metadata.sourceUrl) {
                metadata.sourceUrl = url;
            }

            // Smart Selection: Check Library for existing chapters
            let defaultSelection: string[] = [];
            const { useLibraryStore } = await import('./useLibraryStore');
            const librarySeries = useLibraryStore.getState().series.find(s => 
                s.mangaId === metadata?.mangaId || s.seriesUrl === metadata?.sourceUrl
            );
            
            if (feed.length > 0) {
                if (librarySeries) {
                    const existingChapterNums = new Set(librarySeries.books.map(b => b.meta.chapter));
                    const newChapters = feed.filter(c => {
                         const num = c.attributes?.chapter || c.number;
                         return !existingChapterNums.has(num);
                    });
                    
                    if (newChapters.length > 0) {
                        defaultSelection = [newChapters[newChapters.length - 1].id];
                    } else {
                        defaultSelection = [];
                    }
                } else {
                    defaultSelection = [feed[feed.length - 1].id];
                }
            }

            set({ 
                scrapedImages: result.images || [], 
                metadata: metadata,
                chapterFeed: feed,
                selectedChapterKeys: defaultSelection,
                isScraping: false 
            });
            
            get().setSelectedChapters(defaultSelection);
        } catch (err) {
            set({ 
                error: (err as Error).message || 'Failed to scrape URL',
                isScraping: false 
            });
        }
    },

    setSelectedChapters: (keys) => {
        const { chapterFeed } = get();
        const selected = chapterFeed.filter(c => keys.includes(c.id));
        
        // Estimate: ~400KB per page, average 25 pages per chapter
        // Or better: count pages if we have them (MangaDex has data length in some contexts but not feed)
        // Let's assume 10MB per chapter.
        const estMB = selected.length * 10;
        const sizeStr = estMB > 1024 ? `${(estMB / 1024).toFixed(1)} GB` : `${estMB} MB`;
        
        set({ selectedChapterKeys: keys, estimatedSize: sizeStr });
    },
    
    download: async () => {
        const { metadata } = get();
        if (!metadata) return 'error';
        
        // 1. Get or Pick Base Directory (Centralized Library)
        const { downloadPath: settingsPath, setLocationModalOpen } = useSettingsStore.getState();
        
        if (!settingsPath) {
            setLocationModalOpen(true);
            return 'error';
        }
        
        const libraryPath = settingsPath;
        set({ downloadPath: libraryPath });

        // 2. Prepare Data & Check Existence
        const safeTitle = ScraperService.sanitizeFilename(metadata.title || 'Unknown');
        const mangaRoot = `${libraryPath}/${safeTitle}`;
        
        const { exists } = await import('@tauri-apps/plugin-fs');
        const folderExists = await exists(mangaRoot);

        if (folderExists) {
            const { setSafetyCheckModal } = useSettingsStore.getState();
            
            // Capture state in closure so it survives reset() when ImportModal closes
            const capturedMetadata = { ...metadata };
            const capturedPath = libraryPath;

            setSafetyCheckModal(true, capturedMetadata.title || 'Unknown Series', (action) => {
                const currentMangaRoot = `${capturedPath}/${ScraperService.sanitizeFilename(capturedMetadata.title || 'Unknown')}`;
                
                // Re-hydrate the store state briefly if needed, or just call the worker
                // performQueueDownload uses get(), which might be null. 
                // Let's make performQueueDownload accept optional metadata overrides or just handle it here.
                
                // Better: Just use a one-off call if the store is reset
                if (action === 'redownload') {
                    get().performQueueDownload(currentMangaRoot, true, capturedMetadata);
                } else if (action === 'update') {
                    get().performQueueDownload(currentMangaRoot, false, capturedMetadata);
                }
            });
            return 'prompted';
        }

        get().performQueueDownload(mangaRoot, false);
        return 'started';
    },

    performQueueDownload: async (mangaRoot: string, _force: boolean, metadataOverride?: any) => {
        const { metadata: storeMetadata, chapterFeed, selectedChapterKeys, scrapedImages } = get();
        const metadata = metadataOverride || storeMetadata;
        if (!metadata) return;

        const chaptersToDownload: any[] = chapterFeed
            .filter(c => selectedChapterKeys.includes(c.id))
            .map(c => ({
                id: c.id,
                number: c.number || c.attributes?.chapter,
                chUrl: c.chUrl,
                source: c.source,
                attributes: c.attributes
            }));
        
        // Handle Manual Chapter (Scraped directly without feed)
        if (chaptersToDownload.length === 0 && scrapedImages.length > 0) {
                chaptersToDownload.push({ 
                    id: 'manual', 
                    number: metadata.chapterTitle || '1',
                    chUrl: metadata.sourceUrl || get().url,
                    source: metadata.source || 'unknown',
                    attributes: { chapter: metadata.chapterTitle || '1' },
                    isManual: true,
                    images: scrapedImages 
                });
        }

        // 3. Queue Job
        const { useDownloadStore } = await import('./useDownloadStore');
        
        // Enhance Metadata for Tracking
        let domain = (metadata as any).source || 'unknown';
        const currentUrl = get().url;
        if (domain === 'unknown' && currentUrl) {
            try { domain = new URL(currentUrl).hostname.replace('www.', ''); } catch (_) {}
        }
        const trackingMetadata = {
            ...metadata,
            source: metadata.source || domain.split('.')[0],
            sourceUrl: metadata.sourceUrl || currentUrl || '',
            mangaId: metadata.mangaId || 'local',
            tracked: true,
            autoUpdate: true,
            lastChecked: new Date().toISOString()
        };

        useDownloadStore.getState().addJob({
            id: `${metadata.mangaId || Math.random().toString(36).substr(2, 9)}`,
            title: metadata.title || 'Unknown Series',
            coverUrl: metadata.coverUrl,
            totalChapters: chaptersToDownload.length,
            metadata: trackingMetadata,
            chapterList: chaptersToDownload,
            path: mangaRoot,
            force: _force
        });

        // 4. Reset & Notify
        set({
            isDownloading: false,
            scrapedImages: [], // Clear memory
            metadata: null,
            chapterFeed: [],
            selectedChapterKeys: [],
            error: null
        });

        useSettingsStore.getState().setActiveView('library');
    },
    
    reset: () => set({ 
        url: '', 
        isScraping: false, 
        isDownloading: false, 
        scrapedImages: [], 
        metadata: null,
        chapterFeed: [],
        selectedChapterKeys: [],
        estimatedSize: '0 MB',
        progress: 0, 
        error: null,
        downloadPath: null,
        failedCount: 0
    }),
}));
