import { create } from 'zustand';

interface ChapterRange {
    number: string;
    startIndex: number;
    endIndex: number;
}

interface ReadingState {
  // Core State
  currentChapterIndex: number;
  currentPageIndex: number;
  chapters: { id: string, path: string, title: string, sequence?: ChapterRange }[];
  currentChapterPages: string[];
  
  // Flat Mode Metadata
  isFlatMode: boolean;
  metadata: any | null;
  
  images: string[]; 
  isLoading: boolean;
  seriesId: string | null;
  currentFolderPath: string | null;

  // Actions
  openFolder: (path: string, seriesId?: string, chapterId?: string, sequence?: { id: string, path: string, title: string }[], startPageIndex?: number) => Promise<void>;
  
  loadChapter: (index: number, startPageIndex?: number) => Promise<void>;
  goToNextChapter: () => Promise<void>;
  goToPrevChapter: () => Promise<void>;
  
  setPageIndex: (index: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  
  reset: () => void;
}

export const useReadingStore = create<ReadingState>((set, get) => ({
  currentChapterIndex: 0,
  currentPageIndex: 0,
  chapters: [],
  currentChapterPages: [],
  images: [], 
  isLoading: false,
  seriesId: null,
  currentFolderPath: null,
  isFlatMode: false,
  metadata: null,

  openFolder: async (path, seriesId, chapterId, sequence, startPageIndex) => {
    const { useLibraryStore } = await import('./useLibraryStore');
    
    // Auto-resolve sequence if missing but seriesId exists
    let finalSequence = sequence || [];
    if (finalSequence.length === 0 && seriesId) {
        const series = useLibraryStore.getState().series.find(s => s.id === seriesId);
        if (series) {
            finalSequence = series.books.map(b => ({
                id: b.id,
                path: b.path,
                title: b.title
            }));
        }
    }

    set({ 
      isLoading: true, 
      seriesId: seriesId || null,
      chapters: finalSequence,
      currentChapterPages: [], 
      images: [],
      currentPageIndex: startPageIndex || 0,
      currentFolderPath: path,
      isFlatMode: false,
      metadata: null
    });

    const { invoke } = await import('@tauri-apps/api/core');

    let isFlat = false;
    let metadataV3: any = null;

    // 1. Detect Flat Standard V3
    try {
        const metaContent = await invoke<string>('read_file_string', { path: `${path}/metadata.json` });
        const meta = JSON.parse(metaContent);
        if (meta.version >= 3.0 && meta.chapters) {
            isFlat = true;
            metadataV3 = meta;
        }
    } catch (e) {
        // Not V3 or metadata missing
    }

    set({ isFlatMode: isFlat, metadata: metadataV3 });

    if (isFlat) {
        // Flat Mode: Load ALL pages once
        const allPages: string[] = await invoke('read_folder', { path });
        set({ 
            images: allPages,
            currentChapterPages: allPages, // In flat mode, images == currentChapterPages
            isLoading: false
        });

        // Determine Start Index (prefer startPageIndex if provided, else chapter start)
        let finalStartPage = startPageIndex ?? 0;
        
        if (startPageIndex === undefined && chapterId && metadataV3.chapters) {
            const ch = metadataV3.chapters.find((c: any) => c.number === chapterId || `${seriesId}-${c.number}` === chapterId);
            if (ch) finalStartPage = ch.startIndex;
        }
        
        get().setPageIndex(finalStartPage);

    } else {
        // Legacy Nested Mode
        let startIndex = 0;
        if (sequence && chapterId) {
            startIndex = sequence.findIndex(c => c.id === chapterId);
            if (startIndex === -1) startIndex = 0;
        }
        set({ currentChapterIndex: startIndex });
        await get().loadChapter(startIndex, startPageIndex);
    }
  },

  loadChapter: async (index: number, startPageIndex?: number) => {
      const state = get();
      if (state.isFlatMode) return; // No-op in flat mode

      const chapter = state.chapters[index];
      if (!chapter) {
          set({ isLoading: false });
          return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      try {
          set({ isLoading: true, currentChapterIndex: index }); 
          const pages: string[] = await invoke('read_folder', { path: chapter.path });
          
          set({ 
              currentChapterPages: pages,
              images: pages,
              currentPageIndex: startPageIndex || 0,
              isLoading: false 
          });
      } catch (err) {
          console.error('[ReadingStore] Failed to load chapter', err);
          set({ isLoading: false });
      }
  },

  setPageIndex: (index) => {
      const state = get();
      const safeIndex = Math.max(0, Math.min(index, state.images.length - 1));
      set({ currentPageIndex: safeIndex });
      
      // Auto-detect chapter in flat mode
      if (state.isFlatMode && state.metadata?.chapters) {
          const chIndex = state.metadata.chapters.findIndex((c: any) => 
            safeIndex >= c.startIndex && safeIndex <= c.endIndex
          );
          if (chIndex !== -1 && chIndex !== state.currentChapterIndex) {
              set({ currentChapterIndex: chIndex });
          }
      }

      // Save Progress
      if (state.seriesId) {
          const chNumber = state.isFlatMode 
            ? state.metadata.chapters[get().currentChapterIndex]?.number
            : state.chapters[state.currentChapterIndex]?.id;
            
          if (chNumber) {
            import('./useLibraryStore').then(m => {
                m.useLibraryStore.getState().updateReadingProgress(state.seriesId!, chNumber, safeIndex);
            });
          }
      }
  },

  goToNextChapter: async () => {
      const { currentChapterIndex, chapters, isFlatMode, metadata, setPageIndex } = get();
      if (isFlatMode && metadata?.chapters) {
          const nextCh = metadata.chapters[currentChapterIndex + 1];
          if (nextCh) setPageIndex(nextCh.startIndex);
      } else if (currentChapterIndex + 1 < chapters.length) {
          await get().loadChapter(currentChapterIndex + 1);
      }
  },

  goToPrevChapter: async () => {
      const { currentChapterIndex, isFlatMode, metadata, setPageIndex } = get();
      if (isFlatMode && metadata?.chapters) {
          const prevCh = metadata.chapters[currentChapterIndex - 1];
          if (prevCh) setPageIndex(prevCh.startIndex);
      } else if (currentChapterIndex > 0) {
          await get().loadChapter(currentChapterIndex - 1);
      }
  },

  nextPage: () => {
      const state = get();
      if (state.currentPageIndex < state.images.length - 1) {
          state.setPageIndex(state.currentPageIndex + 1);
      } else if (!state.isFlatMode) {
          state.goToNextChapter();
      }
  },

  prevPage: () => {
      const state = get();
      if (state.currentPageIndex > 0) {
          state.setPageIndex(state.currentPageIndex - 1);
      } else if (!state.isFlatMode) {
          state.goToPrevChapter();
      }
  },

  reset: () => set({ 
      chapters: [], 
      currentChapterPages: [], 
      images: [],
      isLoading: false,
      seriesId: null,
      currentChapterIndex: 0,
      currentPageIndex: 0,
      currentFolderPath: null,
      isFlatMode: false,
      metadata: null
  }),
}));
