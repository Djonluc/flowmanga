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

interface DiscoveryState {
  // Results
  results: SourceSearchResult[];
  trending: SourceSearchResult[];
  latest: SourceSearchResult[];
  random: SourceSearchResult[];

  // UI State
  query: string;
  currentSearchPage: number;
  hasMoreSearchResults: boolean;
  isSearching: boolean;
  isLoadingTrending: boolean;
  isLoadingLatest: boolean;
  isLoadingRandom: boolean;
  activeType: ContentType | "all";
  error: string | null;

  // Actions
  search: (query: string, page?: number) => Promise<void>;
  loadMoreSearchResults: () => Promise<void>;
  fetchTrending: (force?: boolean) => Promise<void>;
  fetchLatest: (force?: boolean) => Promise<void>;
  fetchRandom: (force?: boolean) => Promise<void>;
  forceRefresh: () => Promise<void>;
  setQuery: (query: string) => void;
  setActiveType: (type: ContentType | "all") => void;
  clearResults: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  results: [],
  trending: [],
  latest: [],
  random: [],
  query: "",
  currentSearchPage: 1,
  hasMoreSearchResults: true,
  isSearching: false,
  isLoadingTrending: false,
  isLoadingLatest: false,
  isLoadingRandom: false,
  activeType: "all",
  error: null,

  setQuery: (query) => set({ query }),

  setActiveType: (activeType) => set({ activeType }),

  clearResults: () =>
    set({
      results: [],
      query: "",
      currentSearchPage: 1,
      hasMoreSearchResults: true,
      error: null,
    }),

  search: async (query, page = 1) => {
    if (!query.trim()) return;
    set({ isSearching: true, error: null });
    try {
      const { coloredOnly } = useSettingsStore.getState();
      const mediaDomain =
        get().activeType === "gallery"
          ? "image"
          : get().activeType === "all"
            ? undefined
            : "manga";
      const results = await DiscoveryService.searchGlobal(
        query,
        48, // Increased limit for better results
        coloredOnly,
        page,
        mediaDomain,
      );

      set((state) => {
        const nextResults =
          page === 1 ? results : [...state.results, ...results];

        return {
          results: nextResults,
          isSearching: false,
          query,
          currentSearchPage: page,
          hasMoreSearchResults: results.length >= 48,
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

  loadMoreSearchResults: async () => {
    const state = get();
    if (
      state.isSearching ||
      !state.hasMoreSearchResults ||
      !state.query.trim()
    ) {
      return;
    }

    await get().search(state.query, state.currentSearchPage + 1);
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
      );
      set({ trending, isLoadingTrending: false });
    } catch (err) {
      console.error("[DiscoveryStore] Fetch trending failed:", err);
      set({ isLoadingTrending: false });
    }
  },

  fetchLatest: async (force = false) => {
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

    if (!force && get().latest.length > 0 && currentIsColored === coloredOnly)
      return;

    set({ isLoadingLatest: true, error: null });
    try {
      const category =
        get().activeType === "gallery"
          ? "image"
          : "manga";
      const latest = await DiscoveryService.getLatest(
        24,
        coloredOnly,
        category,
      );
      set({ latest, isLoadingLatest: false });
    } catch (err) {
      console.error("[DiscoveryStore] Failed to fetch latest:", err);
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
      const random = await DiscoveryService.getRandom(
        24,
        coloredOnly,
        category,
      );
      set({ random, isLoadingRandom: false });
    } catch (err) {
      console.error("[DiscoveryStore] Failed to fetch random:", err);
      set({ isLoadingRandom: false });
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
    ]);
  },
}));
