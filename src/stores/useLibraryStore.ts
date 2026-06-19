import { create } from "zustand";
import { getDb } from "../services/db";
import { toast } from "../components/Toast";

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
  artist?: string;
  status?: string;
  books: Book[];
  anilistId?: string;
  malId?: string;
  displayTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverPath?: string;
  createdAt: string;
  updatedAt: string;
  seriesIds: string[];
}

interface LibraryState {
  series: Series[];
  collections: Collection[];
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
  loadCollections: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  addMangaFolder: (path: string) => Promise<void>;
  addToRecent: (book: any) => void;
  updateReadingProgress: (
    seriesId: string,
    chapterId: string,
    page: number,
  ) => Promise<void>;
  updateTags: (seriesId: string, tags: string[]) => Promise<void>;
  clearReadingProgressForSeries: (seriesId: string) => Promise<void>;
  renameSeries: (seriesId: string, newTitle: string) => Promise<void>;
  setSeriesDisplayTitle: (
    seriesId: string,
    displayTitle: string,
  ) => Promise<void>;
  deleteSeries: (
    seriesId: string | null,
    path: string | null,
    deleteFiles?: boolean,
  ) => Promise<void>;
  deleteChapter: (
    seriesId: string,
    chapterId: string,
    deleteFiles?: boolean,
  ) => Promise<void>;
  bulkDelete: (deleteFiles?: boolean) => Promise<void>;
  setSeriesCover: (seriesId: string, sourcePath: string) => Promise<void>;
  removeSeriesCover: (seriesId: string) => Promise<void>;
  registerDownloadedSeries: (metadata: any, chapters: any[]) => Promise<void>;
  scanLibrary: (path?: string) => Promise<void>;
  rebuildCollectionIndex: () => Promise<void>;
  refreshMangaMetadata: (seriesId: string) => Promise<void>;
  refreshChapterThumbnails: (seriesId: string) => Promise<void>;
  bulkRefreshMetadata: () => Promise<void>;
  toggleFavorite: (seriesId: string) => Promise<void>;
  verifyLibraryIntegrity: (seriesId?: string) => Promise<number>;

  // Collection Actions
  createCollection: (name: string, description?: string) => Promise<void>;
  addSeriesToCollection: (
    collectionId: string,
    seriesId: string,
  ) => Promise<void>;
  removeSeriesFromCollection: (
    collectionId: string,
    seriesId: string,
  ) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  series: [],
  collections: [],
  recentBooks: [],
  isLoading: false,

  searchQuery: "",
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
      set({ filterTags: filterTags.filter((t) => t !== tag) });
    } else {
      set({ filterTags: [...filterTags, tag] });
    }
  },
  clearFilterTags: () => set({ filterTags: [] }),
  setFilterStatus: (s) => set({ filterStatus: s }),
  setFilterSource: (src) => set({ filterSource: src }),
  setSelectedSeriesId: (id) => set({ selectedSeriesId: id }),

  toggleSelectionMode: () =>
    set((state) => ({
      selectionMode: !state.selectionMode,
      selectedIds: new Set(),
    })),

  toggleSelectedId: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  loadFromDb: async () => {
    const db = getDb();
    const series = await db.select<any[]>(
      "SELECT * FROM Series ORDER BY updatedAt DESC",
    );
    const enrichedSeries: Series[] = [];

    for (const s of series) {
      const chapters = await db.select<any[]>(
        `
        SELECT c.*, p.currentPage, p.totalPages as savedTotalPages 
        FROM Chapters c 
        LEFT JOIN ReadingProgress p ON c.id = p.chapterId 
        WHERE c.seriesId = ?
      `,
        [s.id],
      );

      enrichedSeries.push({
        id: s.id,
        title: s.title,
        path: s.path,
        displayName: s.displayTitle || s.title,
        displayTitle: s.displayTitle,
        author: s.author,
        cover: s.coverPath,
        description: s.description,
        tags: s.tags ? s.tags.split(",").filter((t: string) => t) : [],
        source: s.source,
        mangaId: s.mangaId,
        seriesUrl: s.seriesUrl,
        anilistId: s.anilistId,
        malId: s.malId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        books: chapters.map((c) => ({
          id: c.id,
          seriesId: s.id,
          path: c.filePath,
          title: c.title,
          cover: c.coverPath || s.coverPath,
          meta: { series: s.title, chapter: c.chapterNumber.toString() },
          progress:
            c.currentPage !== null
              ? {
                  currentPage: c.currentPage,
                  totalPages: c.totalPages || c.savedTotalPages || 0,
                }
              : undefined,
          totalPages: c.totalPages || 0,
          sourceId: c.sourceId,
        })),
      });
    }

    // Sort recent items
    const recentBooks = enrichedSeries.flatMap((s) => s.books).slice(0, 10);

    set({ series: enrichedSeries, recentBooks });
    await get().loadCollections();
  },

  loadCollections: async () => {
    const db = getDb();
    const collections = await db.select<any[]>(
      "SELECT * FROM Collections ORDER BY updatedAt DESC",
    );
    const enriched: Collection[] = [];

    for (const c of collections) {
      const items = await db.select<any[]>(
        "SELECT seriesId FROM CollectionItems WHERE collectionId = ?",
        [c.id],
      );
      enriched.push({
        ...c,
        seriesIds: items.map((i) => i.seriesId),
      });
    }

    set({ collections: enriched });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  addToRecent: (book: any) => {
    set((state) => ({
      recentBooks: [
        book,
        ...state.recentBooks.filter((b) => b.path !== book.path),
      ].slice(0, 10),
    }));
  },

  addMangaFolder: async (path: string) => {
    // ... (keep existing)
    const { invoke } = await import("@tauri-apps/api/core");
    const db = getDb();

    try {
      const results: any[] = await invoke("scan_manga_folder", { path });

      for (const m of results) {
        // 1. Insert Series with rich v2.5 metadata
        await db.execute(
          "INSERT OR IGNORE INTO Series (id, title, path, author, type, coverPath, source, tags, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            m.id,
            m.title,
            m.file_path,
            m.author || "",
            "manga",
            m.cover_path,
            "local",
            (m.tags || []).join(","),
            m.description || "",
          ],
        );

        // 2. Scan and Insert Chapters
        const chapters: any[] = await invoke("scan_chapters", {
          path: m.file_path,
          seriesId: m.id,
        });
        for (const c of chapters) {
          await db.execute(
            "INSERT OR IGNORE INTO Chapters (id, seriesId, title, chapterNumber, filePath, coverPath, totalPages) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              c.id,
              m.id,
              c.title,
              c.chapter_number,
              c.file_path,
              c.cover_path || null,
              c.pages || 0,
            ],
          );
        }
      }

      await get().loadFromDb();
    } catch (err) {
      console.error("[LibraryStore] Failed to add manga folder:", err);
      throw err;
    }
  },

  updateReadingProgress: async (seriesId, chapterId, page) => {
    const db = getDb();
    await db.execute(
      "INSERT OR REPLACE INTO ReadingProgress (id, seriesId, chapterId, currentPage, lastReadAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
      [`${seriesId}-${chapterId}`, seriesId, chapterId, page],
    );
    // Touch the series updatedAt to bring it to the top of the library
    await db.execute(
      "UPDATE Series SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [seriesId],
    );

    // 2. External Tracker Sync (AniList)
    try {
      const series = get().series.find((s) => s.id === seriesId);
      if (series && (series.anilistId || series.malId)) {
        const book = series.books.find((b) => b.id === chapterId);
        if (book) {
          // If we are on the last page or near it, consider the chapter read
          const isNearEnd = page >= (book.totalPages || 1) - 1;
          if (isNearEnd) {
            const chNum = parseFloat(book.meta.chapter || "0");
            if (chNum > 0) {
              const { useTrackerStore } = await import("./useTrackerStore");
              if (series.anilistId) {
                await useTrackerStore
                  .getState()
                  .updateAnilistProgress(
                    parseInt(series.anilistId),
                    Math.floor(chNum),
                  );
              }
              if (series.malId) {
                await useTrackerStore
                  .getState()
                  .updateMalProgress(parseInt(series.malId), Math.floor(chNum));
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[LibraryStore] Tracker sync failed:", e);
    }
  },

  updateTags: async (seriesId, tags) => {
    const db = getDb();
    const tagsStr = tags.join(",");
    await db.execute("UPDATE Series SET tags = ? WHERE id = ?", [
      tagsStr,
      seriesId,
    ]);
    await get().loadFromDb();
  },

  clearReadingProgressForSeries: async (seriesId) => {
    const db = getDb();
    await db.execute("DELETE FROM ReadingProgress WHERE seriesId = ?", [
      seriesId,
    ]);
    await get().loadFromDb();
  },

  renameSeries: async (seriesId, newTitle) => {
    const db = getDb();
    await db.execute("UPDATE Series SET title = ? WHERE id = ?", [
      newTitle,
      seriesId,
    ]);
    await get().loadFromDb();
  },

  setSeriesDisplayTitle: async (seriesId, displayTitle) => {
    const db = getDb();
    await db.execute("UPDATE Series SET displayTitle = ? WHERE id = ?", [
      displayTitle,
      seriesId,
    ]);

    // Update local state directly so we don't need a full DB reload if we don't want to, but loadFromDb is safe
    await get().loadFromDb();
  },

  deleteSeries: async (seriesId, path, deleteFiles = false) => {
    const db = getDb();
    set({ isLoading: true });
    try {
      const whereClause = seriesId ? "id = ?" : "path = ?";
      const whereParam = seriesId || path;

      if (!whereParam) {
        throw new Error("Cannot delete series: both id and path are null");
      }

      // 1. Resolve full details for physical deletion if needed
      let resolvedId = seriesId;
      let resolvedPath = path;

      if (!resolvedId || !resolvedPath) {
        const rows = await db.select<any[]>(
          `SELECT id, path FROM Series WHERE ${whereClause}`,
          [whereParam],
        );
        if (rows.length > 0) {
          resolvedId = rows[0].id;
          resolvedPath = rows[0].path;
        }
      }

      // 2. Database Deletion (Manual cleanup for tables without reliable cascades)
      if (resolvedId) {
        await db.execute("DELETE FROM ReadingProgress WHERE seriesId = ?", [
          resolvedId,
        ]);
        await db.execute("DELETE FROM Chapters WHERE seriesId = ?", [
          resolvedId,
        ]);
        await db.execute("DELETE FROM CollectionItems WHERE seriesId = ?", [
          resolvedId,
        ]);
      }

      await db.execute(`DELETE FROM Series WHERE ${whereClause}`, [whereParam]);
      console.log(`[LibraryStore] Deleted series from DB: ${whereParam}`);

      // 3. Physical Deletion
      if (deleteFiles && resolvedPath) {
        try {
          const { remove } = await import("@tauri-apps/plugin-fs");

          // Safety Check: Prevent deleting root directories
          const parts = resolvedPath.split(/[\\/]/).filter(Boolean);
          const isRoot =
            resolvedPath.length < 5 ||
            resolvedPath.endsWith(":\\") ||
            resolvedPath.endsWith(":/") ||
            parts.length < 3;

          if (isRoot) {
            console.warn(
              "[LibraryStore] Safety block: Refusing to delete shallow path:",
              resolvedPath,
            );
            toast.error(
              "Safety check: Cannot delete files from root directory.",
            );
          } else {
            await remove(resolvedPath, { recursive: true });
            toast.success("Content deleted from disk");
          }
        } catch (e) {
          console.error("[LibraryStore] FS deletion failed:", e);
          toast.error(
            "Removed from library, but failed to delete local files.",
          );
        }
      } else {
        toast.success("Removed from library");
      }

      // 4. Force state refresh
      await get().loadFromDb();
    } catch (err) {
      console.error("[LibraryStore] Failed to delete series:", err);
      toast.error("Failed to remove item from library");
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteChapter: async (seriesId, chapterId, deleteFiles = true) => {
    const db = getDb();
    const series = get().series.find((s) => s.id === seriesId);

    try {
      const rows = await db.select<any[]>(
        "SELECT * FROM Chapters WHERE id = ? AND seriesId = ?",
        [chapterId, seriesId],
      );
      const chapter = rows[0];

      if (!chapter) {
        toast.error("Chapter was not found in the library");
        return;
      }

      await db.execute("DELETE FROM ReadingProgress WHERE chapterId = ?", [
        chapterId,
      ]);
      await db.execute("DELETE FROM Chapters WHERE id = ?", [chapterId]);

      if (deleteFiles && series?.path) {
        const { exists, readDir, readTextFile, remove, writeTextFile } =
          await import("@tauri-apps/plugin-fs");

        const chapterPath = chapter.filePath as string | null;
        const isFlatChapter = !chapterPath || chapterPath === series.path;

        if (!isFlatChapter && chapterPath && (await exists(chapterPath))) {
          await remove(chapterPath, { recursive: true });
        } else {
          const chapterNumber = String(chapter.chapterNumber ?? "");
          const chapterPrefix = `ch${parseFloat(chapterNumber)
            .toString()
            .split(".")[0]
            .padStart(3, "0")}_`;

          const entries = await readDir(series.path).catch(() => []);
          const chapterFiles = entries
            .map((entry: any) => entry.name)
            .filter(
              (name): name is string =>
                typeof name === "string" && name.startsWith(chapterPrefix),
            );

          await Promise.all(
            chapterFiles.map((name) =>
              remove(`${series.path}/${name}`).catch(() => undefined),
            ),
          );

          const metaPath = `${series.path}/metadata.json`;
          if (await exists(metaPath)) {
            try {
              const metadata = JSON.parse(await readTextFile(metaPath));
              const deletedNumber = chapterNumber.toString();
              const remainingEntries = await readDir(series.path).catch(
                () => [],
              );
              const remainingNames = remainingEntries
                .map((entry: any) => entry.name)
                .filter((name): name is string => typeof name === "string");

              metadata.chapters = (metadata.chapters || [])
                .filter((ch: any) => ch?.number?.toString() !== deletedNumber)
                .sort(
                  (a: any, b: any) =>
                    parseFloat(a.number || "0") - parseFloat(b.number || "0"),
                );

              let startIndex = 0;
              for (const ch of metadata.chapters) {
                const prefix = `ch${parseFloat(ch.number || "0")
                  .toString()
                  .split(".")[0]
                  .padStart(3, "0")}_`;
                const files = remainingNames
                  .filter((name) => name.startsWith(prefix))
                  .sort();
                ch.startIndex = startIndex;
                ch.endIndex = startIndex + files.length - 1;
                if (!ch.coverFile || !remainingNames.includes(ch.coverFile)) {
                  ch.coverFile = files[0] || ch.coverFile;
                }
                startIndex += files.length;
              }
              metadata.totalPages = startIndex;

              await writeTextFile(metaPath, JSON.stringify(metadata, null, 2));
            } catch (error) {
              console.warn("[LibraryStore] Failed to update chapter metadata:", error);
            }
          }
        }
      }

      toast.success("Chapter deleted");
      await get().loadFromDb();
    } catch (err) {
      console.error("[LibraryStore] Failed to delete chapter:", err);
      toast.error("Failed to delete chapter");
      throw err;
    }
  },

  setSeriesCover: async (seriesId, sourcePath) => {
    const { invoke } = await import("@tauri-apps/api/core");
    const db = getDb();
    const series = get().series.find((s) => s.id === seriesId);
    if (!series) return;

    try {
      const newCoverPath = await invoke<string>("set_manga_cover", {
        seriesPath: series.path,
        sourcePath,
      });

      // Update DB
      await db.execute("UPDATE Series SET coverPath = ? WHERE id = ?", [
        newCoverPath,
        seriesId,
      ]);

      // Update Local State with a cache-buster logic if needed, but for now just path
      // If the path is the same (cover.jpg), we might need to force re-render in component
      // For now, we update the store.
      set((state) => ({
        series: state.series.map((s) =>
          s.id === seriesId ? { ...s, cover: newCoverPath } : s,
        ),
      }));

      await get().loadFromDb(); // Ensure consistency
    } catch (e) {
      console.error("Failed to set cover", e);
      throw e;
    }
  },

  removeSeriesCover: async (seriesId) => {
    const { invoke } = await import("@tauri-apps/api/core");
    const db = getDb();
    const series = get().series.find((s) => s.id === seriesId);
    if (!series) return;

    try {
      await invoke("remove_manga_cover", { seriesPath: series.path });

      await db.execute("UPDATE Series SET coverPath = NULL WHERE id = ?", [
        seriesId,
      ]);

      set((state) => ({
        series: state.series.map((s) =>
          s.id === seriesId ? { ...s, cover: null } : s,
        ),
      }));

      await get().loadFromDb();
    } catch (e) {
      console.error("Failed to remove cover", e);
      throw e;
    }
  },

  registerDownloadedSeries: async (metadata: any, chapters: any[]) => {
    const db = getDb();
    try {
      // 1. Insert/Update Series (Avoid REPLACE to prevent cascade delete of chapters)
      await db.execute(
        "INSERT OR IGNORE INTO Series (id, title, path, type, source) VALUES (?, ?, ?, ?, ?)",
        [
          metadata.mangaId,
          metadata.title,
          metadata.rootPath,
          "manga",
          metadata.source || "mangadex",
        ],
      );

      await db.execute(
        "UPDATE Series SET title = ?, path = ?, author = ?, coverPath = ?, source = ?, tags = ?, description = ?, seriesUrl = ?, mangaId = ? WHERE id = ?",
        [
          metadata.title,
          metadata.rootPath,
          metadata.author || "",
          metadata.coverPath,
          metadata.source || "mangadex",
          (metadata.tags || []).join(","),
          metadata.description || "",
          metadata.sourceUrl || metadata.seriesUrl || "",
          metadata.mangaId,
          metadata.mangaId,
        ],
      );

      // 2. Insert Chapters
      for (const c of chapters) {
        await db.execute(
          "INSERT OR REPLACE INTO Chapters (id, seriesId, title, chapterNumber, filePath, coverPath, sourceId, totalPages) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            c.id,
            metadata.mangaId,
            c.title,
            c.chapterNumber,
            c.filePath,
            c.coverPath || null,
            c.sourceId || null,
            c.totalPages || 0,
          ],
        );
      }

      // 3. Refresh UI
      await get().loadFromDb();
    } catch (err) {
      console.error(
        "[LibraryStore] Failed to register downloaded series:",
        err,
      );
    }
  },

  scanLibrary: async (path?: string) => {
    if (path) {
      await get().addMangaFolder(path);
    } else {
      const { useSettingsStore } = await import("./useSettingsStore");
      const { libraryPath } = useSettingsStore.getState();
      if (libraryPath) {
        await get().addMangaFolder(libraryPath);
      }
    }
  },

  rebuildCollectionIndex: async () => {
    set({ isLoading: true });
    try {
      // 1. Scan default Library Path
      await get().scanLibrary();

      // 2. Scan Gallery Download Path (Collections)
      const { useGalleryStore } = await import("./useGalleryStore");
      let downloadPath = useGalleryStore.getState().downloadPath;
      
      if (!downloadPath) {
        const { documentDir, join } = await import("@tauri-apps/api/path");
        const docDir = await documentDir();
        downloadPath = await join(docDir, "FlowManga Collection");
      }
      
      if (downloadPath) {
        const { exists } = await import("@tauri-apps/plugin-fs");
        if (await exists(downloadPath)) {
            await get().addMangaFolder(downloadPath);
        }
      }

      // 3. Clean up invalid/missing files
      const count = await get().verifyLibraryIntegrity();
      console.log(`[LibraryStore] Collection rebuild complete. Removed ${count} invalid entries.`);
      const { toast } = await import("../components/Toast");
      toast.success("Collection Index Rebuilt");
    } catch (err) {
      console.error("[LibraryStore] Failed to rebuild collection index:", err);
      const { toast } = await import("../components/Toast");
      toast.error("Failed to rebuild collection index");
    } finally {
      set({ isLoading: false });
    }
  },

  verifyLibraryIntegrity: async (seriesId?: string) => {
    const { exists } = await import("@tauri-apps/plugin-fs");
    const db = getDb();
    const seriesList = seriesId
      ? get().series.filter((s) => s.id === seriesId)
      : get().series;
    set({ isLoading: true });

    let removedCount = 0;
    for (const s of seriesList) {
      if (s.path) {
        const folderExists = await exists(s.path);
        if (!folderExists) {
          console.warn(
            `[LibraryStore] Folder missing: ${s.path}. Removing from DB.`,
          );
          await get().deleteSeries(s.id, s.path, false);
          removedCount++;
        } else {
          // Folder exists, verify chapters
          for (const book of s.books) {
            const fileExists = await exists(book.path);
            if (!fileExists) {
              console.warn(
                `[LibraryStore] Chapter missing: ${book.path}. Removing from DB.`,
              );
              await db.execute("DELETE FROM Chapters WHERE id = ?", [book.id]);
              await db.execute(
                "DELETE FROM ReadingProgress WHERE chapterId = ?",
                [book.id],
              );
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
    const series = get().series.find((s) => s.id === seriesId);
    if (!series) return;

    let targetMangaId = series.mangaId;
    let targetUrl = series.seriesUrl;

    // If local, try to find a source URL in metadata.json
    if (!targetMangaId || targetMangaId === "local" || !targetUrl) {
      try {
        const { readTextFile, exists } = await import("@tauri-apps/plugin-fs");
        const metaPath = `${series.path}/metadata.json`;
        if (await exists(metaPath)) {
          const content = await readTextFile(metaPath);
          const meta = JSON.parse(content);
          targetMangaId = meta.mangaId || targetMangaId;
          targetUrl = meta.sourceUrl || meta.seriesUrl || targetUrl;
        }
      } catch (e) {}
    }

    if ((!targetMangaId || targetMangaId === "local") && !targetUrl) {
      console.log(
        "[LibraryStore] Skipping refresh for strictly local series:",
        series.title,
      );
      return;
    }

    try {
      const { ScraperService } = await import("../services/ScraperService");
      const db = getDb();
      let details: any = null;
      let sourceName = "mangadex";

      if (targetMangaId && targetMangaId.length === 36) {
        // MangaDex
        details = await ScraperService.getMangaDetails(targetMangaId);
        sourceName = "mangadex";
      } else if (
        targetUrl ||
        (targetMangaId && targetMangaId.startsWith("http"))
      ) {
        // URL-based (LuaComic, Headless, etc.)
        const result = await ScraperService.scrapeChapter(
          targetUrl || targetMangaId!,
        );
        if (result.series) {
          details = {
            title: result.series.title,
            description: result.series.description,
            author: "", // We don't usually scrape author from generic series yet
            tags: result.series.tags || [],
            coverUrl: result.series.coverUrl,
          };
          sourceName = result.series.source || "scraped";
        } else if (result.metadata) {
          details = {
            title: result.metadata.title || series.title,
            description: result.metadata.description || "",
            author: result.metadata.author || "",
            tags: result.metadata.tags || [],
            coverUrl: result.metadata.coverUrl,
          };
        }
      }

      if (details) {
        // Normalize tags
        const tags = Array.from(
          new Set([...(series.tags || []), ...(details.tags || [])]),
        )
          .filter((t) => t)
          .join(",");

        // Normalize coverUrl to prevent relative paths issues
        let coverUrl = details.coverUrl;
        if (coverUrl && coverUrl.startsWith("/")) {
          try {
            const origin = new URL(targetUrl || series.seriesUrl!).origin;
            coverUrl = origin + coverUrl;
          } catch (e) {}
        }

        // Dynamically download cover.jpg to disk if not exists or if cover URL is fetched
        let localCoverPath = series.cover;
        if (coverUrl && coverUrl.startsWith("http")) {
          try {
            const { join } = await import("@tauri-apps/api/path");
            const coverPath = await join(series.path, "cover.jpg");
            const referer = targetUrl || series.seriesUrl || null;
            await invoke("download_image", {
              url: coverUrl,
              filePath: coverPath,
              headers: sourceName !== "mangadex" && referer ? { Referer: referer } : null,
            });
            localCoverPath = coverPath;
          } catch (e) {
            console.warn("[LibraryStore] Failed to download refreshed cover:", e);
          }
        }

        await db.execute(
          "UPDATE Series SET title = ?, description = ?, author = ?, tags = ?, coverPath = ?, mangaId = ?, seriesUrl = ? WHERE id = ?",
          [
            details.title,
            details.description,
            details.author || series.author || "",
            tags,
            localCoverPath,
            targetMangaId,
            targetUrl,
            seriesId,
          ],
        );

        // Also update local metadata.json if it exists
        const { writeTextFile, exists } = await import("@tauri-apps/plugin-fs");
        const metaPath = `${series.path}/metadata.json`;
        if (await exists(metaPath)) {
          const newMeta = {
            title: details.title,
            description: details.description,
            author: details.author || series.author || "",
            tags: tags.split(","),
            mangaId: targetMangaId,
            sourceUrl: targetUrl,
            source: sourceName,
            coverFile: "cover.jpg",
            version: 3.0,
          };
          await writeTextFile(metaPath, JSON.stringify(newMeta, null, 2));
        }

        // Also try to generate thumbnails if missing
        await get().refreshChapterThumbnails(seriesId);
        await get().loadFromDb();
      }
    } catch (err) {
      console.error("[LibraryStore] Failed to refresh metadata:", err);
    }
  },

  refreshChapterThumbnails: async (seriesId) => {
    const { invoke } = await import("@tauri-apps/api/core");
    const series = get().series.find((s) => s.id === seriesId);
    if (!series) return;

    const db = getDb();
    for (const book of series.books) {
      // If cover is just the series cover, it's effectively "missing" a per-chapter one
      if (!book.cover || book.cover === series.cover) {
        try {
          // Reuse the same logic as DownloadService but via Rust backend directly for efficiency
          const newThumb: string = await invoke("generate_chapter_thumbnail", {
            chapterPath: book.path,
            seriesPath: series.path,
          });

          if (newThumb) {
            await db.execute("UPDATE Chapters SET coverPath = ? WHERE id = ?", [
              newThumb,
              book.id,
            ]);
          }
        } catch (e) {
          console.warn(
            `[LibraryStore] Failed to generate thumbnail for ${book.title}`,
            e,
          );
        }
      }
    }
  },

  bulkRefreshMetadata: async () => {
    set({ isLoading: true });
    const allSeries = get().series;
    for (const s of allSeries) {
      if (
        s.mangaId &&
        (s.mangaId.length === 36 || s.mangaId.startsWith("http"))
      ) {
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
      const db = getDb();
      const { remove } = await import("@tauri-apps/plugin-fs");

      for (const id of idsArray) {
        const s = series.find((x) => x.id === id);
        if (!s) continue;

        // Manual deletion logic (optimized for batch)
        await db.execute("DELETE FROM ReadingProgress WHERE seriesId = ?", [
          s.id,
        ]);
        await db.execute("DELETE FROM Chapters WHERE seriesId = ?", [s.id]);
        await db.execute("DELETE FROM CollectionItems WHERE seriesId = ?", [
          s.id,
        ]);
        await db.execute("DELETE FROM Series WHERE id = ?", [s.id]);

        if (deleteFiles && s.path) {
          try {
            const parts = s.path.split(/[\\/]/).filter(Boolean);
            if (parts.length >= 3 && s.path.length >= 5) {
              await remove(s.path, { recursive: true });
            }
          } catch (e) {
            console.warn(
              `[LibraryStore] Bulk FS delete failed for ${s.path}:`,
              e,
            );
          }
        }
      }

      set({ selectedIds: new Set(), selectionMode: false });
      await get().loadFromDb();
      toast.success(`Successfully deleted ${idsArray.length} items`);
    } catch (e) {
      console.error("[LibraryStore] Bulk delete failed:", e);
      toast.error("Bulk deletion encountered errors");
    } finally {
      set({ isLoading: false });
    }
  },

  toggleFavorite: async (seriesId) => {
    const db = getDb();
    const series = get().series.find((s) => s.id === seriesId);
    if (!series) return;

    const isFavorite = series.tags.includes("favorite");
    let newTags = [];
    if (isFavorite) {
      newTags = series.tags.filter((t) => t !== "favorite");
    } else {
      newTags = [...series.tags, "favorite"];
    }

    const tagsStr = newTags.join(",");
    await db.execute("UPDATE Series SET tags = ? WHERE id = ?", [
      tagsStr,
      seriesId,
    ]);

    // Update local state
    set((state) => ({
      series: state.series.map((s) =>
        s.id === seriesId ? { ...s, tags: newTags } : s,
      ),
    }));
  },

  createCollection: async (name, description) => {
    const db = getDb();
    const cid = crypto.randomUUID();
    await db.execute(
      "INSERT INTO Collections (id, name, description) VALUES (?, ?, ?)",
      [cid, name, description || ""],
    );
    await get().loadCollections();
  },

  addSeriesToCollection: async (collectionId, seriesId) => {
    const db = getDb();
    await db.execute(
      "INSERT OR IGNORE INTO CollectionItems (collectionId, seriesId) VALUES (?, ?)",
      [collectionId, seriesId],
    );
    await get().loadCollections();
  },

  removeSeriesFromCollection: async (collectionId, seriesId) => {
    const db = getDb();
    await db.execute(
      "DELETE FROM CollectionItems WHERE collectionId = ? AND seriesId = ?",
      [collectionId, seriesId],
    );
    await get().loadCollections();
  },

  deleteCollection: async (collectionId) => {
    const db = getDb();
    await db.execute("DELETE FROM Collections WHERE id = ?", [collectionId]);
    // CASCADE will handle CollectionItems
    await get().loadCollections();
  },

  // Manga Recommendation Methods (separate from Collection ecosystem)
  fetchMangaRecommendations: async (tags?: string[], limit: number = 48) => {
    try {
      const { ScraperService } = await import("../services/ScraperService");
      const { useSettingsStore } = await import("./useSettingsStore");
      const { coloredOnly } = useSettingsStore.getState();

      let results;
      if (tags && tags.length > 0) {
        results = await ScraperService.getRecommendationsByTags(
          tags,
          limit,
          coloredOnly,
          "manga",
        );
      } else {
        results = await ScraperService.getPersonalizedRecommendations(
          limit,
          coloredOnly,
          "manga",
        );
      }

      // Filter out existing series to avoid duplicates
      const existingIds = new Set(get().series.map((s) => s.mangaId || s.id));
      return results.filter((item: any) => !existingIds.has(item.id));
    } catch (err) {
      console.error(
        "[LibraryStore] Failed to fetch manga recommendations:",
        err,
      );
      return [];
    }
  },

  fetchTrendingManga: async (limit: number = 48) => {
    try {
      const { ScraperService } = await import("../services/ScraperService");
      const { useSettingsStore } = await import("./useSettingsStore");
      const { coloredOnly } = useSettingsStore.getState();

      const results = await ScraperService.getTrending(limit, coloredOnly);

      // Filter out existing series to avoid duplicates
      const existingIds = new Set(get().series.map((s) => s.mangaId || s.id));
      return results.filter((item: any) => !existingIds.has(item.id));
    } catch (err) {
      console.error("[LibraryStore] Failed to fetch trending manga:", err);
      return [];
    }
  },

  fetchRecentlyUpdatedManga: async (limit: number = 48) => {
    try {
      const { ScraperService } = await import("../services/ScraperService");
      const { useSettingsStore } = await import("./useSettingsStore");
      const { coloredOnly } = useSettingsStore.getState();

      const results = await ScraperService.getRecentlyUpdated(
        limit,
        coloredOnly,
      );

      // Filter out existing series to avoid duplicates
      const existingIds = new Set(get().series.map((s) => s.mangaId || s.id));
      return results.filter((item: any) => !existingIds.has(item.id));
    } catch (err) {
      console.error(
        "[LibraryStore] Failed to fetch recently updated manga:",
        err,
      );
      return [];
    }
  },
}));
