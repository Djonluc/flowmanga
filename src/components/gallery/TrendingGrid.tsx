/**
 * TrendingGrid
 * 
 * Displays trending/popular images from Zerochan in a masonry-style grid.
 */

import React, { useEffect } from 'react';
import { Loader2, Flame } from 'lucide-react';
import { useGalleryStore } from '../../stores/useGalleryStore';
import { GalleryImageCard } from './GalleryImageCard';

export const TrendingGrid: React.FC = () => {
  const { 
    trendingImages, isLoadingTrending, fetchTrending,
    savedImages, saveImage, openViewer
  } = useGalleryStore();

  useEffect(() => {
    if (trendingImages.length === 0) fetchTrending();
  }, []);

  const savedIds = new Set(savedImages.map(i => i.id));

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Flame size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">Trending Now</h3>
            <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-0.5">Most favorited artwork</p>
          </div>
        </div>

        {trendingImages.length > 0 && (
          <button
            onClick={() => useGalleryStore.getState().startSlideshowFromContext(trendingImages)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 text-[10px] font-black uppercase tracking-widest transition-all border border-orange-500/20"
          >
            <Loader2 size={14} className="hidden" /> {/* Placeholder for Play icon if needed */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            Play Vision
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoadingTrending && trendingImages.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="text-purple-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {trendingImages.map((item, index) => (
            <GalleryImageCard
              key={item.id}
              id={item.id}
              imageUrl={item.coverUrl || ''}
              previewUrl={item.coverUrl}
              title={item.title}
              tags={item.tags}
              saved={savedIds.has(item.id)}
              onView={() => openViewer(item as any, trendingImages as any[], index)}
              onSave={() => saveImage(item)}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {trendingImages.length > 0 && (
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={() => fetchTrending(Math.ceil(trendingImages.length / 24) + 1)}
            disabled={isLoadingTrending}
            className="px-8 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-foreground-dim text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {isLoadingTrending ? <Loader2 size={14} className="animate-spin" /> : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};
