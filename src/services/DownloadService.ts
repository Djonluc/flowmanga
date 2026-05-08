import { invoke } from '@tauri-apps/api/core';
import { readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { useSettingsStore } from '../stores/useSettingsStore';
import { type DownloadJob } from '../types';

export class DownloadService {
    
    // Main Worker Function
    static async processJob(job: DownloadJob, store: any) {
        const { metadata, chapterList, path: mangaRoot } = job;
        let totalDownloaded = job.downloadedChapters || 0;
        
        // 1. Prepare Root
        await mkdir(mangaRoot, { recursive: true });

        // 2. Load Existing Metadata (Safe Update Logic)
        let existingMeta: any = {};
        try {
            const content = await readTextFile(`${mangaRoot}/metadata.json`);
            existingMeta = JSON.parse(content);
        } catch (e) {
            // New download or corrupted metadata, start fresh is acceptable here
            // console.log(`[Download] No existing metadata found for ${metadata.title}, creating new.`);
        }

        // Merge Metadata (Prefer new remote metadata but keep local overrides if we were tracking them)
        const mergedMeta = {
            ...existingMeta,
            ...metadata,
            // Critical: Preserve existing chapters if they exist
            chapters: existingMeta.chapters || [],
            // Preserve total pages tracked locally
            totalPages: existingMeta.totalPages || 0
        };

        // Determine Global Index from Existing
        let globalIndex = mergedMeta.totalPages || 0;


        try {
            // 3. Cover Logic
            if (metadata.coverUrl && !metadata.coverFile && !mergedMeta.coverFile) {
                try {
                    const coverPath = `${mangaRoot}/cover.jpg`;
                    await invoke('download_image', {
                        url: metadata.coverUrl,
                        filePath: coverPath,
                        headers: (metadata.source !== 'mangadex' && metadata.sourceUrl) ? { 'Referer': metadata.sourceUrl } : null
                    });
                    mergedMeta.coverFile = 'cover.jpg';
                } catch (e) {
                    console.warn(`[Download] Cover download failed: ${e}`);
                }
            }

            // 4. Parallel Chapter Processing (Batched)
            const { maxConcurrentChapters } = useSettingsStore.getState();
            const sortedChapters = [...chapterList].sort((a, b) => 
                parseFloat(a.number || a.attributes?.chapter || '0') - 
                parseFloat(b.number || b.attributes?.chapter || '0')
            );

            for (let i = 0; i < sortedChapters.length; i += maxConcurrentChapters) {
                const chunk = sortedChapters.slice(i, i + maxConcurrentChapters);
                
                // Phase A: Scrape/Fetch Data in parallel
                const chapterResults = await Promise.all(chunk.map(async (chapter) => {
                    const chNum = chapter.number || chapter.attributes?.chapter || '1';
                    
                    // Idempotency check (Skip if already in metadata, unless force is true OR folder is missing)
                    const existingCh = mergedMeta.chapters.find((c: any) => c.number === chNum);
                    if (!job.force && existingCh) {
                        const { exists } = await import('@tauri-apps/plugin-fs');
                        const chPath = existingCh.path || `${mangaRoot}/Ch ${chNum}`;
                        if (await exists(chPath)) {
                            return { skipped: true, chNum };
                        }
                        // console.log(`[Download] Folder missing for Ch ${chNum}, re-downloading...`);
                    }

                    try {
                        const data = await this.fetchChapterData(chapter, metadata);
                        return { ...data, chapter, chNum };
                    } catch (err) {
                        console.error(`[Download] Failed to fetch data for ch ${chNum}`, err);
                        return { error: true, chNum };
                    }
                }));

                // Phase B: Assign Indices Sequentially (Ensures data integrity)
                const downloadTasks: any[] = [];
                for (const res of chapterResults) {
                    if ('skipped' in res || 'error' in res || !('images' in res) || !res.images || res.images.length === 0) {
                        if ('skipped' in res) totalDownloaded++;
                        continue;
                    }

                    const startIndex = globalIndex;
                    globalIndex += res.images.length;
                    const endIndex = globalIndex - 1;

                    downloadTasks.push({
                        ...res,
                        startIndex,
                        endIndex
                    });
                }

                // Phase C: Download Pages in parallel
                if (downloadTasks.length > 0) {
                    await Promise.all(downloadTasks.map(async (task) => {
                        // Check Paused State
                        if (store.queue.find((j: any) => j.id === job.id)?.status === 'paused') {
                            return;
                        }

                        try {
                            const thumbFile = await this.downloadChapterPages(
                                task.images, 
                                task.chNum, 
                                mangaRoot, 
                                job.id, 
                                store, 
                                metadata
                            );

                            const newChapterMeta = {
                                number: task.chNum,
                                startIndex: task.startIndex,
                                endIndex: task.endIndex,
                                fileName: `Chapter ${task.chNum}`, 
                                coverFile: thumbFile,
                                sourceId: task.chapter.id || task.chapter.url
                            };

                            mergedMeta.chapters.push(newChapterMeta);
                            mergedMeta.totalPages = globalIndex;
                            
                            await this.writeMetadata(mangaRoot, mergedMeta);
                            
                            totalDownloaded++;
                            store.updateJobProgress(job.id, Math.min(100, Math.round((totalDownloaded / job.totalChapters) * 100)), totalDownloaded);
                        } catch (err) {
                            console.error(`[Download] Failed to download pages for ch ${task.chNum}`, err);
                        }
                    }));
                }

                // Sync progress after chunk
                store.updateJobProgress(job.id, Math.min(100, Math.round((totalDownloaded / job.totalChapters) * 100)), totalDownloaded);
            }

            // 5. Finalize
            // Sort chapters in metadata to be sure
            mergedMeta.chapters.sort((a: any, b: any) => parseFloat(a.number) - parseFloat(b.number));
            
            await this.writeMetadata(mangaRoot, mergedMeta);
            store.updateJobStatus(job.id, 'completed');
            
            // Register with Library & Notify
            import('../stores/useLibraryStore').then(async ({ useLibraryStore }) => {
                  const { join } = await import('@tauri-apps/api/path');
                  // Ensure we use the correct cover file from metadata
                  const coverFile = mergedMeta.coverFile || 'cover.jpg';
                  const absoluteCoverPath = await join(mangaRoot, coverFile);

                  await useLibraryStore.getState().registerDownloadedSeries(
                      { ...mergedMeta, rootPath: mangaRoot, coverPath: absoluteCoverPath }, 
                      await Promise.all(mergedMeta.chapters.map(async (ch: any) => ({
                          id: `${mergedMeta.mangaId}-${ch.number}`,
                          title: `Chapter ${ch.number}`,
                          chapterNumber: isNaN(parseFloat(ch.number)) ? 0 : parseFloat(ch.number),
                          filePath: mangaRoot,
                          coverPath: ch.coverFile ? await join(mangaRoot, ch.coverFile) : null,
                          sourceId: ch.sourceId
                      })))
                  );
                 
                 const { emit } = await import('@tauri-apps/api/event');
                 await emit('library:updated');
            });

        } catch (error) {
            console.error(`[Download] Job ${job.id} failed:`, error);
            store.updateJobStatus(job.id, 'failed');
        }
    }

    private static async fetchChapterData(chapter: any, _metadata: any): Promise<{ images: any[] }> {
        if (chapter.isManual && chapter.images) {
            return { images: chapter.images };
        }
        
        const { ScraperService } = await import('./ScraperService');
        const sourceId = chapter.chUrl || chapter.sourceId || chapter.id || chapter.url;
        
        if (!sourceId) throw new Error("No source identifier for chapter");

        const scrapeUrl = sourceId.startsWith('http') ? sourceId : `https://mangadex.org/chapter/${sourceId}`;
        const res = await ScraperService.scrapeChapter(scrapeUrl);
        
        if (res.images && res.images.length > 0) {
            return { images: res.images };
        }
        throw new Error("No images found for chapter");
    }

    private static async downloadChapterPages(images: any[], chapterNum: string, mangaRoot: string, jobId: string, store: any, metadata: any): Promise<string | null> {
        const chPadded = parseFloat(chapterNum).toString().split('.')[0].padStart(3, '0');
        const { maxConcurrentPages } = useSettingsStore.getState();

        // Choose a page from the middle for the thumbnail (Skip first 3 and last 4)
        const startOffset = 3;
        const endOffset = 4;
        const availableCount = images.length - startOffset - endOffset;
        
        let thumbIndex = Math.floor(images.length / 2); // Default to middle
        if (availableCount > 0) {
            thumbIndex = startOffset + Math.floor(Math.random() * availableCount);
        }

        const thumbPadded = (thumbIndex + 1).toString().padStart(3, '0');
        const thumbFileName = `ch${chPadded}_p${thumbPadded}.jpg`;

        // 2. Download Pages (Concurrency from Settings)
        const chunks = [];
        for (let i = 0; i < images.length; i += maxConcurrentPages) {
            chunks.push(images.slice(i, i + maxConcurrentPages));
        }

        for (const chunk of chunks) {
             if (store.queue.find((j: any) => j.id === jobId)?.status === 'paused') {
                 throw new Error("Job Paused");
             }

            await Promise.all(chunk.map(async (img) => {
                const pageIdx = images.indexOf(img);
                const pPadded = (pageIdx + 1).toString().padStart(3, '0');
                const fileName = `ch${chPadded}_p${pPadded}.jpg`;
                const filePath = `${mangaRoot}/${fileName}`;
                
                try {
                    await invoke('download_image', {
                        url: img.url,
                        filePath: filePath,
                        headers: (metadata.source !== 'mangadex' && metadata.sourceUrl) ? { 'Referer': metadata.sourceUrl } : null
                    });

                } catch (e) {
                    console.error(`Failed to download ${fileName}`, e);
                }
            }));
        }

        return thumbFileName;
    }

    static async repairChapter(seriesId: string, chapterId: string) {
        // console.log(`[Download] Repairing Chapter ${chapterId} for series ${seriesId}...`);
        
        const { useLibraryStore } = await import('../stores/useLibraryStore');
        const series = useLibraryStore.getState().series.find(s => s.id === seriesId);
        if (!series) {
            console.error("[Download] Repair failed: Series not found in library");
            return false;
        }

        const book = series.books.find(b => b.id === chapterId);
        if (!book) {
            console.error("[Download] Repair failed: Chapter not found in series");
            return false;
        }

        const mangaRoot = series.path;
        const metadata = {
            source: series.source,
            sourceUrl: series.seriesUrl,
            mangaId: series.mangaId
        };

        const chapter = {
            id: book.id,
            number: book.meta.chapter || '1',
            sourceId: book.sourceId
        };
        
        // 1. Re-download the chapter
        // We need a dummy job id or the original one. We'll use a unique repair id.
        const repairJobId = `repair-${Date.now()}`;
        
        // Mock a store-like object for the downloadChapterFlat
        const mockStore = {
            queue: [{ id: repairJobId, status: 'running' }],
            updateJobProgress: () => {},
            updateJobStatus: () => {}
        };

        try {
            const { images } = await this.fetchChapterData(chapter, metadata);
            const thumbFile = await this.downloadChapterPages(images, chapter.number, mangaRoot, repairJobId, mockStore, metadata);
            
            if (images.length > 0) {
                // Update metadata if needed (e.g. if page count changed)
                const content = await readTextFile(`${mangaRoot}/metadata.json`);
                const meta = JSON.parse(content);
                
                const chIdx = meta.chapters.findIndex((c: any) => c.number === chapter.number);
                if (chIdx !== -1) {
                    const ch = meta.chapters[chIdx];
                    ch.coverFile = thumbFile || ch.coverFile;
                    // Recalculate range if needed? 
                    // Actually, if it's a repair, we assume indices are mostly valid but the files were bad.
                    // If pagesCount is different, we have a bigger problem with global indices.
                    // For now, let's just focus on fixing the files.
                }
                
                await this.writeMetadata(mangaRoot, meta);
                return true;
            }
        } catch (err) {
            console.error(`[Download] Repair failed for chapter ${chapter.number}`, err);
        }
        return false;
    }

    static async wipeAndRedownload(seriesId: string, seriesPath: string, sourceUrl: string) {
        // console.log(`[Download] NUCLEAR WIPE initiated for ${seriesId} at ${seriesPath}`);
        try {
            // 1. Wipe Disk (Preserves cover)
            await invoke('wipe_manga_contents', { path: seriesPath });
            
            // 2. Clear DB
            const { useLibraryStore } = await import('../stores/useLibraryStore');
            await useLibraryStore.getState().deleteSeries(seriesId);
            
            // 3. Set Scraper URL (Frontend will handle the rest via ImportModal)
            const { useScraperStore } = await import('../stores/useScraperStore');
            useScraperStore.getState().setUrl(sourceUrl);
            
            return true;
        } catch (err) {
            console.error(`[Download] Nuclear Wipe failed`, err);
            return false;
        }
    }

    private static async writeMetadata(mangaRoot: string, metadata: any) {
         try {
             // Ensure we are not losing data (redundant check but good for safety)
             if (!metadata.chapters || !Array.isArray(metadata.chapters)) {
                 console.error("[Download] Attempted to write metadata without chapters! Aborting write.");
                 return;
             }

             const safeMeta = {
                title: metadata.title || 'Unknown Series',
                description: metadata.description || '',
                author: metadata.author || '',
                artist: metadata.artist || '',
                tags: metadata.tags || [],
                status: metadata.status || 'unknown',
                source: metadata.source || 'mangadex',
                sourceUrl: metadata.sourceUrl || '',
                mangaId: metadata.mangaId || 'local',
                coverFile: metadata.coverFile || 'cover.jpg',
                totalPages: metadata.totalPages || 0,
                chapters: metadata.chapters, // This now includes ALL chapters (old + new)
                lastChecked: Math.floor(Date.now() / 1000),
                version: 3.0
            };
            
            await writeTextFile(`${mangaRoot}/metadata.json`, JSON.stringify(safeMeta, null, 2));
         } catch (e) {
             console.error("Failed to write metadata", e);
         }
    }
}
