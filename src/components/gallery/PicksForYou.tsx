/**
 * PicksForYou
 * 
 * Personalized recommendations based on user's favorite tags,
 * liked images, and interaction history.
 * Falls back to curated aesthetics on cold start.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { useGalleryStore } from '../../stores/useGalleryStore';
import { GalleryImageCard } from './GalleryImageCard';

export const PicksForYou: React.FC = () => {
  const {
    picksForYou, isLoadingPicks, generatePicksForYou,
    favoriteTags, savedImages, saveImage, openViewer
  } = useGalleryStore();

  const [page, setPage] = useState(1);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (picksForYou.length === 0) generatePicksForYou(1);
  }, []);

  const loadMore = useCallback(() => {
    if (isLoadingPicks) return;
    const nextPage = page + 1;
    setPage(nextPage);
    generatePicksForYou(nextPage);
  }, [page, isLoadingPicks, generatePicksForYou]);

  const bottomRef = useCallback((node: HTMLDivElement) => {
    if (isLoadingPicks) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    }, { rootMargin: '1200px' });
    
    if (node) observerRef.current.observe(node);
  }, [isLoadingPicks, loadMore]);

  const savedIds = new Set(savedImages.map(i => i.id));
  const hasHistory = favoriteTags.length > 0 || savedImages.some(i => i.liked);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">
              {hasHistory ? 'Picks For You' : 'Curated Aesthetics'}
            </h3>
            <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-0.5">
              {hasHistory ? 'Based on your taste profile' : 'Discover your visual style'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {picksForYou.length > 0 && (
            <button
              onClick={() => useGalleryStore.getState().startSlideshowFromContext(picksForYou, 0, "picks")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 text-[10px] font-black uppercase tracking-widest transition-all border border-purple-500/20"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              Play Vision
            </button>
          )}
          <button
            onClick={() => {
              setPage(1);
              generatePicksForYou(1);
            }}
            disabled={isLoadingPicks}
            className="px-5 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-purple-500/10 hover:border-purple-500/20 text-foreground-dim hover:text-purple-400 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {isLoadingPicks && page === 1 ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
        </div>
      </div>

      {/* Favorite Tags Bar */}
      {favoriteTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {favoriteTags.slice(0, 10).map(tag => (
            <span
              key={tag}
              className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-wider border border-purple-500/10"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoadingPicks && picksForYou.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 size={24} className="text-purple-500 animate-spin" />
          <p className="text-foreground-dim text-xs font-bold uppercase tracking-widest">Analyzing your taste...</p>
        </div>
      ) : picksForYou.length === 0 ? (
        <div className="py-16 border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-center gap-4 bg-white/[0.01]">
          <Sparkles size={32} className="text-purple-500/30" />
          <div>
            <p className="text-foreground/40 text-sm font-bold">No recommendations yet</p>
            <p className="text-foreground-dim text-xs mt-1">Save and like images to teach the engine your taste</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {picksForYou.map((item, index) => (
              <GalleryImageCard
                key={`${item.id}-${index}`}
                id={item.id}
                imageUrl={item.sampleUrl || item.fullUrl || ''}
                previewUrl={item.previewUrl || item.thumbnailUrl}
                title={item.title}
                tags={item.tags}
                saved={savedIds.has(item.id)}
                onView={() => {
                  if (item.contentCategory === "gallery" || item.contentCategory === "album" || item.contentCategory === "doujin") {
                     import("../../stores/useModalStore").then(({ useModalStore }) => {
                        useModalStore.getState().openQuickView(item);
                     });
                  } else {
                     openViewer(item as any, picksForYou as any[], index);
                  }
                }}
                onPlay={() => useGalleryStore.getState().startSlideshowFromContext(picksForYou, index, "picks")}
                onSave={() => saveImage(item)}
              />
            ))}
          </div>
          
          <div ref={bottomRef} className="h-10 flex items-center justify-center">
            {isLoadingPicks && page > 1 && (
              <Loader2 size={24} className="text-purple-500 animate-spin" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
