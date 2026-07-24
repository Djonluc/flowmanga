import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UpdateInfo } from '../services/AppVersionService';
import { DEFAULT_FOR_YOU_PROFILES, type ForYouProfile, type ForYouProfileTagType } from '../image-platform/forYouProfiles';

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
export type ForYouQualityMode = "broad" | "strict" | "themed";

export interface BooruAuth {
  apiKey?: string;
  userId?: string;
  sessionCookies?: string;
  localStorage?: Record<string, string>;
  artistTagApiUrl?: string;
  artistTagKeyPath?: string;
  artistTypeValue?: string;
}

export interface ProviderRuntimePolicy {
  minRequestIntervalMs: number;
  maxRetries: number;
  scheduleEnabled: boolean;
  activeFromHour: number;
  activeToHour: number;
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

  // Discord Rich Presence
  discordRichPresenceEnabled: boolean;
  discordShareMangaTitle: boolean;
  discordShareReadingProgress: boolean;
  discordShowElapsedTime: boolean;
  setDiscordRichPresenceEnabled: (enabled: boolean) => void;
  setDiscordShareMangaTitle: (enabled: boolean) => void;
  setDiscordShareReadingProgress: (enabled: boolean) => void;
  setDiscordShowElapsedTime: (enabled: boolean) => void;

  // Image Processing
  brightness: number;
  contrast: number;
  saturation: number;
  autoCrop: boolean;

  autoScrollSpeed: number; // pixels per frame/second
  isAutoScrolling: boolean;
  accentColor: string;
  isInitializing: boolean;

  setBrightness: (val: number) => void;
  setContrast: (val: number) => void;
  setSaturation: (val: number) => void;
  toggleAutoCrop: () => void;
  setAutoScrollSpeed: (speed: number) => void;
  toggleAutoScrolling: () => void;
  setAccentColor: (color: string) => void;
  setInitializing: (init: boolean) => void;

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
  imageDownloadPath: string | null;
  firstRunComplete: boolean;
  isLocationModalOpen: boolean;
  isSafetyCheckModalOpen: boolean;
  safetyCheckTitle: string;
  onSafetyCheckResolved:
    | ((action: "update" | "redownload") => void)
    | undefined;
  setLibraryPath: (path: string) => void;
  setDownloadPath: (path: string) => void;
  setImageDownloadPath: (path: string) => void;
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
  
  recommendationMode: "dynamic" | "strict_favorites" | "strict_interests";
  setRecommendationMode: (mode: "dynamic" | "strict_favorites" | "strict_interests") => void;

  forYouQualityMode: ForYouQualityMode;
  setForYouQualityMode: (mode: ForYouQualityMode) => void;

  forYouProfiles: ForYouProfile[];
  activeForYouProfileId: string | null;
  setActiveForYouProfile: (profileId: string | null) => void;
  updateForYouProfile: (profileId: string, changes: Partial<ForYouProfile>) => void;
  addForYouProfileTag: (profileId: string, type: ForYouProfileTagType, tag: string) => void;
  removeForYouProfileTag: (profileId: string, type: ForYouProfileTagType, tag: string) => void;
  toggleForYouProfileRequiredTag: (profileId: string, type: 'core' | 'supporting' | 'artist' | 'character' | 'series', tag: string) => void;
  suppressedFavoriteSupportTags: string[];
  suppressFavoriteSupportTag: (tag: string) => void;
  restoreFavoriteSupportTag: (tag: string) => void;

  strictForYouMode: boolean;
  setStrictForYouMode: (strict: boolean) => void;
  
  coloredOnly: boolean;
  toggleColoredOnly: () => void;
  setColoredOnly: (val: boolean) => void;

  globalMediaFilter: 'all' | 'image' | 'video' | 'gif';
  setGlobalMediaFilter: (filter: 'all' | 'image' | 'video' | 'gif') => void;

  booruAuth: Record<string, BooruAuth>;
  setBooruAuth: (providerId: string, auth: BooruAuth) => void;

  networkProxy: string;
  setNetworkProxy: (proxyUrl: string) => void;

  // Source Toggles
  disabledSources: string[];
  toggleSource: (sourceId: string) => void;
  isSourceEnabled: (sourceId: string) => boolean;
  providerPolicies: Record<string, ProviderRuntimePolicy>;
  setProviderPolicy: (sourceId: string, policy: Partial<ProviderRuntimePolicy>) => void;

  // App Version / Updates
  updateInfo: UpdateInfo | null;
  updateStatus: 'idle' | 'checking' | 'available' | 'up-to-date' | 'error';
  setUpdateInfo: (info: UpdateInfo | null) => void;
  setUpdateStatus: (status: 'idle' | 'checking' | 'available' | 'up-to-date' | 'error') => void;
}


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
          const requested = !isFull;
          await appWindow.setFullscreen(requested);

          // Installed WebView2 windows can report the resize before Windows
          // finishes switching out of the taskbar work area. Confirm the
          // native state instead of hiding the title bar optimistically.
          await new Promise(resolve => setTimeout(resolve, 120));
          let confirmed = await appWindow.isFullscreen();
          if (confirmed !== requested) {
            console.warn(`[Settings] Fullscreen transition was not accepted; retrying requested=${requested}.`);
            await appWindow.setFullscreen(requested);
            await new Promise(resolve => setTimeout(resolve, 180));
            confirmed = await appWindow.isFullscreen();
          }

          if (confirmed) await appWindow.setFocus();
          set({ isFullscreen: confirmed });
          window.dispatchEvent(new Event('resize'));
          console.info(`[Settings] Fullscreen requested=${requested} confirmed=${confirmed} viewport=${window.innerWidth}x${window.innerHeight}`);
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

      recommendationMode: "dynamic",
      setRecommendationMode: (mode) => set({ recommendationMode: mode }),

      forYouQualityMode: "broad",
      setForYouQualityMode: (mode) => set({
        forYouQualityMode: mode,
        // Keep the older persisted flag synchronized for existing callers.
        strictForYouMode: mode !== "broad",
      }),

      forYouProfiles: DEFAULT_FOR_YOU_PROFILES,
      activeForYouProfileId: null,
      setActiveForYouProfile: (profileId) => set({ activeForYouProfileId: profileId }),
      suppressedFavoriteSupportTags: [],
      suppressFavoriteSupportTag: (tag) => set((state) => ({
        suppressedFavoriteSupportTags: Array.from(new Set([
          ...state.suppressedFavoriteSupportTags,
          tag.trim().toLowerCase(),
        ].filter(Boolean))),
      })),
      restoreFavoriteSupportTag: (tag) => set((state) => ({
        suppressedFavoriteSupportTags: state.suppressedFavoriteSupportTags.filter(item => item !== tag.trim().toLowerCase()),
      })),
      updateForYouProfile: (profileId, changes) => set((state) => ({
        forYouProfiles: state.forYouProfiles.map(profile =>
          profile.id === profileId ? { ...profile, ...changes } : profile
        ),
      })),
      addForYouProfileTag: (profileId, type, tag) => set((state) => ({
        forYouProfiles: state.forYouProfiles.map(profile => {
          if (profile.id !== profileId) return profile;
          const key = type === 'core'
            ? 'coreTags'
            : type === 'supporting'
              ? 'supportingTags'
              : type === 'excluded'
                ? 'excludedTags'
                : type === 'artist'
                  ? 'artistTags'
                  : type === 'character'
                    ? 'characterTags'
                    : 'seriesTags';
          const cleanTag = tag.trim().toLowerCase();
          const current = (profile[key] || []) as string[];
          if (!cleanTag || current.includes(cleanTag)) return profile;
          return { ...profile, [key]: [...current, cleanTag] };
        }),
      })),
      removeForYouProfileTag: (profileId, type, tag) => set((state) => ({
        forYouProfiles: state.forYouProfiles.map(profile => {
          if (profile.id !== profileId) return profile;
          const key = type === 'core'
            ? 'coreTags'
            : type === 'supporting'
              ? 'supportingTags'
              : type === 'excluded'
                ? 'excludedTags'
                : type === 'artist'
                  ? 'artistTags'
                  : type === 'character'
                    ? 'characterTags'
                    : 'seriesTags';
          const adultKey = type === 'core'
            ? 'adultCoreTags'
            : type === 'supporting'
              ? 'adultSupportingTags'
              : type === 'excluded'
                ? 'adultExcludedTags'
                : undefined;
          const requiredKey = type === 'core'
            ? 'requiredCoreTags'
            : type === 'supporting'
              ? 'requiredSupportingTags'
              : type === 'artist'
                ? 'requiredArtistTags'
                : type === 'character'
                  ? 'requiredCharacterTags'
                  : type === 'series'
                    ? 'requiredSeriesTags'
                    : undefined;
          const adultRequiredKey = type === 'core'
            ? 'adultRequiredCoreTags'
            : type === 'supporting'
              ? 'adultRequiredSupportingTags'
              : type === 'artist'
                ? 'adultRequiredArtistTags'
                : type === 'character'
                  ? 'adultRequiredCharacterTags'
                  : type === 'series'
                    ? 'adultRequiredSeriesTags'
                    : undefined;
          return {
            ...profile,
            [key]: ((profile[key] || []) as string[]).filter(item => item !== tag),
            ...(adultKey ? { [adultKey]: profile[adultKey]?.filter(item => item !== tag) } : {}),
            ...(requiredKey ? { [requiredKey]: profile[requiredKey]?.filter(item => item !== tag) } : {}),
            ...(adultRequiredKey ? { [adultRequiredKey]: profile[adultRequiredKey]?.filter(item => item !== tag) } : {}),
          };
        }),
      })),
      toggleForYouProfileRequiredTag: (profileId, type, tag) => set((state) => ({
        forYouProfiles: state.forYouProfiles.map(profile => {
          if (profile.id !== profileId) return profile;
          const key = type === 'core'
            ? 'coreTags'
            : type === 'supporting'
              ? 'supportingTags'
              : type === 'artist'
                ? 'artistTags'
                : type === 'character'
                  ? 'characterTags'
                  : 'seriesTags';
          const requiredKey = type === 'core'
            ? 'requiredCoreTags'
            : type === 'supporting'
              ? 'requiredSupportingTags'
              : type === 'artist'
                ? 'requiredArtistTags'
                : type === 'character'
                  ? 'requiredCharacterTags'
                  : 'requiredSeriesTags';
          const tags = ((profile[key] || []) as string[]);
          const required = ((profile[requiredKey] || []) as string[]);
          if (!tags.includes(tag)) return profile;
          return {
            ...profile,
            [requiredKey]: required.includes(tag)
              ? required.filter(item => item !== tag)
              : [...required, tag],
          };
        }),
      })),

      strictForYouMode: false,
      setStrictForYouMode: (strict) => set({
        strictForYouMode: strict,
        forYouQualityMode: strict ? "strict" : "broad",
      }),

      isScreenshotMode: false,
      toggleScreenshotMode: () =>
        set((state) => ({ isScreenshotMode: !state.isScreenshotMode })),

      windowWidth: null,
      windowHeight: null,
      setWindowSize: (w, h) => set({ windowWidth: w, windowHeight: h }),

      // Discord Rich Presence is opt-in because activity is visible to other
      // Discord users. The developer-owned application identity is bundled.
      discordRichPresenceEnabled: false,
      discordShareMangaTitle: true,
      discordShareReadingProgress: true,
      discordShowElapsedTime: true,
      setDiscordRichPresenceEnabled: (enabled) => set({ discordRichPresenceEnabled: enabled }),
      setDiscordShareMangaTitle: (enabled) => set({ discordShareMangaTitle: enabled }),
      setDiscordShareReadingProgress: (enabled) => set({ discordShareReadingProgress: enabled }),
      setDiscordShowElapsedTime: (enabled) => set({ discordShowElapsedTime: enabled }),

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
      imageDownloadPath: null,
      firstRunComplete: false,
      setLibraryPath: (path) => set({ libraryPath: path }),
      setDownloadPath: (path) => set({ downloadPath: path }),
      setImageDownloadPath: (path) => set({ imageDownloadPath: path }),
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
      setSafetyCheckModal: (
        open,
        title = "",
        callback?: (action: "update" | "redownload") => void,
      ) =>
        set({
          isSafetyCheckModalOpen: open,
          safetyCheckTitle: title,
          onSafetyCheckResolved: callback,
        }),

      availableSounds: [],
      loadAvailableSounds: async () => {},
      importSound: async () => {},

      // Download Concurrency Defaults
      maxConcurrentJobs: 2,
      maxConcurrentChapters: 3,
      maxConcurrentPages: 3,
      setMaxConcurrentJobs: (val) => set({ maxConcurrentJobs: val }),
      setMaxConcurrentChapters: (val) => set({ maxConcurrentChapters: val }),
      setMaxConcurrentPages: (val) => set({ maxConcurrentPages: val }),

      // Content Filtering
      networkProxy: "",
      setNetworkProxy: (proxyUrl) => set({ networkProxy: proxyUrl }),
      
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

      globalMediaFilter: 'all',
      setGlobalMediaFilter: (filter) => set({ globalMediaFilter: filter }),

      booruAuth: {},
      setBooruAuth: (providerId, auth) => 
        set((state) => ({
          booruAuth: {
            ...state.booruAuth,
            [providerId]: auth
          }
        })),

      // Source Toggles — LuaComic disabled by default (currently broken)
      disabledSources: ['luacomic'],
      toggleSource: (sourceId) =>
        set((state) => {
          const disabled = [...state.disabledSources];
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
          import("./useGalleryStore").then(({ useGalleryStore }) => {
            useGalleryStore.getState().setContentFilter(state.showAdultContent ? "all" : "sfw");
          });
          return { disabledSources: disabled };
        }),
      isSourceEnabled: (sourceId) => {
        const state = useSettingsStore.getState();
        return !state.disabledSources.includes(sourceId);
      },
      providerPolicies: {},
      setProviderPolicy: (sourceId, policy) => set(state => ({
        providerPolicies: {
          ...state.providerPolicies,
          [sourceId]: {
            minRequestIntervalMs: 0,
            maxRetries: 3,
            scheduleEnabled: false,
            activeFromHour: 0,
            activeToHour: 24,
            ...state.providerPolicies[sourceId],
            ...policy,
          },
        },
      })),

      // App Version / Updates
      updateInfo: null,
      updateStatus: 'idle',
      setUpdateInfo: (info) => set({ updateInfo: info, updateStatus: info?.isNewer ? 'available' : 'up-to-date' }),
      setUpdateStatus: (status) => set({ updateStatus: status }),
    }),
    {
      name: "flowmanga-settings",
      merge: (persisted, current) => {
        const {
          discordApplicationId: legacyDiscordApplicationId,
          ...restored
        } = persisted as Partial<SettingsState> & { discordApplicationId?: unknown };
        void legacyDiscordApplicationId;
        const savedProfiles = Array.isArray(restored.forYouProfiles) ? restored.forYouProfiles : [];
        const savedIds = new Set(savedProfiles.map(profile => profile.id));
        const defaultsById = new Map(DEFAULT_FOR_YOU_PROFILES.map(profile => [profile.id, profile]));
        const upgradedProfiles = savedProfiles.map(profile => {
          const defaults = defaultsById.get(profile.id);
          return defaults
            ? {
                ...defaults,
                ...profile,
                adultCoreTags: profile.adultCoreTags ?? defaults.adultCoreTags,
                adultSupportingTags: profile.adultSupportingTags ?? defaults.adultSupportingTags,
                adultExcludedTags: profile.adultExcludedTags ?? defaults.adultExcludedTags,
              }
            : profile;
        });
        return {
          ...current,
          ...restored,
          forYouProfiles: [
            ...upgradedProfiles,
            ...DEFAULT_FOR_YOU_PROFILES.filter(profile => !savedIds.has(profile.id)),
          ],
        };
      },
      partialize: (state) => {
        const { isInitializing, isSettingsOpen, isDownloadPanelOpen, updateInfo, updateStatus, ...rest } = state;
        void isInitializing;
        void isSettingsOpen;
        void isDownloadPanelOpen;
        void updateInfo;
        void updateStatus;
        return rest;
      },
    },
  ),
);
