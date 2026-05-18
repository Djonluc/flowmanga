import React, { useEffect, useRef } from "react";
import { useReadingStore } from "../../stores/useReadingStore";
import { useReaderStore } from "../../stores/useReaderStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { convertFileSrc } from "@tauri-apps/api/core";
import clsx from "clsx";
import { SmartImage } from "../SmartImage";
import { motion } from "framer-motion";

export const VerticalReader = () => {
  const { images, currentPageIndex, setPageIndex } = useReadingStore();
  const {
    autoScroll,
    scrollSpeed,
    setAutoScroll,
    isBoosted,
    imageFit,
    zoomLevel,
  } = useReaderStore();
  const { gapSize } = useSettingsStore();
  const readerRef = useRef<HTMLDivElement>(null);
  const lastScrolledIndex = useRef<number>(-1);
  const isResumedRef = useRef<string | null>(null);

  const actualSpeed = isBoosted ? scrollSpeed * 4 : scrollSpeed;

  const getPageStyle = (): React.CSSProperties => {
    if (imageFit === "width" || imageFit === "stretch") {
      return {
        width: "100%",
        display: "flex",
        justifyContent: "center",
      };
    }
    return { display: "flex", justifyContent: "center" };
  };

  // V2 AUTO-SCROLL ENGINE - Optimized for frame stability
  useEffect(() => {
    if (!autoScroll) return;

    let frameId: number;
    let lastTime = performance.now();

    const scrollStep = (time: number) => {
      const container = readerRef.current;
      if (!container) {
        setAutoScroll(false);
        return;
      }

      const delta = time - lastTime;
      lastTime = time;

      // Cap delta to prevent massive jumps on tab focus/lag
      const cappedDelta = Math.min(delta, 32);

      const pixels = (actualSpeed / 1000) * cappedDelta;
      const maxScroll = container.scrollHeight - container.clientHeight;

      if (container.scrollTop >= maxScroll - 1) {
        setAutoScroll(false);
        return;
      }

      container.scrollTop += pixels;
      frameId = requestAnimationFrame(scrollStep);
    };

    frameId = requestAnimationFrame(scrollStep);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [autoScroll, actualSpeed, setAutoScroll]);

  // PAUSE ON USER INTERACTION
  useEffect(() => {
    const stop = () => {
      if (useReaderStore.getState().autoScroll) {
        setAutoScroll(false);
      }
    };

    const container = readerRef.current;
    container?.addEventListener("wheel", stop, { passive: true });
    container?.addEventListener("touchstart", stop, { passive: true });
    container?.addEventListener("mousedown", stop);

    return () => {
      container?.removeEventListener("wheel", stop);
      container?.removeEventListener("touchstart", stop);
      container?.removeEventListener("mousedown", stop);
    };
  }, [setAutoScroll]);

  // V2: Current page tracking with high-precision ratio map
  const pageRatios = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const container = readerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 1. Update our persistent ratio map
        entries.forEach((entry) => {
          const idx = Number(entry.target.getAttribute("data-index"));
          if (!isNaN(idx)) {
            pageRatios.current.set(idx, entry.intersectionRatio);
          }
        });

        // 2. Find the page that is MOST visible in the viewport
        let bestIndex = -1;
        let maxRatio = -1;

        pageRatios.current.forEach((ratio, idx) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            bestIndex = idx;
          }
        });

        // 3. Update store if we found a clear winner and it's different
        if (bestIndex !== -1) {
          const currentStoredIndex =
            useReadingStore.getState().currentPageIndex;
          if (currentStoredIndex !== bestIndex) {
            setPageIndex(bestIndex);
            lastScrolledIndex.current = bestIndex;
          }
        }
      },
      {
        root: container,
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      },
    );

    const observedElements = new Set<Element>();
    const updateObservations = () => {
      const pages = container.querySelectorAll(".manga-page");
      pages.forEach((p) => {
        if (!observedElements.has(p)) {
          observer.observe(p);
          observedElements.add(p);
        }
      });
    };

    updateObservations();

    const mutationObserver = new MutationObserver(() => {
      updateObservations();
    });

    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      observedElements.clear();
      pageRatios.current.clear();
    };
  }, [images]);

  // RESTORED: Scroll to resumed position on chapter load (GUARDED)
  useEffect(() => {
    // Only resume if this is a NEW series or chapter set
    const chapterKey = images.join(",");

    if (
      readerRef.current &&
      images.length > 0 &&
      isResumedRef.current !== chapterKey
    ) {
      const scrollTimer = setTimeout(() => {
        const targetEl = readerRef.current?.querySelector(
          `[data-index="${currentPageIndex}"]`,
        );
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "auto", block: "start" });
        } else {
          readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
        }
        isResumedRef.current = chapterKey;
        lastScrolledIndex.current = currentPageIndex;
      }, 100);

      return () => clearTimeout(scrollTimer);
    }
  }, [images, currentPageIndex]);

  // JUMP TO PAGE SYNC: Listen for manual progress bar clicks/jumps
  useEffect(() => {
    // If the store index changed and it's NOT the one we just scrolled to from the observer
    // then it means a manual jump was requested (e.g. from the progress bar)
    if (currentPageIndex !== lastScrolledIndex.current) {
      const targetEl = readerRef.current?.querySelector(
        `[data-index="${currentPageIndex}"]`,
      );
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        lastScrolledIndex.current = currentPageIndex;
      }
    }
  }, [currentPageIndex]);

  return (
    <div
      ref={readerRef}
      className="reader-scroll w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center bg-transparent select-none no-scrollbar will-change-scroll"
      style={{ scrollBehavior: "auto", gap: `${gapSize}px` }}
    >
      {images.map((imagePath, index) => (
        <LazyReaderPage
          key={imagePath}
          imagePath={imagePath}
          index={index}
          isLast={index === images.length - 1}
          isBoundary={
            index < images.length - 1 &&
            !images[index + 1]
              .split("/")
              .slice(0, -1)
              .join("/")
              .includes(imagePath.split("/").slice(0, -1).join("/"))
          }
          imageFit={imageFit}
          zoomLevel={zoomLevel}
          pageStyle={getPageStyle()}
        />
      ))}

      <div className="py-60 flex flex-col items-center opacity-20">
        <div className="w-12 h-1 bg-white/20 rounded-full mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-foreground">
          Archive Edge
        </p>
      </div>

      <BottomTrigger
        onTrigger={() => useReadingStore.getState().goToNextChapter()}
      />
    </div>
  );
};

interface LazyPageProps {
  imagePath: string;
  index: number;
  isLast: boolean;
  isBoundary: boolean;
  imageFit: string;
  zoomLevel: number;
  pageStyle: React.CSSProperties;
}

const LazyReaderPage = ({
  imagePath,
  index,
  isBoundary,
  imageFit,
  zoomLevel,
  pageStyle,
}: LazyPageProps) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [aspectRatio, setAspectRatio] = React.useState<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sliding window: keep pages up to 4000px above, preload pages up to 8000px below
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: "4000px 0px 8000px 0px" },
    );

    if (pageRef.current) observer.observe(pageRef.current);
    return () => observer.disconnect();
  }, []);

  const getImageClass = () => {
    switch (imageFit) {
      case "width":
        return "w-full h-auto object-contain";
      case "stretch":
        return "w-full h-full object-fill";
      case "height":
        return "h-screen w-auto object-contain";
      case "contain":
        return "w-full h-auto object-contain";
      case "original":
        return "max-w-full h-auto object-contain";
      default:
        return "w-full h-auto object-contain";
    }
  };

  return (
    <React.Fragment>
      <div
        ref={pageRef}
        data-index={index}
        className={clsx(
          "manga-page transition-all duration-700 ease-out",
          imageFit === "width" || imageFit === "stretch"
            ? "w-full"
            : imageFit === "contain"
            ? "w-full max-w-5xl"
            : "max-w-5xl",
          !aspectRatio && !isVisible && "min-h-[600px]", 
        )}
        style={{
          ...pageStyle,
          aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
        }}
      >
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full flex flex-col items-center justify-center"
          >
            <SmartImage
              src={
                imagePath.startsWith("http")
                  ? imagePath
                  : convertFileSrc(imagePath)
              }
              alt={`Page ${index + 1}`}
              className={clsx(getImageClass(), "shadow-2xl")}
              style={{
                zoom: zoomLevel !== 100 ? `${zoomLevel}%` : undefined,
                transform:
                  zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
              }}
              onLoad={() => {
                // Ensure scroll height doesn't jump when unmounted later
                const srcStr = imagePath.startsWith("http") ? imagePath : convertFileSrc(imagePath);
                const img = document.getElementById(`img-${srcStr}`) as HTMLImageElement;
                if (img && img.naturalWidth && img.naturalHeight) {
                  setAspectRatio(img.naturalWidth / img.naturalHeight);
                }
              }}
              eager={true}
            />
          </motion.div>
        )}
      </div>

      {isBoundary && (
        <div className="w-full py-32 flex flex-col items-center justify-center relative overflow-hidden group/boundary select-none">
          <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] opacity-0 group-hover/boundary:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          <div className="w-px h-24 bg-gradient-to-b from-transparent via-indigo-500/30 to-transparent mb-8" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 z-10"
          >
            <div className="px-4 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 backdrop-blur-md">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.4em]">
                Chapter Concluded
              </p>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-foreground/40 uppercase tracking-widest flex items-center gap-4">
              Continuing{" "}
              <span className="text-indigo-500 animate-pulse">↓</span> Scroll to
              advance
            </h3>
          </motion.div>
          <div className="w-px h-24 bg-gradient-to-b from-transparent via-indigo-500/30 to-transparent mt-8" />
        </div>
      )}
    </React.Fragment>
  );
};

const BottomTrigger = ({ onTrigger }: { onTrigger: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onTrigger();
        }
      },
      { rootMargin: "200px" },
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onTrigger]);

  return <div ref={ref} className="h-4 w-full" />;
};
