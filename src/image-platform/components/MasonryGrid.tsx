import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import type { PlatformImage } from "../types";
import { useImageEngineStore } from "../useImageEngineStore";
import { streamViaTauri, useMediaLoader } from "../../hooks/useMediaLoader";
import { convertFileSrc } from "@tauri-apps/api/core";
import clsx from "clsx";
import { Check, Images, Play, RefreshCw } from "lucide-react";

interface MasonryGridProps {
  images: PlatformImage[];
  onImageClick?: (image: PlatformImage, index: number) => void;
  onImageDoubleClick?: (image: PlatformImage, index: number) => void;
  onReorder?: (draggedId: string, dropId: string) => void;
  columns?: number;
  feedType?: 'latest' | 'curated' | 'discover' | 'search';
  header?: React.ReactNode;
  emptyState?: React.ReactNode;
  resetScrollKey?: number;
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelection?: (image: PlatformImage) => void;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  images,
  onImageClick,
  onImageDoubleClick,
  onReorder,
  columns = 4,
  feedType,
  header,
  emptyState,
  resetScrollKey = 0,
  selectionMode = false,
  selectedIds,
  onToggleSelection,
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
  const [measuredRatios, setMeasuredRatios] = useState<Record<string, number>>({});
  const previousImagesRef = useRef(images);
  const scrollAnchorRef = useRef<{ id: string; offset: number } | null>(null);
  const skipScrollAnchorRef = useRef(false);

  const captureScrollAnchor = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const visibleCards = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-masonry-image-id]"),
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > scrollerRect.top + 16 && rect.top < scrollerRect.bottom;
    });

    const anchor = visibleCards.reduce<HTMLElement | null>((closest, element) => {
      if (!closest) return element;
      return element.getBoundingClientRect().top < closest.getBoundingClientRect().top
        ? element
        : closest;
    }, null);

    if (anchor?.dataset.masonryImageId) {
      scrollAnchorRef.current = {
        id: anchor.dataset.masonryImageId,
        offset: anchor.getBoundingClientRect().top - scrollerRect.top,
      };
    }
  };

  // A tab change or explicit refresh intentionally starts at the top. Appending
  // another page is handled separately so it cannot reset the current viewport.
  useLayoutEffect(() => {
    skipScrollAnchorRef.current = true;
    previousImagesRef.current = images;
    scrollAnchorRef.current = null;
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [resetScrollKey]);

  // Masonry placement can change when a newly loaded image reveals its real
  // dimensions. Restore the visible card's offset after each append or reflow.
  useLayoutEffect(() => {
    const previousImages = previousImagesRef.current;
    const didAppend = images.length > previousImages.length;
    previousImagesRef.current = images;

    if (!didAppend || skipScrollAnchorRef.current) {
      skipScrollAnchorRef.current = false;
      return;
    }

    const anchor = scrollAnchorRef.current;
    const scroller = scrollRef.current;
    if (!anchor || !scroller) return;

    const nextAnchor = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-masonry-image-id]"),
    ).find((element) => element.dataset.masonryImageId === anchor.id);

    if (nextAnchor) {
      const scrollerRect = scroller.getBoundingClientRect();
      const nextOffset = nextAnchor.getBoundingClientRect().top - scrollerRect.top;
      scroller.scrollTop += nextOffset - anchor.offset;
    }
  }, [images, measuredRatios]);

  // Keep track of latest state without triggering re-renders of the observer
  const fetchStateRef = useRef({ isFetchingNextPage, hasMore, loadNextPage });
  useEffect(() => {
    fetchStateRef.current = { isFetchingNextPage, hasMore, loadNextPage };
  }, [isFetchingNextPage, hasMore, loadNextPage]);

  // True Masonry Algorithm: Place each image in the shortest column
  const columnData = useMemo(() => {
    const columnCount = Math.max(1, Math.floor(columns));
    const cols: PlatformImage[][] = Array.from({ length: columnCount }, () => []);
    const colHeights = Array(columnCount).fill(0);

    images.forEach((img) => {
      // Find the shortest column
      let minColIndex = 0;
      let minHeight = colHeights[0];
      for (let i = 1; i < columnCount; i++) {
        if (colHeights[i] < minHeight) {
          minHeight = colHeights[i];
          minColIndex = i;
        }
      }

      // Match the real card height. Capping tall images here makes the
      // placement algorithm think a column is free while the card still
      // occupies that space visually.
      const aspectRatio = measuredRatios[img.id] || (img.aspectRatio > 0
        ? img.aspectRatio
        : img.width > 0 && img.height > 0
          ? img.width / img.height
          : 1);
      const heightContribution = 1 / aspectRatio;

      cols[minColIndex].push(img);
      // Add a small constant to account for the grid gap between items
      colHeights[minColIndex] += heightContribution + 0.05; 
    });
    return cols;
  }, [images, columns, measuredRatios]);

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
          captureScrollAnchor();
          state.loadNextPage();
        }
      },
      { root: scrollRef.current, rootMargin: "240px", threshold: 0.01 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [images.length]);

  if (images.length === 0 && (store.isLoading || isFetchingNextPage || hasMore)) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
          <div className="absolute inset-3 animate-pulse rounded-full bg-accent/15" />
        </div>
        <div>
          <p className="font-black uppercase tracking-[0.22em] text-foreground">Gathering fresh media</p>
          <p className="mt-2 max-w-md text-sm text-foreground-muted">Searching active sources and filtering unavailable or recently repeated results. New cards will appear as each source responds.</p>
        </div>
      </div>
    );
  }

  if (images.length === 0 && !store.isLoading && !isFetchingNextPage) {
    return (
      <div className="p-8 text-center text-foreground-muted">
        {emptyState || (hasMore ? 'No visible images yet.' : 'No images found.')}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={captureScrollAnchor}
      className="w-full h-full overflow-y-auto custom-scrollbar px-4 pb-20"
      style={{ overflowAnchor: "none" }}
    >
      {header && <div className="mb-4">{header}</div>}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.floor(columns))}, minmax(0, 1fr))` }}
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
                  onAspectRatioChange={(ratio) => {
                    setMeasuredRatios((current) => {
                      if (Math.abs((current[image.id] || 0) - ratio) < 0.01) return current;
                      return { ...current, [image.id]: ratio };
                    });
                  }}
                  selectionMode={selectionMode}
                  isSelected={selectedIds?.has(image.id) ?? false}
                  onToggleSelection={() => onToggleSelection?.(image)}
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
  onReorder,
  onAspectRatioChange,
  selectionMode,
  isSelected,
  onToggleSelection,
}: {
  image: PlatformImage;
  onClick: () => void;
  onDoubleClick?: () => void;
  onReorder?: (draggedId: string, dropId: string) => void;
  onAspectRatioChange?: (ratio: number) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [proxySrc, setProxySrc] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [hydratedVideoUrl, setHydratedVideoUrl] = useState<string | null>(null);
  const [refreshedMediaUrls, setRefreshedMediaUrls] = useState<string[]>([]);
  const [isRefreshingMedia, setIsRefreshingMedia] = useState(false);
  const [isPreviewEngaged, setIsPreviewEngaged] = useState(false);
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

  // Video samples are often static JPEG posters (notably on Rule34). Prefer
  // the actual video file; images retain the bandwidth-friendly sample order.
  const videoUrlPattern = /\.(mp4|webm|ogv|ogg|m4v)(?:\?|$)/i;
  const sankakuPosterUrls = [image.thumbnailUrl, image.previewUrl, image.sampleUrl]
    .filter(url => url && !videoUrlPattern.test(url));
  const mediaCandidates = image.mediaType === 'video'
    ? image.providerId === 'sankaku' && !isPreviewEngaged
      ? sankakuPosterUrls
      : [hydratedVideoUrl, ...refreshedMediaUrls, image.fullUrl, image.sampleUrl, image.thumbnailUrl, image.previewUrl]
    : [...refreshedMediaUrls, image.thumbnailUrl, image.sampleUrl, image.previewUrl, image.fullUrl];
  const mediaUrls = Array.from(new Set(mediaCandidates.filter(Boolean)));
  let targetUrl = mediaUrls[sourceIndex] || mediaUrls[0] || "";
  let shouldWaitForProxy = false;
  let finalSrc: string | null = targetUrl;
  let isVideo = Boolean(targetUrl?.match(videoUrlPattern));
  let isRangeStreamVideo = false;
  const isDeclaredVideo = image.mediaType === 'video';
  const isCollection = image.providerId === 'e-hentai'
    || (image.relatedGroupSize || 0) > 1;
  const hasMedia = mediaUrls.length > 0;

  if (image.localPath) {
    // If the file exists locally, bypass everything and load straight from disk
    const localSrc = convertFileSrc(image.localPath);
    targetUrl = localSrc;
    finalSrc = localSrc;
    isVideo = Boolean(localSrc.match(/\.(mp4|webm|ogv|ogg|m4v)(?:\?|$)/i));
  } else {
    // Signed Sankaku video URLs support browser streaming/range requests. A
    // blob proxy must download the entire clip before playback can begin,
    // which makes longer thumbnail previews appear permanently frozen.
    isRangeStreamVideo = isVideo && (image.providerId === 'sankaku' || image.providerId === 'rule34');
    shouldWaitForProxy = !isRangeStreamVideo && needsProxy(targetUrl);
    finalSrc = shouldWaitForProxy ? proxySrc : (isRangeStreamVideo ? streamViaTauri(targetUrl) : targetUrl);
    if (finalSrc && retryAttempt > 0 && !shouldWaitForProxy) {
      try {
        const retryUrl = new URL(finalSrc);
        retryUrl.searchParams.set("flowmanga_retry", String(retryAttempt));
        finalSrc = retryUrl.toString();
      } catch {
        // Keep the original URL when it is not a standard URL.
      }
    }
  }

  useEffect(() => {
    setIsLoaded(false);
    setProxySrc(null);
    setSourceIndex(0);
    setRetryAttempt(0);
    setHasError(false);
    setHydratedVideoUrl(null);
    setRefreshedMediaUrls([]);
  }, [image.id, image.thumbnailUrl, image.previewUrl, image.sampleUrl, image.fullUrl]);

  const retryMedia = async () => {
    setHasError(false);
    setIsLoaded(false);
    setSourceIndex(0);
    setRetryAttempt(0);
    setProxySrc(null);

    if (image.providerId !== 'sankaku' || isRefreshingMedia) return;
    setIsRefreshingMedia(true);
    try {
      const { federator } = await import('../SearchFederator');
      const fresh = await federator.getById(image.providerId, image.sourceId, { forceRefresh: true });
      const urls = Array.from(new Set(
        [fresh?.fullUrl, fresh?.sampleUrl, fresh?.previewUrl, fresh?.thumbnailUrl]
          .filter((url): url is string => Boolean(url)),
      ));
      if (urls.length === 0) {
        setHasError(true);
        return;
      }
      setRefreshedMediaUrls(urls);
      const playable = urls.find(url => videoUrlPattern.test(url));
      if (playable) setHydratedVideoUrl(playable);
    } catch (error) {
      console.warn(`[MasonryGrid] Failed to refresh Sankaku media ${image.sourceId}:`, error);
      setHasError(true);
    } finally {
      setIsRefreshingMedia(false);
    }
  };

  // Sankaku list responses commonly mark a post as video while providing only
  // a static poster. Resolve the signed MP4 only when the card is engaged.
  // Resolving every near-viewport card would fill Sankaku's shared rate-limit
  // queue and starve Latest, Discovery, and Search requests.
  useEffect(() => {
    if (!isVisible || !isPreviewEngaged || image.providerId !== 'sankaku' || image.mediaType !== 'video' || hydratedVideoUrl) return;
    const alreadyPlayable = [image.fullUrl, image.sampleUrl, image.previewUrl, image.thumbnailUrl]
      .some(url => /\.(mp4|webm|ogv|ogg|m4v)(?:\?|$)/i.test(url || ''));
    if (alreadyPlayable) return;

    let active = true;
    const timer = setTimeout(() => {
      void import('../SearchFederator').then(({ federator }) => federator.getById(image.providerId, image.sourceId))
        .then(fresh => {
          if (!active) return;
          const playable = [fresh?.fullUrl, fresh?.sampleUrl, fresh?.previewUrl, fresh?.thumbnailUrl]
            .find(url => /\.(mp4|webm|ogv|ogg|m4v)(?:\?|$)/i.test(url || ''));
          if (playable) setHydratedVideoUrl(playable);
          else console.info(`[MasonryGrid] Sankaku video ${image.sourceId} has no animated preview available for this session.`);
        })
        .catch(error => {
          if (active) console.warn(`[MasonryGrid] Failed to hydrate Sankaku video preview ${image.sourceId}:`, error);
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [hydratedVideoUrl, image.fullUrl, image.mediaType, image.previewUrl, image.providerId, image.sampleUrl, image.sourceId, image.thumbnailUrl, isPreviewEngaged, isVisible]);

  // Fetch proxy URL if needed when visible
  useEffect(() => {
    if (!isVisible || !shouldWaitForProxy || image.localPath) return;

    let active = true;
    setProxySrc(null);
    proxyViaTauri(targetUrl).then((blobUrl) => {
      if (active && blobUrl) setProxySrc(blobUrl);
    });
    return () => {
      active = false;
    };
  }, [
    isVisible,
    targetUrl,
    shouldWaitForProxy,
    proxyViaTauri,
    image.localPath,
    retryAttempt,
  ]);

  // Use the same fallback as the column placer so missing metadata cannot
  // create an invalid or misleading placeholder height.
  const aspectRatio = image.aspectRatio > 0
    ? image.aspectRatio
    : image.width > 0 && image.height > 0
      ? image.width / image.height
      : 1;
  const paddingBottom = `${(1 / aspectRatio) * 100}%`;

  const showSkeleton = hasMedia && (!isLoaded || (shouldWaitForProxy && !proxySrc));
  const handleMediaLoad = (width: number, height: number) => {
    setIsLoaded(true);
    setHasError(false);
    if (width > 0 && height > 0) onAspectRatioChange?.(width / height);
  };
  const handleMediaError = () => {
    setIsLoaded(false);
    setProxySrc(null);

    if (isRangeStreamVideo) {
      // Never download a complete remote video into a grid-card blob. A few
      // large clips are enough to exhaust WebView2's renderer memory. Fall
      // through to the static poster and reserve blob fallback for the modal.
      console.warn(`[MasonryGrid] ${image.providerId} range preview failed for ${image.sourceId}; using poster fallback.`);
      if (sourceIndex < mediaUrls.length - 1) {
        setSourceIndex((index) => index + 1);
        setRetryAttempt(0);
        return;
      }
    }

    if (retryAttempt < 2) {
      setRetryAttempt((attempt) => attempt + 1);
      return;
    }

    if (sourceIndex < mediaUrls.length - 1) {
      setSourceIndex((index) => index + 1);
      setRetryAttempt(0);
      return;
    }

    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div
      ref={cardRef}
      data-masonry-image-id={image.id}
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
        isSelected && "border-accent ring-2 ring-accent/70",
        isDragOver ? "border-accent shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-[0.98] z-20" : "border-border-subtle"
      )}
      onMouseEnter={() => setIsPreviewEngaged(true)}
      onMouseLeave={() => setIsPreviewEngaged(false)}
      onFocusCapture={() => setIsPreviewEngaged(true)}
      style={{ paddingBottom }}
      onClick={() => {
        if (selectionMode) {
          onToggleSelection?.();
          return;
        }
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
      {selectionMode && (
        <div className={clsx(
          "absolute right-3 top-3 z-40 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-lg",
          isSelected ? "border-accent bg-accent text-white" : "border-white/70 bg-black/60 text-transparent",
        )} aria-hidden="true">
          <Check size={16} strokeWidth={3} />
        </div>
      )}
      {isCollection && (
        <div
          aria-label="Multiple images"
          title="Multiple images"
          className={clsx(
            "absolute right-3 z-30 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg backdrop-blur-sm pointer-events-none",
            selectionMode ? "top-12" : "top-3",
          )}
        >
          <Images size={13} />
          <span>Gallery</span>
        </div>
      )}
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
              onLoadedData={(event) => handleMediaLoad(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
              onError={handleMediaError}
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
              onLoad={(event) => handleMediaLoad(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
              onError={handleMediaError}
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
          {isDeclaredVideo && (
            <div aria-label="Video" title="Video" className="absolute left-3 top-3 z-30 inline-flex items-center rounded-full bg-black/75 p-2 text-white shadow-lg backdrop-blur-sm pointer-events-none">
              <Play size={12} fill="currentColor" />
            </div>
          )}
        </>
      )}
      {isVisible && !hasMedia && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-surface text-center p-4">
          <span className="text-xs font-black uppercase tracking-widest text-foreground-muted">
            {image.mediaStatus === 'session_access_required'
              ? 'Saved session needs verification'
              : image.mediaStatus === 'login_required'
                ? 'Sign in to view'
                : image.mediaStatus === 'premium_required'
                  ? 'Premium content'
                  : 'Media unavailable'}
          </span>
          {image.sourceUrl && <span className="text-[10px] text-foreground-muted">Open the original source for access.</span>}
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-surface text-center p-4">
          <span className="text-xs font-black uppercase tracking-widest text-foreground-muted">{isRefreshingMedia ? 'Refreshing media link' : 'Preview unavailable'}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void retryMedia();
            }}
            disabled={isRefreshingMedia}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-raised text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={12} className={isRefreshingMedia ? 'animate-spin' : undefined} /> {isRefreshingMedia ? 'Refreshing' : 'Retry'}
          </button>
        </div>
      )}
    </div>
  );
};
