import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Info, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { useReadingStore } from "../../stores/useReadingStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import type { Series } from "../../stores/useLibraryStore";
import { Button } from "../ui/Button";
import type { SourceSearchResult } from "../../services/sources/types";
import clsx from "clsx";

type FeaturedSeries = (Series | SourceSearchResult) & { coverUrl?: string };

export const FeaturedCarousel = ({ items: propItems }: { items?: any[] }) => {
  const { series } = useLibraryStore();
  const { openFolder } = useReadingStore();
  const theme = useSettingsStore((s) => s.theme);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isLightTheme = theme === "light" || theme === "paper";
  const isOled = theme === "oled";
  
  const featuredItems = useMemo<FeaturedSeries[]>(() => {
    const sourceData = propItems && propItems.length > 0 ? propItems : series;
    if (sourceData.length === 0) return [];
    
    return [...sourceData]
      .sort((a, b) => {
        const dateA = new Date((a as any).updatedAt || (a as any).createdAt || 0).getTime();
        const dateB = new Date((b as any).updatedAt || (b as any).createdAt || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 10); // Show up to 10 items for discovery variety
  }, [series, propItems]);

  const nextSlide = () => {
    if (featuredItems.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
  };

  const prevSlide = () => {
    if (featuredItems.length <= 1) return;
    setCurrentIndex(
      (prev) => (prev - 1 + featuredItems.length) % featuredItems.length,
    );
  };

  useEffect(() => {
    if (featuredItems.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [featuredItems.length]);

  if (featuredItems.length === 0) return null;

  const currentItem =
    featuredItems[Math.min(currentIndex, featuredItems.length - 1)];

  return (
    <div className="relative h-[clamp(380px,50vh,600px)] w-full mb-[clamp(1rem,3vw,3rem)] overflow-hidden group rounded-[clamp(24px,4vw,48px)] mt-[clamp(0.5rem,2vw,1rem)] border border-white/5 shadow-premium">
      {/* Ambient Background Layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 z-0 bg-background"
        >
          {currentItem.cover || currentItem.coverUrl ? (
            <img
              src={
                (currentItem.cover || currentItem.coverUrl).startsWith("http")
                  ? currentItem.cover || currentItem.coverUrl
                  : convertFileSrc(currentItem.cover || currentItem.coverUrl)
              }
              className={clsx(
                "w-full h-full object-cover scale-[1.08] blur-[10px] saturate-[1.12]",
                isLightTheme && "opacity-[0.54] contrast-[1.06]",
                !isLightTheme && isOled && "opacity-[0.56] brightness-[1.12] contrast-[1.08]",
                !isLightTheme && !isOled && "opacity-[0.5] brightness-[1.1] contrast-[1.06]",
              )}
              alt="Background"
            />
          ) : (
            <div className="w-full h-full bg-surface-elevated" />
          )}
          {/* Soft vignettes: keep artwork visible; old stack (opacity-20 + /80 left fade) hid the blur entirely */}
          <div
            className={clsx(
              "absolute inset-0",
              isLightTheme ? "bg-background/5" : isOled ? "bg-background/5" : "bg-background/10",
            )}
          />
          <div
            className={clsx(
              "absolute inset-0 bg-gradient-to-t pointer-events-none",
              isLightTheme &&
                "from-background/42 via-background/8 to-transparent",
              !isLightTheme &&
                isOled &&
                "from-background/55 via-background/12 to-transparent",
              !isLightTheme &&
                !isOled &&
                "from-background/62 via-background/16 to-transparent",
            )}
          />
          <div
            className={clsx(
              "absolute inset-y-0 left-0 w-[min(78%,32rem)] bg-gradient-to-r pointer-events-none",
              isLightTheme &&
                "from-background/34 via-background/6 to-transparent",
              !isLightTheme &&
                isOled &&
                "from-background/44 via-background/8 to-transparent",
              !isLightTheme &&
                !isOled &&
                "from-background/50 via-background/10 to-transparent",
            )}
          />
        </motion.div>
      </AnimatePresence>

      {/* Content Layer */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-[clamp(1.5rem,5vw,5rem)] w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="space-y-[clamp(1rem,2vw,1.5rem)] w-full md:w-[60%] lg:w-[55%] max-w-3xl relative"
          >
            {/* Metadata Tags */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-4 py-2 bg-accent text-white rounded-xl text-[10px] font-black tracking-[0.2em] uppercase shadow-lg shadow-accent-glow/20 border border-white/10">
                {currentItem.books && currentItem.books.length > 0 ? "In Archive" : "Global Trending"}
              </span>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-elevated backdrop-blur-md rounded-xl border border-border-subtle text-[10px] font-bold text-foreground-dim uppercase tracking-widest drop-shadow-md">
                <Heart size={10} className="text-red-500" fill="currentColor" />
                <span>{(Math.random() * 50 + 10).toFixed(1)}K Readers</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-elevated backdrop-blur-md rounded-xl border border-border-subtle text-[10px] font-bold text-amber-400 uppercase tracking-widest drop-shadow-md">
                <span>★ {(Math.random() * 1.5 + 8.4).toFixed(1)}</span>
              </div>
              {currentItem.tags?.[0] && (
                <span className="px-4 py-2 bg-surface-elevated backdrop-blur-md rounded-xl border border-border-subtle text-[10px] font-bold text-foreground-dim uppercase tracking-widest drop-shadow-md line-clamp-1 max-w-[150px]">
                  {currentItem.tags[0]}
                </span>
              )}
            </div>

            <h1 
              className="font-black text-foreground tracking-tighter drop-shadow-2xl line-clamp-2 md:line-clamp-3 overflow-hidden text-ellipsis" 
              style={{ 
                fontSize: currentItem.title?.length > 80 ? "clamp(1.5rem, 3.5vw, 2.75rem)" : 
                          currentItem.title?.length > 40 ? "clamp(1.75rem, 4vw, 3.5rem)" : 
                          "clamp(2rem, 5vw, 4.5rem)",
                lineHeight: "1.05"
              }}
              title={currentItem.title}
            >
              {currentItem.title}
            </h1>

            <p className="text-foreground-dim font-medium leading-relaxed max-w-2xl line-clamp-2 opacity-90 drop-shadow-lg" style={{ fontSize: "clamp(0.875rem, 1.5vw, 1.125rem)" }}>
              {currentItem.description ||
                "Embark on a journey through high-quality storytelling and stunning artistic manifestations. A tale of destiny awaits."}
            </p>

            <div className="flex items-center gap-4 pt-4">
              <button
                className="h-14 px-10 bg-foreground text-background rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-3 group/btn"
                onClick={() => {
                  if (currentItem.books && currentItem.books.length > 0) {
                    const bookToOpen =
                      currentItem.books.find(
                        (b: any) =>
                          b.progress &&
                          b.progress.currentPage < b.progress.totalPages,
                      ) || currentItem.books[0];
                    openFolder(bookToOpen.path, currentItem.id, bookToOpen.id);
                  } else {
                    import("../../stores/useModalStore").then(({ useModalStore }) => {
                        useModalStore.getState().openQuickView(currentItem);
                    });
                  }
                }}
              >
                <Play size={16} fill="currentColor" className="group-hover/btn:scale-125 transition-transform" />
                <span>{currentItem.books?.length ? "Start Reading" : "View Details"}</span>
              </button>

              <button
                className="h-14 w-14 rounded-2xl flex items-center justify-center bg-surface-elevated border border-border-subtle text-foreground hover:bg-surface-raised transition-all backdrop-blur-md"
                onClick={() => useLibraryStore.getState().toggleFavorite(currentItem.id)}
              >
                <Heart size={20} fill={currentItem.tags?.includes("favorite") ? "currentColor" : "none"} className={currentItem.tags?.includes("favorite") ? "text-red-500" : ""} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Indicators */}
      <div className="absolute bottom-12 right-12 z-20 flex items-center gap-6 bg-surface-elevated backdrop-blur-xl px-6 py-4 rounded-[32px] border border-border-subtle">
        <button onClick={prevSlide} className="text-foreground-dim hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
        <div className="flex gap-2">
            {featuredItems.map((_, idx) => (
                <div key={idx} className={clsx("h-1.5 rounded-full transition-all duration-500", idx === currentIndex ? "w-8 bg-accent" : "w-1.5 bg-foreground/20")} />
            ))}
        </div>
        <button onClick={nextSlide} className="text-foreground-dim hover:text-foreground transition-colors"><ChevronRight size={20} /></button>
      </div>

      {/* Hero Cover Spotlight (Right Side) */}
      <div className="absolute right-[clamp(2rem,8vw,8rem)] top-1/2 -translate-y-1/2 z-0 hidden md:block pointer-events-none w-[clamp(200px,25vw,380px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, x: 100, rotate: 12, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, rotate: 8, scale: 1 }}
            exit={{ opacity: 0, x: -100, rotate: 0, scale: 0.8 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="relative"
          >
            {/* Ambient Glow behind cover */}
            <div className="absolute inset-0 bg-indigo-500/20 blur-[80px] rounded-full scale-125" />
            
            {(currentItem.cover || currentItem.coverUrl) && (
              <img
                src={
                  (currentItem.cover || currentItem.coverUrl).startsWith("http")
                    ? currentItem.cover || currentItem.coverUrl
                    : convertFileSrc(currentItem.cover || currentItem.coverUrl)
                }
                className="w-full aspect-[2/3] object-cover rounded-[32px] shadow-[0_40px_80px_rgba(0,0,0,0.8)] border-2 border-white/10"
                alt="Cover Art"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
