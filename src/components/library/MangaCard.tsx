import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, MoreVertical, FolderOpen, Heart } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useLibraryStore } from "../../stores/useLibraryStore";
import clsx from "clsx";

interface MangaCardProps {
  item: any;
  onClick: () => void;
  onMenuClick?: (
    e: React.MouseEvent,
    action?: "rename" | "delete" | "tag",
  ) => void;
  variant?: "standard" | "featured" | "compact";
  orientation?: "portrait" | "landscape";
  isNew?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  density?: "compact" | "comfortable" | "cinematic";
}

export const MangaCard = ({
  item,
  onClick,
  onMenuClick,
  variant = "standard",
  orientation = "portrait",
  isNew,
  isSelectionMode,
  isSelected,
  density = "comfortable"
}: MangaCardProps) => {
  const { toggleFavorite } = useLibraryStore();
  const [hasImageError, setHasImageError] = useState(false);
  const isSeries = "books" in item;

  // Derived state
  const isHistoryItem = !!item.seriesTitle && !!item.chapterNumber;
  const title = item.seriesTitle || item.title;
  const rawCover = item.cover || item.coverUrl || item.coverPath;
  const coverSrc = rawCover
    ? rawCover.startsWith("http")
      ? rawCover
      : convertFileSrc(rawCover)
    : "";
  const progress =
    !isSeries && item.progress
      ? (item.progress.currentPage / (item.progress.totalPages || 1)) * 100
      : item.currentPage && item.totalPages
        ? (item.currentPage / (item.totalPages || 1)) * 100
        : 0;

  const isFavorite =
    item.tags?.includes("favorite") || item.seriesTags?.includes("favorite");
  const tags = item.tags || [];

  const handleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMenuClick) onMenuClick(e);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(item.seriesId || item.id);
  };

  if (variant === "compact" || density === "compact") {
    return (
        <motion.div 
            whileHover={{ x: 4 }}
            onClick={onClick}
            className="flex items-center gap-4 group cursor-pointer p-2 rounded-2xl hover:bg-surface-elevated transition-all border border-transparent hover:border-border-subtle"
        >
            <div className="w-14 h-20 rounded-xl bg-surface overflow-hidden flex-shrink-0 border border-border-subtle shadow-card relative">
                {coverSrc && !hasImageError ? (
                    <img src={coverSrc} className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" alt="" onError={() => setHasImageError(true)} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-foreground-dim"><FolderOpen size={16} /></div>
                )}
                {progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/40">
                        <div className="h-full bg-accent shadow-accent-glow" style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-foreground text-[11px] font-bold truncate group-hover:text-accent transition-colors uppercase tracking-tight leading-tight">
                    {title}
                </h4>
                <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] text-foreground-dim font-bold uppercase tracking-widest truncate">
                        {tags[0] || (isSeries ? `${item.books.length} Vol` : 'Manga')}
                    </span>
                    {item.rating && (
                        <>
                            <div className="w-0.5 h-0.5 rounded-full bg-border-strong" />
                            <span className="text-amber-500 text-[9px] font-black tracking-tighter">★ {item.rating}</span>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -8 }}
      className="group relative flex flex-col gap-4 cursor-pointer"
      onClick={onClick}
    >
      {/* Ambient Glow Backdrop */}
      <div
        className="ambient-glow opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={
          {
            "--accent-glow": isFavorite
              ? "rgba(239, 68, 68, 0.15)"
              : "var(--color-accent-soft)",
          } as any
        }
      />

      {/* Card Image Container */}
      <div
        className={clsx(
          "relative overflow-hidden bg-surface shadow-premium transition-all duration-700 border border-border-subtle",
          "group-hover:shadow-cinematic group-hover:border-border-strong",
          orientation === "landscape" ? "aspect-video" : "aspect-[2/3]",
          variant === "featured" ? "rounded-[40px]" : "rounded-[28px]",
          isSelected && "ring-4 ring-accent ring-offset-4 ring-offset-background scale-95",
        )}
      >
        {/* Selection Indicator */}
        <AnimatePresence>
          {isSelectionMode && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute top-4 left-4 z-50"
            >
              <div
                className={clsx(
                  "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center backdrop-blur-xl shadow-2xl",
                  isSelected
                    ? "bg-accent border-accent text-white"
                    : "bg-background/40 border-border-strong text-transparent",
                )}
              >
                {isSelected && (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-[3]">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image */}
        {coverSrc && !hasImageError ? (
          <img
            src={coverSrc}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-110"
            loading="lazy"
            onError={() => setHasImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-surface-elevated text-foreground-dim font-medium p-4 text-center text-xs tracking-wide gap-2">
            <FolderOpen size={24} className="opacity-20" />
            {hasImageError ? "Broken Link" : "No Cover"}
          </div>
        )}

        {/* Hover Overlay: Cinematic FAB */}
        <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-all duration-700 flex flex-col items-center justify-center backdrop-blur-[2px]">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.1, rotate: 5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-elevated"
          >
            <Play size={20} fill="currentColor" className="ml-1" />
          </motion.div>
        </div>

        {/* Quick Actions (Top Right) */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-20 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500">
          <button
            onClick={handleMenu}
            className="w-9 h-9 rounded-xl bg-background/60 hover:bg-background/80 text-foreground flex items-center justify-center backdrop-blur-xl transition-all shadow-2xl border border-border-subtle"
          >
            <MoreVertical size={14} />
          </button>
          <button
            onClick={handleToggleFavorite}
            className={clsx(
              "w-9 h-9 rounded-xl flex items-center justify-center backdrop-blur-xl transition-all shadow-2xl border",
              isFavorite
                ? "bg-red-500 text-white shadow-lg shadow-red-500/20 border-red-400"
                : "bg-background/60 hover:bg-background/80 text-foreground border-border-subtle",
            )}
          >
            <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        {/* New Badge */}
        {(isNew || (item.updatedAt && new Date().getTime() - new Date(item.updatedAt).getTime() < 3 * 24 * 60 * 60 * 1000)) && (
          <div className="absolute top-4 left-4 z-20">
            <span className="px-3 py-1 rounded-xl bg-accent text-[9px] font-black text-white shadow-lg tracking-tight uppercase border border-white/10">
              New
            </span>
          </div>
        )}

        {/* Progress Bar (Bottom) */}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-background/40 backdrop-blur-md">
            <div
              className="h-full bg-accent shadow-accent-glow"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Details Underneath */}
      <div className="flex flex-col px-1 pb-1">
        <h3 
            className="font-black text-foreground line-clamp-1 leading-snug group-hover:text-accent transition-colors uppercase tracking-tight"
            style={{ fontSize: variant === "featured" ? "clamp(16px, 1.5vw, 20px)" : "clamp(13px, 1.2vw, 16px)" }}
        >
          {title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {isHistoryItem ? (
            <span className="text-accent font-black uppercase tracking-widest" style={{ fontSize: "clamp(9px, 0.8vw, 11px)" }}>
                Resume Ch {item.chapterNumber}
            </span>
          ) : (
            <>
              <span className="text-foreground-dim font-bold tracking-[0.15em] uppercase truncate" style={{ fontSize: "clamp(9px, 0.8vw, 11px)" }}>
                {tags[0] || (isSeries ? `${item.books.length} Volumes` : "Manga")}
              </span>
              {item.rating && (
                <>
                  <div className="w-1 h-1 rounded-full bg-border-strong flex-shrink-0" />
                  <span className="text-amber-500 font-black tracking-tighter flex items-center gap-1" style={{ fontSize: "clamp(9px, 0.8vw, 11px)" }}>
                    ★ {item.rating}
                  </span>
                </>
              )}
              {item.chapterNumber && (
                  <>
                      <div className="w-1 h-1 rounded-full bg-border-strong flex-shrink-0" />
                      <span className="text-foreground-dim font-bold uppercase tracking-widest" style={{ fontSize: "clamp(9px, 0.8vw, 11px)" }}>CH {item.chapterNumber}</span>
                  </>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};
