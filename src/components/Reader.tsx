import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { Play } from "lucide-react";
import { useReadingStore } from "../stores/useReadingStore";
import { useReaderStore } from "../stores/useReaderStore"; // New V2 Store
import { useAnalyticsStore } from "../stores/useAnalyticsStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { usePreloader } from "../hooks/usePreloader";
import { convertFileSrc } from "@tauri-apps/api/core";

import { VerticalReader } from "./readers/VerticalReader";
import { SinglePageReader } from "./readers/SinglePageReader";
import { SlideshowReader } from "./readers/SlideshowReader";
import { NovelReader } from "./readers/NovelReader";

import { ReaderTopBar } from "./reader/ReaderTopBar";
import { ReaderBottomBar } from "./reader/ReaderBottomBar";
import { QuickSettings } from "./reader/QuickSettings";
import { AdaptiveUI } from "./reader/AdaptiveUI";
import { useReaderEngine } from "../hooks/useReaderEngine";

export const Reader = () => {
  useReaderEngine();
  usePreloader(5);
  const { startSession, addReadingTime } = useAnalyticsStore();
  const {
    images,
    currentPageIndex: currentIndex,
    reset,
    seriesId,
  } = useReadingStore();
  const { mode, setCurrentPage, setTotalPages, currentThemeColor } =
    useReaderStore();
  const { setAmbientImage, ambientMode, toggleFullScreenAction } =
    useSettingsStore();

  // UI Visibility State
  const [showControls, setShowControls] = useState(true);
  const [prevSrc, setPrevSrc] = useState("");
  const [bgFlip, setBgFlip] = useState(false); // dual-layer flip for crossfade
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal storage index with Reader V2 Store on load
  useEffect(() => {
    if (images.length > 0) {
      setTotalPages(images.length);
      setCurrentPage(currentIndex);
    }
  }, [images.length, currentIndex]);

  const currentSrc = images[currentIndex]
    ? images[currentIndex].startsWith("http")
      ? images[currentIndex]
      : (() => {
          try {
            return convertFileSrc(images[currentIndex]);
          } catch {
            return "";
          }
        })()
    : "";

  // Drive the ambient background crossfade
  useEffect(() => {
    if (currentSrc && currentSrc !== prevSrc) {
      setPrevSrc(currentSrc);
      setBgFlip((f) => !f);
    }
  }, [currentSrc]);

  // Sync Global Ambient Image
  useEffect(() => {
    const currentImg = images[currentIndex];
    if (currentImg) {
      setAmbientImage(currentImg);
    }
    return () => {
      // Verify if we are unmounting or just changing page?
      // Actually, we want to clear ONLY on unmount of the Reader component.
      // But this effect runs on index change.
      // So we should have a separate effect for cleanup?
      // Or just let the next view set it.
      // But if we go back to Home (which sets its own), it's fine.
      // If we go to a view that DOESN'T set it (like Library grid), we might want to clear it.
      // Let's rely on a separate mount/unmount effect.
    };
  }, [currentIndex, images]);

  useEffect(() => {
    return () => {
      setAmbientImage(null); // Clear on reader exit
    };
  }, []);

  const handleMouseMove = (e: MouseEvent) => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

    if (e.clientY > 100 && e.clientY < window.innerHeight - 100) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);

    startSession();
    const timer = setInterval(() => {
      if (document.hasFocus()) addReadingTime(1, seriesId ?? undefined);
    }, 1000);

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useReaderStore.getState();
      if (state.mode === "vertical") return;

      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        useReadingStore.getState().nextPage();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        useReadingStore.getState().prevPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      clearInterval(timer);
    };
  }, [seriesId]);

  // Update Reading Progress in Data Store when Reader V2 page changes
  // This ensures progress persists even when using the new engine
  useEffect(() => {
    const readerPage = useReaderStore.getState().currentPage;
    if (readerPage !== currentIndex) {
      useReadingStore.getState().setPageIndex(readerPage);
    }
  }, [useReaderStore.getState().currentPage]);

  const renderReader = () => {
    // V2 Architecture: Unmount previous mode by using separate components
    switch (mode) {
      case "vertical":
        return <VerticalReader />;
      case "single":
        return <SinglePageReader />;
      case "slideshow":
        return <SlideshowReader />;
      case "text_reader":
        return <NovelReader />;
      default:
        return <VerticalReader />;
    }
  };

  return (
    <div
      onDoubleClick={toggleFullScreenAction}
      onClick={() => {
        if (!showControls) {
          setShowControls(true);
        }
      }}
      className="fixed inset-0 z-50 w-screen h-screen bg-transparent overflow-hidden select-none flex flex-col items-center justify-center"
    >
      {/* Adaptive UI color extraction logic is handled in <AdaptiveUI /> component below */}

      <AdaptiveUI />

      <ReaderTopBar visible={showControls} onBack={reset} />

      <QuickSettings />

      {/* Overlay Controls (Tap Zones for Single/Slideshow) */}
      <AnimatePresence>
        {mode !== "vertical" && !showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex pointer-events-auto"
          >
            <div
              className="w-[15%] h-full cursor-w-resize"
              onClick={() => useReadingStore.getState().prevPage()}
            />
            <div
              className="flex-1 h-full"
              onClick={() => setShowControls(true)}
            />
            <div
              className="w-[15%] h-full cursor-e-resize"
              onClick={() => useReadingStore.getState().nextPage()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full h-full flex items-center justify-center relative z-10">
        {renderReader()}
      </div>

      <ChapterTransitionOverlay />
      <FeedbackHUD />

      <ReaderBottomBar visible={showControls} />
    </div>
  );
};

const ChapterTransitionOverlay = () => {
  const { chapters, currentChapterIndex } = useReadingStore();
  const prevIndex = useRef(currentChapterIndex);
  const controls = useAnimationControls();

  useEffect(() => {
    if (currentChapterIndex !== prevIndex.current) {
      prevIndex.current = currentChapterIndex;
      void controls.start({
        opacity: [0, 1, 1, 0],
        y: [40, -40, -40, -80],
        x: ["-50%", "-50%", "-50%", "-50%"],
        scale: [0.95, 1, 1, 1.05],
        transition: {
          duration: 3.5,
          times: [0, 0.1, 0.85, 1],
          ease: [0.16, 1, 0.3, 1],
        },
      });
    }
  }, [controls, currentChapterIndex]);

  const title = chapters[currentChapterIndex]?.title;
  if (!title) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, x: "-50%", scale: 0.95 }}
      animate={controls}
      className="fixed bottom-0 left-1/2 z-[100] px-6 py-3 bg-background/85 backdrop-blur-3xl rounded-full border border-border-subtle text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.8)] pointer-events-none select-none flex items-center gap-4"
    >
      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
        <Play size={14} fill="currentColor" className="ml-0.5" />
      </div>
      <div className="flex flex-col pr-4">
        <span className="text-[7px] font-black text-indigo-500 uppercase tracking-[0.4em]">
          Entering
        </span>
        <span className="text-xs font-black uppercase tracking-widest text-foreground-muted">
          {title}
        </span>
      </div>
    </motion.div>
  );
};

const FeedbackHUD = () => {
  const { feedback } = useReaderStore();

  return (
    <AnimatePresence mode="wait">
      {feedback && (
        <motion.div
          key={feedback.type + feedback.value}
          initial={{ opacity: 0, scale: 0.5, y: -20, x: "-50%" }}
          animate={{ opacity: 1, scale: 1, y: 32, x: "-50%" }}
          exit={{ opacity: 0, scale: 1.2, y: -20, x: "-50%" }}
          transition={{ type: "spring", damping: 15, stiffness: 200 }}
          className="fixed top-0 left-1/2 z-[101] px-10 py-4 bg-accent shadow-[0_32px_64px_rgba(59,130,246,0.5)] rounded-[32px] flex items-center gap-6 pointer-events-none select-none border border-white/20"
        >
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-black text-white/70 uppercase tracking-[0.5em] mb-0.5">
              {feedback.type}
            </span>
            <span className="text-2xl font-black text-white italic tracking-tighter tabular-nums">
              {feedback.value}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
