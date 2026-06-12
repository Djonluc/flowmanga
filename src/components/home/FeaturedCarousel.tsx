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

      {/* Content Layer Safe Zone Constraints */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-[clamp(1.5rem,5vw,5rem)] w-full max-h-full pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="flex flex-col min-h-0 w-full md:w-[65%] lg:w-[60%] max-w-3xl relative pointer-events-auto max-h-full pb-[clamp(3rem,8vw,0rem)] md:pb-0"
          >
            {/* Metadata Tags Zone - Horizontal Scroll Fallback */}
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-shrink-0 pb-1 mb-[clamp(0.5rem,1.5vw,1rem)] [mask-image:linear-gradient(to_right,white_85%,transparent)] w-full pr-8">
              <span className="flex-shrink-0 px-4 py-2 bg-accent text-white rounded-xl text-[10px] font-black tracking-widest uppercase shadow-lg shadow-accent-glow/20 border border-white/10">
                {currentItem.books && currentItem.books.length > 0 ? "In Archive" : "Global Trending"}
              </span>
              <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-surface-elevated backdrop-blur-md rounded-xl border border-border-subtle text-[10px] font-bold text-foreground-dim uppercase tracking-widest drop-shadow-md">
                <Heart size={10} className="text-red-500" fill="currentColor" />
                <span>{(Math.random() * 50 + 10).toFixed(1)}K Readers</span>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-surface-elevated backdrop-blur-md rounded-xl border border-border-subtle text-[10px] font-bold text-amber-400 uppercase tracking-widest drop-shadow-md">
                <span>★ {(Math.random() * 1.5 + 8.4).toFixed(1)}</span>
              </div>
              {currentItem.tags?.slice(0, 3).map((tag: string) => (
                <span key={tag} className="flex-shrink-0 px-4 py-2 bg-surface-elevated backdrop-blur-md rounded-xl border border-border-subtle text-[10px] font-bold text-foreground-dim uppercase tracking-widest drop-shadow-md">
                  {tag}
                </span>
              ))}
            </div>

            {/* Title Zone - Smart Clamped & Responsive */}
            <h1 
              className="font-black text-foreground tracking-tighter drop-shadow-2xl flex-shrink-0 line-clamp-2 md:line-clamp-3 mb-[clamp(0.5rem,1.5vw,1rem)] overflow-hidden text-ellipsis" 
              style={{ 
                fontSize: "clamp(1.75rem, 4vw, 3.5rem)",
                lineHeight: "1.05"
              }}
              title={currentItem.title}
            >
              {currentItem.title}
            </h1>

            {/* Description Zone - Compressible */}
            <div className="flex-shrink min-h-0 overflow-hidden mb-[clamp(1rem,2.5vw,1.5rem)]">
              <p className="text-foreground-dim font-medium leading-relaxed max-w-2xl line-clamp-2 sm:line-clamp-3 opacity-90 drop-shadow-lg" style={{ fontSize: "clamp(0.875rem, 1.2vw, 1.125rem)" }}>
                {currentItem.description ||
                  "Embark on a journey through high-quality storytelling and stunning artistic manifestations. A tale of destiny awaits."}
              </p>
            </div>

            {/* CTA Zone - Anchored & Fixed Size */}
            <div className="flex items-center gap-4 flex-shrink-0 pt-2">
              <button
                className="h-14 px-[clamp(1.5rem,3vw,2.5rem)] bg-foreground text-background rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-xs hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-3 group/btn"
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
                <Play size={16} fill="currentColor" className="group-hover/btn:scale-125 transition-transform shrink-0" />
                <span className="whitespace-nowrap">{currentItem.books?.length ? "Start Reading" : "View Details"}</span>
              </button>

              <button
                className="h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center bg-surface-elevated border border-border-subtle text-foreground hover:bg-surface-raised transition-all backdrop-blur-md"
                onClick={() => useLibraryStore.getState().toggleFavorite(currentItem.id)}
              >
                <Heart size={20} fill={currentItem.tags?.includes("favorite") ? "currentColor" : "none"} className={currentItem.tags?.includes("favorite") ? "text-red-500" : ""} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Indicators Safe Zone */}
      <div className="absolute bottom-[clamp(1rem,4vw,3rem)] right-[clamp(1rem,4vw,3rem)] z-20 flex items-center gap-[clamp(0.5rem,2vw,1.5rem)] bg-surface-elevated backdrop-blur-xl px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.5rem,1vw,1rem)] rounded-[32px] border border-border-subtle pointer-events-auto shadow-lg">
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
