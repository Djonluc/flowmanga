/**
 * SlideshowPlayer
 *
 * Cinematic fullscreen slideshow with autoplay, transitions,
 * keyboard navigation, and ambient controls.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Monitor,
  Settings,
  Sparkles,
} from "lucide-react";
import { useGalleryStore } from "../../stores/useGalleryStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useMediaLoader } from "../../hooks/useMediaLoader";

export const SlideshowPlayer: React.FC = () => {
  const {
    isSlideshowPlaying,
    slideshowImages,
    slideshowIndex,
    activeSlideshowId,
    slideshows,
    nextSlide,
    prevSlide,
    stopSlideshow,
  } = useGalleryStore();

  const {
    slideshowInterval,
    slideshowTransition,
    setSlideshowInterval,
    setSlideshowTransition,
  } = useSettingsStore();

  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [touchDelta, setTouchDelta] = useState(0);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [speed, setSpeed] = useState<number>(slideshowInterval);
  const [showOverlay, setShowOverlay] = useState<"play" | "pause" | null>(null);
  const controlTimer = useRef<any>(null);
  const overlayTimer = useRef<any>(null);
  const autoTimer = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeShow = slideshows.find((s) => s.id === activeSlideshowId);
  const currentImage = slideshowImages[slideshowIndex];
  const { preloadHighResImage } = useMediaLoader();

  useEffect(() => {
    setSpeed(activeShow?.interval || slideshowInterval);
  }, [activeShow?.interval, slideshowInterval]);

  const transitionType = slideshowTransition;

  const fallbackUrls = useCallback((image: any) => {
    if (!image) return [];
    const urls: string[] = [];
    if ("fullResUrl" in image && image.fullResUrl) urls.push(image.fullResUrl);
    if ("imageUrl" in image && image.imageUrl) urls.push(image.imageUrl);
    if ("previewUrl" in image && image.previewUrl) urls.push(image.previewUrl);

    const primary = urls[0];
    if (primary) {
      if (primary.match(/\.(avif)$/i))
        urls.push(primary.replace(/\.(avif)$/i, ".jpg"));
      urls.push(primary.replace(/\.[^.]+$/, ".jpg"));
      urls.push(primary.replace(/\.[^.]+$/, ".png"));
      urls.push(primary.replace(/\.[^.]+$/, ".webp"));
    }

    return Array.from(new Set(urls)).filter(Boolean);
  }, []);

  useEffect(() => {
    if (!currentImage) return;
    let ignore = false;
    const urls = fallbackUrls(currentImage);
    const source = currentImage.source || "unknown";

    if (urls.length > 0) {
      setIsLoading(true);
      preloadHighResImage(urls, source).then((img) => {
        if (!ignore && img) {
          setRenderedUrl(img.src);
          setIsLoading(false);
        } else if (!ignore) {
          setIsLoading(false);
        }
      });
    }

    return () => {
      ignore = true;
    };
  }, [currentImage, fallbackUrls, preloadHighResImage]);

  useEffect(() => {
    if (!currentImage || slideshowImages.length <= 1) return;
    const nextIndex = (slideshowIndex + 1) % slideshowImages.length;
    const nextImage = slideshowImages[nextIndex];
    if (nextImage) {
      const urls = fallbackUrls(nextImage);
      const source = nextImage.source || "unknown";
      if (urls.length > 0) {
        preloadHighResImage(urls, source);
      }
    }
  }, [
    currentImage,
    slideshowIndex,
    slideshowImages,
    fallbackUrls,
    preloadHighResImage,
  ]);

  useEffect(() => {
    if (!isSlideshowPlaying || isPaused || !currentImage) return;
    clearInterval(autoTimer.current);
    autoTimer.current = setInterval(() => {
      nextSlide();
    }, speed);
    return () => clearInterval(autoTimer.current);
  }, [isSlideshowPlaying, isPaused, speed, nextSlide, currentImage]);

  const refreshControls = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlTimer.current);
    controlTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    if (!isSlideshowPlaying) return;
    refreshControls();
    return () => clearTimeout(controlTimer.current);
  }, [isSlideshowPlaying, slideshowIndex, refreshControls]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isSlideshowPlaying) return;
      switch (e.key) {
        case "Escape":
          stopSlideshow();
          break;
        case "ArrowRight":
        case " ":
          nextSlide();
          refreshControls();
          break;
        case "ArrowLeft":
          prevSlide();
          refreshControls();
          break;
        case "p":
        case "P":
          togglePause();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    isSlideshowPlaying,
    stopSlideshow,
    nextSlide,
    prevSlide,
    refreshControls,
  ]);

  useEffect(() => {
    const listener = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", listener);
    return () => document.removeEventListener("fullscreenchange", listener);
  }, []);

  const changeSpeed = (delta: number) => {
    const next = Math.max(1000, Math.min(20000, speed + delta));
    setSpeed(next);
    setSlideshowInterval(next);
  };

  const toggleTransition = (type: "fade" | "slide" | "none") => {
    setSlideshowTransition(type);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isSlideshowPlaying) return;
    if (Math.abs(e.deltaY) < 15) return;
    e.preventDefault();
    if (e.deltaY > 0) {
      nextSlide();
    } else {
      prevSlide();
    }
    refreshControls();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStart || e.touches.length !== 1) return;
    setTouchDelta(e.touches[0].clientX - touchStart.x);
  };

  const handleTouchEnd = () => {
    if (!touchStart) return;
    if (touchDelta > 80) {
      prevSlide();
    } else if (touchDelta < -80) {
      nextSlide();
    }
    setTouchStart(null);
    setTouchDelta(0);
    refreshControls();
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  const togglePause = () => {
    setIsPaused((prev) => {
      const next = !prev;
      setShowOverlay(next ? "pause" : "play");
      clearTimeout(overlayTimer.current);
      overlayTimer.current = setTimeout(() => setShowOverlay(null), 800);
      return next;
    });
    refreshControls();
  };

  const transitionVariants = useMemo(() => {
    if (transitionType === "slide") {
      return {
        initial: { opacity: 0, x: 50 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -50 },
      };
    }
    if (transitionType === "none") {
      return {
        initial: { opacity: 1, x: 0 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 0 },
      };
    }
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }, [transitionType]);

  if (!isSlideshowPlaying || !currentImage) return null;

  const currentSource = (currentImage.source || "unknown").toString();
  const sourceLabel = currentSource
    .replace(/\./g, " ")
    .replace(/(^\w|\s\w)/g, (match) => match.toUpperCase());
  const currentTitle = currentImage?.tags?.[0] || "Untitled Vision";

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-9998 bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseMove={refreshControls}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={currentImage.previewUrl || currentImage.imageUrl}
          className="w-full h-full object-cover scale-125 blur-[80px] opacity-30"
          alt=""
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentImage.id}-${slideshowIndex}`}
            className="relative max-w-[90vw] max-h-[90vh] w-full h-full flex items-center justify-center"
            initial={transitionVariants.initial}
            animate={transitionVariants.animate}
            exit={transitionVariants.exit}
            transition={{
              duration: transitionType === "none" ? 0 : 0.7,
              ease: "easeOut",
            }}
          >
            <img
              src={
                renderedUrl || currentImage.imageUrl || currentImage.previewUrl
              }
              alt={currentTitle}
              decoding="async"
              className={`max-w-full max-h-full object-contain rounded-3xl transition-all duration-700 ${
                isLoading ? "scale-95 opacity-50 blur-sm" : "scale-100 opacity-100 blur-0"
              } shadow-[0_0_120px_rgba(126,34,206,0.35)]`}
            />

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-white/10 border-t-purple-500 animate-spin" />
              </div>
            )}

            <AnimatePresence>
              {showOverlay && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                >
                  <div className="w-24 h-24 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                    {showOverlay === "pause" ? (
                      <div className="flex gap-2">
                        <div className="w-3 h-8 bg-white rounded-full" />
                        <div className="w-3 h-8 bg-white rounded-full" />
                      </div>
                    ) : (
                      <div className="w-0 h-0 border-t-[15px] border-t-transparent border-l-[25px] border-l-white border-b-[15px] border-b-transparent ml-2" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 p-6 bg-linear-to-t from-black/90 to-transparent transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-white/60">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.24em] text-purple-300/80">
                {activeShow ? activeShow.name : "Slideshow"} · {sourceLabel}
              </p>
              <h2 className="text-sm sm:text-base font-black text-white truncate">
                {currentTitle}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-white/70">
                <Sparkles size={12} /> {isPaused ? "Paused" : "Playing"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-white/70">
                <Monitor size={12} /> {(speed / 1000).toFixed(1)}s
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={() => prevSlide()}
                className="rounded-2xl bg-white/10 px-4 py-3 text-white/70 hover:bg-white/15 transition"
              >
                <ArrowLeft size={18} /> Previous
              </button>
              <button
                onClick={togglePause}
                className="rounded-2xl bg-purple-600 px-4 py-3 text-white font-black uppercase tracking-[0.12em] transition hover:bg-purple-500 active:scale-95"
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={() => nextSlide()}
                className="rounded-2xl bg-white/10 px-4 py-3 text-white/70 hover:bg-white/15 transition"
              >
                Next <ArrowRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:w-auto">
              <button
                onClick={() => changeSpeed(-500)}
                className="rounded-2xl bg-white/10 px-4 py-3 text-white/70 hover:bg-white/15 transition"
              >
                - Speed
              </button>
              <button
                onClick={() => changeSpeed(500)}
                className="rounded-2xl bg-white/10 px-4 py-3 text-white/70 hover:bg-white/15 transition"
              >
                + Speed
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {(["fade", "slide", "none"] as const).map((type) => (
              <button
                key={type}
                onClick={() => toggleTransition(type)}
                className={`rounded-2xl px-4 py-3 text-[10px] uppercase tracking-[0.24em] transition ${
                  slideshowTransition === type
                    ? "bg-purple-500 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.24em] text-white/50">
            <span>
              {slideshowIndex + 1} / {slideshowImages.length}
            </span>
            <span>{sourceLabel}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        className={`absolute top-6 left-6 z-50 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/70 transition ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Settings size={16} className="inline-block mr-2" />
        {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      </button>

      <button
        onClick={stopSlideshow}
        className={`absolute top-6 right-6 z-50 rounded-2xl bg-white/5 p-3 text-white/70 hover:bg-white/10 transition ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <X size={20} />
      </button>
    </motion.div>
  );
};
