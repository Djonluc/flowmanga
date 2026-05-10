import { create } from 'zustand';
import { getDb } from '../services/db';
import { toast } from '../components/Toast';

export interface ComicInfo {
  series?: string;
  volume?: string;
  chapter?: string;
  group?: string;
  title?: string;
}

export interface Book {
  id: string;
  seriesId: string;
  path: string;
  title: string;
  cover: string | null;
  meta: ComicInfo;
  progress?: {
    currentPage: number;
    totalPages: number;
  };
  totalPages?: number;
  sourceId?: string; // Original UUID or URL
}

export interface Series {
  id: string;
  mangaId?: string; // Cross-source identifier
  seriesUrl?: string; // Original scraping URL
  title: string;
  path: string;
  displayName: string;
  author?: string;
  cover: string | null;
  description?: string;
  tags: string[];
  source?: string;
  books: Book[];
  anilistId?: string;
  malId?: string;
  createdAt: string;
  updatedAt: string;
}

interface LibraryState {
  series: Series[];
  recentBooks: any[];
  isLoading: boolean;
  
  // Library State
  searchQuery: string;
  filterTags: string[];
  filterGenre: string | null;
  filterStatus: string | null;
  filterSource: string | null;
  selectedSeriesId: string | null;

  setSearchQuery: (query: string) => void;
  setFilterGenre: (genre: string | null) => void;
  toggleFilterTag: (tag: string) => void;
  clearFilterTags: () => void;
  setFilterStatus: (status: string | null) => void;
  setFilterSource: (source: string | null) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  toggleSelectionMode: () => void;
  toggleSelectedId: (id: string) => void;
  clearSelection: () => void;
  setSelectedSeriesId: (id: string | null) => void;
  
  // Actions
  loadFromDb: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  addMangaFolder: (path: string) => Promise<void>;
  addToRecent: (book: any) => void;
  updateReadingProgress: (seriesId: string, chapterId: string, page: number) => Promise<void>;
  updateTags: (seriesId: string, tags: string[]) => Promise<void>;
  renameSeries: (seriesId: string, newTitle: string) => Promise<void>;
  deleteSeries: (seriesId: string | null, path: string | null, deleteFiles?: boolean) => Promise<void>;
  bulkDelete: (deleteFiles?: boolean) => Promise<void>;
  setSeriesCover: (seriesId: string, sourcePath: string) => Promise<void>;
  removeSeriesCover: (seriesId: string) => Promise<void>;
  registerDownloadedSeries: (metadata: any, chapters: any[]) => Promise<void>;
  scanLibrary: (path?: string) => Promise<void>;
  refreshMangaMetadata: (seriesId: string) => Promise<void>;
  refreshChapterThumbnails: (seriesId: string) => Promise<void>;
  bulkRefreshMetadata: () => Promise<void>;
  toggleFavorite: (seriesId: string) => Promise<void>;
  verifyLibraryIntegrity: () => Promise<number>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  series: [],
  recentBooks: [],
  isLoading: false,

  searchQuery: '',
  filterTags: [],
  filterGenre: null,
  filterStatus: null,
  filterSource: null,
  selectedSeriesId: null,
  selectionMode: false,
  selectedIds: new Set<string>(),

  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilterGenre: (g) => set({ filterGenre: g }),
  toggleFilterTag: (tag) => {
    const { filterTags } = get();
    if (filterTags.includes(tag)) {
        set({ filterTags: filterTags.filter(t => t !== tag) });
    } else {
        set({ filterTags: [...filterTags, tag] });
    }
  },
  clearFilterTags: () => set({ filterTags: [] }),
  setFilterStatus: (s) => set({ filterStatus: s }),
  setFilterSource: (src) => set({ filterSource: src }),
  setSelectedSeriesId: (id) => set({ selectedSeriesId: id }),

  toggleSelectionMode: () => set((state) => ({ 
    selectionMode: !state.selectionMode,
    selectedIds: new Set()
  })),

  toggleSelectedId: (id) => set((state) => {
    const next = new Set(state.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { selectedIds: next };
  }),

  clearSelection: () => set({ selectedIds: new Set() }),

  loadFromDb: async () => {
    const db = getDb();
    const series = await db.select<any[]>('SELECT * FROM Series WHERE type = "manga" ORDER BY updatedAt DESC');
    const enrichedSeries: Series[] = [];

    for (const s of series) {
      const chapters = await db.select<any[]>(`
        SELECT c.*, p.currentPage, p.totalPages as savedTotalPages 
        FROM Chapters c 
        LEFT JOIN ReadingProgress p ON c.id = p.chapterId 
        WHERE c.seriesId = ?
      `, [s.id]);
      
      enrichedSeries.push({
        id: s.id,
        title: s.title, 
        path: s.path,
        displayName: s.title, 
        author: s.author,
        cover: s.coverPath,
        description: s.description,
        tags: s.tags ? s.tags.split(',').filter((t: string) => t) : [],
        source: s.source,
        mangaId: s.mangaId,
        seriesUrl: s.seriesUrl,
        anilistId: s.anilistId,
        malId: s.malId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        books: chapters.map(c => ({
          id: c.id,
          seriesId: s.id,
          path: c.filePath,
          title: c.title,
          cover: c.coverPath || s.coverPath,
          meta: { series: s.title, chapter: c.chapterNumber.toString() },
          progress: c.currentPage !== null ? {
            currentPage: c.currentPage,
            totalPages: c.totalPages || c.savedTotalPages || 0
          } : undefined,
          totalPages: c.totalPages || 0,
          sourceId: c.sourceId
        }))
      });
    }

    // Sort recent items
    const recentBooks = enrichedSeries.flatMap(s => s.books).slice(0, 10);

    set({ series: enrichedSeries, recentBooks });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  addToRecent: (book: any) => {
      set(state => ({
          recentBooks: [book, ...state.recentBooks.filter(b => b.path !== book.path)].slice(0, 10)
      }));
  },

  addMangaFolder: async (path: string) => {
    // ... (keep existing)
    const { invoke } = await import('@tauri-apps/api/core');
    const db = getDb();
    
    try {
      const results: any[] = await invoke('scan_manga_folder', { path });

      for (const m of results) {
        // 1. Insert Series with rich v2.5 metadata
        await db.execute(
          'INSERT OR IGNORE INTO Series (id, title, path, author, type, coverPath, source, tags, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [m.id, m.title, m.file_path, m.author || '', 'manga', m.cover_path, 'local', (m.tags || []).join(','), m.description || '']
        );
        
        // 2. Scan and Insert Chapters
        const chapters: any[] = await invoke('scan_chapters', { path: m.file_path, seriesId: m.id });
        for (const c of chapters) {
            await db.execute(
              'INSERT OR IGNORE INTO Chapters (id, seriesId, title, chapterNumber, filePath, coverPath, totalPages) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [c.id, m.id, c.title, c.chapter_number, c.file_path, c.cover_path || null, c.pages || 0]
            );
        }
      }

      await get().loadFromDb();
    } catch (err) {
      console.error('[LibraryStore] Failed to add manga folder:', err);
      throw err;
    }
  },

  updateReadingProgress: async (seriesId, chapterId, page) => {
    const db = getDb();
    await db.execute(
      'INSERT OR REPLACE INTO ReadingProgress (id, seriesId, chapterId, currentPage, lastReadAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [`${seriesId}-${chapterId}`, seriesId, chapterId, page]
    );
    // Touch the series updatedAt to bring it to the top of the library
    await db.execute('UPDATE Series SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [seriesId]);

    // 2. External Tracker Sync (AniList)
    try {
        const series = get().series.find(s => s.id === seriesId);
        if (series && (series.anilistId || series.malId)) {
            const book = series.books.find(b => b.id === chapterId);
            if (book) {
                // If we are on the last page or near it, consider the chapter read
                const isNearEnd = page >= (book.totalPages || 1) - 1;
                if (isNearEnd) {
                    const chNum = parseFloat(book.meta.chapter || '0');
                    if (chNum > 0) {
                        const { useTrackerStore } = await import('./useTrackerStore');
                        if (series.anilistId) {
                            await useTrackerStore.getState().updateAnilistProgress(parseInt(series.anilistId), Math.floor(chNum));
                        }
                        if (series.malId) {
                            await useTrackerStore.getState().updateMalProgress(parseInt(series.malId), Math.floor(chNum));
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('[LibraryStore] Tracker sync failed:', e);
    }
  },

  updateTags: async (seriesId, tags) => {
      const db = getDb();
      const tagsStr = tags.join(',');
      await db.execute('UPDATE Series SET tags = ? WHERE id = ?', [tagsStr, seriesId]);
      await get().loadFromDb(); 
  },

  renameSeries: async (seriesId, newTitle) => {
      const db = getDb();
      await db.execute('UPDATE Series SET title = ? WHERE id = ?', [newTitle, seriesId]);
      await get().loadFromDb();
  },

  deleteSeries: async (seriesId, path, deleteFiles = false) => {
      const db = getDb();
      try {
        // Use path as fallback when id is null (SQLite TEXT PK allows nulls)
        const whereClause = seriesId ? 'id = ?' : 'path = ?';
        const whereParam = seriesId || path;
        if (!whereParam) {
          throw new Error('Cannot delete series: both id and path are null');
        }

        // Look up the seriesId by path if needed, for child record cleanup
        let resolvedId = seriesId;
        let resolvedPath = path;
        if (!resolvedId && path) {
          const rows = await db.select<any[]>('SELECT id FROM Series WHERE path = ?', [path]);
          resolvedId = rows.length > 0 ? rows[0].id : null;
        }
        if (!resolvedPath && seriesId) {
          const rows = await db.select<any[]>('SELECT path FROM Series WHERE id = ?', [seriesId]);
          resolvedPath = rows.length > 0 ? rows[0].path : null;
        }

        // Explicitly delete child records (handles both null-id and normal cases)
        if (resolvedId) {
          await db.execute('DELETE FROM ReadingProgress WHERE seriesId = ?', [resolvedId]);
          await db.execute('DELETE FROM Chapters WHERE seriesId = ?', [resolvedId]);
        } else {
          // For null-id series, find chapters by joining on the series path
          await db.execute(`DELETE FROM ReadingProgress WHERE seriesId IN (SELECT id FROM Series WHERE ${whereClause})`, [whereParam]);
          await db.execute(`DELETE FROM Chapters WHERE seriesId IN (SELECT id FROM Series WHERE ${whereClause})`, [whereParam]);
        }

        await db.execute(`DELETE FROM Series WHERE ${whereClause}`, [whereParam]);
        
        // Physical Deletion
        if (deleteFiles && resolvedPath) {
          const { remove } = await import('@tauri-apps/plugin-fs');
          try {
            // console.log('[LibraryStore] Attempting to delete:', resolvedPath);
            // Safety Check: Prevent deleting root directories or very short paths
            const isRoot = resolvedPath.length < 5 || 
                           resolvedPath.endsWith(':\\') || 
                           resolvedPath.endsWith(':/') ||
                           resolvedPath.split(/[\\/]/).filter(Boolean).length < 3;
            
            if (isRoot) {
                console.error('[LibraryStore] Refusing to delete potentially critical path:', resolvedPath);
                toast.error("Safety check: Cannot delete root directory.");
                return;
            }

            await remove(resolvedPath, { recursive: true });
            toast.success("Folder deleted from disk");
          } catch (e) {
            console.error('[LibraryStore] Failed to delete folder from disk:', e);
            toast.error("Failed to delete local files. Check permissions.");
          }
        }

        await get().loadFromDb();
      } catch (err) {
        console.error('[LibraryStore] Failed to delete series:', err);
        throw err;
      }
  },

  setSeriesCover: async (seriesId, sourcePath) => {
      const { invoke } = await import('@tauri-apps/api/core');
      const db = getDb();
      const series = get().series.find(s => s.id === seriesId);
      if (!series) return;

      try {
          const newCoverPath = await invoke<string>('set_manga_cover', { seriesPath: series.path, sourcePath });
          
          // Update DB
          await db.execute('UPDATE Series SET coverPath = ? WHERE id = ?', [newCoverPath, seriesId]);

          // Update Local State with a cache-buster logic if needed, but for now just path
          // If the path is the same (cover.jpg), we might need to force re-render in component
          // For now, we update the store.
          set(state => ({
              series: state.series.map(s => s.id === seriesId ? { ...s, cover: newCoverPath } : s)
          }));
          
          await get().loadFromDb(); // Ensure consistency
      } catch (e) {
          console.error('Failed to set cover', e);
          throw e;
      }
  },

  removeSeriesCover: async (seriesId) => {
      const { invoke } = await import('@tauri-apps/api/core');
      const db = getDb();
      const series = get().series.find(s => s.id === seriesId);
      if (!series) return;

      try {
          await invoke('remove_manga_cover', { seriesPath: series.path });
          
          await db.execute('UPDATE Series SET coverPath = NULL WHERE id = ?', [seriesId]);

          set(state => ({
              series: state.series.map(s => s.id === seriesId ? { ...s, cover: null } : s)
          }));
          
          await get().loadFromDb();
      } catch (e) {
          console.error('Failed to remove cover', e);
          throw e;
      }
  },

  registerDownloadedSeries: async (metadata: any, chapters: any[]) => {
      const db = getDb();
      try {
          // 1. Insert/Update Series (Avoid REPLACE to prevent cascade delete of chapters)
          await db.execute(
            'INSERT OR IGNORE INTO Series (id, title, path, type, source) VALUES (?, ?, ?, ?, ?)',
            [metadata.mangaId, metadata.title, metadata.rootPath, 'manga', metadata.source || 'mangadex']
          );

          await db.execute(
            'UPDATE Series SET title = ?, path = ?, author = ?, coverPath = ?, source = ?, tags = ?, description = ?, seriesUrl = ?, mangaId = ? WHERE id = ?',
            [
                metadata.title, 
                metadata.rootPath, 
                metadata.author || '', 
                metadata.coverPath, 
                metadata.source || 'mangadex', 
                (metadata.tags || []).join(','), 
                metadata.description || '',
                metadata.sourceUrl || metadata.seriesUrl || '',
                metadata.mangaId,
                metadata.mangaId
            ]
          );

          // 2. Insert Chapters
          for (const c of chapters) {
              await db.execute(
                'INSERT OR REPLACE INTO Chapters (id, seriesId, title, chapterNumber, filePath, coverPath, sourceId, totalPages) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [c.id, metadata.mangaId, c.title, c.chapterNumber, c.filePath, c.coverPath || null, c.sourceId || null, c.totalPages || 0]
              );
          }
          
          // 3. Refresh UI
          await get().loadFromDb();
      } catch (err) {
          console.error('[LibraryStore] Failed to register downloaded series:', err);
      }
  },

  scanLibrary: async (path?: string) => {
        if (path) {
            await get().addMangaFolder(path);
        } else {
            const { useSettingsStore } = await import('./useSettingsStore');
            const { libraryPath } = useSettingsStore.getState();
            if (libraryPath) {
                await get().addMangaFolder(libraryPath);
            }
        }
  },

  verifyLibraryIntegrity: async (seriesId?: string) => {
    const { exists } = await import('@tauri-apps/plugin-fs');
    const db = getDb();
    const seriesList = seriesId ? get().series.filter(s => s.id === seriesId) : get().series;
    set({ isLoading: true });

    let removedCount = 0;
    for (const s of seriesList) {
        if (s.path) {
            const folderExists = await exists(s.path);
            if (!folderExists) {
                console.warn(`[LibraryStore] Folder missing: ${s.path}. Removing from DB.`);
                await get().deleteSeries(s.id, s.path, false);
                removedCount++;
            } else {
                // Folder exists, verify chapters
                for (const book of s.books) {
                    const fileExists = await exists(book.path);
                    if (!fileExists) {
                        console.warn(`[LibraryStore] Chapter missing: ${book.path}. Removing from DB.`);
                        await db.execute('DELETE FROM Chapters WHERE id = ?', [book.id]);
                        await db.execute('DELETE FROM ReadingProgress WHERE chapterId = ?', [book.id]);
                    }
                }
            }
        }
    }

    if (removedCount > 0 || seriesId) {
        await get().loadFromDb();
    }
    set({ isLoading: false });
    return removedCount;
  },

  refreshMangaMetadata: async (seriesId) => {
    const series = get().series.find(s => s.id === seriesId);
    if (!series || !series.mangaId || series.mangaId === 'local') return;

    try {
        const { ScraperService } = await import('../services/ScraperService');
        const db = getDb();
        let details: any = null;
        let sourceName = 'mangadex';

        if (series.mangaId.length === 36) {
            // MangaDex
            details = await ScraperService.getMangaDetails(series.mangaId);
            sourceName = 'mangadex';
        } else if (series.mangaId.startsWith('http')) {
            // URL-based (LuaComic, Headless, etc.)
            const result = await ScraperService.scrapeChapter(series.mangaId);
            if (result.series) {
                details = {
                    title: result.series.title,
                    description: result.series.description,
                    author: '', // We don't usually scrape author from generic series yet
                    tags: result.series.tags || [],
                    coverUrl: result.series.coverUrl
                };
                sourceName = result.series.source || 'scraped';
            } else if (result.metadata) {
                details = {
                    title: result.metadata.title || series.title,
                    description: result.metadata.description || '',
                    author: result.metadata.author || '',
                    tags: result.metadata.tags || [],
                    coverUrl: result.metadata.coverUrl
                };
            }
        }

        if (details) {
            // Normalize tags
            const tags = Array.from(new Set([
                ...(series.tags || []),
                ...(details.tags || [])
            ])).filter(t => t).join(',');

            await db.execute(
                'UPDATE Series SET title = ?, description = ?, author = ?, tags = ?, coverPath = ? WHERE id = ?',
                [
                    details.title,
                    details.description,
                    details.author || series.author || '',
                    tags,
                    details.coverUrl || series.cover,
                    seriesId
                ]
            );

            // Also update local metadata.json if it exists
            const { writeTextFile, exists } = await import('@tauri-apps/plugin-fs');
            const metaPath = `${series.path}/metadata.json`;
            if (await exists(metaPath)) {
                const newMeta = {
                    title: details.title,
                    description: details.description,
                    author: details.author || series.author || '',
                    tags: tags.split(','),
                    mangaId: series.mangaId,
                    coverFile: 'cover.jpg',
                    source: sourceName,
                    version: 3.0
                };
                await writeTextFile(metaPath, JSON.stringify(newMeta, null, 2));
            }

            // Also try to generate thumbnails if missing
            await get().refreshChapterThumbnails(seriesId);
            await get().loadFromDb();
        }
    } catch (err) {
        console.error('[LibraryStore] Failed to refresh metadata:', err);
    }
  },

  refreshChapterThumbnails: async (seriesId) => {
      const { invoke } = await import('@tauri-apps/api/core');
      const series = get().series.find(s => s.id === seriesId);
      if (!series) return;

      const db = getDb();
      for (const book of series.books) {
          // If cover is just the series cover, it's effectively "missing" a per-chapter one
          if (!book.cover || book.cover === series.cover) {
              try {
                  // Reuse the same logic as DownloadService but via Rust backend directly for efficiency
                  const newThumb: string = await invoke('generate_chapter_thumbnail', { 
                      chapterPath: book.path, 
                      seriesPath: series.path 
                  });
                  
                  if (newThumb) {
                      await db.execute('UPDATE Chapters SET coverPath = ? WHERE id = ?', [newThumb, book.id]);
                  }
              } catch (e) {
                  console.warn(`[LibraryStore] Failed to generate thumbnail for ${book.title}`, e);
              }
          }
      }
  },

  bulkRefreshMetadata: async () => {
      set({ isLoading: true });
      const allSeries = get().series;
      for (const s of allSeries) {
          if (s.mangaId && (s.mangaId.length === 36 || s.mangaId.startsWith('http'))) {
              await get().refreshMangaMetadata(s.id);
          } else {
              // Local only updates
              await get().refreshChapterThumbnails(s.id);
          }
      }
      set({ isLoading: false });
  },

  bulkDelete: async (deleteFiles = false) => {
    const { selectedIds, series } = get();
    if (selectedIds.size === 0) return;

    set({ isLoading: true });
    try {
        const idsArray = Array.from(selectedIds);
        for (const id of idsArray) {
            const s = series.find(x => x.id === id);
            if (s) {
                await get().deleteSeries(s.id, s.path, deleteFiles);
            }
        }
        set({ selectedIds: new Set(), selectionMode: false });
        await get().loadFromDb();
        toast.success(`Successfully deleted ${idsArray.length} items`);
    } catch (e) {
        console.error('[LibraryStore] Bulk delete failed:', e);
        toast.error('Bulk deletion encountered errors');
    } finally {
        set({ isLoading: false });
    }
  },

  toggleFavorite: async (seriesId) => {
    const db = getDb();
    const series = get().series.find(s => s.id === seriesId);
    if (!series) return;

    const isFavorite = series.tags.includes('favorite');
    let newTags = [];
    if (isFavorite) {
        newTags = series.tags.filter(t => t !== 'favorite');
    } else {
        newTags = [...series.tags, 'favorite'];
    }

    const tagsStr = newTags.join(',');
    await db.execute('UPDATE Series SET tags = ? WHERE id = ?', [tagsStr, seriesId]);
    
    // Update local state
    set(state => ({
        series: state.series.map(s => s.id === seriesId ? { ...s, tags: newTags } : s)
    }));
  },
}));
