import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReadingMode =
  | "vertical"
  | "single"
  | "dual"
  | "slideshow"
  | "horizontal";
export type Theme = "dark" | "light" | "oled" | "paper" | "amethyst";
export type AmbientMode =
  | "solid"
  | "blurred-page"
  | "blurred-cover"
  | "gradient"
  | "oled"
  | "adaptive-vibrant";
export type SidebarMode = "expanded" | "collapsed" | "hover";

export interface BooruAuth {
  apiKey?: string;
  userId?: string;
}

interface SettingsState {
  theme: Theme;
  readingMode: ReadingMode;
  readingDirection: "ltr" | "rtl";
  gapSize: number;
  slideshowInterval: number;
  slideshowTransition: "fade" | "slide" | "none";
  fitMode: "width" | "height" | "original" | "smart";
  zoomScale: number; // Global zoom preference
  sidebarOpen: boolean;
  activeView: "home" | "library" | "stats" | "videos" | "history" | "discover";
  setActiveView: (
    view: "home" | "library" | "stats" | "videos" | "history" | "discover",
  ) => void;

  libraryViewMode: "grid" | "shelf";
  libraryDensity: "compact" | "comfortable" | "cinematic";
  setLibraryViewMode: (mode: "grid" | "shelf") => void;
  setLibraryDensity: (density: "compact" | "comfortable" | "cinematic") => void;
  toggleLibraryViewMode: () => void;

  isFullscreen: boolean;
  setFullscreenState: (full: boolean) => void;
  toggleFullScreenAction: () => void;

  setTheme: (theme: Theme) => void;
  setReadingMode: (mode: ReadingMode) => void;
  setReadingDirection: (dir: "ltr" | "rtl") => void;
  setGapSize: (size: number) => void;
  setSlideshowInterval: (ms: number) => void;
  setSlideshowTransition: (type: "fade" | "slide" | "none") => void;
  setFitMode: (mode: "width" | "height" | "original" | "smart") => void;
  setZoomScale: (scale: number) => void;
  toggleSidebar: () => void;
  sidebarMode: SidebarMode;
  setSidebarMode: (mode: SidebarMode) => void;

  ambientVolume: number; // 0 to 1
  setAmbientVolume: (volume: number) => void;

  isHudVisible: boolean;
  toggleHud: () => void;
  setHudVisibility: (visible: boolean) => void;

  isShortcutsOpen: boolean;
  toggleShortcuts: () => void;

  isSettingsOpen: boolean;
  toggleSettings: () => void;
  isDownloadPanelOpen: boolean;
  toggleDownloadPanel: () => void;

  isScreenshotMode: boolean;
  toggleScreenshotMode: () => void;

  windowWidth: number | null;
  windowHeight: number | null;
  setWindowSize: (w: number, h: number) => void;

  // Image Processing
  brightness: number;
  contrast: number;
  saturation: number;
  autoCrop: boolean;

  autoScrollSpeed: number; // pixels per frame/second
  isAutoScrolling: boolean;
  accentColor: string;
  isInitializing: boolean;
  selectedAmbientSound: string;

  setBrightness: (val: number) => void;
  setContrast: (val: number) => void;
  setSaturation: (val: number) => void;
  toggleAutoCrop: () => void;
  setAutoScrollSpeed: (speed: number) => void;
  toggleAutoScrolling: () => void;
  setAccentColor: (color: string) => void;
  setInitializing: (init: boolean) => void;
  setSelectedAmbientSound: (sound: string) => void;

  // Ambient Background
  ambientMode: AmbientMode;
  ambientIntensity: number; // Opacity of the effect (0-1)
  ambientBlur: number; // Blur radius in px
  ambientBrightness: number; // 0-2 (1 is neutral)
  showAmbientNoise: boolean;

  setAmbientMode: (mode: AmbientMode) => void;
  setAmbientIntensity: (val: number) => void;
  setAmbientBlur: (val: number) => void;
  setAmbientBrightness: (val: number) => void;
  setAmbientNoise: (show: boolean) => void;

  ambientImage: string | null;
  setAmbientImage: (img: string | null) => void;

  libraryPath: string | null;
  downloadPath: string | null;
  firstRunComplete: boolean;
  isLocationModalOpen: boolean;
  isSafetyCheckModalOpen: boolean;
  safetyCheckTitle: string;
  onSafetyCheckResolved:
    | ((action: "update" | "redownload") => void)
    | undefined;
  setLibraryPath: (path: string) => void;
  setDownloadPath: (path: string) => void;
  setFirstRunComplete: (done: boolean) => void;
  getRecommendedPath: () => Promise<string>;
  setLocationModalOpen: (open: boolean) => void;
  setSafetyCheckModal: (
    open: boolean,
    title?: string,
    callback?: (action: "update" | "redownload") => void,
  ) => void;

  availableSounds: { name: string; path: string }[];
  loadAvailableSounds: () => Promise<void>;
  importSound: (path: string) => Promise<void>;

  // Download Concurrency
  maxConcurrentJobs: number;
  maxConcurrentChapters: number;
  maxConcurrentPages: number;
  setMaxConcurrentJobs: (val: number) => void;
  setMaxConcurrentChapters: (val: number) => void;
  setMaxConcurrentPages: (val: number) => void;

  // Content Filtering
  showAdultContent: boolean;
  setShowAdultContent: (show: boolean) => void;
  excludedTags: string[];
  setExcludedTags: (tags: string[]) => void;
  
  coloredOnly: boolean;
  toggleColoredOnly: () => void;
  setColoredOnly: (val: boolean) => void;

  booruAuth: Record<string, BooruAuth>;
  setBooruAuth: (providerId: string, auth: BooruAuth) => void;

  // Manga Source Toggles
  disabledMangaSources: string[];
  toggleMangaSource: (sourceId: string) => void;
  isMangaSourceEnabled: (sourceId: string) => boolean;
}

const BUILTIN_SOUNDS = [
  { name: 'Lo-fi Beats', path: 'https://stream.zeno.fm/0r0xa792kwzuv' },
  { name: 'Rainfall', path: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg' },
  { name: 'Quiet Cafe', path: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
  { name: 'Celestial Wind', path: 'https://actions.google.com/sounds/v1/weather/wind_blowing.ogg' },
  { name: 'Deep Space', path: 'https://actions.google.com/sounds/v1/science_fiction/space_station_ambience.ogg' },
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      readingMode: "vertical",
      readingDirection: "ltr",
      gapSize: 0,
      slideshowInterval: 3000,
      slideshowTransition: "fade",
      fitMode: "width",
      zoomScale: 1,
      activeView: "home",
      setActiveView: (view) => set({ activeView: view }),

      libraryViewMode: "grid",
      libraryDensity: "comfortable",
      setLibraryViewMode: (mode) => set({ libraryViewMode: mode }),
      setLibraryDensity: (density) => set({ libraryDensity: density }),
      toggleLibraryViewMode: () =>
        set((state) => ({
          libraryViewMode: state.libraryViewMode === "grid" ? "shelf" : "grid",
        })),

      isFullscreen: false,
      setFullscreenState: (f) => set({ isFullscreen: f }),
      toggleFullScreenAction: async () => {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const appWindow = getCurrentWindow();
          const isFull = await appWindow.isFullscreen();
          await appWindow.setFullscreen(!isFull);
          set({ isFullscreen: !isFull });
        } catch (err) {
          console.error("[Settings] Failed to toggle fullscreen:", err);
        }
      },

      sidebarOpen: true,
      sidebarMode: "expanded",
      setSidebarMode: (mode) => set({ sidebarMode: mode }),

      setTheme: (theme) => set({ theme }),
      setReadingMode: (mode) => set({ readingMode: mode }),
      setReadingDirection: (dir) => set({ readingDirection: dir }),
      setGapSize: (size) => set({ gapSize: size }),
      setSlideshowInterval: (ms) => set({ slideshowInterval: ms }),
      setSlideshowTransition: (type) => set({ slideshowTransition: type }),
      setFitMode: (mode) => set({ fitMode: mode }),
      setZoomScale: (scale) => set({ zoomScale: scale }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      ambientVolume: 0.2,
      setAmbientVolume: (volume) => set({ ambientVolume: volume }),

      isHudVisible: true,
      toggleHud: () => set((state) => ({ isHudVisible: !state.isHudVisible })),
      setHudVisibility: (visible) => set({ isHudVisible: visible }),

      isShortcutsOpen: false,
      toggleShortcuts: () =>
        set((state) => ({ isShortcutsOpen: !state.isShortcutsOpen })),

      isSettingsOpen: false,
      toggleSettings: () =>
        set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
      isDownloadPanelOpen: false,
      toggleDownloadPanel: () =>
        set((state) => ({ isDownloadPanelOpen: !state.isDownloadPanelOpen })),

      isScreenshotMode: false,
      toggleScreenshotMode: () =>
        set((state) => ({ isScreenshotMode: !state.isScreenshotMode })),

      windowWidth: null,
      windowHeight: null,
      setWindowSize: (w, h) => set({ windowWidth: w, windowHeight: h }),

      // Image Processing
      brightness: 1,
      contrast: 1,
      saturation: 1,
      autoCrop: false,

      setBrightness: (b) => set({ brightness: b }),
      setContrast: (c) => set({ contrast: c }),
      setSaturation: (s) => set({ saturation: s }),
      toggleAutoCrop: () => set((state) => ({ autoCrop: !state.autoCrop })),

      autoScrollSpeed: 2, // Default speed
      isAutoScrolling: false,
      accentColor: "#3b82f6", // Default blue-500
      isInitializing: true,
      setAutoScrollSpeed: (speed) => set({ autoScrollSpeed: speed }),
      toggleAutoScrolling: () =>
        set((state) => ({ isAutoScrolling: !state.isAutoScrolling })),
      setAccentColor: (color) => set({ accentColor: color }),
      setInitializing: (init) => set({ isInitializing: init }),
      selectedAmbientSound: BUILTIN_SOUNDS[0].path, // Default to first builtin instead of 'none' or 'lofi'
      setSelectedAmbientSound: (sound) => set({ selectedAmbientSound: sound }),

      // Ambient Defaults
      ambientMode: "blurred-page",
      ambientIntensity: 0.5,
      ambientBlur: 60,
      ambientBrightness: 0.4,
      showAmbientNoise: true,

      setAmbientMode: (mode) => set({ ambientMode: mode }),
      setAmbientIntensity: (val) => set({ ambientIntensity: val }),
      setAmbientBlur: (val) => set({ ambientBlur: val }),
      setAmbientBrightness: (val) => set({ ambientBrightness: val }),
      setAmbientNoise: (show) => set({ showAmbientNoise: show }),

      // Dynamic Ambient Source
      ambientImage: null,
      setAmbientImage: (img) => set({ ambientImage: img }),

      // Library Persistence
      libraryPath: null,
      downloadPath: null,
      firstRunComplete: false,
      setLibraryPath: (path) => set({ libraryPath: path }),
      setDownloadPath: (path) => set({ downloadPath: path }),
      setFirstRunComplete: (done) => set({ firstRunComplete: done }),
      getRecommendedPath: async () => {
        const { documentDir, join } = await import("@tauri-apps/api/path");
        const docs = await documentDir();
        return await join(docs, "FlowManga");
      },
      isLocationModalOpen: false,
      setLocationModalOpen: (open) => set({ isLocationModalOpen: open }),
      isSafetyCheckModalOpen: false,
      safetyCheckTitle: "",
      onSafetyCheckResolved: undefined,
      setSafetyCheckModal: (open, title = "", callback = undefined) =>
        set({
          isSafetyCheckModalOpen: open,
          safetyCheckTitle: title,
          onSafetyCheckResolved: callback,
        }),

      availableSounds: BUILTIN_SOUNDS,
      loadAvailableSounds: async () => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const customSounds = await invoke<any[]>("list_ambient_sounds");
          
          set((state) => {
              const all = [...BUILTIN_SOUNDS];
              customSounds.forEach(cs => {
                  if (!all.find(a => a.path === cs.path)) all.push(cs);
              });
              return { availableSounds: all };
          });
        } catch (err) {
          console.error("[Settings] Failed to load ambient sounds:", err);
        }
      },
      importSound: async (path: string) => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("import_ambient_sound", { path });
          // Refresh the list
          const customSounds = await invoke<any[]>("list_ambient_sounds");
          set((state) => {
              const all = [...BUILTIN_SOUNDS];
              customSounds.forEach(cs => {
                  if (!all.find(a => a.path === cs.path)) all.push(cs);
              });
              return { availableSounds: all };
          });
        } catch (err) {
          console.error("[Settings] Failed to import ambient sound:", err);
          throw err;
        }
      },

      // Download Concurrency Defaults
      maxConcurrentJobs: 2,
      maxConcurrentChapters: 3,
      maxConcurrentPages: 3,
      setMaxConcurrentJobs: (val) => set({ maxConcurrentJobs: val }),
      setMaxConcurrentChapters: (val) => set({ maxConcurrentChapters: val }),
      setMaxConcurrentPages: (val) => set({ maxConcurrentPages: val }),

      // Content Filtering
      showAdultContent: false,
      setShowAdultContent: (show) => {
        set({ showAdultContent: show });
        // Invalidate all discovery caches to prevent stale NSFW content leakage
        import("../services/DiscoveryService").then(({ DiscoveryService }) => {
          DiscoveryService.clearAllCache();
        });
      },
      excludedTags: [
        'bestiality',
        'scat',
        'zoophilia',
        'coprophagia',
        'coprophilia',
        'watersports',
        'golden shower',
        'feces',
        'urine',
      ],
      setExcludedTags: (tags) => set({ excludedTags: tags }),
      
      coloredOnly: true,
      toggleColoredOnly: () => set((state) => ({ coloredOnly: !state.coloredOnly })),
      setColoredOnly: (val) => set({ coloredOnly: val }),

      booruAuth: {},
      setBooruAuth: (providerId, auth) => 
        set((state) => ({
          booruAuth: {
            ...state.booruAuth,
            [providerId]: auth
          }
        })),

      // Manga Source Toggles — LuaComic disabled by default (currently broken)
      disabledMangaSources: ['luacomic'],
      toggleMangaSource: (sourceId) =>
        set((state) => {
          const disabled = [...state.disabledMangaSources];
          const idx = disabled.indexOf(sourceId);
          if (idx >= 0) {
            disabled.splice(idx, 1);
          } else {
            disabled.push(sourceId);
          }
          // Clear discovery cache when sources change
          import("../services/DiscoveryService").then(({ DiscoveryService }) => {
            DiscoveryService.clearAllCache();
          });
          return { disabledMangaSources: disabled };
        }),
      isMangaSourceEnabled: (sourceId) => {
        const state = useSettingsStore.getState();
        return !state.disabledMangaSources.includes(sourceId);
      },
    }),
    {
      name: "flowmanga-settings",
      partialize: (state) => {
        const { isInitializing, isSettingsOpen, isDownloadPanelOpen, ...rest } = state;
        return rest;
      },
    },
  ),
);
