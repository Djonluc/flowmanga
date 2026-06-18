import { create } from "zustand";
import type { PlatformImage } from "./types";

interface SlideshowState {
  isActive: boolean;
  currentIndex: number;
  intervalMs: number;
  isPaused: boolean;
  shuffle: boolean;
  loop: boolean;
  images: PlatformImage[];
  onReachEnd?: () => void;
  
  // Actions
  start: (startIndex: number, images: PlatformImage[], onReachEnd?: () => void) => void;
  stop: () => void;
  togglePause: () => void;
  next: () => void;
  prev: () => void;
  setInterval: (ms: number) => void;
}

// A hidden image element used purely to force the browser to cache the next image
const preloadImage = (url: string) => {
  const img = new Image();
  img.src = url;
};

export const useSlideshowStore = create<SlideshowState>((set, get) => {
  let timerId: ReturnType<typeof setInterval> | null = null;

  const startTimer = () => {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      const { isPaused, next } = get();
      if (!isPaused) {
        next();
      }
    }, get().intervalMs);
  };

  const stopTimer = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  return {
    isActive: false,
    currentIndex: 0,
    intervalMs: 5000,
    isPaused: false,
    shuffle: false,
    loop: true,
    images: [],

    start: (startIndex = 0, images = [], onReachEnd) => {
      set({ isActive: true, isPaused: false, currentIndex: startIndex, images, onReachEnd });
      startTimer();
      
      // Preload next image immediately
      if (images[startIndex + 1]) {
        preloadImage(images[startIndex + 1].fullUrl || images[startIndex + 1].sampleUrl);
      }
    },

    stop: () => {
      stopTimer();
      set({ isActive: false, images: [], onReachEnd: undefined });
    },

    togglePause: () => {
      const { isPaused } = get();
      if (isPaused) {
        startTimer();
      } else {
        stopTimer();
      }
      set({ isPaused: !isPaused });
    },

    next: () => {
      const state = get();
      const images = state.images;

      if (!images || images.length === 0) return;

      // Smart pre-fetching: If we are within 5 images of the end, fetch the next page!
      if (state.currentIndex >= images.length - 5 && state.onReachEnd) {
        state.onReachEnd();
      }

      let nextIndex = state.currentIndex + 1;

      if (state.shuffle) {
        nextIndex = Math.floor(Math.random() * images.length);
      } else if (nextIndex >= images.length) {
        if (state.loop) {
          nextIndex = 0; // Loop back to 0
        } else {
          // Wait for more images
          return;
        }
      }

      set({ currentIndex: nextIndex });

      // Preload the *next* image after this one to ensure smooth transitions
      if (images[nextIndex + 1]) {
        preloadImage(images[nextIndex + 1].fullUrl || images[nextIndex + 1].sampleUrl);
      }
    },

    prev: () => {
      const state = get();
      const images = state.images;
      if (!images || images.length === 0) return;

      let prevIndex = state.currentIndex - 1;
      if (prevIndex < 0) {
        if (state.loop) prevIndex = images.length - 1;
        else prevIndex = 0;
      }
      
      set({ currentIndex: prevIndex });
    },

    setInterval: (ms: number) => {
      set({ intervalMs: ms });
      const { isActive, isPaused } = get();
      if (isActive && !isPaused) {
        startTimer(); // Restart timer with new interval
      }
    }
  };
});
