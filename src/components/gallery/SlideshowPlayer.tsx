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
  Shuffle,
  Repeat,
  Dices,
  Eye,
  EyeOff,
  Info,
  Tag,
  Globe,
  LayoutList,
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
    slideshowShuffle,
    slideshowRepeat,
    slideshowRandom,
    slideshowHudVisible,
    toggleSlideshowShuffle,
    toggleSlideshowRepeat,
    toggleSlideshowRandom,
    setSlideshowHudVisible,
    setSlideshowIndex,
    isSearching,
    searchByTags,
    searchQuery,
    currentSearchPage,
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
  const [showOverlay, setShowOverlay] = useState<
    "play" | "pause" | "shuffle" | "repeat" | "random" | null
  >(null);
  const [showQueue, setShowQueue] = useState(false);
  const [showMetadata, setShowMetadata] = useState(true);
  const controlTimer = useRef<any>(null);
  const overlayTimer = useRef<any>(null);
  const autoTimer = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeShow = slideshows.find((s) => s.id === activeSlideshowId);
  const currentImage = slideshowImages[slideshowIndex];
  const { preloadHighResImage } = useMediaLoader();

  const transitionType = slideshowTransition;
  const effectiveInterval = Math.max(
    1000,
    activeShow?.interval || slideshowInterval,
  );

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
    if (!isSlideshowPlaying || isPaused || !currentImage) {
      if (autoTimer.current) {
        clearInterval(autoTimer.current);
        autoTimer.current = null;
      }
      return;
    }

    if (autoTimer.current) clearInterval(autoTimer.current);

    autoTimer.current = setInterval(() => {
      const state = useGalleryStore.getState();
      if (!state.isSlideshowPlaying) {
        if (autoTimer.current) clearInterval(autoTimer.current);
        return;
      }

      nextSlide();
    }, effectiveInterval);

    return () => {
      if (autoTimer.current) clearInterval(autoTimer.current);
    };
  }, [
    isSlideshowPlaying,
    isPaused,
    effectiveInterval,
    currentImage,
    nextSlide,
  ]);


  const refreshControls = useCallback(() => {
    setSlideshowHudVisible(true);
    clearTimeout(controlTimer.current);
    controlTimer.current = setTimeout(() => {
      if (!isPaused) setSlideshowHudVisible(false);
    }, 4000);
  }, [isPaused, setSlideshowHudVisible]);

  useEffect(() => {
    if (!isSlideshowPlaying) return;
    // Only refresh controls automatically if they are already visible.
    // This prevents the HUD from popping up on every slide transition
    // if the user (or the auto-hide timer) has hidden it.
    if (useGalleryStore.getState().slideshowHudVisible) {
      refreshControls();
    }
    return () => clearTimeout(controlTimer.current);
  }, [isSlideshowPlaying, slideshowIndex, refreshControls]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      setShowOverlay(next ? "pause" : "play");
      clearTimeout(overlayTimer.current);
      overlayTimer.current = setTimeout(() => setShowOverlay(null), 800);
      return next;
    });
    refreshControls();
  }, [refreshControls]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    toggleSlideshowShuffle();
    setShowOverlay("shuffle");
    clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setShowOverlay(null), 800);
  }, [toggleSlideshowShuffle]);

  const toggleRepeat = useCallback(() => {
    toggleSlideshowRepeat();
    setShowOverlay("repeat");
    clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setShowOverlay(null), 800);
  }, [toggleSlideshowRepeat]);

  const toggleRandom = useCallback(() => {
    toggleSlideshowRandom();
    setShowOverlay("random");
    clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setShowOverlay(null), 800);
  }, [toggleSlideshowRandom]);

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
          break;
        case "ArrowLeft":
          prevSlide();
          break;
        case "p":
        case "P":
          togglePause();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "m":
        case "M":
          setShowMetadata((prev) => !prev);
          break;
        case "h":
        case "H":
          setSlideshowHudVisible(!slideshowHudVisible);
          break;
        case "q":
        case "Q":
          setShowQueue((prev) => !prev);
          break;
        case "s":
        case "S":
          toggleShuffle();
          break;
        case "r":
        case "R":
          toggleRepeat();
          break;
        case "d":
        case "D":
          toggleRandom();
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
    slideshowHudVisible,
    setSlideshowHudVisible,
    togglePause,
    toggleFullscreen,
    toggleShuffle,
    toggleRepeat,
    toggleRandom,
  ]);

  useEffect(() => {
    const listener = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", listener);
    return () => document.removeEventListener("fullscreenchange", listener);
  }, []);

  const changeSpeed = (delta: number) => {
    const currentInterval = activeShow?.interval || slideshowInterval;
    const next = Math.max(1000, Math.min(20000, currentInterval + delta));
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
      {/* Cinematic HUD Hide Layer */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          slideshowHudVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={currentImage.previewUrl || currentImage.imageUrl}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover scale-125 blur-[120px] opacity-30"
            alt=""
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImage.id}
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
              referrerPolicy="no-referrer"
              decoding="async"
              className={`max-w-full max-h-full object-contain rounded-3xl transition-all duration-700 ${
                isLoading
                  ? "scale-95 opacity-50 blur-sm"
                  : "scale-100 opacity-100 blur-0"
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
                  <div className="w-24 h-24 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white">
                    {showOverlay === "pause" && (
                      <div className="flex gap-2">
                        <div className="w-3 h-8 bg-white rounded-full" />
                        <div className="w-3 h-8 bg-white rounded-full" />
                      </div>
                    )}
                    {showOverlay === "play" && (
                      <div className="w-0 h-0 border-t-15 border-t-transparent border-l-25 border-l-white border-b-15 border-b-transparent ml-2" />
                    )}
                    {showOverlay === "shuffle" && (
                      <Shuffle
                        size={40}
                        className={
                          slideshowShuffle ? "text-purple-400" : "text-white"
                        }
                      />
                    )}
                    {showOverlay === "repeat" && (
                      <Repeat
                        size={40}
                        className={
                          slideshowRepeat ? "text-purple-400" : "text-white"
                        }
                      />
                    )}
                    {showOverlay === "random" && (
                      <Dices
                        size={40}
                        className={
                          slideshowRandom ? "text-purple-400" : "text-white"
                        }
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {slideshowHudVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-x-0 bottom-0 p-6 bg-linear-to-t from-black/90 to-transparent z-50"
          >
            <div className="max-w-5xl mx-auto space-y-4">
              {showMetadata && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-white/60">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-purple-300/80 flex items-center gap-2">
                      <Globe size={10} /> {sourceLabel} · {slideshowIndex + 1} /{" "}
                      {slideshowImages.length}
                    </p>
                    <h2 className="text-sm sm:text-base font-black text-white truncate max-w-md">
                      {currentTitle}
                    </h2>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {currentImage.tags?.slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          className="text-[8px] uppercase tracking-widest bg-white/5 px-1.5 py-0.5 rounded border border-white/5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-white/70">
                      <Sparkles size={12} /> {isPaused ? "Paused" : "Playing"}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-white/70">
                      <Monitor size={12} />{" "}
                      {(effectiveInterval / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => prevSlide()}
                    className="rounded-2xl bg-white/10 p-4 text-white/70 hover:bg-white/15 transition active:scale-95"
                    title="Previous"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <button
                    onClick={togglePause}
                    className="rounded-2xl bg-purple-600 px-8 py-4 text-white font-black uppercase tracking-[0.12em] transition hover:bg-purple-500 active:scale-95 shadow-lg shadow-purple-500/20"
                  >
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={() => nextSlide()}
                    className="rounded-2xl bg-white/10 p-4 text-white/70 hover:bg-white/15 transition active:scale-95"
                    title="Next"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleShuffle}
                    className={`p-3 rounded-xl transition ${slideshowShuffle ? "bg-purple-500 text-white" : "bg-white/5 text-white/40 hover:text-white"}`}
                    title="Shuffle"
                  >
                    <Shuffle size={18} />
                  </button>
                  <button
                    onClick={toggleRepeat}
                    className={`p-3 rounded-xl transition ${slideshowRepeat ? "bg-purple-500 text-white" : "bg-white/5 text-white/40 hover:text-white"}`}
                    title="Repeat"
                  >
                    <Repeat size={18} />
                  </button>
                  <button
                    onClick={toggleRandom}
                    className={`p-3 rounded-xl transition ${slideshowRandom ? "bg-purple-500 text-white" : "bg-white/5 text-white/40 hover:text-white"}`}
                    title="Random"
                  >
                    <Dices size={18} />
                  </button>
                  <div className="w-px h-6 bg-white/10 mx-1" />
                  <button
                    onClick={() => setShowQueue(!showQueue)}
                    className={`p-3 rounded-xl transition ${showQueue ? "bg-purple-500 text-white" : "bg-white/5 text-white/40 hover:text-white"}`}
                    title="Queue Preview"
                  >
                    <LayoutList size={18} />
                  </button>
                  <button
                    onClick={() => setShowMetadata(!showMetadata)}
                    className={`p-3 rounded-xl transition ${showMetadata ? "bg-purple-500 text-white" : "bg-white/5 text-white/40 hover:text-white"}`}
                    title="Toggle Metadata"
                  >
                    <Info size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-purple-500"
                    initial={false}
                    animate={{
                      width: `${((slideshowIndex + 1) / slideshowImages.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => changeSpeed(-500)}
                    className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition"
                  >
                    Slower
                  </button>
                  <button
                    onClick={() => changeSpeed(500)}
                    className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition"
                  >
                    Faster
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queue Sidebar */}
      <AnimatePresence>
        {showQueue && slideshowHudVisible && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="absolute top-0 right-0 bottom-0 w-80 bg-black/80 backdrop-blur-3xl border-l border-white/10 z-60 p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/40">
                Upcoming Vision
              </h3>
              <button
                onClick={() => setShowQueue(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
              {slideshowImages
                .slice(slideshowIndex + 1, slideshowIndex + 11)
                .map((img, i) => (
                  <div
                    key={`${img.id}-${i}`}
                    className="flex gap-4 items-center group cursor-pointer"
                    onClick={() => setSlideshowIndex(slideshowIndex + 1 + i)}
                  >
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/5 shrink-0 border border-white/5">
                      <img
                        src={img.previewUrl || img.imageUrl}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition"
                        alt=""
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white truncate">
                        {img.tags?.[0] || "Untitled"}
                      </p>
                      <p className="text-[8px] uppercase tracking-widest text-white/20 mt-1">
                        {img.source}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={toggleFullscreen}
        className={`absolute top-6 left-6 z-50 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/70 transition ${
          slideshowHudVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <Monitor size={16} className="inline-block mr-2" />
        {isFullscreen ? "Exit" : "Fullscreen"}
      </button>

      <div className="absolute top-6 right-6 z-50 flex gap-2">
        <button
          onClick={() => setSlideshowHudVisible(!slideshowHudVisible)}
          className={`rounded-2xl bg-white/5 p-3 text-white/70 hover:bg-white/10 transition ${
            slideshowHudVisible
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
          title={slideshowHudVisible ? "Hide HUD" : "Show HUD"}
        >
          {slideshowHudVisible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
        <button
          onClick={stopSlideshow}
          className={`rounded-2xl bg-white/5 p-3 text-white/70 hover:bg-white/10 transition ${
            slideshowHudVisible
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <X size={20} />
        </button>
      </div>
    </motion.div>
  );
};
