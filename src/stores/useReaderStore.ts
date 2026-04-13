import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettingsStore } from './useSettingsStore';

export type ReaderMode = 'vertical' | 'single' | 'slideshow';

interface SeriesSettings {
  speed: number;
  mode: ReaderMode;
  zoom: number;
  imageFit: ImageFit;
}

export type ImageFit = 'width' | 'height' | 'contain' | 'original' | 'stretch';

interface ReaderState {
  // Mode & Navigation
  mode: ReaderMode;
  currentPage: number;
  totalPages: number;
  
  // Auto-Scroll (Vertical)
  autoScroll: boolean;
  scrollSpeed: number; // pixels per second
  zoomLevel: number;
  imageFit: ImageFit;
  isBoosted: boolean;
  
  // Slideshow
  slideshowActive: boolean;
  
  // Per-series configuration memory
  seriesConfigs: Record<string, SeriesSettings>;

  // Actions
  setMode: (mode: ReaderMode) => void;
  setCurrentPage: (page: number) => void;
  setAutoScroll: (active: boolean) => void;
  setScrollSpeed: (speed: number) => void;
  setZoomLevel: (zoom: number) => void;
  setImageFit: (fit: ImageFit) => void;
  setSlideshowActive: (active: boolean) => void;
  setTotalPages: (total: number) => void;
  setIsBoosted: (boosted: boolean) => void;
  
  // Memory Management
  activeSeriesId: string | null;
  loadSeriesConfig: (seriesId: string) => void;
  saveSeriesConfig: (seriesId: string) => void;
  
  // HUD Feedback
  feedback: { type: 'speed' | 'mode' | 'zoom' | 'fit', value: string } | null;
  setFeedback: (feedback: { type: 'speed' | 'mode' | 'zoom' | 'fit', value: string } | null) => void;

  // Adaptive UI
  currentThemeColor: string;
  setCurrentThemeColor: (color: string) => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      mode: 'vertical',
      currentPage: 0,
      totalPages: 0,
      autoScroll: false,
      scrollSpeed: 40,
      zoomLevel: 100,
      imageFit: 'width',
      isBoosted: false,
      
      slideshowActive: false,
      
      seriesConfigs: {},
      activeSeriesId: null,
      feedback: null,
      
      currentThemeColor: '#000000',
      setCurrentThemeColor: (color: string) => set({ currentThemeColor: color }),

      setMode: (mode) => {
          useSettingsStore.getState().setReadingMode(mode as any);
          const defaultFit = mode === 'vertical' ? 'width' : 'contain';
          set({ 
              mode, 
              autoScroll: false, 
              slideshowActive: false,
              imageFit: defaultFit
          });
          const { activeSeriesId, saveSeriesConfig } = get();
          if (activeSeriesId) saveSeriesConfig(activeSeriesId);
          get().setFeedback({ type: 'mode', value: mode.toUpperCase() });
      },
      
      setCurrentPage: (currentPage) => set({ currentPage }),
      setAutoScroll: (autoScroll) => set({ autoScroll }),
      setScrollSpeed: (scrollSpeed) => {
          const s = Math.max(1, scrollSpeed);
          set({ scrollSpeed: s });
          const { activeSeriesId, saveSeriesConfig } = get();
          if (activeSeriesId) saveSeriesConfig(activeSeriesId);
          get().setFeedback({ type: 'speed', value: `${s}px/s` });
      },
      setZoomLevel: (zoomLevel) => {
          const z = Math.max(10, Math.min(500, zoomLevel));
          set({ zoomLevel: z });
          const { activeSeriesId, saveSeriesConfig } = get();
          if (activeSeriesId) saveSeriesConfig(activeSeriesId);
          get().setFeedback({ type: 'zoom', value: `${z}%` });
      },
      setImageFit: (imageFit) => {
          set({ imageFit });
          const { activeSeriesId, saveSeriesConfig } = get();
          if (activeSeriesId) saveSeriesConfig(activeSeriesId);
          get().setFeedback({ type: 'fit', value: imageFit.toUpperCase() });
      },
      setSlideshowActive: (slideshowActive) => set({ slideshowActive }),
      setTotalPages: (totalPages) => set({ totalPages }),
      setIsBoosted: (isBoosted) => set({ isBoosted }),

      setFeedback: (feedback) => {
          set({ feedback });
          // Auto-clear
          if (feedback) {
              setTimeout(() => {
                  if (get().feedback?.value === feedback.value) {
                      set({ feedback: null });
                  }
              }, 2000);
          }
      },

      loadSeriesConfig: (seriesId) => {
          const config = get().seriesConfigs[seriesId];
          set({ activeSeriesId: seriesId });
          if (config) {
              set({
                  mode: config.mode,
                  scrollSpeed: config.speed,
                  zoomLevel: config.zoom,
                  imageFit: config.imageFit || (config.mode === 'vertical' ? 'width' : 'contain'),
                  autoScroll: false
              });
          }
      },

      saveSeriesConfig: (seriesId) => {
          const { mode, scrollSpeed, zoomLevel, seriesConfigs } = get();
          set({
              seriesConfigs: {
                  ...seriesConfigs,
                  [seriesId]: {
                      mode,
                      speed: scrollSpeed,
                      zoom: zoomLevel,
                      imageFit: get().imageFit
                  }
              }
          });
      }
    }),
    {
      name: 'reader-storage',
    }
  )
);
