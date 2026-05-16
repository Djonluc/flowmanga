/**
 * ImageViewer
 *
 * Fullscreen image viewer with zoom, pan, keyboard nav,
 * like/save actions, and tag exploration.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Download,
  Maximize,
  ExternalLink,
  Tag,
  RotateCcw,
  MousePointer2,
  Monitor,
  Settings,
  Trash2,
} from "lucide-react";

import { useGalleryStore } from "../../stores/useGalleryStore";
import { useMediaLoader } from "../../hooks/useMediaLoader";

export const ImageViewer: React.FC = () => {
  const {
    viewerImage,
    viewerContext,
    viewerIndex,
    closeViewer,
    viewerNext,
    viewerPrev,
    savedImages,
    saveImage,
    likeImage,
    unlikeImage,
    searchByTags,
    setActiveTab,
    isHudPinned,
    toggleHudPin,
    downloadPath,
    setDownloadPath,
  } = useGalleryStore();

  const [zoom, setZoom] = useState(1); // 1 = Fit to Screen (CSS handles it)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showHud, setShowHud] = useState(true);
  const [isHighResLoading, setIsHighResLoading] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [highResLoaded, setHighResLoaded] = useState(false);
  const [highResError, setHighResError] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [highResImage, setHighResImage] = useState<HTMLImageElement | null>(
    null,
  );
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const { preloadHighResImage } = useMediaLoader();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const [touchState, setTouchState] = useState<{
    mode: "drag" | "pinch" | null;
    x: number;
    y: number;
    pan: { x: number; y: number };
    zoom: number;
    distance: number;
  }>({ mode: null, x: 0, y: 0, pan: { x: 0, y: 0 }, zoom: 1, distance: 0 });

  const [naturalZoom, setNaturalZoom] = useState(1);

  const measureImageZoom = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const renderedWidth = img.clientWidth;
    const renderedHeight = img.clientHeight;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (renderedWidth && renderedHeight && naturalWidth && naturalHeight) {
      const ratio = Math.max(
        naturalWidth / renderedWidth,
        naturalHeight / renderedHeight,
        1,
      );
      setNaturalZoom(ratio);
    }
  }, []);

  const setActualSize = useCallback(() => {
    setZoom(naturalZoom);
    setPan({ x: 0, y: 0 });
  }, [naturalZoom]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const changeZoom = useCallback((delta: number) => {
    setZoom((current) => Math.max(0.5, Math.min(current + delta, 30)));
  }, []);

  const clampPan = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      if (!containerRef.current || zoom <= 1 || !imageRef.current)
        return { x: 0, y: 0 };

      const container = containerRef.current;
      const img = imageRef.current;
      const width = img.clientWidth * zoom;
      const height = img.clientHeight * zoom;
      const maxX = Math.max(0, (width - container.clientWidth) / 2);
      const maxY = Math.max(0, (height - container.clientHeight) / 2);

      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [zoom],
  );

  const downloadImage = async (url: string, id: string) => {
    try {
      setDownloadProgress(10);

      const { documentDir, join } = await import("@tauri-apps/api/path");
      const { mkdir, exists } = await import("@tauri-apps/plugin-fs");

      let baseDir = downloadPath;
      if (!baseDir) {
        const docDir = await documentDir();
        baseDir = await join(docDir, "FlowManga Collection");
      }

      // Ensure directory exists
      if (!(await exists(baseDir))) {
        await mkdir(baseDir, { recursive: true });
      }

      // Extract extension from URL safely
      let ext = "jpg";
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const matches = pathname.match(/\.([a-z0-9]+)$/i);
        if (matches && matches[1]) {
          ext = matches[1].toLowerCase();
        }
      } catch (error) {
        console.warn("Failed to parse extension, defaulting to jpg", error);
      }

      const filename = `flowmanga_vision_${id}.${ext}`;
      const fullPath = await join(baseDir, filename);

      setDownloadProgress(30);

      // Use Rust backend for robust download
      await invoke("download_image", {
        url,
        filePath: fullPath,
        headers: {
          Referer: sourceUrl || "https://flowmanga.app/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      setDownloadProgress(100);
      setTimeout(() => setDownloadProgress(null), 2000);
    } catch (e) {
      console.error("Download failed:", e);
      setDownloadProgress(null);
      // Fallback to browser download if possible, though unlikely to work in Tauri
      window.open(url, "_blank");
    }
  };

  const changeDownloadFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select FlowManga Collection Folder",
      });
      if (selected && typeof selected === "string") {
        setDownloadPath(selected);
      }
    } catch (e) {
      console.error("Failed to change folder:", e);
    }
  };

  const isSaved = viewerImage
    ? savedImages.some((i) => i.id === viewerImage.id)
    : false;
  const isLiked = viewerImage
    ? savedImages.find((i) => i.id === viewerImage.id)?.liked || false
    : false;

  // Auto-hide HUD
  const refreshHud = useCallback(() => {
    setShowHud(true);
    if (hudTimer.current) {
      clearTimeout(hudTimer.current);
    }
    if (!useGalleryStore.getState().isHudPinned) {
      hudTimer.current = setTimeout(() => setShowHud(false), 3000);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (!viewerImage) return;
    const image = viewerImage;
    const isSaved = savedImages.some((i) => i.id === image.id);
    const isLiked = savedImages.find((i) => i.id === image.id)?.liked || false;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          closeViewer();
          break;
        case "ArrowLeft":
          viewerPrev();
          resetView();
          break;
        case "ArrowRight":
          viewerNext();
          resetView();
          break;
        case "l":
        case "L":
          if (isSaved) {
            if (isLiked) {
              unlikeImage(image.id);
            } else {
              likeImage(image.id);
            }
          }
          break;
        case "+":
        case "=":
          changeZoom(0.5);
          break;
        case "-":
          changeZoom(-0.5);
          break;
        case "0":
          resetView();
          break;
      }
      refreshHud();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    viewerImage,
    viewerIndex,
    isSaved,
    isLiked,
    closeViewer,
    viewerPrev,
    viewerNext,
    resetView,
    refreshHud,
    unlikeImage,
    likeImage,
    savedImages,
    changeZoom,
  ]);

  useEffect(() => {
    refreshHud();
    return () => {
      if (hudTimer.current) {
        clearTimeout(hudTimer.current);
      }
    };
  }, [viewerIndex, refreshHud]);

  // Scroll zoom (Manually attached to avoid passive listener issues)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // More sensitive zoom for better feel
      const delta = -e.deltaY * 0.003;
      const newZoom = Math.min(Math.max(zoom * (1 + delta), 0.5), 30);
      setZoom(newZoom);
      if (newZoom <= 1) setPan({ x: 0, y: 0 });
      refreshHud();
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [zoom, refreshHud]);

  // adaptive fit on resize
  useEffect(() => {
    const handleResize = () => resetView();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [resetView]);

  // Pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan.x, pan.y],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      const clamped = clampPan(newX, newY);
      setPan(clamped);
    },
    [isDragging, dragStart.x, dragStart.y, clampPan],
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.hypot(dx, dy);
        setTouchState({
          mode: "pinch",
          x: 0,
          y: 0,
          pan,
          zoom,
          distance,
        });
      } else if (e.touches.length === 1) {
        setTouchState({
          mode: "drag",
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          pan,
          zoom,
          distance: 0,
        });
      }
    },
    [pan, zoom],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!touchState.mode) return;
      if (touchState.mode === "pinch" && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.hypot(dx, dy);
        const targetZoom = Math.min(
          Math.max((touchState.zoom * distance) / touchState.distance, 0.5),
          30,
        );
        setZoom(targetZoom);
      }
      if (touchState.mode === "drag" && e.touches.length === 1 && zoom > 1) {
        const newX = e.touches[0].clientX - touchState.x + touchState.pan.x;
        const newY = e.touches[0].clientY - touchState.y + touchState.pan.y;
        setPan(clampPan(newX, newY));
      }
    },
    [touchState, zoom, clampPan],
  );

  const handleTouchEnd = useCallback(() => {
    setTouchState({
      mode: null,
      x: 0,
      y: 0,
      pan: { x: 0, y: 0 },
      zoom: 1,
      distance: 0,
    });
  }, []);

  const handleTagClick = useCallback(
    (tag: string) => {
      closeViewer();
      setActiveTab("search");
      searchByTags(tag);
    },
    [closeViewer, setActiveTab, searchByTags],
  );

  const isOpen = !!viewerImage;
  const image = viewerImage;
  const typedImage = image as {
    imageUrl?: string;
    coverUrl?: string;
    previewUrl?: string;
    title?: string;
    url?: string;
    source?: string;
    tags?: string[];
  } | null;

  const rawImageUrl = typedImage
    ? "imageUrl" in typedImage && typedImage.imageUrl
      ? typedImage.imageUrl
      : typedImage.coverUrl || ""
    : "";
  const previewUrl = typedImage
    ? "previewUrl" in typedImage && typedImage.previewUrl
      ? typedImage.previewUrl
      : typedImage.coverUrl || ""
    : "";
  const tags: string[] =
    typedImage && "tags" in typedImage && Array.isArray(typedImage.tags)
      ? typedImage.tags
      : [];
  const title = typedImage
    ? "title" in typedImage
      ? typedImage.title || tags[0] || "Untitled"
      : tags[0] || "Untitled"
    : "";
  const source = image ? ("source" in image ? image.source : "unknown") : "";
  const sourceUrl = image
    ? "url" in image
      ? typedImage?.url || ""
      : ""
    : "";

  const formattedSource = source
    ? source
        .toString()
        .replace(/\./g, " ")
        .replace(/(^\w|\s\w)/g, (match) => match.toUpperCase())
    : "Source";

  // Build intelligent array of fallback URLs
  const fallbackUrls = React.useMemo(() => {
    if (!typedImage) return [];

    const urls: string[] = [];
    if ("fullResUrl" in typedImage && typedImage.fullResUrl)
      urls.push(typedImage.fullResUrl as string);
    if ("imageUrl" in typedImage && typedImage.imageUrl)
      urls.push(typedImage.imageUrl as string);

    const first = urls[0];
    if (first) {
      if (first.match(/\.(avif)$/i))
        urls.push(first.replace(/\.(avif)$/i, ".jpg"));
      urls.push(first.replace(/\.[^.]+$/, ".jpg"));
      urls.push(first.replace(/\.[^.]+$/, ".png"));
      urls.push(first.replace(/\.[^.]+$/, ".webp"));
    }

    return Array.from(new Set(urls)).filter(Boolean);
  }, [typedImage]);

  const primaryUrl = localUrl || fallbackUrls[0] || previewUrl;
  const imageUrl = localUrl || primaryUrl || previewUrl || rawImageUrl;

  useEffect(() => {
    if (isOpen && image) {
      setShowAllTags(false);
      setHighResLoaded(false);
      setHighResError(false);
      setLocalUrl(null);
      setHighResImage(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsHighResLoading(
        fallbackUrls.length > 0 && fallbackUrls[0] !== previewUrl,
      );

      let ignore = false;

      const loadHighRes = async () => {
        setHighResLoaded(false);
        setHighResError(false);
        setIsHighResLoading(fallbackUrls.length > 0 && fallbackUrls[0] !== previewUrl);

        try {
          const { documentDir, join } = await import("@tauri-apps/api/path");
          const { exists } = await import("@tauri-apps/plugin-fs");

          let baseDir = downloadPath;
          if (!baseDir) {
            const docDir = await documentDir();
            baseDir = await join(docDir, "FlowManga Collection");
          }

          const extensions = ["jpg", "png", "webp", "gif", "jpeg"];
          for (const ext of extensions) {
            const filename = `flowmanga_vision_${image.id}.${ext}`;
            const fullPath = await join(baseDir, filename);
            if (await exists(fullPath)) {
              if (ignore) return;
              console.log("[ImageViewer] Using local version:", fullPath);
              setLocalUrl(convertFileSrc(fullPath));
              setIsHighResLoading(false);
              setHighResLoaded(true);
              measureImageZoom();
              return;
            }
          }
        } catch (e) {
          console.error("[ImageViewer] Local check failed:", e);
        }

        if (fallbackUrls.length > 0 && fallbackUrls[0] !== previewUrl) {
          preloadHighResImage(fallbackUrls, source).then((loadedImage) => {
            if (ignore) return;
            if (loadedImage) {
              setHighResImage(loadedImage);
              setHighResLoaded(true);
              setIsHighResLoading(false);
              setHighResError(false);
              measureImageZoom();
            } else {
              console.warn(
                "[ImageViewer] All high-res fallback tiers failed to load for:",
                fallbackUrls[0],
              );
              setHighResError(true);
              setIsHighResLoading(false);
            }
          });
        } else {
          if (!ignore) setIsHighResLoading(false);
        }
      };

      loadHighRes();
      return () => {
        ignore = true;
      };
    }
  }, [
    isOpen,
    image,
    image?.id,
    previewUrl,
    downloadPath,
    preloadHighResImage,
    fallbackUrls,
    source,
    measureImageZoom,
  ]);

  const retryHighRes = useCallback(() => {
    if (!image) return;
    setHighResError(false);
    setIsHighResLoading(true);
    preloadHighResImage(fallbackUrls, source).then((loadedImage) => {
      if (loadedImage) {
        setHighResImage(loadedImage);
        setHighResLoaded(true);
        setIsHighResLoading(false);
        setHighResError(false);
        measureImageZoom();
      } else {
        setHighResError(true);
        setIsHighResLoading(false);
      }
    });
  }, [image, fallbackUrls, source, preloadHighResImage, measureImageZoom]);

  return (
    <AnimatePresence>
      {isOpen && image && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-2xl flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseMove={refreshHud}
          ref={containerRef}
        >
          {/* Ambient Glow */}
          <div
            className="absolute inset-0 opacity-20 blur-[120px] pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${image.dominantColor || "#a855f7"}, transparent 70%)`,
            }}
          />

          {/* Controls Toolbar (Top Left) */}
          <motion.div
            className={`absolute top-6 left-6 z-[60] flex items-center gap-2 transition-all ${showHud || isHudPinned ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-xl border border-white/10 p-1 rounded-2xl shadow-2xl">
              <button
                onClick={closeViewer}
                className="p-2.5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-all"
                title="Close Viewer"
              >
                <X size={18} />
              </button>

              <div className="w-[1px] h-4 bg-white/10 mx-1" />

              <button
                onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                className={`p-2.5 rounded-xl transition-all ${!isSidebarVisible ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "hover:bg-white/10 text-white/40 hover:text-white"}`}
                title={isSidebarVisible ? "Hide Metadata" : "Show Metadata"}
              >
                <Tag size={16} />
              </button>

              <div className="w-[1px] h-4 bg-white/10 mx-1" />

              <button
                onClick={setActualSize}
                className="p-2.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all"
                title="Actual Size (1:1)"
              >
                <MousePointer2 size={16} />
              </button>

              <button
                onClick={resetView}
                className="p-2.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all"
                title="Fit to Screen"
              >
                <RotateCcw size={16} />
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all"
                title="Toggle Fullscreen"
              >
                <Monitor size={16} />
              </button>

              <div className="w-[1px] h-4 bg-white/10 mx-1" />

              <button
                onClick={changeDownloadFolder}
                className="p-2.5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all"
                title="Change Collection Folder"
              >
                <Settings size={16} />
              </button>

              <button
                onClick={toggleHudPin}
                className={`p-2.5 rounded-xl transition-all ${isHudPinned ? "bg-purple-600 text-white" : "hover:bg-white/10 text-white/40 hover:text-white"}`}
                title={isHudPinned ? "Unlock HUD" : "Pin HUD"}
              >
                <Maximize
                  size={16}
                  className={isHudPinned ? "rotate-45" : ""}
                />
              </button>
            </div>
          </motion.div>

          {/* Navigation Arrows */}
          {viewerContext.length > 1 && (
            <>
              <button
                onClick={() => {
                  viewerPrev();
                  resetView();
                }}
                className={`absolute left-4 top-1/2 -translate-y-1/2 z-50 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all ${showHud || isHudPinned ? "opacity-100" : "opacity-0"}`}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => {
                  viewerNext();
                  resetView();
                }}
                className={`absolute right-4 top-1/2 -translate-y-1/2 z-50 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all ${showHud || isHudPinned ? "opacity-100" : "opacity-0"}`}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Main Content Area */}
          <div className="w-full h-full flex flex-col md:flex-row overflow-hidden">
            {/* Image Section */}
            <div
              className="flex-1 relative flex items-center justify-center overflow-hidden"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                cursor: isDragging ? "grabbing" : zoom > 1 ? "grab" : "default",
              }}
            >
              {/* Stable Image Container - CSS handles fit-to-screen */}
              <div className="w-full h-full relative">
                {/* Preview Layer (Always visible until high-res ready) */}
                <motion.img
                  ref={imageRef}
                  src={previewUrl}
                  alt={title}
                  decoding="async"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    width: "auto",
                    height: "auto",
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  }}
                  className="object-contain select-none shadow-2xl absolute inset-0 m-auto will-change-transform"
                  initial={false}
                  animate={{ opacity: highResLoaded ? 0 : 1 }}
                  transition={{ duration: 0.8 }}
                  draggable={false}
                />

                {/* High-Res Layer */}
                {primaryUrl !== previewUrl && !highResError && highResImage && (
                  <motion.img
                    src={localUrl || highResImage.src}
                    alt={title}
                    decoding="async"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      height: "auto",
                      transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                    }}
                    className="object-contain select-none absolute inset-0 m-auto will-change-transform"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: highResLoaded ? 1 : 0 }}
                    transition={{ duration: 0.8 }}
                    draggable={false}
                  />
                )}

                {/* Fallback/Retry Layer if High-Res fails */}
                {highResError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-30">
                    <div className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-black/60 border border-white/10 shadow-2xl max-w-sm text-center">
                      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                        <RotateCcw size={32} className="text-red-400" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-white font-black uppercase tracking-widest text-sm">Resolution Failed</h3>
                        <p className="text-white/60 text-xs leading-relaxed">
                          We couldn't secure the high-resolution vision from {formattedSource}. The optimized preview is still active.
                        </p>
                      </div>
                      <button
                        onClick={retryHighRes}
                        className="px-8 py-3 rounded-xl bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition-all active:scale-95"
                      >
                        Retry Resolution
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* High-Res Loading Indicator */}
              {isHighResLoading && !highResError && !highResLoaded && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-purple-500 animate-spin" />
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
                    Resolving Vision...
                  </p>
                </div>
              )}

              {/* Download Progress Toast */}
              {downloadProgress !== null && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/10 flex items-center gap-4 shadow-2xl z-[70]">
                  <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-purple-500 animate-spin flex items-center justify-center text-[10px] font-black text-purple-400">
                    {downloadProgress}%
                  </div>
                  <div>
                    <p className="text-white text-[10px] font-black uppercase tracking-widest">
                      {downloadProgress === 100
                        ? "Vision Secured"
                        : "Acquiring Vision..."}
                    </p>
                    <div className="w-32 h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                      <motion.div
                        className="h-full bg-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Side Info (Desktop) */}
            <AnimatePresence>
              {(showHud || isHudPinned) && isSidebarVisible && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="hidden lg:flex w-80 shrink-0 flex-col bg-black/40 backdrop-blur-3xl border-l border-white/5 p-8 overflow-y-auto no-scrollbar z-50"
                >
                  <div className="space-y-8">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">
                          {title}
                        </h2>
                        {localUrl && (
                          <span className="px-2 py-0.5 rounded-md bg-green-500/20 text-green-400 text-[8px] font-black uppercase tracking-widest border border-green-500/20">
                            Secured
                          </span>
                        )}
                      </div>
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                        {source} · #{image.id}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(showAllTags ? tags : tags.slice(0, 12)).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => handleTagClick(tag)}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-purple-500/20 text-white/60 hover:text-purple-400 text-[10px] font-bold uppercase tracking-wider transition-all border border-white/5"
                        >
                          {tag}
                        </button>
                      ))}
                      {tags.length > 12 && (
                        <button
                          onClick={() => setShowAllTags(!showAllTags)}
                          className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all border border-purple-500/10"
                        >
                          {showAllTags
                            ? "Show Less"
                            : `+${tags.length - 12} More`}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => {
                          if (isSaved) {
                            if (isLiked) {
                              unlikeImage(image.id);
                            } else {
                              likeImage(image.id);
                            }
                          } else {
                            saveImage(image);
                          }
                        }}
                        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 ${
                          isLiked
                            ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20"
                            : "bg-white text-black hover:bg-neutral-200 shadow-xl"
                        }`}
                      >
                        <Heart
                          size={16}
                          fill={isLiked ? "currentColor" : "none"}
                        />
                        {isLiked
                          ? "Liked"
                          : isSaved
                            ? "Like Vision"
                            : "Save Vision"}
                      </button>

                      <button
                        onClick={() => downloadImage(imageUrl, image.id)}
                        disabled={downloadProgress !== null}
                        className="w-full py-4 rounded-2xl bg-white text-black hover:bg-neutral-200 flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-white/5 disabled:opacity-50"
                      >
                        <Download size={16} />
                        {downloadProgress !== null
                          ? "Downloading..."
                          : "Download High-Res"}
                      </button>

                      {isSaved && (
                        <button
                          onClick={() => {
                            if (confirm("Remove image from library entirely?")) {
                              useGalleryStore.getState().unsaveImage(image.id);
                              closeViewer();
                            }
                          }}
                          className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all"
                        >
                          <Trash2 size={16} />
                          Remove from Library
                        </button>
                      )}

                      {/* Download Location Settings */}
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                            Storage Path
                          </h4>
                          <button
                            onClick={changeDownloadFolder}
                            className="text-purple-400 text-[9px] font-black uppercase tracking-widest hover:text-purple-300 transition-colors"
                          >
                            Change
                          </button>
                        </div>
                        <p className="text-[10px] text-white/60 font-mono break-all line-clamp-2">
                          {downloadPath || "Documents/FlowManga Collection"}
                        </p>
                      </div>

                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5 flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all"
                      >
                        <ExternalLink size={14} />
                        Open Optimized View
                      </a>

                      {sourceUrl && (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all"
                        >
                          <ExternalLink size={16} />
                          View on {formattedSource}
                        </a>
                      )}
                    </div>

                    {/* Recommendations Placeholder */}
                    <div className="pt-4 border-t border-white/5">
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4">
                        More Like This
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {viewerContext
                          .slice(0, 4)
                          .filter((i) => i.id !== image.id)
                          .map((rec) => (
                            <div
                              key={rec.id}
                              className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => {
                                const idx = viewerContext.findIndex(
                                  (i) => i.id === rec.id,
                                );
                                useGalleryStore
                                  .getState()
                                  .openViewer(rec, viewerContext, idx);
                              }}
                            >
                              <img
                                src={
                                  "previewUrl" in rec
                                    ? rec.previewUrl
                                    : "coverUrl" in rec
                                      ? rec.coverUrl
                                      : ""
                                }
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation Indicator */}
          <div
            className={`absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/5 text-[10px] font-black text-white/40 uppercase tracking-widest transition-opacity duration-500 ${showHud || isHudPinned ? "opacity-100" : "opacity-0"}`}
          >
            {viewerIndex + 1} / {viewerContext.length}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
