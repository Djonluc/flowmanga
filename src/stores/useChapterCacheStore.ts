import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SourceChapter } from '../services/sources/types';

interface ChapterCacheEntry {
  chapters: SourceChapter[];
  updatedAt: number;
}

interface ChapterCacheState {
  cache: Record<string, ChapterCacheEntry>;
  setCache: (seriesId: string, chapters: SourceChapter[]) => void;
  getCache: (seriesId: string) => SourceChapter[] | null;
  clearCache: (seriesId: string) => void;
}

export const useChapterCacheStore = create<ChapterCacheState>()(
  persist(
    (set, get) => ({
      cache: {},
      setCache: (seriesId, chapters) => {
        set((state) => ({
          cache: {
            ...state.cache,
            [seriesId]: { chapters, updatedAt: Date.now() },
          },
        }));
      },
      getCache: (seriesId) => {
        const entry = get().cache[seriesId];
        if (!entry) return null;
        // Expire after 12 hours (12 * 60 * 60 * 1000)
        if (Date.now() - entry.updatedAt > 12 * 60 * 60 * 1000) return null;
        return entry.chapters;
      },
      clearCache: (seriesId) => {
        set((state) => {
          const newCache = { ...state.cache };
          delete newCache[seriesId];
          return { cache: newCache };
        });
      },
    }),
    {
      name: 'chapter-cache-storage',
    }
  )
);
