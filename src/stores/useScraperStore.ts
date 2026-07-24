import { create } from 'zustand';
import { ScraperService, type ScrapedImage, type ScrapeResult } from '../services/ScraperService';
import { useSettingsStore } from './useSettingsStore';
import { resolveMangaArchivePath, stableSeriesId } from '../utils/mangaStorage';

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
    prefill: (data: { url: string, metadata: any }) => void;
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

    prefill: (data) => set({ 
        url: data.url, 
        metadata: data.metadata, 
        error: null,
        chapterFeed: [],
        selectedChapterKeys: [],
        scrapedImages: []
    }),
    
    scrape: async () => {
        const { url, metadata: currentMetadata } = get();
        if (!url) return;
        
        set({ isScraping: true, error: null, scrapedImages: [], chapterFeed: [], selectedChapterKeys: [] });
        
        try {
            const result = await ScraperService.scrapeChapter(url);
            
            let feed: any[] = [];
            let metadata: any = { ...currentMetadata, ...result.metadata };

            if (result.series) {
                // Headless/Mangago series
                metadata = {
                    title: result.series.title,
                    description: result.series.description,
                    coverUrl: result.series.coverUrl,
                    source: result.series.source,
                    sourceUrl: result.series.seriesUrl,
                    tags: result.series.tags ?? [],
                    mangaId: result.series.seriesUrl // Use URL as ID for non-MangaDex
                };
                const chapters = Array.isArray(result.series.chapters) ? result.series.chapters : [];
                feed = chapters.map(ch => ({
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
                    const existingChapterNums = new Set((Array.isArray(librarySeries.books) ? librarySeries.books : []).map(b => b.meta.chapter));
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
        const {
            libraryPath,
            downloadPath: legacyDownloadPath,
            setLocationModalOpen,
        } = useSettingsStore.getState();
        const settingsPath = resolveMangaArchivePath(libraryPath, legacyDownloadPath);
        
        if (!settingsPath) {
            setLocationModalOpen(true);
            return 'error';
        }
        
        const archivePath = settingsPath;
        set({ downloadPath: archivePath });

        // 2. Prepare Data & Check Existence
        const safeTitle = ScraperService.sanitizeFilename(metadata.title || 'Unknown');
        const { join } = await import('@tauri-apps/api/path');
        const mangaRoot = await join(archivePath, safeTitle);
        console.info(`[Download] Queueing "${metadata.title || 'Unknown'}" in configured manga archive: ${mangaRoot}`);
        
        const { exists } = await import('@tauri-apps/plugin-fs');
        const folderExists = await exists(mangaRoot);

        if (folderExists) {
            const { setSafetyCheckModal } = useSettingsStore.getState();
            
            // Capture state in closure so it survives reset() when ImportModal closes
            const capturedMetadata = { ...metadata };
            const capturedPath = archivePath;
            const capturedChapterFeed = [...get().chapterFeed];
            const capturedSelectedKeys = [...get().selectedChapterKeys];
            const capturedScrapedImages = [...get().scrapedImages];

            setSafetyCheckModal(true, capturedMetadata.title || 'Unknown Series', (action) => {
                import('@tauri-apps/api/path').then(({ join }) =>
                    join(capturedPath, ScraperService.sanitizeFilename(capturedMetadata.title || 'Unknown'))
                ).then((currentMangaRoot) => {
                    if (action === 'redownload') {
                        get().performQueueDownload(currentMangaRoot, true, capturedMetadata, capturedChapterFeed, capturedSelectedKeys, capturedScrapedImages);
                    } else if (action === 'update') {
                        get().performQueueDownload(currentMangaRoot, false, capturedMetadata, capturedChapterFeed, capturedSelectedKeys, capturedScrapedImages);
                    }
                }).catch((error) => console.error('[Download] Failed to resolve archive path', error));
            });
            return 'prompted';
        }

        get().performQueueDownload(mangaRoot, false);
        return 'started';
    },

    performQueueDownload: async (
        mangaRoot: string, 
        _force: boolean, 
        metadataOverride?: any, 
        chapterFeedOverride?: any[], 
        selectedKeysOverride?: string[],
        scrapedImagesOverride?: any[]
    ) => {
        const { metadata: storeMetadata, chapterFeed: storeFeed, selectedChapterKeys: storeKeys, scrapedImages: storeImages } = get();
        const metadata = metadataOverride || storeMetadata;
        const chapterFeed = chapterFeedOverride || storeFeed;
        const selectedChapterKeys = selectedKeysOverride || storeKeys;
        const scrapedImages = scrapedImagesOverride || storeImages;
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
        const seriesIdentity = metadata.sourceUrl || currentUrl || `${domain}:${metadata.title || mangaRoot}`;
        const seriesId = stableSeriesId(metadata.mangaId, seriesIdentity);
        const trackingMetadata = {
            ...metadata,
            source: metadata.source || domain.split('.')[0],
            sourceUrl: metadata.sourceUrl || currentUrl || '',
            mangaId: seriesId,
            tracked: true,
            autoUpdate: true,
            lastChecked: new Date().toISOString()
        };

        useDownloadStore.getState().addJob({
            id: seriesId,
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
