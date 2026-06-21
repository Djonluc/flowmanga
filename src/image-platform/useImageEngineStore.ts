import { create } from "zustand";
import type { PlatformImage } from "./types";
import { federator } from "./SearchFederator";
import { QueryParser } from "./QueryParser";

interface FeedState {
  images: PlatformImage[];
  currentPage: number;
  hasMore: boolean;
}

const initialFeedState: FeedState = {
  images: [],
  currentPage: 1,
  hasMore: true,
};

interface ImageEngineState {
  feeds: {
    latest: FeedState;
    curated: FeedState;
    discover: FeedState;
    search: FeedState & { query: string };
  };
  
  fetchMode: 'search' | 'latest' | 'curated' | 'discover';
  isLoading: boolean;
  isFetchingNextPage: boolean;
  error: string | null;

  // Actions
  search: (rawQuery: string) => Promise<void>;
  fetchLatest: (forceRefresh?: boolean) => Promise<void>;
  fetchCurated: (forceRefresh?: boolean) => Promise<void>;
  fetchDiscover: (forceRefresh?: boolean) => Promise<void>;
  loadNextPage: () => Promise<void>;
  reset: () => void;
  markAsSeen: (images: PlatformImage[]) => Promise<void>;
}

export const useImageEngineStore = create<ImageEngineState>((set, get) => ({
  feeds: {
    latest: { ...initialFeedState },
    curated: { ...initialFeedState },
    discover: { ...initialFeedState },
    search: { ...initialFeedState, query: "" },
  },
  fetchMode: 'latest',
  isLoading: false,
  isFetchingNextPage: false,
  error: null,

  search: async (rawQuery: string) => {
    set({ isLoading: true, fetchMode: 'search', error: null });
    
    // Wipe search state and start over
    set(state => ({
      feeds: {
        ...state.feeds,
        search: { images: [], currentPage: 1, hasMore: true, query: rawQuery }
      }
    }));

    try {
      const mode = 'search';
      const results = await federator.search(QueryParser.parse(rawQuery), 1, (chunk) => {
        set(s => {
          const existingIds = new Set(s.feeds[mode].images.map(img => img.id));
          const newUnique = chunk.filter(img => !existingIds.has(img.id));
          return {
            feeds: {
              ...s.feeds,
              [mode]: {
                ...s.feeds[mode],
                images: [...s.feeds[mode].images, ...newUnique]
              }
            }
          };
        });
      });
      set(state => ({ 
        isLoading: false,
        feeds: {
          ...state.feeds,
          search: { ...state.feeds.search, hasMore: results.length > 0 }
        }
      }));
    } catch (e: any) {
      console.error("[ImageEngineStore] Search failed:", e);
      set({ error: e.message || "Failed to search", isLoading: false });
    }
  },

  fetchLatest: async (forceRefresh = false) => {
    set({ fetchMode: 'latest' });
    const { feeds } = get();
    if (!forceRefresh && feeds.latest.images.length > 0) return; // Cache hit

    if (forceRefresh) {
      set(state => ({ feeds: { ...state.feeds, latest: { ...state.feeds.latest, images: [], currentPage: 1, hasMore: true } } }));
    }

    set({ isLoading: true, error: null });
    try {
      const mode = 'latest';
      const results = await federator.getLatest(1, (chunk) => {
        set(s => {
          const existingIds = new Set(s.feeds[mode].images.map(img => img.id));
          const newUnique = chunk.filter(img => !existingIds.has(img.id));
          get().markAsSeen(newUnique);
          return {
            feeds: {
              ...s.feeds,
              [mode]: { ...s.feeds[mode], images: [...s.feeds[mode].images, ...newUnique] }
            }
          };
        });
      });
      set(state => ({ 
        isLoading: false,
        feeds: {
          ...state.feeds,
          latest: { ...state.feeds.latest, currentPage: 1, hasMore: results.length > 0 }
        }
      }));
    } catch (e: any) {
      set({ error: e.message || "Failed to fetch latest", isLoading: false });
    }
  },

  fetchCurated: async (forceRefresh = false) => {
    set({ fetchMode: 'curated' });
    const { feeds } = get();
    if (!forceRefresh && feeds.curated.images.length > 0) return; // Cache hit

    if (forceRefresh) {
      set(state => ({ feeds: { ...state.feeds, curated: { ...state.feeds.curated, images: [], currentPage: 1, hasMore: true } } }));
    }

    set({ isLoading: true, error: null });
    try {
      const mode = 'curated';
      const results = await federator.getCurated(1, (chunk) => {
        set(s => {
          const existingIds = new Set(s.feeds[mode].images.map(img => img.id));
          const newUnique = chunk.filter(img => !existingIds.has(img.id));
          get().markAsSeen(newUnique);
          return {
            feeds: {
              ...s.feeds,
              [mode]: { ...s.feeds[mode], images: [...s.feeds[mode].images, ...newUnique] }
            }
          };
        });
      });
      set(state => ({ 
        isLoading: false,
        feeds: {
          ...state.feeds,
          curated: { ...state.feeds.curated, currentPage: 1, hasMore: results.length > 0 }
        }
      }));
    } catch (e: any) {
      set({ error: e.message || "Failed to fetch curated", isLoading: false });
    }
  },

  fetchDiscover: async (forceRefresh = false) => {
    set({ fetchMode: 'discover' });
    const { feeds } = get();
    if (!forceRefresh && feeds.discover.images.length > 0) return; // Cache hit

    if (forceRefresh) {
      set(state => ({ feeds: { ...state.feeds, discover: { ...state.feeds.discover, images: [], currentPage: 1, hasMore: true } } }));
    }

    set({ isLoading: true, error: null });
    try {
      const mode = 'discover';
      const results = await federator.getDiscovery(1, (chunk) => {
        set(s => {
          const existingIds = new Set(s.feeds[mode].images.map(img => img.id));
          const newUnique = chunk.filter(img => !existingIds.has(img.id));
          get().markAsSeen(newUnique);
          return {
            feeds: {
              ...s.feeds,
              [mode]: { ...s.feeds[mode], images: [...s.feeds[mode].images, ...newUnique] }
            }
          };
        });
      });
      set(state => ({ 
        isLoading: false,
        feeds: {
          ...state.feeds,
          discover: { ...state.feeds.discover, currentPage: 1, hasMore: results.length > 0 }
        }
      }));
    } catch (e: any) {
      set({ error: e.message || "Failed to fetch discovery", isLoading: false });
    }
  },

  loadNextPage: async () => {
    const state = get();
    const mode = state.fetchMode;
    const activeFeed = state.feeds[mode];
    
    if (state.isFetchingNextPage || !activeFeed.hasMore) return;

    set({ isFetchingNextPage: true });

    try {
      const nextPage = activeFeed.currentPage + 1;
      let newResults: PlatformImage[] = [];

      const handleChunk = (chunk: PlatformImage[]) => {
        set(s => {
          const existingIds = new Set(s.feeds[mode].images.map(img => img.id));
          const newUnique = chunk.filter(img => !existingIds.has(img.id));
          get().markAsSeen(newUnique);
          return {
            feeds: {
              ...s.feeds,
              [mode]: {
                ...s.feeds[mode],
                images: [...s.feeds[mode].images, ...newUnique]
              }
            }
          };
        });
      };

      if (mode === 'search') newResults = await federator.search(QueryParser.parse(state.feeds.search.query), nextPage, handleChunk);
      else if (mode === 'latest') newResults = await federator.getLatest(nextPage, handleChunk);
      else if (mode === 'curated') newResults = await federator.getCurated(nextPage, handleChunk);
      else if (mode === 'discover') newResults = await federator.getDiscovery(nextPage, handleChunk);

      const shouldKillFeed = (mode === 'search' || mode === 'latest') ? newResults.length === 0 : false;

      set(s => ({
        isFetchingNextPage: false,
        feeds: {
          ...s.feeds,
          [mode]: {
            ...s.feeds[mode],
            currentPage: nextPage,
            hasMore: !shouldKillFeed
          }
        }
      }));
    } catch (e: any) {
      console.error("[ImageEngineStore] Fetch next page failed:", e);
      set({ isFetchingNextPage: false });
    }
  },

  reset: () => {
    set({
      feeds: {
        latest: { ...initialFeedState },
        curated: { ...initialFeedState },
        discover: { ...initialFeedState },
        search: { ...initialFeedState, query: "" },
      },
      fetchMode: 'latest',
      isLoading: false,
      isFetchingNextPage: false,
      error: null
    });
  },

  markAsSeen: async (images: PlatformImage[]) => {
    if (images.length === 0) return;
    try {
      const { getDb } = await import('../services/db');
      const db = getDb();
      
      // Keep transaction small
      const values = images.map(img => `('${img.id}', '${img.sourceId}', '${img.providerId}')`).join(',');
      await db.execute(`
        INSERT OR IGNORE INTO FlowSeenImages (id, sourceId, providerId)
        VALUES ${values}
      `);
    } catch (e) {
      console.error("[ImageEngineStore] Failed to mark as seen", e);
    }
  }
}));
