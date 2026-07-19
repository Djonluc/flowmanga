import { create } from "zustand";
import type { PlatformImage } from "./types";
import { federator } from "./SearchFederator";
import { QueryParser } from "./QueryParser";
import { getSankakuCooldownUntil } from "../services/Sankaku";

let deferredPageRetryTimer: ReturnType<typeof setTimeout> | undefined;
const emptyPageSkips: Record<'search' | 'latest' | 'curated' | 'discover', number> = {
  search: 0,
  latest: 0,
  curated: 0,
  discover: 0,
};

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

  activeTab: "new" | "foryou" | "collection" | "playlists" | "discover" | "search";
  setActiveTab: (tab: "new" | "foryou" | "collection" | "playlists" | "discover" | "search") => void;

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
  activeTab: 'discover',
  setActiveTab: (tab) => set({ activeTab: tab }),
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
          void get().markAsSeen(newUnique);
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
      console.info(`[ImageEngineStore] search page=1 query=${rawQuery || '(empty)'} returned=${results.length} visible=${get().feeds.search.images.length}`);
      set(state => ({ 
        isLoading: false,
        feeds: {
          ...state.feeds,
          search: { ...state.feeds.search, hasMore: true }
        }
      }));
      if (get().feeds.search.images.length === 0 && results.length === 0) {
        setTimeout(() => void get().loadNextPage(), 0);
      }
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
          const newImages = [...s.feeds[mode].images, ...newUnique];
          newImages.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          return {
            feeds: {
              ...s.feeds,
              [mode]: { ...s.feeds[mode], images: newImages }
            }
          };
        });
      });
      console.info(`[ImageEngineStore] latest page=1 returned=${results.length} visible=${get().feeds.latest.images.length} forceRefresh=${forceRefresh}`);
      set(state => ({ 
        isLoading: false,
        feeds: {
          ...state.feeds,
          latest: { ...state.feeds.latest, currentPage: 1, hasMore: true }
        }
      }));
      if (get().feeds.latest.images.length === 0 && results.length === 0) {
        setTimeout(() => void get().loadNextPage(), 0);
      }
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
      console.info(`[ImageEngineStore] curated page=1 returned=${results.length} visible=${get().feeds.curated.images.length} forceRefresh=${forceRefresh}`);
      set(state => ({ 
        isLoading: false,
        feeds: {
          ...state.feeds,
          curated: { ...state.feeds.curated, currentPage: 1, hasMore: true }
        }
      }));
      if (get().feeds.curated.images.length === 0 && results.length === 0) {
        setTimeout(() => void get().loadNextPage(), 0);
      }
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
      console.info(`[ImageEngineStore] discover page=1 returned=${results.length} visible=${get().feeds.discover.images.length} forceRefresh=${forceRefresh}`);
      set(state => ({ 
        isLoading: false,
        feeds: {
          ...state.feeds,
          discover: { ...state.feeds.discover, currentPage: 1, hasMore: true }
        }
      }));
      if (get().feeds.discover.images.length === 0 && results.length === 0) {
        setTimeout(() => void get().loadNextPage(), 0);
      }
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
      let appendedCount = 0;
      const handleChunk = (chunk: PlatformImage[]) => {
        set(s => {
          const existingIds = new Set(s.feeds[mode].images.map(img => img.id));
          const newUnique = chunk.filter(img => !existingIds.has(img.id));
          appendedCount += newUnique.length;
          get().markAsSeen(newUnique);
          const newImages = [...s.feeds[mode].images, ...newUnique];
          if (mode === 'latest') {
            newImages.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          }
          return {
            feeds: {
              ...s.feeds,
              [mode]: {
                ...s.feeds[mode],
                images: newImages
              }
            }
          };
        });
      };

      let pageResults: PlatformImage[] = [];
      if (mode === 'search') pageResults = await federator.search(QueryParser.parse(state.feeds.search.query), nextPage, handleChunk);
      else if (mode === 'latest') pageResults = await federator.getLatest(nextPage, handleChunk);
      else if (mode === 'curated') pageResults = await federator.getCurated(nextPage, handleChunk);
      else if (mode === 'discover') pageResults = await federator.getDiscovery(nextPage, handleChunk);

      // Do not skip a cursor page when every provider deferred or failed. In
      // particular, Sankaku must retry this page after its cooldown rather
      // than moving to a cursor that was never fetched.
      if (pageResults.length === 0 && appendedCount === 0) {
        const cooldownUntil = getSankakuCooldownUntil();
        if (mode === 'latest' && !cooldownUntil) {
          // Never skip a chronological cursor or declare Latest exhausted due
          // to a temporary empty response. Retry the same page at a calm pace.
          set({ isFetchingNextPage: false });
          if (!deferredPageRetryTimer) {
            deferredPageRetryTimer = setTimeout(() => {
              deferredPageRetryTimer = undefined;
              if (get().fetchMode === 'latest' && get().feeds.latest.hasMore) void get().loadNextPage();
            }, 5000);
          }
          console.info(`[ImageEngineStore] latest page=${nextPage} returned no posts; retrying the same chronological page`);
          return;
        }
        if (cooldownUntil) {
          set({ isFetchingNextPage: false });
        }
        if (cooldownUntil && !deferredPageRetryTimer) {
          const expectedPage = activeFeed.currentPage;
          const retryDelay = Math.max(500, cooldownUntil - Date.now() + 100);
          deferredPageRetryTimer = setTimeout(() => {
            deferredPageRetryTimer = undefined;
            const latestState = get();
            if (
              latestState.fetchMode === mode
              && latestState.feeds[mode].currentPage === expectedPage
              && latestState.feeds[mode].hasMore
            ) {
              void latestState.loadNextPage();
            }
          }, retryDelay);
        }
        if (!cooldownUntil) {
          emptyPageSkips[mode] += 1;
          const backOff = emptyPageSkips[mode] >= 5;
          set(s => ({
            isFetchingNextPage: false,
            feeds: {
              ...s.feeds,
              [mode]: { ...s.feeds[mode], currentPage: nextPage, hasMore: true },
            },
          }));
          console.info(`[ImageEngineStore] ${mode} page=${nextPage} had no unseen items; ${backOff ? 'backing off before continuing' : 'advancing'}`);
          if (backOff) emptyPageSkips[mode] = 0;
          setTimeout(() => void get().loadNextPage(), backOff ? 3000 : 0);
        }
        return;
      }

      emptyPageSkips[mode] = 0;

      set(s => ({
        isFetchingNextPage: false,
        feeds: {
          ...s.feeds,
            [mode]: {
              ...s.feeds[mode],
              currentPage: nextPage,
              hasMore: true
          }
        }
      }));
    } catch (e: any) {
      console.error("[ImageEngineStore] Fetch next page failed:", e);
      set({ isFetchingNextPage: false });
    }
  },

  reset: () => {
    if (deferredPageRetryTimer) {
      clearTimeout(deferredPageRetryTimer);
      deferredPageRetryTimer = undefined;
    }
    Object.keys(emptyPageSkips).forEach(key => { emptyPageSkips[key as keyof typeof emptyPageSkips] = 0; });
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
      
      // Refresh the exposure timestamp if an item reaches a feed again after
      // expiry. Parameters avoid IDs ever being interpreted as SQL text.
      for (const image of images) {
        await db.execute(`
          INSERT INTO FlowSeenImages (id, sourceId, providerId, seenAt)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            sourceId = excluded.sourceId,
            providerId = excluded.providerId,
            seenAt = CURRENT_TIMESTAMP
        `, [image.id, image.sourceId, image.providerId]);
      }
    } catch (e) {
      console.error("[ImageEngineStore] Failed to mark as seen", e);
    }
  }
}));
