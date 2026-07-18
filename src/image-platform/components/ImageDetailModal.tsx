import React from 'react';
import { createPortal } from 'react-dom';
import type { PlatformImage } from '../types';
import { useSlideshowStore } from '../useSlideshowStore';
import { useImageCollectionStore } from '../useImageCollectionStore';
import { Download, Heart, FolderPlus, Play, ExternalLink, X, Tag, Loader2, Star, RefreshCw, Folder, Trash2, Search, ShieldAlert, ZoomIn, ZoomOut, Maximize, Minimize, Move, Pin } from 'lucide-react';
import clsx from 'clsx';
import { useGalleryStore } from '../../stores/useGalleryStore';
import { toast } from '../../components/Toast';
import { writeFile, mkdir, remove } from '@tauri-apps/plugin-fs';
import { pictureDir, join } from '@tauri-apps/api/path';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { streamViaTauri, useMediaLoader } from '../../hooks/useMediaLoader';
import { TagWikiService } from '../../services/TagWikiService';
import type { TagWiki } from '../../services/TagWikiService';
import { getSankakuAuthHeaders } from '../../services/Sankaku';

interface ImageDetailModalProps {
  image: PlatformImage;
  images: PlatformImage[];
  index: number;
  onClose: () => void;
  onNavigate?: (newIndex: number) => void;
  onSearchTag: (tag: string) => void;
  favoriteTags?: string[];
  onToggleFavorite?: (tag: string) => void;
}

const ClickableTag = ({ tag, type, onSearch, onClose, isInterest }: { tag: string, type: string, onSearch: (t: string) => void, onClose: () => void, isInterest: boolean }) => {
  const { favoriteTags, blockedTags, toggleTagState } = useGalleryStore();
  const cleanTag = tag.replace(`${type}:`, '').toLowerCase().trim();
  const isFav = favoriteTags.includes(cleanTag);
  const isBlocked = blockedTags.includes(cleanTag);

  const [isHovered, setIsHovered] = React.useState(false);
  const [wiki, setWiki] = React.useState<TagWiki | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [tooltipPos, setTooltipPos] = React.useState({ top: 0, left: 0 });
  const buttonRef = React.useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setTooltipPos({
          top: rect.top + rect.height / 2,
          left: rect.left - 10
        });
      }
      setIsHovered(true);
      if (!wiki) {
        setLoading(true);
        TagWikiService.fetchDescription(cleanTag).then(res => {
          setWiki(res);
          setLoading(false);
        });
      }
    }, 400);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
  };

  const handlePinInterest = async () => {
    try {
      const { getDb } = await import('../../services/db');
      const { toast } = await import('../../components/Toast');
      const db = getDb();
      try {
        await db.execute(
          "INSERT INTO UserInterests (id, type, name, score, isPinned) VALUES (?, ?, ?, 100, 1)",
          [crypto.randomUUID(), type, cleanTag]
        );
        toast.success(`Pinned ${cleanTag} as interest!`);
      } catch {
        await db.execute(
          "UPDATE UserInterests SET isPinned = 1 WHERE type = ? AND name = ?",
          [type, cleanTag]
        );
        toast.success(`Pinned ${cleanTag} as interest!`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  let colorClasses = "bg-surface border-border-subtle hover:border-accent text-foreground-muted hover:text-foreground";
  if (isFav) {
    colorClasses = "bg-yellow-500/20 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/30";
  } else if (isBlocked) {
    colorClasses = "bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30";
  } else if (isInterest) {
    colorClasses = "bg-sky-500/20 border-sky-500/50 text-sky-500 hover:bg-sky-500/30";
  } else {
    if (type === "artist") colorClasses = "bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20";
    else if (type === "series") colorClasses = "bg-purple-500/10 border-purple-500/20 text-purple-300 hover:bg-purple-500/20";
    else if (type === "character") colorClasses = "bg-green-500/10 border-green-500/20 text-green-300 hover:bg-green-500/20";
  }

  return (
    <div className="flex group relative" ref={buttonRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button 
        onClick={() => toggleTagState(cleanTag, type)} 
        className={`px-3 py-1.5 border rounded-l-lg text-sm transition-all border-r-0 flex items-center gap-2 ${colorClasses}`}
        title="Click to toggle Favorite / Block"
      >
        {isFav && <Star size={12} fill="currentColor" />}
        {isBlocked && <ShieldAlert size={12} />}
        {cleanTag}
      </button>
      <button 
        onClick={handlePinInterest} 
        className={`px-2 py-1.5 border rounded-none transition-all border-l-0 border-r-0 ${colorClasses} opacity-80 hover:opacity-100`}
        title="Pin to Interest Manager"
      >
        <Pin size={12} />
      </button>
      <button 
        onClick={() => { onSearch(cleanTag); onClose(); }} 
        className={`px-2 py-1.5 border rounded-r-lg transition-all ${colorClasses} opacity-80 hover:opacity-100`}
        title="Search this tag"
      >
        <Search size={12} />
      </button>

      {/* Hover Tooltip via Portal to avoid clipping */}
      {isHovered && createPortal(
        <div 
          className="fixed z-[9999] bg-surface-elevated border border-border-subtle rounded-xl shadow-2xl p-4 text-left pointer-events-none animate-fade-in w-72 backdrop-blur-xl"
          style={{ top: tooltipPos.top, left: tooltipPos.left, transform: 'translate(-100%, -50%)' }}
        >
          <h4 className="text-foreground font-black uppercase tracking-widest text-xs mb-2 border-b border-border-subtle pb-2">{cleanTag}</h4>
          {loading ? (
            <div className="flex items-center gap-2 text-foreground-muted text-xs">
              <Loader2 size={12} className="animate-spin" /> Loading description...
            </div>
          ) : wiki ? (
            <div 
              className="text-xs text-foreground-muted line-clamp-6 tag-tooltip-html"
              dangerouslySetInnerHTML={{ __html: wiki.parsedBody }}
            />
          ) : (
            <p className="text-xs text-foreground-muted italic">No description available.</p>
          )}
          {/* Arrow pointing to the right */}
          <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-surface-elevated border-t border-r border-border-subtle transform rotate-45" />
        </div>,
        document.body
      )}
    </div>
  );
};

export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({ image, images, index, onClose, onNavigate, onSearchTag }) => {
  const slideshow = useSlideshowStore();
  const { savedImages, saveImage, removeSavedImage, folders, loadFolders, refreshMetadata, updateLocalPath } = useImageCollectionStore();
  const imageDownloadPath = useSettingsStore(state => state.imageDownloadPath);
  const { proxyViaTauri, needsProxy } = useMediaLoader();
  const [showFolderMenu, setShowFolderMenu] = React.useState(false);
  const [showAllTags, setShowAllTags] = React.useState(false);
  const [downloadingIds, setDownloadingIds] = React.useState<string[]>([]);
  const isDownloading = downloadingIds.includes(image.id);
  const [isRefreshingMeta, setIsRefreshingMeta] = React.useState(false);
  
  const [userInterests, setUserInterests] = React.useState<string[]>([]);
  React.useEffect(() => {
    const fetchInterests = async () => {
      try {
        const { TagIntelligenceService } = await import('../services/TagIntelligenceService');
        const interests = await TagIntelligenceService.getInterests();
        setUserInterests(interests.map(i => i.name.toLowerCase()));
      } catch (e) { console.error(e); }
    };
    fetchInterests();
  }, []);

  // Pan and Zoom State
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const isImageTall = Boolean(image.height && image.width && (image.height / image.width > 1.5));
  const initialVideoSource = [image.fullUrl, image.sampleUrl, image.previewUrl]
    .find(url => Boolean(url?.match(/\.(mp4|webm)(?:\?|$)/i))) || null;
  const [videoSource, setVideoSource] = React.useState<string | null>(initialVideoSource);
  const isVideo = image.mediaType === 'video' && Boolean(videoSource);

  const getContainedImageSize = React.useCallback(() => {
    const container = containerRef.current;
    if (!container || !image.width || !image.height) return null;

    const rect = container.getBoundingClientRect();
    const imageAspectRatio = image.width / image.height;
    const containerAspectRatio = rect.width / rect.height;
    const width = imageAspectRatio > containerAspectRatio
      ? rect.width
      : rect.height * imageAspectRatio;

    return { width, height: width / imageAspectRatio, container: rect };
  }, [image.width, image.height]);

  const clampPanForScale = React.useCallback((nextScale: number, x: number, y: number) => {
    const contained = getContainedImageSize();
    if (!contained || nextScale <= 1) return { x: 0, y: 0 };

    const maxX = Math.max(0, (contained.width * nextScale - contained.container.width) / 2);
    const maxY = Math.max(0, (contained.height * nextScale - contained.container.height) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, [getContainedImageSize]);

  const resetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const fitToWidth = () => {
    const contained = getContainedImageSize();
    if (!contained) return;

    const newScale = Math.max(1, contained.container.width / contained.width);
    setScale(newScale);
    setPan(clampPanForScale(newScale, 0, isImageTall ? contained.container.height : 0));
  };

  const actualSize = () => {
    const contained = getContainedImageSize();
    if (!contained) return;

    const newScale = Math.max(1, image.width / contained.width);
    setScale(newScale);
    setPan(clampPanForScale(newScale, 0, isImageTall ? contained.container.height : 0));
  };

  React.useEffect(() => {
    // ALWAYS fit to screen by default
    if (!containerRef.current || !image.width || !image.height) {
      resetZoom();
      return;
    }

    // Give the container a tiny delay to ensure it has rendered its dimensions
    setTimeout(() => {
      resetZoom();
    }, 50);
  }, [image.id, image.width, image.height]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (onNavigate && images && images.length > 0) {
        if (e.key === 'ArrowLeft' || e.code === 'KeyA' || e.key.toLowerCase() === 'a') {
          e.preventDefault();
          e.stopPropagation();
          onNavigate(index > 0 ? index - 1 : images.length - 1);
        } else if (e.key === 'ArrowRight' || e.code === 'KeyD' || e.key.toLowerCase() === 'd') {
          e.preventDefault();
          e.stopPropagation();
          onNavigate(index < images.length - 1 ? index + 1 : 0);
        }
      }

      if (e.code === 'KeyF' || e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
        if (!document.fullscreenElement) {
          if (containerRef.current) {
            containerRef.current.requestFullscreen().catch(err => console.log(err));
          }
        } else {
          document.exitFullscreen().catch(err => console.log(err));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [onClose, onNavigate, index, images]);

  React.useEffect(() => {
    // Prevent default wheel behavior on the container to stop page scroll
    const container = containerRef.current;
    const handleWheelNative = (e: WheelEvent) => {
      if (isVideo) return; // Disable zoom for videos to prevent native controls from scaling
      e.preventDefault();
      const zoomSensitivity = e.deltaMode === 1 ? 0.05 : 0.001; // reduced sensitivity
      const delta = -e.deltaY * zoomSensitivity;
      
      setScale(prevScale => {
        let newScale = prevScale * Math.exp(delta);
        newScale = Math.min(Math.max(0.1, newScale), 5); // Max zoom 5x

        if (container) {
          const rect = container.getBoundingClientRect();
          const cursorX = e.clientX - rect.left;
          const cursorY = e.clientY - rect.top;

          const xRatio = (cursorX - rect.width / 2) / prevScale;
          const yRatio = (cursorY - rect.height / 2) / prevScale;

          setPan(prevPan => clampPanForScale(
            newScale,
            prevPan.x - xRatio * (newScale - prevScale),
            prevPan.y - yRatio * (newScale - prevScale),
          ));
        }
        return newScale;
      });
    };

    if (container) {
      container.addEventListener('wheel', handleWheelNative, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheelNative);
      }
    };
  }, [isVideo, clampPanForScale]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || isVideo) return; 
    
    // Do not initiate drag or capture pointer if clicking a button
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan(clampPanForScale(
      scale,
      e.clientX - dragStart.x,
      e.clientY - dragStart.y,
    ));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isVideo) return;
    if (scale > 1.1) {
      resetZoom();
    } else {
      // Zoom in towards cursor
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      
      const newScale = 3;
      const xRatio = (cursorX - rect.width / 2) / scale;
      const yRatio = (cursorY - rect.height / 2) / scale;

      setPan(clampPanForScale(
        newScale,
        pan.x - xRatio * (newScale - scale),
        pan.y - yRatio * (newScale - scale),
      ));
      setScale(newScale);
    }
  };

  React.useEffect(() => {
    loadFolders();
  }, []);



  const savedImageMatch = savedImages.find(img => img.id === image.id);
  const isFavorited = !!savedImageMatch;
  const currentLocalPath = savedImageMatch?.localPath || image.localPath;

  const handleFavoriteToggle = async () => {
    if (isFavorited) {
      await removeSavedImage(image.id);
    } else {
      await saveImage(image, null);
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setDownloadingIds(prev => [...prev, image.id]);
    try {
      
      const urlToDownload = image.fullUrl || image.sampleUrl || image.thumbnailUrl;
      if (!urlToDownload) throw new Error("No URL available for download");

      // Extract extension
      let ext = "jpg";
      const match = urlToDownload.match(/\.(png|jpg|jpeg|gif|webm|mp4|avif|webp)(?:\?|$)/i);
      if (match && match[1]) {
        ext = match[1].toLowerCase();
      }

      // 1. Determine save directory
      let saveDirectory = imageDownloadPath;
      if (!saveDirectory) {
        const picsDir = await pictureDir();
        saveDirectory = await join(picsDir, "FlowManga", "Images");
      }

      // Ensure directory exists
      await mkdir(saveDirectory, { recursive: true });

      // Build full path
      const defaultFilename = `${image.providerId}-${image.sourceId}.${ext}`;
      const savePath = await join(saveDirectory, defaultFilename);

      toast.info(`Downloading to ${savePath}...`);

      // 2. Fetch the file
      const response = await tauriFetch(urlToDownload, {
        method: "GET",
        headers: {
          "User-Agent": "FlowManga/3.0",
          "Referer": image.sourceUrl || "https://chan.sankakucomplex.com/",
          ...(urlToDownload.includes("sankaku") ? getSankakuAuthHeaders() : {}),
        }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const buffer = await response.arrayBuffer();

      // 3. Write file
      await writeFile(savePath, new Uint8Array(buffer));

      toast.success("Download completed successfully!");
      
      // Auto-add to collection database so it appears in My Collection
      if (!isFavorited) {
        await saveImage(image, null);
      }
      
      // Update the localPath so next time it loads natively from disk
      await updateLocalPath(image.id, savePath);
    } catch (e: any) {
      console.error("Download failed:", e);
      toast.error(`Download failed: ${e.message}`);
    } finally {
      setDownloadingIds(prev => prev.filter(id => id !== image.id));
    }
  };

  const handleDeleteDownload = async () => {
    if (!currentLocalPath) return;
    try {
      await remove(currentLocalPath);
      await updateLocalPath(image.id, null);
      toast.success("Local download deleted!");
    } catch (e: any) {
      console.error("Failed to delete local file:", e);
      toast.error("Failed to delete file from disk. It may have already been moved.");
      // Still clear the DB path if it's missing from disk
      await updateLocalPath(image.id, null);
    }
  };

  const handleRefreshMeta = async () => {
    if (isRefreshingMeta) return;
    setIsRefreshingMeta(true);
    toast.info("Refreshing metadata...");
    const success = await refreshMetadata(image.id);
    if (success) {
      toast.success("Metadata updated successfully!");
    } else {
      toast.error("Failed to update metadata. Provider might not support direct fetching.");
    }
    setIsRefreshingMeta(false);
  };

  // Use structured tag fields from providers when available, fall back to prefix-based parsing
  const characterTags: string[] = (image.characterTags && image.characterTags.length > 0)
    ? image.characterTags
    : image.tags.filter(t => typeof t === 'string' && t.startsWith("character:"));
  const artistTags: string[] = (image.artistTags && image.artistTags.length > 0)
    ? image.artistTags
    : image.tags.filter(t => typeof t === 'string' && t.startsWith("artist:"));
  const seriesTags: string[] = (image.copyrightTags && image.copyrightTags.length > 0)
    ? image.copyrightTags
    : image.tags.filter(t => typeof t === 'string' && t.startsWith("series:"));
  const generalTags: string[] = (image.generalTags && image.generalTags.length > 0)
    ? image.generalTags
    : image.tags.filter(t => typeof t === 'string' && !t.startsWith("character:") && !t.startsWith("artist:") && !t.startsWith("series:"));

  const [thumbnailSrc, setThumbnailSrc] = React.useState<string | null>(null);
  const [fullSrc, setFullSrc] = React.useState<string | null>(null);
  const [isFullLoaded, setIsFullLoaded] = React.useState(false);
  const [isThumbLoaded, setIsThumbLoaded] = React.useState(false);
  const [thumbnailRetries, setThumbnailRetries] = React.useState(0);
  const [fullRetries, setFullRetries] = React.useState(0);
  const [sankakuRefreshAttempted, setSankakuRefreshAttempted] = React.useState(false);
  const [videoProxyFallbackAttempted, setVideoProxyFallbackAttempted] = React.useState(false);
  const thumbnailSource = image.thumbnailUrl || image.sampleUrl || image.previewUrl || "";
  const fullSource = image.fullUrl || image.sampleUrl || "";

  const loadRemoteSource = React.useCallback(async (url: string, attempt = 0) => {
    if (!url) return null;
    let candidate = url;
    if (attempt > 0) {
      try {
        const retryUrl = new URL(url);
        retryUrl.searchParams.set("flowmanga_retry", String(attempt));
        candidate = retryUrl.toString();
      } catch {
        // Keep the original URL when it is not a standard URL.
      }
    }
    return needsProxy(candidate) ? proxyViaTauri(candidate) : candidate;
  }, [needsProxy, proxyViaTauri]);

  const refreshSankakuMedia = React.useCallback(async (kind: "thumbnail" | "full") => {
    if (image.providerId !== "sankaku" || sankakuRefreshAttempted) return;
    setSankakuRefreshAttempted(true);
    try {
      const { federator } = await import("../SearchFederator");
      const fresh = await federator.getById(image.providerId, image.sourceId);
      const freshUrl = kind === "thumbnail"
        ? (fresh?.thumbnailUrl || fresh?.sampleUrl || fresh?.previewUrl)
        : (fresh?.fullUrl || fresh?.sampleUrl || fresh?.thumbnailUrl);
      if (freshUrl) {
        const resolved = await loadRemoteSource(freshUrl);
        if (kind === "thumbnail") {
          setThumbnailRetries(0);
          setIsThumbLoaded(false);
          setThumbnailSrc(resolved);
        } else {
          setFullRetries(0);
          setIsFullLoaded(false);
          setFullSrc(resolved);
        }
      }
    } catch (error) {
      console.warn("[ImageDetailModal] Failed to refresh Sankaku media URL:", error);
    }
  }, [image.providerId, image.sourceId, loadRemoteSource, sankakuRefreshAttempted]);

  React.useEffect(() => {
    setIsFullLoaded(false);
    setIsThumbLoaded(false);
    setThumbnailSrc(null);
    setFullSrc(null);
    setThumbnailRetries(0);
    setFullRetries(0);
    setSankakuRefreshAttempted(false);
    setVideoProxyFallbackAttempted(false);
    setVideoSource(initialVideoSource);

    const loadImages = async () => {
      // 0. Instantly load local file if we have it downloaded
      if (currentLocalPath) {
        const localSrc = convertFileSrc(currentLocalPath);
        setThumbnailSrc(localSrc);
        setFullSrc(localSrc);
        return;
      }

      // Sankaku list payloads often contain only a still preview for videos.
      // Hydrate the richer per-post payload before deciding this is an image.
      if (image.providerId === 'sankaku' && image.mediaType === 'video' && !initialVideoSource) {
        try {
          const { federator } = await import('../SearchFederator');
          const fresh = await federator.getById(image.providerId, image.sourceId);
          const playable = [fresh?.fullUrl, fresh?.sampleUrl, fresh?.previewUrl]
            .find(url => Boolean(url?.match(/\.(mp4|webm)(?:\?|$)/i)));
          if (playable) {
            setVideoSource(playable);
            // Keep the signed CDN URL intact so <video> can request byte
            // ranges instead of waiting for a full-file blob download.
            setFullSrc(streamViaTauri(playable));
          } else {
            console.warn(`[ImageDetailModal] Sankaku post ${image.sourceId} is marked as video but its detail payload has no playable URL.`);
          }
        } catch (error) {
          console.warn(`[ImageDetailModal] Failed to hydrate Sankaku video ${image.sourceId}:`, error);
        }
      }

      // 1. Instantly load the thumbnail
      loadRemoteSource(thumbnailSource).then(setThumbnailSrc);

      // 2. Load the full image in the background
      if (initialVideoSource) {
        if (image.providerId === 'sankaku' || image.providerId === 'rule34') {
          setFullSrc(streamViaTauri(initialVideoSource));
        } else {
          // Danbooru and the other protected CDNs still require the existing
          // Rust media loader; only Sankaku uses the range-stream protocol.
          setFullSrc(await loadRemoteSource(initialVideoSource));
        }
      } else if (image.mediaType !== 'video') {
        loadRemoteSource(fullSource).then(setFullSrc);
      }
    };
    
    loadImages();
  }, [currentLocalPath, thumbnailSource, fullSource, initialVideoSource, image.mediaType, image.providerId, image.sourceId, loadRemoteSource]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-[98vw] h-[98vh] bg-surface rounded-2xl overflow-hidden shadow-2xl flex border border-border-subtle"
        onClick={e => e.stopPropagation()}
      >
        {/* Left Side: Media */}
        <div 
          ref={containerRef}
          className="flex-1 bg-black/50 relative flex items-center justify-center group overflow-hidden touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
        >
          {isVideo ? (
            <>
              {!isFullLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground-muted gap-4">
                  <Loader2 size={48} className="animate-spin text-accent" />
                  <span className="font-black tracking-widest uppercase text-xs">Buffering Video...</span>
                </div>
              )}
              <video 
                src={(fullSrc || thumbnailSrc) || undefined}
                autoPlay
                loop
                controls
                className="w-full h-full object-contain relative z-10"
                onLoadedData={() => setIsFullLoaded(true)}
                onError={() => {
                  const supportsStreamFallback = image.providerId === 'sankaku' || image.providerId === 'rule34';
                  if (!supportsStreamFallback || !videoSource || videoProxyFallbackAttempted) {
                    console.warn(`[ImageDetailModal] Video playback failed for ${image.providerId}:${image.sourceId}.`);
                    return;
                  }
                  setVideoProxyFallbackAttempted(true);
                  console.warn(`[ImageDetailModal] ${image.providerId} range stream failed for ${image.sourceId}; trying blob fallback.`);
                  void proxyViaTauri(videoSource).then(fallback => {
                    if (fallback) {
                      setIsFullLoaded(false);
                      setFullSrc(fallback);
                    } else {
                      console.warn(`[ImageDetailModal] ${image.providerId} blob fallback failed for ${image.sourceId}.`);
                    }
                  });
                }}
              />
            </>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
              {!isThumbLoaded && !isFullLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground-muted gap-4 z-0">
                  <Loader2 size={48} className="animate-spin text-accent" />
                  <span className="font-black tracking-widest uppercase text-xs">Loading Image...</span>
                </div>
              )}
              
              <div 
                className="relative w-full h-full"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transition: isDragging ? 'none' : 'transform 0.1s ease-out', transformOrigin: 'center' }}
              >
                {thumbnailSrc && (
                  <img 
                    src={thumbnailSrc}
                    alt="Thumbnail"
                    className={`absolute inset-0 w-full h-full object-contain blur-md transition-opacity duration-300 z-10 ${isFullLoaded ? 'opacity-0' : (isThumbLoaded ? 'opacity-100' : 'opacity-0')}`}
                    referrerPolicy="no-referrer"
                    onLoad={() => setIsThumbLoaded(true)}
                    onError={async () => {
                      if (thumbnailRetries < 2) {
                        const nextAttempt = thumbnailRetries + 1;
                        setThumbnailRetries(nextAttempt);
                        const retryUrl = await loadRemoteSource(thumbnailSource, nextAttempt);
                        if (retryUrl) {
                          setIsThumbLoaded(false);
                          setThumbnailSrc(retryUrl);
                        }
                      } else {
                        setIsThumbLoaded(true);
                        void refreshSankakuMedia("thumbnail");
                      }
                    }}
                  />
                )}
                {fullSrc && (
                  <img 
                    src={fullSrc}
                    alt="Detail view"
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 z-20 ${isFullLoaded ? 'opacity-100' : 'opacity-0'}`}
                    referrerPolicy="no-referrer"
                    onLoad={() => setIsFullLoaded(true)}
                    onError={async () => {
                      if (fullRetries < 2) {
                        const nextAttempt = fullRetries + 1;
                        setFullRetries(nextAttempt);
                        const retryUrl = await loadRemoteSource(fullSource, nextAttempt);
                        if (retryUrl) {
                          setIsFullLoaded(false);
                          setFullSrc(retryUrl);
                        }
                      } else {
                        setIsFullLoaded(true);
                        void refreshSankakuMedia("full");
                      }
                    }}
                  />
                )}
              </div>
            </div>
          )}
          
          <button 
            onClick={() => {
              if (!document.fullscreenElement) {
                if (containerRef.current) {
                  containerRef.current.requestFullscreen().catch(err => console.log(err));
                }
              } else {
                document.exitFullscreen().catch(err => console.log(err));
              }
            }}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-all backdrop-blur-md z-30 opacity-30 hover:opacity-100"
            title="Toggle Fullscreen (F)"
          >
            <Maximize size={24} />
          </button>
          
          <button 
            onClick={() => {
              onClose();
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.log(err));
              }
            }}
            className="absolute top-4 left-4 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-all backdrop-blur-md z-30"
          >
            <X size={24} />
          </button>

          {/* Zoom Controls Overlay */}
          {!isVideo && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-2xl border border-white/10 opacity-30 hover:opacity-100 transition-all z-30 pointer-events-auto">
              <button onClick={() => setScale(s => Math.max(0.1, s - 0.5))} className="p-2 hover:bg-white/10 rounded-xl text-white transition-all" title="Zoom Out">
                <ZoomOut size={18} />
              </button>
              <span className="text-white text-xs font-black min-w-[48px] text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(5, s + 0.5))} className="p-2 hover:bg-white/10 rounded-xl text-white transition-all" title="Zoom In">
                <ZoomIn size={18} />
              </button>
              <div className="w-[1px] h-4 bg-white/20 mx-1"></div>
              <button onClick={resetZoom} className="p-2 hover:bg-white/10 rounded-xl text-white transition-all" title="Fit to Screen">
                <Minimize size={18} />
              </button>
              <button onClick={fitToWidth} className="p-2 hover:bg-white/10 rounded-xl text-white transition-all" title="Fit to Width">
                <Maximize size={18} />
              </button>
              <button onClick={actualSize} className="p-2 hover:bg-white/10 rounded-xl text-white transition-all" title="100% Actual Size">
                <Move size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Info & Actions */}
        <div className="w-[350px] shrink-0 bg-surface-elevated overflow-y-auto no-scrollbar flex flex-col border-l border-border-subtle z-30 relative">
          
          {/* Header Metadata */}
          <div className="p-6 border-b border-border-subtle flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-accent/20 text-accent font-black text-xs uppercase tracking-widest rounded-full">
                {image.providerId}
              </span>
              <span className="text-xs text-foreground-muted font-bold">
                 {image.createdAt ? new Date(image.createdAt).toLocaleDateString() : ""}
              </span>
            </div>
            
            <h2 className="text-xl font-bold text-foreground mt-2">
              {image.width} × {image.height}
            </h2>
            <div className="flex items-center gap-4 text-sm text-foreground-muted">
              <span>Rating: <span className="text-foreground capitalize">{image.rating}</span></span>
              <span>Score: <span className="text-foreground">{image.score}</span></span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-6 border-b border-border-subtle grid grid-cols-2 gap-3">
            <button onClick={() => { slideshow.start(index, images); onClose(); }} className="h-10 col-span-2 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
              <Play size={18} fill="currentColor" /> Start Slideshow
            </button>
            {currentLocalPath ? (
              <button 
                onClick={handleDeleteDownload}
                className="h-10 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-red-400 transition-all"
              >
                <Trash2 size={16} /> Delete Download
              </button>
            ) : (
              <button 
                onClick={handleDownload}
                disabled={isDownloading}
                className="h-10 bg-surface hover:bg-surface-raised border border-border-subtle rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
                {isDownloading ? "Downloading..." : "Download"}
              </button>
            )}
            <button 
              onClick={handleFavoriteToggle} 
              className={clsx(
                "h-10 border border-border-subtle rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all",
                isFavorited ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-surface hover:bg-surface-raised text-foreground"
              )}
            >
              <Heart size={16} fill={isFavorited ? "currentColor" : "none"} /> 
              {isFavorited ? "Favorited" : "Favorite"}
            </button>
            {folders.length > 0 && (
              <div className="relative">
                <button 
                  onClick={() => setShowFolderMenu(!showFolderMenu)}
                  className="w-full h-10 border border-border-subtle hover:border-accent rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-foreground transition-all"
                >
                  <FolderPlus size={16} /> {savedImages.find(img => img.id === image.id)?.folderId ? "Manage Folder" : "Add to Folder"}
                </button>
                {showFolderMenu && (
                  <div className="absolute bottom-full left-0 w-full mb-2 bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden shadow-xl z-10">
                    {savedImages.find(img => img.id === image.id)?.folderId && (
                      <button 
                        onClick={() => { saveImage(image, null); setShowFolderMenu(false); toast.success("Removed from folder"); }}
                        className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-400 text-sm font-bold transition-all flex items-center gap-2 border-b border-border-subtle"
                      >
                        <Trash2 size={14} /> Remove from Folder
                      </button>
                    )}
                    {folders.map(f => (
                      <button 
                        key={f.id}
                        onClick={() => { saveImage(image, f.id); setShowFolderMenu(false); toast.success("Saved to " + f.name); }}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm font-bold text-foreground transition-all flex items-center gap-2"
                      >
                        <Folder size={14} className="text-accent" />
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button 
              onClick={async () => {
                const { open } = await import('@tauri-apps/plugin-shell');
                 if (image.sourceUrl) await open(image.sourceUrl);
              }}
              className="h-10 bg-surface hover:bg-surface-raised border border-border-subtle rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-foreground transition-all"
            >
              <ExternalLink size={16} /> Original
            </button>
            <button 
              onClick={handleRefreshMeta}
              disabled={isRefreshingMeta}
              className="h-10 bg-surface hover:bg-surface-raised border border-border-subtle rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-foreground transition-all disabled:opacity-50"
            >
              {isRefreshingMeta ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 
              Refresh Meta
            </button>
          </div>

          {(image.author || image.source || image.relatedGroupId || image.parentId || image.poolIds?.length || image.bookIds?.length || image.isPremium || image.redirectToSignup || image.videoDuration) && (
            <div className="p-6 border-b border-border-subtle space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-foreground-muted">Source Metadata</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-foreground-muted">
                {image.author && <span>Author: <strong className="text-foreground">{image.author}</strong></span>}
                {image.source && <span>Source: <strong className="text-foreground">{image.source}</strong></span>}
                {image.sequence !== undefined && <span>Sequence: <strong className="text-foreground">{image.sequence}</strong></span>}
                {image.videoDuration !== undefined && <span>Duration: <strong className="text-foreground">{Math.round(image.videoDuration)}s</strong></span>}
                {image.isPremium && <span className="text-amber-400">Premium content</span>}
                {image.redirectToSignup && <span className="text-amber-400">Sign-in required</span>}
              </div>
              {(image.parentId || image.poolIds?.length || image.bookIds?.length || image.relatedGroupId) && (
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                  {image.parentId && <span className="px-2 py-1 rounded bg-surface border border-border-subtle">Parent {image.parentId}</span>}
                  {image.poolIds?.map(poolId => <span key={`pool-${poolId}`} className="px-2 py-1 rounded bg-surface border border-border-subtle">Pool {poolId}</span>)}
                  {image.bookIds?.map(bookId => <span key={`book-${bookId}`} className="px-2 py-1 rounded bg-surface border border-border-subtle">Book {bookId}</span>)}
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="p-6 flex flex-col gap-6">
            
            {artistTags.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                  <Tag size={12} /> Artist
                </h3>
                <div className="flex flex-wrap gap-2">
                  {artistTags.map(t => {
                    const clean = typeof t === 'string' ? t.replace('artist:', '').toLowerCase().trim() : '';
                    return <ClickableTag key={t as string} tag={t as string} type="artist" onSearch={onSearchTag} onClose={onClose} isInterest={userInterests.includes(clean)} />
                  })}
                </div>
              </div>
            )}

            {seriesTags.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                  <Tag size={12} /> Series
                </h3>
                <div className="flex flex-wrap gap-2">
                  {seriesTags.map(t => {
                    const clean = typeof t === 'string' ? t.replace('series:', '').toLowerCase().trim() : '';
                    return <ClickableTag key={t as string} tag={t as string} type="series" onSearch={onSearchTag} onClose={onClose} isInterest={userInterests.includes(clean)} />
                  })}
                </div>
              </div>
            )}

            {characterTags.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-green-400 flex items-center gap-2">
                  <Tag size={12} /> Character
                </h3>
                <div className="flex flex-wrap gap-2">
                  {characterTags.map(t => {
                    const clean = typeof t === 'string' ? t.replace('character:', '').toLowerCase().trim() : '';
                    return <ClickableTag key={t as string} tag={t as string} type="character" onSearch={onSearchTag} onClose={onClose} isInterest={userInterests.includes(clean)} />
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                  <Tag size={12} /> General Tags ({generalTags.length})
                </h3>
                {generalTags.length > 20 && (
                  <button 
                    onClick={() => setShowAllTags(!showAllTags)} 
                    className="text-xs font-bold text-accent hover:underline"
                  >
                    {showAllTags ? "Show Less" : "Show All"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {generalTags.slice(0, showAllTags ? undefined : 20).map(t => {
                  const clean = typeof t === 'string' ? t.toLowerCase().trim() : '';
                  return <ClickableTag key={t as string} tag={t as string} type="general" onSearch={onSearchTag} onClose={onClose} isInterest={userInterests.includes(clean)} />
                })}
                {!showAllTags && generalTags.length > 20 && (
                  <button onClick={() => setShowAllTags(true)} className="px-3 py-1 bg-surface-raised text-foreground-muted rounded-lg text-sm">
                    +{generalTags.length - 20} more...
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
