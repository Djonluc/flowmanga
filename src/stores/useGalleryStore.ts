/**
 * useGalleryStore
 *
 * Central state management for the Gallery Ecosystem.
 */

import { create } from 'zustand';
import { getDb } from '../services/db';
import { ZerochanProvider } from '../services/sources/gallery/ZerochanProvider';
import { DanbooruProvider } from '../services/sources/gallery/DanbooruProvider';
import type { SourceSearchResult, SourceSearchOptions } from '../services/sources/types';
import type { SourceProvider } from '../services/sources/types';

// ─── Types ───────────────────────────────────────────────────────────

export interface GalleryImage {
  id: string;
  imageUrl: string;
  previewUrl?: string;
  tags: string[];
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
  zerochanId?: number;
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

export type GalleryTab = 'trending' | 'discover' | 'picks' | 'wallpapers' | 'collections' | 'slideshows' | 'following' | 'search';

// ─── Cold Start Data ────────────────────────────────────────────────

const CURATED_AESTHETICS = [
  'Cyberpunk', 'Fantasy', 'Vocaloid', 'Sunset', 'Neon',
  'Dark Aesthetic', 'Pastel', 'Rain', 'Cherry Blossoms', 'Space',
  'Samurai', 'Gothic', 'Steampunk', 'Ocean'
];

const AESTHETIC_COMBOS = [
  ['Cyberpunk', 'Rain'],
  ['Fantasy', 'Moonlight'],
  ['Gothic', 'Neon'],
  ['Sunset', 'Anime City'],
  ['Dark Fantasy', 'Glowing Eyes'],
  ['Cyberpunk', 'Neon'],
  ['Fantasy', 'Forest'],
  ['Vocaloid', 'Stage'],
  ['Samurai', 'Snow'],
  ['Ocean', 'Underwater']
];

// ─── Provider Registry ──────────────────────────────────────────────

const PROVIDERS: Record<string, SourceProvider> = {
  zerochan: new ZerochanProvider(),
  danbooru: new DanbooruProvider()
};

function getProvider(id: string = 'zerochan'): SourceProvider {
  return PROVIDERS[id] || PROVIDERS.zerochan;
}


// ─── Store ───────────────────────────────────────────────────────────

interface GalleryState {
  // Persisted Data
  savedImages: GalleryImage[];
  folders: GalleryFolder[];
  favoriteTags: string[];
  slideshows: Slideshow[];

  // Discovery Feeds
  trendingImages: SourceSearchResult[];
  popularImages: SourceSearchResult[];
  latestImages: SourceSearchResult[];
  randomVisions: SourceSearchResult[];
  picksForYou: SourceSearchResult[];
  recommendedAesthetics: SourceSearchResult[];
  recentPopular: SourceSearchResult[];
  likedDiscovery: SourceSearchResult[];
  continueExploring: SourceSearchResult[];
  wallpaperImages: SourceSearchResult[];

  // Search
  searchQuery: string;
  searchResults: SourceSearchResult[];
  searchSuggestions: string[];

  // UI State
  activeTab: GalleryTab;
  activeProvider: string;
  isLoadingTrending: boolean;
  isLoadingPopular: boolean;
  isLoadingLatest: boolean;
  isLoadingRandom: boolean;
  isLoadingPicks: boolean;
  isLoadingRecommended: boolean;
  isLoadingRecentPopular: boolean;
  isLoadingLikedDiscovery: boolean;
  isLoadingContinueExploring: boolean;
  isLoadingWallpapers: boolean;
  isSearching: boolean;
  isLoadingFolders: boolean;
  downloadPath: string | null;
  contentFilter: 'sfw' | 'all';
  isHudPinned: boolean;
  viewHistory: string[]; 

  // Slideshow Playback
  activeSlideshowId: string | null;
  slideshowImages: GalleryImage[];
  slideshowIndex: number;
  isSlideshowPlaying: boolean;

  // Image Viewer
  viewerImage: (GalleryImage | SourceSearchResult) | null;
  viewerContext: (GalleryImage | SourceSearchResult)[];
  viewerIndex: number;

  // Actions — UI
  setActiveTab: (tab: GalleryTab) => void;
  setActiveProvider: (provider: string) => void;
  setSearchQuery: (query: string) => void;
  setDownloadPath: (path: string) => void;
  setContentFilter: (filter: 'sfw' | 'all') => void;
  toggleHudPin: () => void;

  // Actions — Data Loading
  loadFromDb: () => Promise<void>;
  loadFolders: () => Promise<void>;
  loadFavoriteTags: () => Promise<void>;
  loadSlideshows: () => Promise<void>;

  // Actions — Discovery
  fetchTrending: (page?: number) => Promise<void>;
  fetchPopular: (page?: number) => Promise<void>;
  fetchLatest: (page?: number) => Promise<void>;
  fetchRandomVisions: () => Promise<void>;
  fetchWallpapers: (page?: number) => Promise<void>;
  generatePicksForYou: () => Promise<void>;
  fetchRecommendedAesthetics: () => Promise<void>;
  fetchRecentPopular: () => Promise<void>;
  fetchLikedDiscovery: () => Promise<void>;
  fetchContinueExploring: () => Promise<void>;
  
  fetchAllDiscovery: () => Promise<void>;
  searchByTags: (query: string) => Promise<void>;
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

  // Actions — History / Interactions
  logInteraction: (imageId: string | null, tag: string | null, action: string) => Promise<void>;
  trackInteraction: (tags: string[]) => void;

  // Actions — Slideshows
  createSlideshow: (name: string, tags?: string, folderId?: string) => Promise<void>;
  deleteSlideshow: (id: string) => Promise<void>;
  startSlideshow: (id: string) => Promise<void>;
  startSlideshowFromContext: (images: (GalleryImage | SourceSearchResult)[], startIndex?: number) => void;
  stopSlideshow: () => void;
  nextSlide: () => void;
  prevSlide: () => void;

  // Actions — Image Viewer
  openViewer: (image: GalleryImage | SourceSearchResult, context?: (GalleryImage | SourceSearchResult)[], index?: number) => Promise<void>;
  closeViewer: () => void;
  viewerNext: () => void;
  viewerPrev: () => void;
}

export const useGalleryStore = create<GalleryState>((set, get) => ({
  // ─── Initial State ───────────────────────────────────────────────

  savedImages: [],
  folders: [],
  favoriteTags: [],
  slideshows: [],

  trendingImages: [],
  popularImages: [],
  latestImages: [],
  randomVisions: [],
  picksForYou: [],
  recommendedAesthetics: [],
  recentPopular: [],
  likedDiscovery: [],
  continueExploring: [],
  wallpaperImages: [],

  searchQuery: '',
  searchResults: [],
  searchSuggestions: [],

  activeTab: 'trending',
  activeProvider: 'zerochan',
  isLoadingTrending: false,
  isLoadingPopular: false,
  isLoadingLatest: false,
  isLoadingRandom: false,
  isLoadingPicks: false,
  isLoadingRecommended: false,
  isLoadingRecentPopular: false,
  isLoadingLikedDiscovery: false,
  isLoadingContinueExploring: false,
  isLoadingWallpapers: false,
  isSearching: false,
  isLoadingFolders: false,
  downloadPath: null,
  contentFilter: 'sfw',
  isHudPinned: false,
  viewHistory: [],


  activeSlideshowId: null,
  slideshowImages: [],
  slideshowIndex: 0,
  isSlideshowPlaying: false,

  viewerImage: null,
  viewerContext: [],
  viewerIndex: 0,

  // ─── UI Actions ──────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveProvider: (provider) => set({ activeProvider: provider }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDownloadPath: async (path: string) => {
    try {
      const db = getDb();
      await db.execute('INSERT OR REPLACE INTO GallerySettings (key, value) VALUES (?, ?)', ['downloadPath', path]);
      set({ downloadPath: path });
    } catch (e) {
      console.error('[GalleryStore] Failed to save downloadPath:', e);
    }
  },
  setContentFilter: async (filter: 'sfw' | 'all') => {
    try {
      const db = getDb();
      await db.execute('INSERT OR REPLACE INTO GallerySettings (key, value) VALUES (?, ?)', ['contentFilter', filter]);
      set({ contentFilter: filter });
      await get().fetchAllDiscovery();
    } catch (e) {
      console.error('[GalleryStore] Failed to save contentFilter:', e);
    }
  },
  toggleHudPin: () => set((state) => ({ isHudPinned: !state.isHudPinned })),

  // ─── Data Loading ────────────────────────────────────────────────

  loadFromDb: async () => {
    try {
      const db = getDb();
      
      // 1. Load Saved Images
      const rows = await db.select<any[]>('SELECT * FROM GalleryImages ORDER BY savedAt DESC');
      const savedImages: GalleryImage[] = rows.map(r => ({
        id: r.id,
        imageUrl: r.imageUrl,
        previewUrl: r.previewUrl,
        tags: r.tags ? r.tags.split(',').filter((t: string) => t) : [],
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
        zerochanId: r.zerochanId,
      }));
      set({ savedImages });

      // 2. Load Settings (Gracefully)
      try {
        const settingsRows = await db.select<any[]>('SELECT * FROM GallerySettings');
        const settings = new Map(settingsRows.map(r => [r.key, r.value]));
        
        if (settings.has('downloadPath')) set({ downloadPath: settings.get('downloadPath') });
        if (settings.has('contentFilter')) set({ contentFilter: settings.get('contentFilter') as any });
      } catch (settingsError) {
        console.warn('[GalleryStore] GallerySettings table not ready or empty:', settingsError);
      }

      // 3. Load Related Data
      await Promise.all([
        get().loadFolders(),
        get().loadFavoriteTags(),
        get().loadSlideshows()
      ]);
    } catch (e) {
      console.error('[GalleryStore] loadFromDb critical failure:', e);
    }
  },


  loadFolders: async () => {
    try {
      const db = getDb();
      const rows = await db.select<any[]>('SELECT * FROM GalleryFolders ORDER BY pinned DESC, updatedAt DESC');
      const counts = await db.select<any[]>(
        'SELECT folderId, COUNT(*) as cnt FROM GalleryImages WHERE folderId IS NOT NULL GROUP BY folderId'
      );
      const countMap = new Map(counts.map(c => [c.folderId, c.cnt]));

      const folders: GalleryFolder[] = rows.map(r => ({
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
      console.error('[GalleryStore] loadFolders failed:', e);
    }
  },

  loadFavoriteTags: async () => {
    try {
      const db = getDb();
      const rows = await db.select<any[]>('SELECT tag FROM FavoriteTags ORDER BY usageCount DESC');
      set({ favoriteTags: rows.map(r => r.tag) });
    } catch (e) {
      console.error('[GalleryStore] loadFavoriteTags failed:', e);
    }
  },

  loadSlideshows: async () => {
    try {
      const db = getDb();
      const rows = await db.select<any[]>('SELECT * FROM Slideshows ORDER BY createdAt DESC');
      const slideshows: Slideshow[] = rows.map(r => ({
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
      console.error('[GalleryStore] loadSlideshows failed:', e);
    }
  },

  // ─── Discovery ──────────────────────────────────────────────────

  fetchAllDiscovery: async () => {
    // Parallel load with independent error handling
    const tasks = [
      get().fetchTrending(),
      get().fetchPopular(),
      get().fetchLatest(),
      get().fetchRandomVisions(),
      get().generatePicksForYou(),
      get().fetchRecommendedAesthetics(),
      get().fetchRecentPopular(),
      get().fetchLikedDiscovery(),
      get().fetchContinueExploring(),
      get().fetchWallpapers()
    ];
    
    await Promise.allSettled(tasks);
  },


  fetchTrending: async (page = 1) => {
    if (get().isLoadingTrending) return;
    set({ isLoadingTrending: true });
    try {
      const provider = getProvider(get().activeProvider);
      const results = await provider.getTrending({ page, limit: 24, contentFilter: get().contentFilter });
      if (page === 1) set({ trendingImages: results });
      else set({ trendingImages: [...get().trendingImages, ...results] });
    } catch (e) {
      console.error('[GalleryStore] Failed to fetch trending:', e);
    } finally {
      set({ isLoadingTrending: false });
    }
  },

  fetchPopular: async (page = 1) => {
    if (get().isLoadingPopular) return;
    set({ isLoadingPopular: true });
    try {
      const provider = getProvider(get().activeProvider);
      const results = await provider.search('masterpiece highres', { page, limit: 24, contentFilter: get().contentFilter });
      if (page === 1) set({ popularImages: results });
      else set({ popularImages: [...get().popularImages, ...results] });
    } catch (e) {
      console.error('[GalleryStore] Failed to fetch popular:', e);
    } finally {
      set({ isLoadingPopular: false });
    }
  },

  fetchLatest: async (page = 1) => {
    if (get().isLoadingLatest) return;
    set({ isLoadingLatest: true });
    try {
      const provider = getProvider(get().activeProvider);
      const results = await provider.getLatest({ page, limit: 24, contentFilter: get().contentFilter });
      if (page === 1) set({ latestImages: results });
      else set({ latestImages: [...get().latestImages, ...results] });
    } catch (e) {
      console.error('[GalleryStore] Failed to fetch latest:', e);
    } finally {
      set({ isLoadingLatest: false });
    }
  },

  fetchRandomVisions: async () => {
    if (get().isLoadingRandom) return;
    set({ isLoadingRandom: true });
    try {
      const provider = getProvider(get().activeProvider);
      const combo = AESTHETIC_COMBOS[Math.floor(Math.random() * AESTHETIC_COMBOS.length)];
      const results = await provider.search(combo.join(' '), { limit: 12, contentFilter: get().contentFilter });
      set({ randomVisions: results });
    } catch (e) {
      console.error('[GalleryStore] Failed to fetch random visions:', e);
    } finally {
      set({ isLoadingRandom: false });
    }
  },

  fetchWallpapers: async (page = 1) => {
    if (get().isLoadingWallpapers) return;
    set({ isLoadingWallpapers: true });
    try {
      const provider = getProvider(get().activeProvider);
      const results = await provider.search('Wallpaper', { page, limit: 24, contentFilter: get().contentFilter });
      if (page === 1) set({ wallpaperImages: results });
      else set({ wallpaperImages: [...get().wallpaperImages, ...results] });
    } catch (e) {
      console.error('[GalleryStore] Failed to fetch wallpapers:', e);
    } finally {
      set({ isLoadingWallpapers: false });
    }
  },

  generatePicksForYou: async () => {
    if (get().isLoadingPicks) return;
    set({ isLoadingPicks: true });
    try {
      const { viewHistory, favoriteTags, savedImages, contentFilter } = get();
      const hasHistory = viewHistory.length > 0 || favoriteTags.length > 0 || savedImages.some(i => i.liked);
      const provider = getProvider(get().activeProvider);

      let results: SourceSearchResult[] = [];
      
      if (!hasHistory) {
        // Multi-aesthetic blend for new users
        const aesthetics = [...CURATED_AESTHETICS].sort(() => 0.5 - Math.random()).slice(0, 2);
        results = await provider.search(aesthetics.join(' '), { limit: 24, contentFilter });
      } else {
        const seeds = Array.from(new Set([...viewHistory.slice(0, 3), ...favoriteTags.slice(0, 2)]));
        results = await provider.search(seeds.join(' '), { limit: 24, contentFilter });
      }

      // Fallback if search was too specific or failed
      if (results.length === 0) {
        const fallbackAesthetic = CURATED_AESTHETICS[Math.floor(Math.random() * CURATED_AESTHETICS.length)];
        results = await provider.search(fallbackAesthetic, { limit: 24, contentFilter });
      }

      set({ picksForYou: results });
    } catch (e) {
      console.error('[GalleryStore] Failed to refresh picks:', e);
    } finally {
      set({ isLoadingPicks: false });
    }
  },


  fetchRecommendedAesthetics: async () => {
    if (get().isLoadingRecommended) return;
    set({ isLoadingRecommended: true });
    try {
      const provider = getProvider(get().activeProvider);
      const randomAesthetic = CURATED_AESTHETICS[Math.floor(Math.random() * CURATED_AESTHETICS.length)];
      const results = await provider.search(randomAesthetic, { limit: 12, contentFilter: get().contentFilter });
      set({ recommendedAesthetics: results });
    } catch (e) {
      console.error('[GalleryStore] Failed to fetch recommended aesthetics:', e);
    } finally {
      set({ isLoadingRecommended: false });
    }
  },

  fetchRecentPopular: async () => {
    if (get().isLoadingRecentPopular) return;
    set({ isLoadingRecentPopular: true });
    try {
      const provider = getProvider(get().activeProvider);
      const results = await provider.getTrending({ limit: 12, contentFilter: get().contentFilter });
      set({ recentPopular: results });
    } catch (e) {
      console.error('[GalleryStore] Failed to fetch recent popular:', e);
    } finally {
      set({ isLoadingRecentPopular: false });
    }
  },

  fetchLikedDiscovery: async () => {
    if (get().isLoadingLikedDiscovery) return;
    set({ isLoadingLikedDiscovery: true });
    const liked = get().savedImages.filter(i => i.liked);
    if (liked.length === 0) {
      set({ isLoadingLikedDiscovery: false });
      return;
    }
    try {
      const provider = getProvider(get().activeProvider);
      const randomLiked = liked[Math.floor(Math.random() * liked.length)];
      const seeds = randomLiked.tags.slice(0, 3).join(' ');
      const results = await provider.search(seeds, { limit: 12, contentFilter: get().contentFilter });
      set({ likedDiscovery: results });
    } catch (e) {
      console.error('[GalleryStore] Failed to fetch liked discovery:', e);
    } finally {
      set({ isLoadingLikedDiscovery: false });
    }
  },

  fetchContinueExploring: async () => {
    if (get().isLoadingContinueExploring) return;
    set({ isLoadingContinueExploring: true });
    const history = get().viewHistory;
    if (history.length === 0) {
      set({ isLoadingContinueExploring: false });
      return;
    }
    try {
      const provider = getProvider(get().activeProvider);
      const lastTag = history[0];
      const results = await provider.search(lastTag, { limit: 12, contentFilter: get().contentFilter });
      set({ continueExploring: results });
    } catch (e) {
      console.error('[GalleryStore] Failed to fetch continue exploring:', e);
    } finally {
      set({ isLoadingContinueExploring: false });
    }
  },

  searchByTags: async (query) => {
    if (!query.trim()) return;
    set({ isSearching: true, searchQuery: query });
    try {
      const provider = getProvider(get().activeProvider);
      const results = await provider.search(query, { limit: 48, contentFilter: get().contentFilter });
      set({ searchResults: results });
      get().trackInteraction(query.split(' '));
    } catch (e) {
      console.error('[GalleryStore] Search failed:', e);
    } finally {
      set({ isSearching: false });
    }
  },

  fetchSuggestions: async (query) => {
    if (!query || query.length < 2) return;
    try {
      const provider = getProvider(get().activeProvider);
      const suggestions = await provider.getAutocomplete(query);
      set({ searchSuggestions: suggestions });
    } catch (e) {
      console.error('[GalleryStore] Autocomplete failed:', e);
    }
  },

  // ─── Image Management ───────────────────────────────────────────

  saveImage: async (image) => {
    try {
      const db = getDb();
      const id = image.id;
      const tags = Array.isArray(image.tags) ? image.tags.join(',') : '';
      const imageUrl = (image as any).imageUrl || (image as any).coverUrl || '';
      const previewUrl = (image as any).previewUrl || (image as any).coverUrl || '';
      const source = image.source || 'zerochan';
      const zerochanId = (image as any).zerochanId || (image as any)._zerochanId;

      await db.execute(
        `INSERT OR IGNORE INTO GalleryImages (id, imageUrl, previewUrl, tags, source, rating, zerochanId) 
         VALUES (?, ?, ?, ?, ?, 'safe', ?)`,
        [id, imageUrl, previewUrl, tags, source, zerochanId]
      );

      get().trackInteraction(tags.split(','));
      await get().loadFromDb();
    } catch (e) {
      console.error('[GalleryStore] saveImage failed:', e);
    }
  },

  unsaveImage: async (id) => {
    const db = getDb();
    await db.execute('DELETE FROM GalleryImages WHERE id = ?', [id]);
    await get().loadFromDb();
  },

  likeImage: async (id) => {
    const db = getDb();
    await db.execute('UPDATE GalleryImages SET liked = 1 WHERE id = ?', [id]);
    const img = get().savedImages.find(i => i.id === id);
    if (img) get().trackInteraction(img.tags);
    await get().loadFromDb();
  },

  unlikeImage: async (id) => {
    const db = getDb();
    await db.execute('UPDATE GalleryImages SET liked = 0 WHERE id = ?', [id]);
    await get().loadFromDb();
  },

  addToFolder: async (imageId, folderId) => {
    const db = getDb();
    await db.execute('UPDATE GalleryImages SET folderId = ? WHERE id = ?', [folderId, imageId]);
    await db.execute('UPDATE GalleryFolders SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [folderId]);
    await get().loadFromDb();
  },

  removeFromFolder: async (imageId) => {
    const db = getDb();
    await db.execute('UPDATE GalleryImages SET folderId = NULL WHERE id = ?', [imageId]);
    await get().loadFromDb();
  },

  // ─── Folder Management ─────────────────────────────────────────

  createFolder: async (name, description) => {
    const db = getDb();
    const id = crypto.randomUUID();
    await db.execute('INSERT INTO GalleryFolders (id, name, description) VALUES (?, ?, ?)', [id, name, description || '']);
    await get().loadFolders();
  },

  deleteFolder: async (id) => {
    const db = getDb();
    await db.execute('UPDATE GalleryImages SET folderId = NULL WHERE folderId = ?', [id]);
    await db.execute('DELETE FROM GalleryFolders WHERE id = ?', [id]);
    await get().loadFromDb();
  },

  renameFolder: async (id, name) => {
    const db = getDb();
    await db.execute('UPDATE GalleryFolders SET name = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
    await get().loadFolders();
  },

  togglePinFolder: async (id) => {
    const db = getDb();
    const folder = get().folders.find(f => f.id === id);
    if (!folder) return;
    await db.execute('UPDATE GalleryFolders SET pinned = ? WHERE id = ?', [folder.pinned ? 0 : 1, id]);
    await get().loadFolders();
  },

  // ─── Tag Management ────────────────────────────────────────────

  favoriteTag: async (tag) => {
    const db = getDb();
    await db.execute('INSERT OR REPLACE INTO FavoriteTags (tag, usageCount) VALUES (?, COALESCE((SELECT usageCount FROM FavoriteTags WHERE tag = ?), 0) + 1)', [tag, tag]);
    await get().loadFavoriteTags();
  },

  unfavoriteTag: async (tag) => {
    const db = getDb();
    await db.execute('DELETE FROM FavoriteTags WHERE tag = ?', [tag]);
    await get().loadFavoriteTags();
  },

  // ─── History / Interaction ──────────────────────────────────────

  logInteraction: async (imageId, tag, action) => {
    try {
      const db = getDb();
      await db.execute('INSERT INTO GalleryHistory (imageId, tag, action) VALUES (?, ?, ?)', [imageId, tag, action]);
    } catch (e) {
      console.error('[GalleryStore] logInteraction failed:', e);
    }
  },

  trackInteraction: (tags) => set((state) => ({
    viewHistory: Array.from(new Set([...tags.slice(0, 5), ...state.viewHistory])).slice(0, 100)
  })),

  // ─── Slideshows ────────────────────────────────────────────────

  createSlideshow: async (name, tags, folderId) => {
    const db = getDb();
    const id = crypto.randomUUID();
    await db.execute('INSERT INTO Slideshows (id, name, tags, folderId) VALUES (?, ?, ?, ?)', [id, name, tags || '', folderId || null]);
    await get().loadSlideshows();
  },

  deleteSlideshow: async (id) => {
    const db = getDb();
    await db.execute('DELETE FROM Slideshows WHERE id = ?', [id]);
    await get().loadSlideshows();
  },

  startSlideshow: async (id) => {
    const slideshow = get().slideshows.find(s => s.id === id);
    if (!slideshow) return;
    let images = get().savedImages;
    if (slideshow.folderId) images = images.filter(i => i.folderId === slideshow.folderId);
    if (slideshow.tags) {
      const tagList = slideshow.tags.split(',').map(t => t.trim().toLowerCase());
      images = images.filter(i => i.tags.some(t => tagList.includes(t.toLowerCase())));
    }
    if (slideshow.shuffle) images = [...images].sort(() => Math.random() - 0.5);
    set({ activeSlideshowId: id, slideshowImages: images, slideshowIndex: 0, isSlideshowPlaying: true });
  },

  startSlideshowFromContext: (images, startIndex = 0) => {
    const galleryImages: GalleryImage[] = images.map(img => {
      if ('imageUrl' in img) return img as GalleryImage;
      const res = img as any;
      return {
        id: res.id,
        imageUrl: res.imageUrl || res.coverUrl || '',
        previewUrl: res.previewUrl || res.coverUrl || '',
        tags: res.tags || [],
        source: res.source || 'zerochan',
        rating: 'safe',
        savedAt: new Date().toISOString(),
        liked: false,
      } as GalleryImage;
    });
    set({ activeSlideshowId: 'dynamic', slideshowImages: galleryImages, slideshowIndex: startIndex, isSlideshowPlaying: true });
  },

  stopSlideshow: () => set({ activeSlideshowId: null, slideshowImages: [], slideshowIndex: 0, isSlideshowPlaying: false }),
  nextSlide: () => set((state) => ({ slideshowIndex: (state.slideshowIndex + 1) % state.slideshowImages.length })),
  prevSlide: () => set((state) => ({ slideshowIndex: (state.slideshowIndex - 1 + state.slideshowImages.length) % state.slideshowImages.length })),

  // ─── Image Viewer ──────────────────────────────────────────────

  openViewer: async (image, context = [], index = 0) => {
    set({ viewerImage: image, viewerContext: context, viewerIndex: index });
    const tags = Array.isArray(image.tags) ? image.tags : [];
    get().trackInteraction(tags);
  },

  closeViewer: () => set({ viewerImage: null, viewerContext: [], viewerIndex: 0 }),
  viewerNext: () => {
    const { viewerIndex, viewerContext } = get();
    if (viewerIndex < viewerContext.length - 1) {
      const nextIdx = viewerIndex + 1;
      set({ viewerIndex: nextIdx, viewerImage: viewerContext[nextIdx] });
      const tags = Array.isArray(viewerContext[nextIdx].tags) ? viewerContext[nextIdx].tags : [];
      get().trackInteraction(tags as string[]);
    }
  },
  viewerPrev: () => {
    const { viewerIndex, viewerContext } = get();
    if (viewerIndex > 0) {
      const prevIdx = viewerIndex - 1;
      set({ viewerIndex: prevIdx, viewerImage: viewerContext[prevIdx] });
      const tags = Array.isArray(viewerContext[prevIdx].tags) ? viewerContext[prevIdx].tags : [];
      get().trackInteraction(tags as string[]);
    }
  },
}));
