import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { PlatformImage } from '../types';
import { useImageEngineStore } from '../useImageEngineStore';
import clsx from 'clsx';

interface MasonryGridProps {
  images: PlatformImage[];
  onImageClick?: (image: PlatformImage, index: number) => void;
  columns?: number;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({ 
  images, 
  onImageClick,
  columns = 4 
}) => {
  const store = useImageEngineStore();
  const hasMore = store.feeds[store.fetchMode].hasMore;
  const isFetchingNextPage = store.isFetchingNextPage;
  const loadNextPage = store.loadNextPage;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Keep track of latest state without triggering re-renders of the observer
  const fetchStateRef = useRef({ isFetchingNextPage, hasMore, loadNextPage });
  useEffect(() => {
    fetchStateRef.current = { isFetchingNextPage, hasMore, loadNextPage };
  }, [isFetchingNextPage, hasMore, loadNextPage]);

  // Divide images into columns for pure CSS masonry
  const columnData = useMemo(() => {
    const cols: PlatformImage[][] = Array.from({ length: columns }, () => []);
    images.forEach((img, index) => {
      cols[index % columns].push(img);
    });
    return cols;
  }, [images, columns]);

  // Infinite Scroll Trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const state = fetchStateRef.current;
        if (entries[0].isIntersecting && !state.isFetchingNextPage && state.hasMore) {
          state.loadNextPage();
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [images.length]);

  if (images.length === 0) {
    return <div className="p-8 text-center text-foreground-muted">No images found.</div>;
  }

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar px-4 pb-20">
      <div 
        className="grid gap-4" 
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {columnData.map((col, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-4">
            {col.map((image) => {
              const globalIndex = images.findIndex(img => img.id === image.id);
              return (
                <ImageCard 
                  key={image.id} 
                  image={image} 
                  onClick={() => onImageClick?.(image, globalIndex)} 
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Infinite Scroll Sentinel */}
      <div 
        ref={loadMoreRef} 
        className="w-full h-32 flex items-center justify-center mt-8"
      >
        {isFetchingNextPage && (
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
        )}
        {!hasMore && images.length > 0 && (
          <div className="text-foreground-muted text-sm uppercase tracking-widest font-black">
            End of Results
          </div>
        )}
      </div>
    </div>
  );
};

const ImageCard = ({ image, onClick }: { image: PlatformImage, onClick: () => void }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Lazy loading using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '500px' }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  // Pre-calculate container height based on aspect ratio to prevent layout shifting
  const paddingBottom = `${(1 / image.aspectRatio) * 100}%`;

  return (
    <div 
      ref={cardRef}
      className="relative w-full rounded-xl overflow-hidden bg-surface-elevated border border-border-subtle group cursor-pointer"
      style={{ paddingBottom }}
      onClick={onClick}
    >
      {isVisible && (
        <>
          {(image.thumbnailUrl?.match(/\.(mp4|webm)(?:\?|$)/i) || image.sampleUrl?.match(/\.(mp4|webm)(?:\?|$)/i) || image.fullUrl?.match(/\.(mp4|webm)(?:\?|$)/i)) ? (
            <video
              src={image.sampleUrl || image.fullUrl}
              autoPlay
              loop
              muted
              playsInline
              referrerPolicy="no-referrer"
              onLoadedData={() => setIsLoaded(true)}
              className={clsx(
                "absolute inset-0 w-full h-full object-cover transition-all duration-700",
                isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105",
                "group-hover:scale-105"
              )}
            />
          ) : (
            <img
              src={image.thumbnailUrl || image.sampleUrl}
              alt={image.tags.slice(0, 5).join(' ')}
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setIsLoaded(true)}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== image.sampleUrl && image.sampleUrl) {
                  img.src = image.sampleUrl; // Fallback to sampleUrl
                } else {
                  setIsLoaded(true); // Force show broken image if both fail
                }
              }}
              className={clsx(
                "absolute inset-0 w-full h-full object-cover transition-all duration-700",
                isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105",
                "group-hover:scale-105"
              )}
            />
          )}
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={clsx(
                "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                image.rating === 'safe' ? "bg-green-500/20 text-green-400" : 
                image.rating === 'explicit' ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
              )}>
                {image.rating}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface/80 backdrop-blur text-[10px] text-foreground-dim uppercase font-black">
                {image.providerId}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {image.tags.slice(0, 3).map((tag, idx) => (
                <span key={`${tag}-${idx}`} className="text-[10px] text-white/80 truncate max-w-[100px]">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
