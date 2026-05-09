import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Info, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { useReadingStore } from "../../stores/useReadingStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import type { Series } from "../../stores/useLibraryStore";
import { Button } from "../ui/Button";
import clsx from "clsx";

type FeaturedSeries = Series & { coverUrl?: string };

export const FeaturedCarousel = () => {
  const { series } = useLibraryStore();
  const { openFolder } = useReadingStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const featuredItems = useMemo<FeaturedSeries[]>(() => {
    if (series.length === 0) return [];
    return [...series]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      )
      .slice(0, 5);
  }, [series]);

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
    <div className="relative h-[280px] md:h-[340px] w-full mb-8 overflow-hidden group rounded-3xl mt-4 border border-white/5 shadow-2xl">
      {/* Ambient Background Layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 z-0"
        >
          {currentItem.cover || currentItem.coverUrl ? (
            <img
              src={
                (currentItem.cover || currentItem.coverUrl).startsWith("http")
                  ? currentItem.cover || currentItem.coverUrl
                  : convertFileSrc(currentItem.cover || currentItem.coverUrl)
              }
              className="w-full h-full object-cover opacity-50 scale-100"
              alt="Background"
            />
          ) : (
            <div className="w-full h-full bg-neutral-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#060607] via-[#060607]/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-[#060607] via-[#060607]/60 to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#060607] via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        </motion.div>
      </AnimatePresence>

      {/* Content Layer */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-8 md:p-12 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4 max-w-xl relative"
          >
            {/* Subtle glow behind text */}
            <div className="absolute -inset-10 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-accent/20 border border-accent/20 text-accent rounded-full text-xs font-medium tracking-wide flex items-center gap-2">
                🔥 Trending Now
              </span>
              {currentItem.tags?.[0] && (
                <span className="px-3 py-1.5 bg-white/5 border border-white/10 text-neutral-400 rounded-full text-xs font-medium tracking-wide">
                  {currentItem.tags[0]}
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight line-clamp-1 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
              {currentItem.title}
            </h1>

            <p className="text-white/90 font-medium text-sm leading-relaxed max-w-xl line-clamp-3 drop-shadow-xl p-4 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/5">
              {currentItem.description ||
                "No description available for this series. Immerse yourself in high-quality storytelling and stunning artwork."}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Button
                size="default"
                className="h-11 px-6 text-xs bg-indigo-500 hover:bg-indigo-600 shadow-xl shadow-indigo-500/10 hover:scale-[1.02]"
                onClick={() => {
                  if (currentItem.books && currentItem.books.length > 0) {
                    const bookToOpen =
                      currentItem.books.find(
                        (b) =>
                          b.progress &&
                          b.progress.currentPage < b.progress.totalPages,
                      ) || currentItem.books[0];
                    openFolder(bookToOpen.path, currentItem.id, bookToOpen.id);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <Play size={14} fill="currentColor" />
                  Continue Reading
                  <ChevronRight size={14} className="ml-1" />
                </div>
              </Button>
              <Button
                variant="secondary"
                size="default"
                className="h-11 px-6 text-xs bg-white/5 border-white/10 hover:bg-white/10"
                onClick={() => {
                  useLibraryStore
                    .getState()
                    .setSelectedSeriesId(currentItem.id);
                  useSettingsStore.getState().setActiveView("library");
                }}
              >
                <Info size={14} className="mr-2" /> View Details
              </Button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  useLibraryStore.getState().toggleFavorite(currentItem.id);
                }}
                className={clsx(
                  "h-11 w-11 rounded-xl flex items-center justify-center transition-all backdrop-blur-md border border-white/10 shadow-xl",
                  currentItem.tags?.includes('favorite') ? "bg-red-500 text-white" : "bg-white/5 hover:bg-white/10 text-white"
                )}
              >
                <Heart size={18} fill={currentItem.tags?.includes('favorite') ? "currentColor" : "none"} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Controls */}
      <div className="absolute bottom-8 right-8 z-20 flex items-center gap-4">
        <button
          onClick={prevSlide}
          className="w-8 h-8 rounded-full bg-black/20 border border-white/5 flex items-center justify-center text-white hover:bg-black/40 transition-all backdrop-blur-md"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1.5 px-2">
          {featuredItems.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? "w-6 bg-accent" : "w-1.5 bg-white/20"}`}
            />
          ))}
        </div>
        <button
          onClick={nextSlide}
          className="w-8 h-8 rounded-full bg-black/20 border border-white/5 flex items-center justify-center text-white hover:bg-black/40 transition-all backdrop-blur-md"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Cover Art Spotlight (Right Side) */}
      <div className="absolute right-24 top-1/2 -translate-y-1/2 z-0 hidden xl:block opacity-100 mix-blend-normal pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, x: 100, rotate: 10 }}
            animate={{ opacity: 1, x: 0, rotate: 6 }}
            exit={{ opacity: 0, x: -100, rotate: 0 }}
            transition={{ duration: 0.8 }}
          >
            {(currentItem.cover || currentItem.coverUrl) && (
              <img
                src={
                  (currentItem.cover || currentItem.coverUrl).startsWith("http")
                    ? currentItem.cover || currentItem.coverUrl
                    : convertFileSrc(currentItem.cover || currentItem.coverUrl)
                }
                className="h-[420px] w-auto rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] rotate-6"
                alt="Cover Art"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
