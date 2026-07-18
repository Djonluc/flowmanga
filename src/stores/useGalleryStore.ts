/**
 * useGalleryStore
 *
 * Central state management for the Gallery Ecosystem.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getDb } from "../services/db";
import { toast } from "../components/Toast";
import { useSettingsStore } from "./useSettingsStore";
import { ContentFilter } from "../services/ContentFilter";
import { hasExcludedTag, mergeExcludedTags } from "../services/TagExclusions";
import { imageDiscovery, imageAutocomplete, mapImageMediaToSearchResult } from "../services/image-engine";
import type {
  SourceSearchResult,
  ContentType,
} from "../services/sources/types";

// Module-level timers and controllers for request management
let _suggestionDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let _searchAbortController: AbortController | null = null;
let _searchGeneration = 0;
let _discoveryAbortController: AbortController | null = null;
let _discoveryGeneration = 0;
let _suggestionAbortController: AbortController | null = null;

// ─── Types ───────────────────────────────────────────────────────────

export interface GalleryImage {
  id: string;
  imageUrl: string;
  previewUrl?: string;
  tags: string[];
  generalTags?: string[];
  characterTags?: string[];
  copyrightTags?: string[];
  artistTags?: string[];
  metaTags?: string[];
  source: string;
  rating: string;
  width?: number;
  height?: number;
  dominantColor?: string;
  aesthetic?: string;
  artist?: string;
  savedAt: string;
  liked: boolean;
  folderId?: string;
  contentType?: ContentType;
}

export interface GalleryFolder {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  imageCount?: number;
}

export interface Slideshow {
  id: string;
  name: string;
  tags: string;
  folderId?: string;
  transition: string;
  interval: number;
  shuffle: boolean;
  createdAt: string;
}

export interface UserSmartCollection {
  id: string;
  name: string;
  tags: string[]; // array of tags
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmartCollection {
  tag: string;
  count: number;
  images: GalleryImage[];
  isManual?: boolean;
  id?: string;
}

export type GalleryTab =
  | "discover"
  | "picks"
  | "collections"
  | "slideshows"
  | "following"
  | "search";

// ─── Cold Start Data ────────────────────────────────────────────────

const CURATED_AESTHETICS = [
  "Cyberpunk",
  "Fantasy",
  "Vocaloid",
  "Sunset",
  "Neon",
  "Dark Aesthetic",
  "Pastel",
  "Rain",
  "Cherry Blossoms",
  "Space",
  "Samurai",
  "Gothic",
  "Steampunk",
  "Ocean",
];

// ─── Utilities ───────────────────────────────────────────────────────

function buildResultKey(item: SourceSearchResult) {
  return `${item.id}||${item.imageUrl || item.url || item.previewUrl || ""}`;
}

function dedupeResults(
  items: SourceSearchResult[],
  existingGroups: SourceSearchResult[][] = [],
) {
  const seen = new Set<string>();
  for (const group of existingGroups) {
    for (const item of group) {
      if (!item) continue;
      seen.add(buildResultKey(item));
    }
  }

  let blockedTags: string[] = [];
  try {
    // We get the blocked tags dynamically to avoid circular issues
    blockedTags = mergeExcludedTags(
      useGalleryStore.getState().blockedTags || [],
      useSettingsStore.getState().excludedTags || [],
    );
  } catch (error) {
    console.warn('[GalleryStore] Failed to load blocked-tag filters:', error);
  }

  return items.filter((item) => {
    const key = buildResultKey(item);
    if (seen.has(key)) return false;
    
    // Filter out items that contain any blocked tag
    if (blockedTags.length > 0 && hasExcludedTag(item.tags || [], blockedTags)) return false;
    
    seen.add(key);
    return true;
  });
}

// ─── Store ───────────────────────────────────────────────────────────

interface GalleryState {
  // Persisted Data
  savedImages: GalleryImage[];
  folders: GalleryFolder[];
  favoriteTags: string[];
  blockedTags: string[];
  slideshows: Slideshow[];
  smartCollections: { tag: string; count: number; images: GalleryImage[] }[];
  localFolders: { id: string; path: string; name: string }[];

  // Discovery Feeds
  popularImages: SourceSearchResult[];
  latestImages: SourceSearchResult[];
  randomVisions: SourceSearchResult[];
  picksForYou: SourceSearchResult[];
  recommendedAesthetics: SourceSearchResult[];
  recentPopular: SourceSearchResult[];
  likedDiscovery: SourceSearchResult[];
  continueExploring: SourceSearchResult[];

  // Search
  searchQuery: string;
  searchResults: SourceSearchResult[];
  currentSearchPage: number;
  hasMoreSearchResults: boolean;
  searchSuggestions: string[];

  // UI State
  activeTab: GalleryTab;
  isLoadingPopular: boolean;
  isLoadingLatest: boolean;
  isLoadingRandom: boolean;
  isLoadingPicks: boolean;
  isLoadingRecommended: boolean;
  isLoadingRecentPopular: boolean;
  isLoadingLikedDiscovery: boolean;
  isLoadingContinueExploring: boolean;
  isSearching: boolean;
  isLoadingFolders: boolean;
  downloadPath: string | null;
  contentFilter: "sfw" | "all";
  isHudPinned: boolean;
  viewHistory: string[];

  // Slideshow Playback
  activeSlideshowId: string | null;
  slideshowImages: GalleryImage[];
  slideshowIndex: number;
  isSlideshowPlaying: boolean;
  slideshowShuffle: boolean;
  slideshowRepeat: boolean;
  slideshowRandom: boolean;
  slideshowHudVisible: boolean;
  lastSlideshowPosition: Record<string, number>;

  // Image Viewer
  viewerImage: (GalleryImage | SourceSearchResult) | null;
  viewerContext: (GalleryImage | SourceSearchResult)[];
  viewerIndex: number;

  // Actions — UI
  setActiveTab: (tab: GalleryTab) => void;
  setSearchQuery: (query: string) => void;
  setDownloadPath: (path: string) => void;
  setContentFilter: (filter: "sfw" | "all") => void;
  cancelDiscovery: () => void;
  fetchAllDiscovery: () => Promise<void>;
  toggleHudPin: () => void;

  // Actions — Data Loading
  loadFromDb: () => Promise<void>;
  loadFolders: () => Promise<void>;
  loadFavoriteTags: () => Promise<void>;
  loadSlideshows: () => Promise<void>;
  generateSmartCollections: () => void;
  addLocalFolder: () => Promise<void>;
  removeLocalFolder: (id: string) => Promise<void>;
  loadLocalFolders: () => Promise<void>;

  // Actions — Discovery
  fetchPopular: (page?: number) => Promise<void>;
  fetchLatest: (page?: number) => Promise<void>;
  fetchRandomVisions: () => Promise<void>;
  generatePicksForYou: (page?: number) => Promise<void>;
  fetchRecommendedAesthetics: () => Promise<void>;
  fetchRecentPopular: () => Promise<void>;
  fetchLikedDiscovery: () => Promise<void>;
  fetchContinueExploring: () => Promise<void>;
  preloadMoreContent: () => Promise<void>;

  searchByTags: (query: string, page?: number) => Promise<void>;
  fetchSuggestions: (query: string) => Promise<void>;

  // Actions — Image Management
  saveImage: (image: SourceSearchResult | GalleryImage) => Promise<void>;
  unsaveImage: (id: string) => Promise<void>;
  likeImage: (id: string) => Promise<void>;
  unlikeImage: (id: string) => Promise<void>;
  addToFolder: (imageId: string, folderId: string) => Promise<void>;
  removeFromFolder: (imageId: string) => Promise<void>;

  // Actions — Folder Management
  createFolder: (name: string, description?: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  renameFolder: (id: string, name: string) => Promise<void>;
  togglePinFolder: (id: string) => Promise<void>;

  // Actions — Tag Management
  favoriteTag: (tag: string) => Promise<void>;
  unfavoriteTag: (tag: string) => Promise<void>;
  clearFavoriteTags: () => Promise<void>;
  blockTag: (tag: string) => Promise<void>;
  unblockTag: (tag: string) => Promise<void>;
  clearBlockedTags: () => Promise<void>;
  toggleTagState: (tag: string, type?: string) => Promise<void>;

  // Actions — History / Interactions
  clearViewHistory: () => Promise<void>;
  logInteraction: (
    imageId: string | null,
    tag: string | null,
    action: string,
  ) => Promise<void>;
  trackInteraction: (tags: string[]) => void;

  // Actions — Slideshows
  createSlideshow: (
    name: string,
    tags?: string,
    folderId?: string,
  ) => Promise<void>;
  deleteSlideshow: (id: string) => Promise<void>;
  startSlideshow: (id: string) => Promise<void>;
  startSlideshowFromContext: (
    images: (GalleryImage | SourceSearchResult)[],
    startIndex?: number,
    contextId?: string
  ) => void;
  stopSlideshow: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  toggleSlideshowShuffle: () => void;
  toggleSlideshowRepeat: () => void;
  toggleSlideshowRandom: () => void;
  setSlideshowHudVisible: (visible: boolean) => void;
  setSlideshowIndex: (index: number) => void;

  // Actions — Smart Collections
  loadUserSmartCollections: () => Promise<void>;
  createUserSmartCollection: (name: string, tags: string[]) => Promise<void>;
  deleteUserSmartCollection: (id: string) => Promise<void>;
  togglePinUserSmartCollection: (id: string) => Promise<void>;
  updateUserSmartCollection: (id: string, name: string, tags: string[]) => Promise<void>;

  // Actions — Image Viewer
  openViewer: (
    image: GalleryImage | SourceSearchResult,
    context?: (GalleryImage | SourceSearchResult)[],
    index?: number,
  ) => Promise<void>;
  closeViewer: () => void;
  viewerNext: () => void;
  viewerPrev: () => void;
}

export const useGalleryStore = create<GalleryState>()(persist((set, get) => ({
  // ─── Initial State ───────────────────────────────────────────────

  savedImages: [],
  folders: [],
  favoriteTags: [],
  blockedTags: [],
  slideshows: [],
  smartCollections: [],
  localFolders: [],
  userSmartCollections: [],

  popularImages: [],
  latestImages: [],
  randomVisions: [],
  picksForYou: [],
  recommendedAesthetics: [],
  recentPopular: [],
  likedDiscovery: [],
  continueExploring: [],

  searchQuery: "",
  searchResults: [],
  currentSearchPage: 1,
  hasMoreSearchResults: true,
  searchSuggestions: [],

  activeTab: "discover",
  isLoadingPopular: false,
  isLoadingLatest: false,
  isLoadingRandom: false,
  isLoadingPicks: false,
  isLoadingRecommended: false,
  isLoadingRecentPopular: false,
  isLoadingLikedDiscovery: false,
  isLoadingContinueExploring: false,
  isSearching: false,
  isLoadingFolders: false,
  downloadPath: null,
  contentFilter: "sfw",
  isHudPinned: false,
  viewHistory: [],

  activeSlideshowId: null,
  slideshowImages: [],
  slideshowIndex: 0,
  isSlideshowPlaying: false,
  slideshowShuffle: false,
  slideshowRepeat: false,
  slideshowRandom: false,
  slideshowHudVisible: true,
  lastSlideshowPosition: {},

  viewerImage: null,
  viewerContext: [],
  viewerIndex: 0,

  // ─── UI Actions ──────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDownloadPath: async (path: string) => {
    try {
      const db = getDb();
      await db.execute(
        "INSERT OR REPLACE INTO GallerySettings (key, value) VALUES (?, ?)",
        ["downloadPath", path],
      );
      set({ downloadPath: path });
    } catch (e) {
      console.error("[GalleryStore] Failed to save downloadPath:", e);
    }
  },
  setContentFilter: async (filter: "sfw" | "all") => {
    try {
      useSettingsStore.getState().setShowAdultContent(filter === "all");
      set({
        contentFilter: filter,
        popularImages: [],
        latestImages: [],
        randomVisions: [],
        picksForYou: [],
        recommendedAesthetics: [],
        recentPopular: [],
        likedDiscovery: [],
        continueExploring: [],
        isLoadingPopular: false,
        isLoadingLatest: false,
        isLoadingRandom: false,
        isLoadingPicks: false,
        isLoadingRecommended: false,
        isLoadingRecentPopular: false,
        isLoadingLikedDiscovery: false,
        isLoadingContinueExploring: false,
      });
      
      get().cancelDiscovery(); 
      await get().fetchAllDiscovery();
    } catch (e) {
      console.error("[GalleryStore] Failed to set contentFilter:", e);
    }
  },

  cancelDiscovery: () => {
    _discoveryGeneration += 1;
    if (_discoveryAbortController) {
      _discoveryAbortController.abort();
    }
    _discoveryAbortController = new AbortController();
  },
  toggleHudPin: () => set((state) => ({ isHudPinned: !state.isHudPinned })),

  // ─── Data Loading ────────────────────────────────────────────────

  loadFromDb: async () => {
    try {
      const db = getDb();

      // 1. Load Saved Images
      const rows = await db.select<any[]>(
        "SELECT * FROM GalleryImages ORDER BY savedAt DESC",
      );
      const savedImages: GalleryImage[] = rows.map((r) => ({
        id: r.id,
        imageUrl: r.imageUrl,
        previewUrl: r.previewUrl,
        tags: r.tags ? r.tags.split(",").filter((t: string) => t) : [],
        source: r.source,
        rating: r.rating,
        width: r.width,
        height: r.height,
        dominantColor: r.dominantColor,
        aesthetic: r.aesthetic,
        artist: r.artist,
        savedAt: r.savedAt,
        liked: !!r.liked,
        folderId: r.folderId,
        generalTags: r.generalTags ? JSON.parse(r.generalTags) : [],
        characterTags: r.characterTags ? JSON.parse(r.characterTags) : [],
        copyrightTags: r.copyrightTags ? JSON.parse(r.copyrightTags) : [],
        artistTags: r.artistTags ? JSON.parse(r.artistTags) : [],
        metaTags: r.metaTags ? JSON.parse(r.metaTags) : [],
      }));
      set({ savedImages });

      // 2. Load Settings (Gracefully)
      try {
        const settingsRows = await db.select<any[]>(
          "SELECT * FROM GallerySettings",
        );
        const settings = new Map(settingsRows.map((r) => [r.key, r.value]));

        if (settings.has("downloadPath"))
          set({ downloadPath: settings.get("downloadPath") });
        if (settings.has("contentFilter"))
          set({ contentFilter: settings.get("contentFilter") as any });
        if (settings.has("blockedTags")) {
          try {
            set({ blockedTags: JSON.parse(settings.get("blockedTags")) });
          } catch (error) {
            console.warn('[GalleryStore] Ignored invalid persisted blocked tags:', error);
          }
        }
      } catch (settingsError) {
        console.warn(
          "[GalleryStore] GallerySettings table not ready or empty:",
          settingsError,
        );
      }

      // 3. Generate Smart Insights
      get().generateSmartCollections();

      // 4. Load Related Data
      await Promise.all([
        get().loadFolders(),
        get().loadFavoriteTags(),
        get().loadSlideshows(),
        get().loadLocalFolders(),
      ]);
    } catch (e) {
      console.error("[GalleryStore] loadFromDb critical failure:", e);
    }
  },

  loadFolders: async () => {
    try {
      const db = getDb();
      const rows = await db.select<any[]>(
        "SELECT * FROM GalleryFolders ORDER BY pinned DESC, updatedAt DESC",
      );
      const counts = await db.select<any[]>(
        "SELECT folderId, COUNT(*) as cnt FROM GalleryImages WHERE folderId IS NOT NULL GROUP BY folderId",
      );
      const countMap = new Map(counts.map((c) => [c.folderId, c.cnt]));

      const folders: GalleryFolder[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        coverUrl: r.coverUrl,
        pinned: !!r.pinned,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        imageCount: countMap.get(r.id) || 0,
      }));

      set({ folders });
    } catch (e) {
      console.error("[GalleryStore] loadFolders failed:", e);
    }
  },

  loadFavoriteTags: async () => {
    try {
      const db = getDb();
      const rows = await db.select<any[]>(
        "SELECT tag FROM FavoriteTags ORDER BY usageCount DESC",
      );
      set({ favoriteTags: rows.map((r) => r.tag) });
    } catch (e) {
      console.error("[GalleryStore] loadFavoriteTags failed:", e);
    }
  },

  loadSlideshows: async () => {
    try {
      const db = getDb();
      const rows = await db.select<any[]>(
        "SELECT * FROM Slideshows ORDER BY createdAt DESC",
      );
      const slideshows: Slideshow[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        tags: r.tags,
        folderId: r.folderId,
        transition: r.transition,
        interval: r.interval,
        shuffle: !!r.shuffle,
        createdAt: r.createdAt,
      }));
      set({ slideshows });
    } catch (e) {
      console.error("[GalleryStore] loadSlideshows failed:", e);
    }
  },

  // ─── Discovery ──────────────────────────────────────────────────

  fetchAllDiscovery: async () => {
    // Parallel load with independent error handling
    const tasks = [
      get().fetchPopular(),
      get().fetchLatest(),
      get().fetchRandomVisions(),
      get().generatePicksForYou(),
      get().fetchRecommendedAesthetics(),
      get().fetchRecentPopular(),
      get().fetchLikedDiscovery(),
      get().fetchContinueExploring(),
    ];

    await Promise.allSettled(tasks);
  },

  fetchPopular: async (page = 1) => {
    if (get().isLoadingPopular) return;
    set({ isLoadingPopular: true });
    const generation = _discoveryGeneration;
    try {
      // Use randomized page for refresh to ensure variety
      const fetchPage = page === 1 ? Math.floor(Math.random() * 5) + 1 : page;
      const rawResults = await imageDiscovery.getDiscovery({ limit: 48, page: fetchPage, ratingFilter: get().contentFilter });
      const results = rawResults.map(mapImageMediaToSearchResult);
      if (generation !== _discoveryGeneration) return;
      const unique = dedupeResults(results, [
        ...(page > 1 ? [get().popularImages] : []),
        get().latestImages,
        get().randomVisions,
        get().recommendedAesthetics,
        get().recentPopular,
        get().likedDiscovery,
        get().continueExploring,
      ]);
      if (page === 1) set({ popularImages: unique });
      else set({ popularImages: [...get().popularImages, ...unique] });
    } catch (e) {
      console.error("[GalleryStore] Failed to fetch popular:", e);
    } finally {
      if (generation === _discoveryGeneration) set({ isLoadingPopular: false });
    }
  },

  fetchLatest: async (page = 1) => {
    if (get().isLoadingLatest) return;
    set({ isLoadingLatest: true });
    const generation = _discoveryGeneration;
    try {
      const rawResults = await imageDiscovery.getLatest({ limit: 48, page, ratingFilter: get().contentFilter });
      const results = rawResults.map(mapImageMediaToSearchResult);
      if (generation !== _discoveryGeneration) return;
      const unique = dedupeResults(results, [
        ...(page > 1 ? [get().latestImages] : []),
        get().popularImages,
        get().randomVisions,
        get().recommendedAesthetics,
        get().recentPopular,
        get().likedDiscovery,
        get().continueExploring,
      ]);
      if (page === 1) set({ latestImages: unique });
      else set({ latestImages: [...get().latestImages, ...unique] });
    } catch (e) {
      console.error("[GalleryStore] Failed to fetch latest:", e);
    } finally {
      if (generation === _discoveryGeneration) set({ isLoadingLatest: false });
    }
  },

  fetchRandomVisions: async () => {
    if (get().isLoadingRandom) return;
    set({ isLoadingRandom: true });
    const generation = _discoveryGeneration;
    try {
      const rawResults = await imageDiscovery.getRandom({ limit: 64, page: 1, ratingFilter: get().contentFilter });
      const results = rawResults.map(mapImageMediaToSearchResult);
      if (generation !== _discoveryGeneration) return;
      const unique = dedupeResults(results, [
        get().randomVisions,
        get().popularImages,
        get().latestImages,
        get().recommendedAesthetics,
        get().recentPopular,
        get().likedDiscovery,
        get().continueExploring,
      ]);
      set({ randomVisions: unique });
    } catch (e) {
      console.error("[GalleryStore] Failed to fetch random visions:", e);
    } finally {
      if (generation === _discoveryGeneration) set({ isLoadingRandom: false });
    }
  },

  generatePicksForYou: async (page = 1) => {
    if (get().isLoadingPicks) return;
    set({ isLoadingPicks: true });
    const generation = _discoveryGeneration;
    if (!_discoveryAbortController) _discoveryAbortController = new AbortController();
    try {
      const { viewHistory, favoriteTags, savedImages } = get();
      const contentFilter = useSettingsStore.getState().showAdultContent ? "all" : "sfw";
      
      // Extract top 3 tags from each liked image
      const likedImages = savedImages.filter(i => i.liked);
      const likedTags = likedImages.flatMap(img => img.tags.slice(0, 3));
      
      const hasHistory = favoriteTags.length > 0 || likedImages.length > 0;

      let results: SourceSearchResult[] = [];

      if (!hasHistory) {
        const raw = await imageDiscovery.getRandom({ limit: 64, page, ratingFilter: contentFilter });
        results = raw.map(mapImageMediaToSearchResult);
      } else {
        const allSeeds = Array.from(
          new Set([...likedTags, ...favoriteTags]),
        );
        // Search several independent taste seeds so one overly-specific
        // combination cannot collapse the entire feed to one provider/page.
        const selectedSeeds = allSeeds
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);
          
        if (selectedSeeds.length > 0) {
          const rawBySeed = await Promise.all(
            selectedSeeds.map((seed) =>
              imageDiscovery.search(seed, { limit: 24, page, ratingFilter: contentFilter }),
            ),
          );
          results = rawBySeed.flat().map(mapImageMediaToSearchResult);
        } else {
          // Fallback if seeds ended up empty somehow
          const raw = await imageDiscovery.search(CURATED_AESTHETICS[Math.floor(Math.random() * CURATED_AESTHETICS.length)], { limit: 64, page, ratingFilter: contentFilter });
          results = raw.map(mapImageMediaToSearchResult);
        }
      }

      if (results.length === 0) {
        const fallbackAesthetic =
          CURATED_AESTHETICS[
            Math.floor(Math.random() * CURATED_AESTHETICS.length)
          ];
        const raw = await imageDiscovery.search(fallbackAesthetic, { limit: 48, page: 1, ratingFilter: contentFilter });
          results = raw.map(mapImageMediaToSearchResult);
      }

      const savedIds = new Set(savedImages.map((i) => i.id));
      const historyIds = new Set(viewHistory);

      const filtered = results.filter(
        (res) => !savedIds.has(res.id) && !historyIds.has(res.id),
      );

      if (generation !== _discoveryGeneration) return;

      const unique = dedupeResults(filtered, [
        get().latestImages,
        get().popularImages,
        get().randomVisions,
        get().recommendedAesthetics,
        get().recentPopular,
        get().likedDiscovery,
        get().continueExploring,
        ...(page === 1 ? [] : [get().picksForYou])
      ]);

      set((state) => {
        const nextPicks = page === 1 ? unique : [...state.picksForYou, ...unique];
        
        if (state.isSlideshowPlaying && state.activeSlideshowId === "picks") {
          const galleryImages: GalleryImage[] = unique.map((img) => {
            if ("imageUrl" in img) return img as GalleryImage;
            const res = img as any;
            return {
              id: res.id,
              imageUrl: res.imageUrl || res.coverUrl || "",
              previewUrl: res.previewUrl || res.coverUrl || "",
              tags: res.tags || [],
              source: res.source || "unknown",
              rating: "safe",
              savedAt: new Date().toISOString(),
              liked: false,
            } as GalleryImage;
          });
          
          return {
            picksForYou: nextPicks,
            slideshowImages: [...state.slideshowImages, ...galleryImages],
          };
        }

        return { picksForYou: nextPicks };
      });
    } catch (e) {
      console.error("[GalleryStore] Failed to refresh picks:", e);
    } finally {
      if (generation === _discoveryGeneration) set({ isLoadingPicks: false });
    }
  },

  fetchRecommendedAesthetics: async () => {
    if (get().isLoadingRecommended) return;
    set({ isLoadingRecommended: true });
    const generation = _discoveryGeneration;
    if (!_discoveryAbortController) _discoveryAbortController = new AbortController();
    try {
      const randomAesthetic =
        CURATED_AESTHETICS[
          Math.floor(Math.random() * CURATED_AESTHETICS.length)
        ];
      const rawResults = await imageDiscovery.search(randomAesthetic, { limit: 48, page: 1, ratingFilter: get().contentFilter });
      const results = rawResults.map(mapImageMediaToSearchResult);
      const savedIds = new Set(get().savedImages.map((i) => i.id));
      const historyIds = new Set(get().viewHistory);
      const filtered = results.filter(
        (res) => !savedIds.has(res.id) && !historyIds.has(res.id),
      );

      if (generation !== _discoveryGeneration) return;

      set({
        recommendedAesthetics: dedupeResults(filtered, [
          get().latestImages,
          get().popularImages,
          get().randomVisions,
          get().recentPopular,
          get().likedDiscovery,
          get().continueExploring,
        ]),
      });

      // Preload thumbnails for better performance
      
    } catch (e) {
      console.error(
        "[GalleryStore] Failed to fetch recommended aesthetics:",
        e,
      );
    } finally {
      if (generation === _discoveryGeneration) set({ isLoadingRecommended: false });
    }
  },

  fetchRecentPopular: async () => {
    if (get().isLoadingRecentPopular) return;
    set({ isLoadingRecentPopular: true });
    const generation = _discoveryGeneration;
    if (!_discoveryAbortController) _discoveryAbortController = new AbortController();
    try {
      const rawResults = await imageDiscovery.search("", { limit: 48, page: 1, ratingFilter: get().contentFilter });
      const results = rawResults.map(mapImageMediaToSearchResult);
      const savedIds = new Set(get().savedImages.map((i) => i.id));
      const historyIds = new Set(get().viewHistory);
      const filtered = results.filter(
        (res) => !savedIds.has(res.id) && !historyIds.has(res.id),
      );

      if (generation !== _discoveryGeneration) return;

      set({
        recentPopular: dedupeResults(filtered, [
          get().latestImages,
          get().popularImages,
          get().randomVisions,
          get().recommendedAesthetics,
          get().likedDiscovery,
          get().continueExploring,
        ]),
      });
    } catch (e) {
      console.error("[GalleryStore] Failed to fetch recent popular:", e);
    } finally {
      if (generation === _discoveryGeneration) set({ isLoadingRecentPopular: false });
    }
  },

  fetchLikedDiscovery: async () => {
    if (get().isLoadingLikedDiscovery) return;
    set({ isLoadingLikedDiscovery: true });
    const generation = _discoveryGeneration;
    if (!_discoveryAbortController) _discoveryAbortController = new AbortController();
    const liked = get().savedImages.filter((i) => i.liked);
    if (liked.length === 0) {
      set({ isLoadingLikedDiscovery: false });
      return;
    }
    try {
      const randomLiked = liked[Math.floor(Math.random() * liked.length)];
      const seeds = randomLiked.tags.slice(0, 3);
      const rawResults = await imageDiscovery.search(seeds.join(" "), { limit: 48, page: 1, ratingFilter: get().contentFilter });
      const results = rawResults.map(mapImageMediaToSearchResult);
      const savedIds = new Set(get().savedImages.map((i) => i.id));
      const historyIds = new Set(get().viewHistory);
      const filtered = results.filter(
        (res) => !savedIds.has(res.id) && !historyIds.has(res.id),
      );

      if (generation !== _discoveryGeneration) return;

      set({
        likedDiscovery: dedupeResults(filtered, [
          get().latestImages,
          get().popularImages,
          get().randomVisions,
          get().recommendedAesthetics,
          get().recentPopular,
          get().continueExploring,
        ]),
      });
    } catch (e) {
      console.error("[GalleryStore] Failed to fetch liked discovery:", e);
    } finally {
      if (generation === _discoveryGeneration) set({ isLoadingLikedDiscovery: false });
    }
  },

  fetchContinueExploring: async () => {
    if (get().isLoadingContinueExploring) return;
    set({ isLoadingContinueExploring: true });
    const generation = _discoveryGeneration;
    if (!_discoveryAbortController) _discoveryAbortController = new AbortController();
    const history = get().viewHistory;
    if (history.length === 0) {
      set({ isLoadingContinueExploring: false });
      return;
    }
    try {
      const lastTag = history[0];
      const rawResults = await imageDiscovery.search(lastTag, { limit: 48, page: 1, ratingFilter: get().contentFilter });
      const results = rawResults.map(mapImageMediaToSearchResult);
      const savedIds = new Set(get().savedImages.map((i) => i.id));
      const historyIds = new Set(get().viewHistory);
      const filtered = results.filter(
        (res) => !savedIds.has(res.id) && !historyIds.has(res.id),
      );

      if (generation !== _discoveryGeneration) return;

      set({
        continueExploring: dedupeResults(filtered, [
          get().latestImages,
          get().popularImages,
          get().randomVisions,
          get().recommendedAesthetics,
          get().recentPopular,
          get().likedDiscovery,
        ]),
      });
    } catch (e) {
      console.error("[GalleryStore] Failed to fetch continue exploring:", e);
    } finally {
      if (generation === _discoveryGeneration) set({ isLoadingContinueExploring: false });
    }
  },

  searchByTags: async (query, page = 1) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: "", currentSearchPage: 1, hasMoreSearchResults: true });
      return;
    }
    
    set({ isSearching: true, searchQuery: query, currentSearchPage: page });

    if (page === 1) {
      _searchGeneration += 1;
      if (_searchAbortController) _searchAbortController.abort();
      _searchAbortController = new AbortController();
    }

    const generation = _searchGeneration;

    try {
      const tags = query.split(/[ ,+]+/).filter(Boolean);
      const rawResults = await imageDiscovery.search(tags.join(" "), { limit: 48, page, ratingFilter: get().contentFilter });
      const results = rawResults.map(mapImageMediaToSearchResult);
      if (generation !== _searchGeneration) return;

      set((state) => {
        const newItems = page === 1 ? results : dedupeResults(results, [state.searchResults]);
        const hasMore = newItems.length > 0 || (page === 1 && results.length > 0);
        const nextResults = page === 1 ? results : [...state.searchResults, ...newItems];
        
        // Cap search results to prevent unbounded memory growth
        const cappedResults = nextResults.slice(-300);
        
        // If we are playing a dynamic slideshow (from search), sync the images
        if (state.isSlideshowPlaying && state.activeSlideshowId === "dynamic") {
          const galleryImages: GalleryImage[] = newItems.map((img) => {
            if ("imageUrl" in img) return img as GalleryImage;
            const res = img as any;
            return {
              id: res.id,
              imageUrl: res.imageUrl || res.coverUrl || "",
              previewUrl: res.previewUrl || res.coverUrl || "",
              tags: res.tags || [],
              source: res.source || "unknown",
              rating: "safe",
              savedAt: new Date().toISOString(),
              liked: false,
            } as GalleryImage;
          });
          
          return {
            searchResults: cappedResults,
            slideshowImages: [...state.slideshowImages, ...galleryImages],
            currentSearchPage: page,
            hasMoreSearchResults: hasMore,
            searchQuery: query,
          };
        }

        return {
          searchResults: cappedResults,
          currentSearchPage: page,
          hasMoreSearchResults: hasMore,
          searchQuery: query,
        };
      });

      if (page === 1) get().trackInteraction(tags);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error("[GalleryStore] Tag search failed:", e);
      }
    } finally {
      if (generation === _searchGeneration) set({ isSearching: false });
    }
  },

  fetchSuggestions: async (query) => {
    if (!query || query.length < 2) return;

    // Debounce: cancel previous pending suggestion fetch
    if (_suggestionDebounceTimer) clearTimeout(_suggestionDebounceTimer);

    _suggestionDebounceTimer = setTimeout(async () => {
      // Abort previous suggestions if still in flight
      if (_suggestionAbortController) _suggestionAbortController.abort();
      _suggestionAbortController = new AbortController();

      try {
        const sourceMatch = query.match(/(?:^|\s)source:([a-z0-9_-]+)/i);
        const lastToken = query.split(/[\s,+]+/).filter(Boolean).pop() || query;
        const suggestions = await imageAutocomplete.getSuggestions(
          lastToken.replace(/^[-+]/, ""),
          sourceMatch?.[1]?.toLowerCase(),
        );
        const showAdultContent = useSettingsStore.getState().showAdultContent;
        set({
          searchSuggestions: suggestions
            .map((suggestion) => suggestion.tag)
            .filter(tag => showAdultContent || !ContentFilter.isAdultTag(tag)),
        });
      } catch (e) {
        console.error("[GalleryStore] Autocomplete failed:", e);
      }
    }, 400);
  },

  // ─── Background Preloading ──────────────────────────────────────

  preloadMoreContent: async () => {
    // Preload additional pages for main feeds in background
    const preloadPromises = [
      get().fetchPopular(Math.ceil(get().popularImages.length / 48) + 1),
      get().fetchLatest(Math.ceil(get().latestImages.length / 48) + 1),
    ];

    // Preload more recommendations
    if (get().recommendedAesthetics.length < 24) {
      preloadPromises.push(get().fetchRecommendedAesthetics());
    }
    if (get().recentPopular.length < 24) {
      preloadPromises.push(get().fetchRecentPopular());
    }
    if (get().likedDiscovery.length < 24) {
      preloadPromises.push(get().fetchLikedDiscovery());
    }
    if (get().continueExploring.length < 24) {
      preloadPromises.push(get().fetchContinueExploring());
    }

    // Execute preloads silently (no loading states)
    Promise.allSettled(preloadPromises).catch((e) =>
      console.log(
        "[GalleryStore] Background preload completed with some failures:",
        e,
      ),
    );
  },

  // ─── Image Management ───────────────────────────────────────────

  saveImage: async (image) => {
    try {
      if (
        "contentType" in image &&
        image.contentType &&
        image.contentType !== "gallery" &&
        image.contentType !== "album"
      ) {
        toast.warning(
          "Only gallery or album images can be saved into Collections.",
        );
        return;
      }

      const db = getDb();
      const id = image.id;
      const tags = Array.isArray(image.tags) ? image.tags.join(",") : "";
      const imageUrl = (image as any).imageUrl || (image as any).coverUrl || "";
      const previewUrl =
        (image as any).previewUrl || (image as any).coverUrl || "";
      const source = image.source || "unknown";

      await db.execute(
        `INSERT OR IGNORE INTO GalleryImages (
          id, imageUrl, previewUrl, tags, source, rating,
          generalTags, characterTags, copyrightTags, artistTags, metaTags
        ) VALUES (?, ?, ?, ?, ?, 'safe', ?, ?, ?, ?, ?)`,
        [
          id, imageUrl, previewUrl, tags, source,
          JSON.stringify(image.generalTags || []),
          JSON.stringify(image.characterTags || []),
          JSON.stringify(image.copyrightTags || []),
          JSON.stringify(image.artistTags || []),
          JSON.stringify(image.metaTags || [])
        ],
      );

      get().trackInteraction(tags.split(","));
      await get().loadFromDb();
    } catch (e) {
      console.error("[GalleryStore] saveImage failed:", e);
    }
  },

  unsaveImage: async (id) => {
    const db = getDb();
    await db.execute("DELETE FROM GalleryImages WHERE id = ?", [id]);
    await get().loadFromDb();
  },

  likeImage: async (id) => {
    const db = getDb();
    await db.execute("UPDATE GalleryImages SET liked = 1 WHERE id = ?", [id]);
    const img = get().savedImages.find((i) => i.id === id);
    if (img) get().trackInteraction(img.tags);
    await get().loadFromDb();
  },

  unlikeImage: async (id) => {
    const db = getDb();
    await db.execute("UPDATE GalleryImages SET liked = 0 WHERE id = ?", [id]);
    await get().loadFromDb();
  },

  addToFolder: async (imageId, folderId) => {
    const db = getDb();
    await db.execute("UPDATE GalleryImages SET folderId = ? WHERE id = ?", [
      folderId,
      imageId,
    ]);
    await db.execute(
      "UPDATE GalleryFolders SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [folderId],
    );
    await get().loadFromDb();
  },

  removeFromFolder: async (imageId) => {
    const db = getDb();
    await db.execute("UPDATE GalleryImages SET folderId = NULL WHERE id = ?", [
      imageId,
    ]);
    await get().loadFromDb();
  },

  // ─── Folder Management ─────────────────────────────────────────

  createFolder: async (name, description) => {
    const db = getDb();
    const id = crypto.randomUUID();
    await db.execute(
      "INSERT INTO GalleryFolders (id, name, description) VALUES (?, ?, ?)",
      [id, name, description || ""],
    );
    await get().loadFolders();
  },

  deleteFolder: async (id) => {
    const db = getDb();
    await db.execute(
      "UPDATE GalleryImages SET folderId = NULL WHERE folderId = ?",
      [id],
    );
    await db.execute("DELETE FROM GalleryFolders WHERE id = ?", [id]);
    await get().loadFromDb();
  },

  renameFolder: async (id, name) => {
    const db = getDb();
    await db.execute(
      "UPDATE GalleryFolders SET name = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [name, id],
    );
    await get().loadFolders();
  },

  togglePinFolder: async (id) => {
    const db = getDb();
    const folder = get().folders.find((f) => f.id === id);
    if (!folder) return;
    await db.execute("UPDATE GalleryFolders SET pinned = ? WHERE id = ?", [
      folder.pinned ? 0 : 1,
      id,
    ]);
    await get().loadFolders();
  },

  // ─── Tag Management ────────────────────────────────────────────

  favoriteTag: async (tag) => {
    const db = getDb();
    await db.execute(
      "INSERT OR REPLACE INTO FavoriteTags (tag, usageCount) VALUES (?, COALESCE((SELECT usageCount FROM FavoriteTags WHERE tag = ?), 0) + 1)",
      [tag, tag],
    );
    await get().loadFavoriteTags();
  },

  unfavoriteTag: async (tag) => {
    const db = getDb();
    await db.execute("DELETE FROM FavoriteTags WHERE tag = ?", [tag]);
    await get().loadFavoriteTags();
  },

  clearFavoriteTags: async () => {
    const db = getDb();
    await db.execute("DELETE FROM FavoriteTags");
    await db.execute("DELETE FROM UserInterests WHERE type IN ('dominant_tag', 'supporting_tag', 'artist', 'character', 'series')");
    await get().loadFavoriteTags();
  },

  blockTag: async (tag) => {
    const db = getDb();
    const cleanTag = tag.toLowerCase().trim();
    const current = get().blockedTags;
    if (current.includes(cleanTag)) return;
    
    const newTags = [...current, cleanTag];
    await db.execute(
      "INSERT OR REPLACE INTO GallerySettings (key, value) VALUES (?, ?)",
      ["blockedTags", JSON.stringify(newTags)]
    );
    set({ blockedTags: newTags });
  },

  unblockTag: async (tag) => {
    const db = getDb();
    const cleanTag = tag.toLowerCase().trim();
    const current = get().blockedTags;
    if (!current.includes(cleanTag)) return;

    const newTags = current.filter(t => t !== cleanTag);
    await db.execute(
      "INSERT OR REPLACE INTO GallerySettings (key, value) VALUES (?, ?)",
      ["blockedTags", JSON.stringify(newTags)]
    );
    set({ blockedTags: newTags });
  },

  clearBlockedTags: async () => {
    const db = getDb();
    await db.execute(
      "INSERT OR REPLACE INTO GallerySettings (key, value) VALUES (?, ?)",
      ["blockedTags", JSON.stringify([])]
    );
    set({ blockedTags: [] });
  },

  toggleTagState: async (tag, type = 'supporting_tag') => {
    const { favoriteTags, blockedTags, favoriteTag, unfavoriteTag, blockTag, unblockTag } = get();
    const cleanTag = tag.toLowerCase().trim();
    
    if (favoriteTags.includes(cleanTag)) {
      // 1st -> 2nd state: un-favorite, block
      await unfavoriteTag(cleanTag);
      try {
        const db = getDb();
        await db.execute("DELETE FROM UserInterests WHERE name = ?", [cleanTag]);
      } catch (error) {
        console.warn('[GalleryStore] Failed to remove the previous interest state:', error);
      }
      await blockTag(cleanTag);
    } else if (blockedTags.includes(cleanTag)) {
      // 2nd -> 3rd state: un-block
      await unblockTag(cleanTag);
    } else {
      // 0th -> 1st state: favorite
      await favoriteTag(cleanTag);
      try {
        const db = getDb();
        await db.execute(
          "INSERT INTO UserInterests (id, type, name, score, isPinned) VALUES (?, ?, ?, 100, 0)",
          [crypto.randomUUID(), type, cleanTag]
        );
      } catch (error) {
        console.warn('[GalleryStore] Failed to persist the new interest state:', error);
      }
    }
  },

  // ─── History / Interaction ──────────────────────────────────────
  
  clearViewHistory: async () => {
    const db = getDb();
    await db.execute("DELETE FROM GalleryHistory");
    set({ viewHistory: [] });
  },

  logInteraction: async (imageId, tag, action) => {
    try {
      const db = getDb();
      await db.execute(
        "INSERT INTO GalleryHistory (imageId, tag, action) VALUES (?, ?, ?)",
        [imageId, tag, action],
      );
    } catch (e) {
      console.error("[GalleryStore] logInteraction failed:", e);
    }
  },

  trackInteraction: (tags) =>
    set((state) => ({
      viewHistory: Array.from(
        new Set([...tags.slice(0, 5), ...state.viewHistory]),
      ).slice(0, 100),
    })),

  // ─── Slideshows ────────────────────────────────────────────────

  createSlideshow: async (name, tags, folderId) => {
    const db = getDb();
    const id = crypto.randomUUID();
    await db.execute(
      "INSERT INTO Slideshows (id, name, tags, folderId) VALUES (?, ?, ?, ?)",
      [id, name, tags || "", folderId || null],
    );
    await get().loadSlideshows();
  },

  deleteSlideshow: async (id) => {
    const db = getDb();
    await db.execute("DELETE FROM Slideshows WHERE id = ?", [id]);
    await get().loadSlideshows();
  },

  startSlideshow: async (id) => {
    const slideshow = get().slideshows.find((s) => s.id === id);
    if (!slideshow) return;
    let images = get().savedImages;
    if (slideshow.folderId)
      images = images.filter((i) => i.folderId === slideshow.folderId);
    if (slideshow.tags) {
      const tagList = slideshow.tags
        .split(",")
        .map((t) => t.trim().toLowerCase());
      images = images.filter((i) =>
        i.tags.some((t) => tagList.includes(t.toLowerCase())),
      );
    }
    if (slideshow.shuffle) images = [...images].sort(() => Math.random() - 0.5);
    set({
      activeSlideshowId: id,
      slideshowImages: images,
      slideshowIndex: 0,
      isSlideshowPlaying: true,
    });
  },

  startSlideshowFromContext: (images, startIndex = 0, contextId = "dynamic") => {
    const galleryImages: GalleryImage[] = images.map((img) => {
      if ("imageUrl" in img) return img as GalleryImage;
      const res = img as any;
      return {
        id: res.id,
        imageUrl: res.imageUrl || res.coverUrl || "",
        previewUrl: res.previewUrl || res.coverUrl || "",
        tags: res.tags || [],
        source: res.source || "unknown",
        rating: "safe",
        savedAt: new Date().toISOString(),
        liked: false,
      } as GalleryImage;
    });
    set({
      activeSlideshowId: contextId,
      slideshowImages: galleryImages,
      slideshowIndex: startIndex,
      isSlideshowPlaying: true,
    });
  },

  stopSlideshow: () => {
    const { activeSlideshowId, slideshowIndex, lastSlideshowPosition } = get();
    if (activeSlideshowId) {
      set({
        lastSlideshowPosition: {
          ...lastSlideshowPosition,
          [activeSlideshowId]: slideshowIndex,
        },
      });
    }
    set({
      activeSlideshowId: null,
      slideshowImages: [],
      slideshowIndex: 0,
      isSlideshowPlaying: false,
    });
  },
  nextSlide: () => {
    let shouldFetchPicks = false;
    let shouldFetchSearch = false;
    let newSlideshowImages: GalleryImage[] | null = null;
    let nextIdx = 0;

    set((state) => {
      nextIdx = state.slideshowIndex + 1;
      let newImages = state.slideshowImages;

      if (state.slideshowRandom) {
        nextIdx = Math.floor(Math.random() * newImages.length);
      } else if (nextIdx >= newImages.length) {
        nextIdx = state.slideshowRepeat ? 0 : newImages.length - 1;
        if (!state.slideshowRepeat && state.isSlideshowPlaying) {
          // Auto-stop if reached end and no repeat
          return { isSlideshowPlaying: false, slideshowIndex: newImages.length - 1 };
        }
      }

      // Memory Management: Keep sliding window
      if (newImages.length > 200 && nextIdx > 150) {
        newImages = newImages.slice(100);
        nextIdx -= 100;
        newSlideshowImages = newImages;
      }

      // Pre-fetch pagination
      if (!state.slideshowRandom && newImages.length - nextIdx <= 5) {
        if (state.activeSlideshowId === "search" && !state.isSearching) {
          shouldFetchSearch = true;
        } else if (state.activeSlideshowId === "picks" && !state.isLoadingPicks) {
          shouldFetchPicks = true;
        }
      }

      return { 
        slideshowIndex: nextIdx,
        ...(newSlideshowImages ? { slideshowImages: newSlideshowImages } : {})
      };
    });

    if (shouldFetchSearch) {
      const state = get();
      state.searchByTags(state.searchQuery, state.currentSearchPage + 1);
    }
    if (shouldFetchPicks) {
      const state = get();
      const nextPage = Math.floor(state.picksForYou.length / 48) + 1;
      state.generatePicksForYou(nextPage);
    }
  },
  prevSlide: () =>
    set((state) => {
      let prevIdx = state.slideshowIndex - 1;
      if (prevIdx < 0) {
        prevIdx = state.slideshowRepeat ? state.slideshowImages.length - 1 : 0;
      }
      return { slideshowIndex: prevIdx };
    }),
  toggleSlideshowShuffle: () =>
    set((state) => {
      const nextShuffle = !state.slideshowShuffle;
      let newImages = [...state.slideshowImages];
      if (nextShuffle) {
        newImages = newImages.sort(() => Math.random() - 0.5);
      } else {
        // In a real app, we might want to restore original order, but for now just toggle state
      }
      return { slideshowShuffle: nextShuffle, slideshowImages: newImages };
    }),
  toggleSlideshowRepeat: () =>
    set((state) => ({ slideshowRepeat: !state.slideshowRepeat })),
  toggleSlideshowRandom: () =>
    set((state) => ({ slideshowRandom: !state.slideshowRandom })),
  setSlideshowHudVisible: (visible) => set({ slideshowHudVisible: visible }),
  setSlideshowIndex: (index) => set({ slideshowIndex: index }),

  generateSmartCollections: () => {
    const { savedImages, userSmartCollections } = get();
    
    // Filter out adult content if setting is disabled
    const { showAdultContent } = useSettingsStore.getState();
    const filteredImages = showAdultContent 
      ? savedImages 
      : savedImages.filter(img => !ContentFilter.isAdult(img));
    
    // 1. Process User-Defined Smart Collections (Highest Priority)
    const manualSmart: SmartCollection[] = userSmartCollections.map(usc => {
      const matchingImages = filteredImages.filter(img => {
        const imgTags = [
          ...(img.tags || []),
          ...(img.generalTags || []),
          ...(img.characterTags || []),
          ...(img.artistTags || []),
          ...(img.copyrightTags || []),
          ...(img.metaTags || []),
        ].map(t => t.toLowerCase().trim());
        // Match ALL tags in the collection (AND-style)
        return usc.tags.every(tag => imgTags.includes(tag.toLowerCase().trim()));
      });
      
      return {
        tag: usc.name,
        count: matchingImages.length,
        images: matchingImages,
        isManual: true,
        id: usc.id
      };
    });

    // 2. Process Auto-Generated Clusters
    const tagCounts: Record<string, { count: number; images: GalleryImage[] }> = {};
    
    filteredImages.forEach(img => {
      const allTags = [
        ...(img.tags || []),
        ...(img.generalTags || []),
        ...(img.characterTags || []),
        ...(img.artistTags || []),
        ...(img.copyrightTags || []),
        ...(img.metaTags || []),
      ];
      allTags.forEach(tag => {
        const normalized = tag.toLowerCase().trim();
        if (normalized.length < 3) return;
        if (!tagCounts[normalized]) {
          tagCounts[normalized] = { count: 0, images: [] };
        }
        if (!tagCounts[normalized].images.some(i => i.id === img.id)) {
          tagCounts[normalized].count++;
          tagCounts[normalized].images.push(img);
        }
      });
    });

    const threshold = Math.max(3, Math.floor(filteredImages.length * 0.03));
    const autoSmart = Object.entries(tagCounts)
      .map(([tag, data]) => ({ tag, ...data }))
      .filter(item => item.count >= threshold)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // 3. Merge (Manual first, then Auto)
    // Filter out auto-generated tags that are already covered by manual collections with the same name
    const manualNames = new Set(manualSmart.map(m => m.tag.toLowerCase()));
    const finalAuto = autoSmart.filter(a => !manualNames.has(a.tag.toLowerCase()));

    set({ smartCollections: [...manualSmart, ...finalAuto] });
  },

  loadUserSmartCollections: async () => {
    try {
      const db = getDb();
      const rows = await db.select<any[]>("SELECT * FROM UserSmartCollections");
      const mapped: UserSmartCollection[] = rows.map(r => ({
        ...r,
        tags: JSON.parse(r.tags),
        pinned: !!r.pinned
      }));
      set({ userSmartCollections: mapped });
      get().generateSmartCollections();
    } catch (e) {
      console.warn("[GalleryStore] UserSmartCollections not ready:", e);
    }
  },

  createUserSmartCollection: async (name, tags) => {
    const db = getDb();
    const id = crypto.randomUUID();
    await db.execute(
      "INSERT INTO UserSmartCollections (id, name, tags) VALUES (?, ?, ?)",
      [id, name, JSON.stringify(tags)]
    );
    await get().loadUserSmartCollections();
    toast.success(`Created "${name}" collection`);
  },

  deleteUserSmartCollection: async (id) => {
    const db = getDb();
    await db.execute("DELETE FROM UserSmartCollections WHERE id = ?", [id]);
    await get().loadUserSmartCollections();
    toast.success("Collection deleted");
  },

  togglePinUserSmartCollection: async (id) => {
    const coll = get().userSmartCollections.find(c => c.id === id);
    if (!coll) return;
    const db = getDb();
    await db.execute(
      "UPDATE UserSmartCollections SET pinned = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [!coll.pinned ? 1 : 0, id]
    );
    await get().loadUserSmartCollections();
  },

  updateUserSmartCollection: async (id, name, tags) => {
    const db = getDb();
    await db.execute(
      "UPDATE UserSmartCollections SET name = ?, tags = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [name, JSON.stringify(tags), id]
    );
    await get().loadUserSmartCollections();
    toast.success("Collection updated");
  },

  addLocalFolder: async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Image Folder",
      });

      if (selected && typeof selected === "string") {
        const db = getDb();
        const id = crypto.randomUUID();
        const name = selected.split(/[\\/]/).pop() || "Local Folder";
        
        // Add to LocalFolders tracker
        await db.execute(
          "INSERT INTO LocalFolders (id, path, name) VALUES (?, ?, ?)",
          [id, selected, name]
        );

        // Also create a GalleryFolder so it's fully integrated
        await db.execute(
          "INSERT INTO GalleryFolders (id, name, description) VALUES (?, ?, ?)",
          [id, name, `Local: ${selected}`]
        );

        toast.success(`Scanning ${name}...`);

        try {
          const { readDir } = await import("@tauri-apps/plugin-fs");
          const { convertFileSrc } = await import("@tauri-apps/api/core");
          
          const entries = await readDir(selected);
          const imageEntries = entries.filter(e => e.isFile && /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(e.name));
          
          for (const entry of imageEntries) {
            const imgId = crypto.randomUUID();
            const fullPath = `${selected}/${entry.name}`;
            const fileSrc = convertFileSrc(fullPath);
            
            await db.execute(
              "INSERT INTO GalleryImages (id, imageUrl, previewUrl, tags, source, rating, liked, folderId, savedAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)",
              [imgId, fileSrc, fileSrc, "local", "local", "safe", id]
            );
          }
          toast.success(`Imported ${imageEntries.length} images from ${name}`);
        } catch (scanErr) {
          console.error("[GalleryStore] Folder scan failed:", scanErr);
          toast.error("Failed to read folder contents");
        }

        await get().loadFromDb();
      }
    } catch (e) {
      console.error("[GalleryStore] addLocalFolder failed:", e);
    }
  },

  removeLocalFolder: async (id) => {
    const db = getDb();
    await db.execute("DELETE FROM LocalFolders WHERE id = ?", [id]);
    // Also remove the associated gallery folder and its images
    await db.execute("DELETE FROM GalleryImages WHERE folderId = ?", [id]);
    await db.execute("DELETE FROM GalleryFolders WHERE id = ?", [id]);
    await get().loadFromDb();
  },

  loadLocalFolders: async () => {
    try {
      const db = getDb();
      const folders = await db.select<any[]>("SELECT * FROM LocalFolders");
      set({ localFolders: folders });
    } catch (e) {
      console.warn("[GalleryStore] LocalFolders table not ready:", e);
    }
  },

  // ─── Image Viewer ──────────────────────────────────────────────

  openViewer: async (image, context = [], index = 0) => {
    if ((image.source === "e-hentai" || (image as any).provider === "e-hentai") && image.contentCategory !== "image_set") {
      const { useModalStore } = await import("./useModalStore");
      useModalStore.getState().openQuickView({
        ...image,
        mediaDomain: "manga",
        contentType: image.contentCategory || "doujin",
      });
      return;
    }

    set({ viewerImage: image, viewerContext: context, viewerIndex: index });
    const tags = Array.isArray(image.tags) ? image.tags : [];
    get().trackInteraction(tags);
  },

  closeViewer: () =>
    set({ viewerImage: null, viewerContext: [], viewerIndex: 0 }),
  viewerNext: () => {
    const { viewerIndex, viewerContext } = get();
    if (viewerIndex < viewerContext.length - 1) {
      const nextIdx = viewerIndex + 1;
      set({ viewerIndex: nextIdx, viewerImage: viewerContext[nextIdx] });
      const tags = Array.isArray(viewerContext[nextIdx].tags)
        ? viewerContext[nextIdx].tags
        : [];
      get().trackInteraction(tags as string[]);
    }
  },
  viewerPrev: () => {
    const { viewerIndex, viewerContext } = get();
    if (viewerIndex > 0) {
      const prevIdx = viewerIndex - 1;
      set({ viewerIndex: prevIdx, viewerImage: viewerContext[prevIdx] });
      const tags = Array.isArray(viewerContext[prevIdx].tags)
        ? viewerContext[prevIdx].tags
        : [];
      get().trackInteraction(tags as string[]);
    }
  },
}), {
  name: "gallery-store-cache",
  partialize: (state) => ({
    popularImages: state.popularImages,
    latestImages: state.latestImages,
    randomVisions: state.randomVisions,
    picksForYou: state.picksForYou,
    recommendedAesthetics: state.recommendedAesthetics,
    recentPopular: state.recentPopular,
    likedDiscovery: state.likedDiscovery,
    continueExploring: state.continueExploring,
  }),
}));
