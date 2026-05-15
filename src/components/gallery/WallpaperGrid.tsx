/**
 * WallpaperGrid
 *
 * High-resolution focused section for discovering wallpapers.
 */

import React, { useEffect } from "react";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { useGalleryStore } from "../../stores/useGalleryStore";
import { GalleryImageCard } from "./GalleryImageCard";

export const WallpaperGrid: React.FC = () => {
  const {
    wallpaperImages,
    isLoadingWallpapers,
    fetchWallpapers,
    savedImages,
    saveImage,
    openViewer,
  } = useGalleryStore();

  useEffect(() => {
    if (wallpaperImages.length === 0) fetchWallpapers();
  }, []);

  const savedIds = new Set(savedImages.map((i) => i.id));

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-500">
            <ImageIcon size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">
              Wallpapers
            </h3>
            <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-0.5">
              High-definition anime visions
            </p>
          </div>
        </div>

        {wallpaperImages.length > 0 && (
          <button
            onClick={() =>
              useGalleryStore
                .getState()
                .startSlideshowFromContext(wallpaperImages)
            }
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 text-[10px] font-black uppercase tracking-widest transition-all border border-cyan-500/20"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            Play Wallpapers
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoadingWallpapers && wallpaperImages.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="text-cyan-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {wallpaperImages.map((item, index) => (
            <div key={item.id} className="aspect-video">
              <GalleryImageCard
                id={item.id}
                imageUrl={item.coverUrl || ""}
                previewUrl={item.coverUrl}
                title={item.title}
                tags={item.tags}
                saved={savedIds.has(item.id)}
                onView={() =>
                  openViewer(item as any, wallpaperImages as any[], index)
                }
                onSave={() => saveImage(item)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {wallpaperImages.length > 0 && (
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={() =>
              fetchWallpapers(Math.ceil(wallpaperImages.length / 48) + 1)
            }
            disabled={isLoadingWallpapers}
            className="px-8 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-foreground-dim text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {isLoadingWallpapers ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              "Load More"
            )}
          </button>
        </div>
      )}
    </div>
  );
};
