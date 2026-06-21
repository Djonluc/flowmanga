import React, { useEffect, useRef, useState, useMemo } from "react";
import type { PlatformImage } from "../types";
import { useImageEngineStore } from "../useImageEngineStore";
import { useMediaLoader } from "../../hooks/useMediaLoader";
import { convertFileSrc } from "@tauri-apps/api/core";
import clsx from "clsx";

interface MasonryGridProps {
  images: PlatformImage[];
  onImageClick?: (image: PlatformImage, index: number) => void;
  onImageDoubleClick?: (image: PlatformImage, index: number) => void;
  onReorder?: (draggedId: string, dropId: string) => void;
  columns?: number;
  feedType?: 'latest' | 'curated' | 'discover' | 'search';
  header?: React.ReactNode;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  images,
  onImageClick,
  onImageDoubleClick,
  onReorder,
  columns = 4,
  feedType,
  header
}) => {
  const store = useImageEngineStore();
  
  // If feedType is provided, read directly from that feed. Otherwise fallback to active mode.
  const activeFeedType = feedType || store.fetchMode;
  const hasMore = store.feeds[activeFeedType].hasMore;
  const isFetchingNextPage = store.isFetchingNextPage && store.fetchMode === activeFeedType;
  const loadNextPage = () => {
    if (store.fetchMode === activeFeedType) store.loadNextPage();
  };
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep track of latest state without triggering re-renders of the observer
  const fetchStateRef = useRef({ isFetchingNextPage, hasMore, loadNextPage });
  useEffect(() => {
    fetchStateRef.current = { isFetchingNextPage, hasMore, loadNextPage };
  }, [isFetchingNextPage, hasMore, loadNextPage]);

  // True Masonry Algorithm: Place each image in the shortest column
  const columnData = useMemo(() => {
    const cols: PlatformImage[][] = Array.from({ length: columns }, () => []);
    const colHeights = Array(columns).fill(0);

    images.forEach((img) => {
      // Find the shortest column
      let minColIndex = 0;
      let minHeight = colHeights[0];
      for (let i = 1; i < columns; i++) {
        if (colHeights[i] < minHeight) {
          minHeight = colHeights[i];
          minColIndex = i;
        }
      }

      // Calculate relative height contribution
      // Cap at a max height multiplier of 3x width (aspectRatio >= 0.33) 
      // to avoid extreme gaps from long webtoon strips
      const effectiveRatio = img.aspectRatio && img.aspectRatio > 0 ? Math.max(img.aspectRatio, 0.33) : 1;
      const heightContribution = 1 / effectiveRatio;

      cols[minColIndex].push(img);
      // Add a small constant to account for the grid gap between items
      colHeights[minColIndex] += heightContribution + 0.05; 
    });
    return cols;
  }, [images, columns]);

  // Infinite Scroll Trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const state = fetchStateRef.current;
        if (
          entries[0].isIntersecting &&
          !state.isFetchingNextPage &&
          state.hasMore
        ) {
          state.loadNextPage();
        }
      },
      { rootMargin: "100px", threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="p-8 text-center text-foreground-muted">
        No images found.
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="w-full h-full overflow-y-auto custom-scrollbar px-4 pb-20">
      {header && <div className="mb-4">{header}</div>}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {columnData.map((col, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-4">
            {col.map((image) => {
              const globalIndex = images.findIndex(
                (img) => img.id === image.id,
              );
              return (
                <ImageCard
                  key={image.id}
                  image={image}
                  onClick={() => onImageClick?.(image, globalIndex)}
                  onDoubleClick={() => onImageDoubleClick?.(image, globalIndex)}
                  onReorder={onReorder}
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

const ImageCard = ({
  image,
  onClick,
  onDoubleClick,
  onReorder
}: {
  image: PlatformImage;
  onClick: () => void;
  onDoubleClick?: () => void;
  onReorder?: (draggedId: string, dropId: string) => void;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [proxySrc, setProxySrc] = useState<string | null>(null);
  const { proxyViaTauri, needsProxy } = useMediaLoader();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [isDragOver, setIsDragOver] = useState(false);

  // Lazy loading using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px" },
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  let targetUrl = image.thumbnailUrl || image.sampleUrl || "";
  let shouldWaitForProxy = false;
  let finalSrc = targetUrl;
  let isVideo = targetUrl?.match(/\.(mp4|webm)(?:\?|$)/i);

  if (image.localPath) {
    // If the file exists locally, bypass everything and load straight from disk
    const localSrc = convertFileSrc(image.localPath);
    targetUrl = localSrc;
    finalSrc = localSrc;
    isVideo = localSrc.match(/\.(mp4|webm)(?:\?|$)/i);
  } else {
    shouldWaitForProxy = needsProxy(targetUrl);
    finalSrc = shouldWaitForProxy ? proxySrc : targetUrl;
  }

  // Fetch proxy URL if needed when visible
  useEffect(() => {
    if (!isVisible || !shouldWaitForProxy || image.localPath) return;

    proxyViaTauri(targetUrl).then((blobUrl) => {
      if (blobUrl) setProxySrc(blobUrl);
    });
  }, [
    isVisible,
    targetUrl,
    shouldWaitForProxy,
    proxyViaTauri,
    image.localPath,
  ]);

  // Pre-calculate container height based on aspect ratio to prevent layout shifting
  const paddingBottom = `${(1 / image.aspectRatio) * 100}%`;

  const showSkeleton = !isLoaded || (shouldWaitForProxy && !proxySrc);

  return (
    <div
      ref={cardRef}
      draggable={!!onReorder}
      onDragStart={(e) => {
        if (!onReorder) return;
        e.dataTransfer.setData('text/plain', image.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (!onReorder) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!onReorder) return;
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        if (!onReorder) return;
        e.preventDefault();
        setIsDragOver(false);
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== image.id) {
          onReorder(draggedId, image.id);
        }
      }}
      className={clsx(
        "relative w-full rounded-xl overflow-hidden bg-surface-elevated border group cursor-pointer transition-all",
        isDragOver ? "border-accent shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-[0.98] z-20" : "border-border-subtle"
      )}
      style={{ paddingBottom }}
      onClick={() => {
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
          onDoubleClick?.();
        } else {
          clickTimer.current = setTimeout(() => {
            clickTimer.current = null;
            onClick();
          }, 250);
        }
      }}
    >
      {/* Loading Skeleton */}
      {showSkeleton && (
        <div className="absolute inset-0 bg-surface flex flex-col justify-end p-4 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.5s_infinite] -translate-x-full"></div>
          <div className="w-1/3 h-4 bg-black/20 rounded mb-2"></div>
          <div className="flex gap-1">
            <div className="w-12 h-3 bg-black/20 rounded"></div>
            <div className="w-16 h-3 bg-black/20 rounded"></div>
          </div>
        </div>
      )}

      {isVisible && finalSrc && (
        <>
          {isVideo ? (
            <video
              src={finalSrc}
              autoPlay
              loop
              muted
              playsInline
              referrerPolicy="no-referrer"
              onLoadedData={() => setIsLoaded(true)}
              className={clsx(
                "absolute inset-0 w-full h-full object-cover transition-all duration-700 z-10",
                isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105",
                "group-hover:scale-105",
              )}
            />
          ) : (
            <img
              src={finalSrc}
              alt={image.tags.slice(0, 5).join(" ")}
              referrerPolicy="no-referrer"
              onLoad={() => setIsLoaded(true)}
              onError={(e) => {
                const img = e.currentTarget;
                if (
                  !shouldWaitForProxy &&
                  img.src !== image.sampleUrl &&
                  image.sampleUrl
                ) {
                  img.src = image.sampleUrl; // Fallback to sampleUrl
                } else {
                  setIsLoaded(true); // Force show broken image if both fail
                }
              }}
              className={clsx(
                "absolute inset-0 w-full h-full object-cover transition-all duration-700 z-10",
                isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105",
                "group-hover:scale-105",
              )}
            />
          )}
          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-20 pointer-events-none">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={clsx(
                  "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                  image.rating === "safe"
                    ? "bg-green-500/20 text-green-400"
                    : image.rating === "explicit"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-yellow-500/20 text-yellow-400",
                )}
              >
                {image.rating}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface/80 backdrop-blur text-[10px] text-foreground-dim uppercase font-black">
                {image.providerId}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {image.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={`${tag}-${idx}`}
                  className="text-[10px] text-white/80 truncate max-w-[100px]"
                >
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
