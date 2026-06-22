/**
 * useDiscoveryStore
 *
 * Manages the state for the global Discovery view.
 * Handles cross-source searching, category browsing,
 * and persistent discovery results.
 */

import { create } from "zustand";
import { DiscoveryService } from "../services/DiscoveryService";
import { useSettingsStore } from "./useSettingsStore";
import type {
  SourceSearchResult,
  ContentType,
} from "../services/sources/types";
import { useLibraryStore } from "./useLibraryStore";
import { MangaIntelligenceService } from "../services/manga-intelligence/MangaIntelligenceService";

const dedupeResults = (current: SourceSearchResult[], incoming: SourceSearchResult[]) => {
  const seenIds = new Set(current.map(r => r.id));
  const seenTitles = new Set(
    current.map(r => r.title?.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean)
  );
  
  // Library de-duplication
  const librarySeries = useLibraryStore.getState().series || [];
  const libraryIds = new Set(librarySeries.map(s => s.id));
  const libraryTitles = new Set(
    librarySeries.map(s => s.title?.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean)
  );
  
  return [
    ...current,
    ...incoming.filter(r => {
      if (seenIds.has(r.id)) return false;
      
      const titleKey = r.title?.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (titleKey && seenTitles.has(titleKey)) return false;
      
      // Filter out library series
      if (libraryIds.has(r.id)) return false;
      if (titleKey && libraryTitles.has(titleKey)) return false;

      seenIds.add(r.id);
      if (titleKey) seenTitles.add(titleKey);
      return true;
    })
  ];
};

interface DiscoveryState {
  // Results
  results: SourceSearchResult[];
  trending: SourceSearchResult[];
  latest: SourceSearchResult[];
  random: SourceSearchResult[];
  forYou: SourceSearchResult[];

  // UI State
  query: string;
  searchTags: string[];
  currentSearchPage: number;
  currentLatestPage: number;
  currentRandomPage: number;
  hasMoreSearchResults: boolean;
  hasMoreLatest: boolean;
  hasMoreRandom: boolean;
  isSearching: boolean;
  isLoadingTrending: boolean;
  isLoadingLatest: boolean;
  isLoadingRandom: boolean;
  isLoadingForYou: boolean;
  activeType: ContentType | "all";
  error: string | null;
  activeTab: "latest" | "discover" | "for-you" | "search";
  scrollPositions: Record<string, number>;

  // Actions
  search: (query: string, page?: number) => Promise<void>;
  searchByTags: (tags: string[], page?: number) => Promise<void>;
  loadMoreSearchResults: () => Promise<void>;
  loadMoreLatest: () => Promise<void>;
  loadMoreRandom: () => Promise<void>;
  fetchTrending: (force?: boolean) => Promise<void>;
  fetchLatest: (force?: boolean, page?: number) => Promise<void>;
  fetchRandom: (force?: boolean) => Promise<void>;
  fetchForYou: (force?: boolean) => Promise<void>;
  forceRefresh: () => Promise<void>;
  setQuery: (query: string) => void;
  setActiveType: (type: ContentType | "all") => void;
  setActiveTab: (tab: "latest" | "discover" | "for-you" | "search") => void;
  setScrollPosition: (tab: string, pos: number) => void;
  clearResults: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  results: [],
  trending: [],
  latest: [],
  random: [],
  forYou: [],
  query: "",
  searchTags: [],
  currentSearchPage: 1,
  currentLatestPage: 1,
  currentRandomPage: 1,
  hasMoreSearchResults: true,
  hasMoreLatest: true,
  hasMoreRandom: true,
  isSearching: false,
  isLoadingTrending: false,
  isLoadingLatest: false,
  isLoadingRandom: false,
  isLoadingForYou: false,
  activeType: "all",
  error: null,
  activeTab: "discover",
  scrollPositions: {},

  setQuery: (query) => set({ query }),

  setActiveType: (activeType) =>
    set({
      activeType,
      trending: [],
      latest: [],
      random: [],
      forYou: [],
      currentLatestPage: 1,
      currentRandomPage: 1,
      hasMoreLatest: true,
      hasMoreRandom: true,
    }),

  setActiveTab: (activeTab) => set({ activeTab }),
  
  setScrollPosition: (tab, pos) => set((state) => ({
      scrollPositions: { ...state.scrollPositions, [tab]: pos }
  })),

  clearResults: () =>
    set({
      results: [],
      query: "",
      searchTags: [],
      currentSearchPage: 1,
      currentLatestPage: 1,
      currentRandomPage: 1,
      hasMoreSearchResults: true,
      hasMoreLatest: true,
      hasMoreRandom: true,
      error: null,
      activeTab: "discover",
    }),

  search: async (query, page = 1) => {
    if (!query.trim()) return;
    set({ isSearching: true, error: null });
    try {
      const { coloredOnly } = useSettingsStore.getState();
      
      // The user requested to always search ALL content within the active ecosystem (manga vs image)
      const mediaDomain = get().activeType === "gallery" ? "image" : "manga"; 
      
      const results = await DiscoveryService.searchGlobal(
        query,
        48, // Increased limit for better results
        coloredOnly,
        page,
        mediaDomain,
      );

      // Inject local library matches on page 1
      let localMatches: SourceSearchResult[] = [];
      if (page === 1) {
        const librarySeries = useLibraryStore.getState().series || [];
        const lowerQuery = query.toLowerCase();
        localMatches = librarySeries
            .filter(s => s.title?.toLowerCase().includes(lowerQuery) || s.tags?.some(t => t.toLowerCase().includes(lowerQuery)))
            .map(s => ({
                id: s.id,
                title: s.title,
                coverUrl: s.coverPath || s.coverUrl || "",
                tags: s.tags,
                source: "Library",
                provider: "local",
                url: "",
                rating: s.rating
            }));
      }

      set((state) => {
        const sourceResults = page === 1 ? dedupeResults(localMatches, results) : dedupeResults(state.results, results);
        const nextResults = page === 1 ? sourceResults : sourceResults; // dedupeResults handles combining them

        return {
          results: nextResults,
          isSearching: false,
          query,
          currentSearchPage: page,
          hasMoreSearchResults:
            (page === 1 ? nextResults.length > 0 : nextResults.length > state.results.length) && page < 20,
        };
      });
    } catch (err) {
      console.error("[DiscoveryStore] Search failed:", err);
      set({
        error: "Global search failed. Some sources may be unavailable.",
        isSearching: false,
      });
    }
  },

  searchByTags: async (tags, page = 1) => {
    if (!tags || tags.length === 0) return;
    set({ isSearching: true, error: null, searchTags: tags });
    try {
      const { coloredOnly } = useSettingsStore.getState();
      
      // Always search ALL content within the active ecosystem (manga vs image)
      const mediaDomain = get().activeType === "gallery" ? "image" : "manga";
      
      const results = await DiscoveryService.searchGlobalByTags(
        tags,
        48,
        coloredOnly,
        page,
        mediaDomain,
      );

      // Inject local library matches on page 1
      let localMatches: SourceSearchResult[] = [];
      if (page === 1) {
        const librarySeries = useLibraryStore.getState().series || [];
        const lowerTags = tags.map(t => t.toLowerCase());
        localMatches = librarySeries
            .filter(s => s.tags?.some(t => lowerTags.includes(t.toLowerCase())))
            .map(s => ({
                id: s.id,
                title: s.title,
                coverUrl: s.coverPath || s.coverUrl || "",
                tags: s.tags,
                source: "Library",
                provider: "local",
                url: "",
                rating: s.rating
            }));
      }

      set((state) => {
        // dedupeResults filters out duplicate titles, so we pass localMatches as current to ensure they take precedence
        const sourceResults = page === 1 ? dedupeResults(localMatches, results) : dedupeResults(state.results, results);
        const nextResults = sourceResults;

        return {
          results: nextResults,
          isSearching: false,
          query: tags.join(" "),
          currentSearchPage: page,
          hasMoreSearchResults:
            (page === 1 ? nextResults.length > 0 : nextResults.length > state.results.length) && page < 20,
        };
      });
    } catch (err) {
      console.error("[DiscoveryStore] Tag search failed:", err);
      set({
        error: "Tag search failed. Some sources may be unavailable.",
        isSearching: false,
      });
    }
  },

  loadMoreSearchResults: async () => {
    const state = get();
    if (
      state.isSearching ||
      !state.hasMoreSearchResults ||
      (!state.query.trim() && state.searchTags.length === 0)
    ) {
      return;
    }

    if (state.searchTags.length > 0) {
      await get().searchByTags(state.searchTags, state.currentSearchPage + 1);
    } else {
      await get().search(state.query, state.currentSearchPage + 1);
    }
  },

  loadMoreLatest: async () => {
    const state = get();
    if (state.isLoadingLatest || !state.hasMoreLatest) return;
    await get().fetchLatest(true, state.currentLatestPage + 1);
  },

  loadMoreRandom: async () => {
    const state = get();
    if (state.isLoadingRandom) return;
    await get().fetchRandom(true);
  },

  fetchTrending: async (force = false) => {
    const { coloredOnly } = useSettingsStore.getState();
    const currentIsColored =
      get().trending.length > 0 &&
      get().trending.some((item) => {
        const tags = (item.tags || []).map((t) => t.toLowerCase());
        const src = item.source?.toLowerCase() || "";
        return (
          tags.some((t) =>
            ["full color", "colored", "manhwa", "manhua", "webtoon"].includes(
              t,
            ),
          ) ||
          src.includes("manhwaread") ||
          src.includes("luacomic")
        );
      });

    if (!force && get().trending.length > 0 && currentIsColored === coloredOnly)
      return;

    set({ isLoadingTrending: true, error: null });
    try {
      const category =
        get().activeType === "gallery"
          ? "image"
          : "manga";
      const trending = await DiscoveryService.getTrending(
        24,
        coloredOnly,
        category,
        1,
        get().activeType,
      );
      set({ trending, isLoadingTrending: false });
    } catch (err) {
      console.error("[DiscoveryStore] Fetch trending failed:", err);
      set({ isLoadingTrending: false });
    }
  },

  fetchLatest: async (force = false, page = 1) => {
    const { coloredOnly } = useSettingsStore.getState();
    const currentIsColored =
      get().latest.length > 0 &&
      get().latest.some((item) => {
        const tags = (item.tags || []).map((t) => t.toLowerCase());
        const src = item.source?.toLowerCase() || "";
        return (
          tags.some((t) =>
            ["full color", "colored", "manhwa", "manhua", "webtoon"].includes(
              t,
            ),
          ) ||
          src.includes("manhwaread") ||
          src.includes("luacomic")
        );
      });

    if (!force && page === 1 && get().latest.length > 0 && currentIsColored === coloredOnly)
      return;

    set({ isLoadingLatest: true, error: null });
    try {
      const category =
        get().activeType === "gallery"
          ? "image"
          : "manga";
      const results = await DiscoveryService.getLatest(
        24,
        coloredOnly,
        category,
        page,
        get().activeType,
      );
      set((state) => ({ 
        latest: page === 1 ? results : dedupeResults(state.latest, results),
        isLoadingLatest: false,
        currentLatestPage: page,
        hasMoreLatest: results.length > 0
      }));
    } catch (err) {
      console.error("[DiscoveryStore] Fetch latest failed:", err);
      set({ isLoadingLatest: false });
    }
  },

  fetchRandom: async (force = false) => {
    const { coloredOnly } = useSettingsStore.getState();
    if (!force && get().random.length > 0) return;

    set({ isLoadingRandom: true });
    try {
      const category =
        get().activeType === "gallery"
          ? "image"
          : "manga";
      const results = await DiscoveryService.getRandom(
        24,
        coloredOnly,
        category,
        get().activeType,
      );
      set((state) => ({ 
        random: force ? dedupeResults(state.random, results) : results,
        isLoadingRandom: false 
      }));
    } catch (err) {
      console.error("[DiscoveryStore] Fetch random failed:", err);
      set({ isLoadingRandom: false });
    }
  },

  fetchForYou: async (force = false) => {
    if (!force && get().forYou.length > 0) return;

    set({ isLoadingForYou: true });
    try {
        const smartRecommendations = await MangaIntelligenceService.getSmartRecommendations(24);
        
        // Convert recommendations back to SourceSearchResult
        // The MangaIntelligence Engine caches the full object in generic series struct, so we map it back.
        const mappedResults = smartRecommendations.map(rec => ({
            id: rec.series.id,
            title: rec.series.title,
            coverUrl: rec.series.coverUrl,
            source: rec.series.source,
            provider: rec.series.source,
            contentType: rec.series.contentType as ContentType || 'manga',
            url: rec.series.url || '',
            tags: rec.series.tags,
            description: rec.series.description,
            score: rec.score // Keep score for debugging if needed
        })) as unknown as SourceSearchResult[];

        set({ forYou: mappedResults, isLoadingForYou: false });
    } catch (err) {
      console.error("[DiscoveryStore] Fetch For You failed:", err);
      set({ isLoadingForYou: false });
    }
  },

  forceRefresh: async () => {
    set({
      isLoadingTrending: true,
      isLoadingLatest: true,
      isLoadingRandom: true,
      trending: [],
      latest: [],
      random: [],
      results: [],
    });
    await DiscoveryService.clearAllCache();
    await Promise.all([
      get().fetchTrending(true),
      get().fetchLatest(true),
      get().fetchRandom(true),
      get().fetchForYou(true),
    ]);
  },
}));
