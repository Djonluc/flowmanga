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
  Loader2,
  Maximize,
  ExternalLink,
  Tag,
  RotateCcw,
  MousePointer2,
  Monitor,
  Settings,
} from "lucide-react";

import { useGalleryStore } from "../../stores/useGalleryStore";

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
  const [imageErrorCount, setImageErrorCount] = useState(0);
  const [showAllTags, setShowAllTags] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [highResLoaded, setHighResLoaded] = useState(false);
  const [highResError, setHighResError] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const hudTimer = useRef<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Set image to 1:1 pixel zoom (unscaled natural size)
  const setActualSize = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Fit image to screen (CSS object-contain already handles this at zoom=1)
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Clamp pan values based on zoom and viewport size
  const clampPan = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      if (!containerRef.current || zoom === 1) return { x: 0, y: 0 };

      const container = containerRef.current;
      const viewportW = container.clientWidth;
      const viewportH = container.clientHeight;

      // Rough estimate: at zoom level, image is roughly scaled
      const maxX = (viewportW * (zoom - 1)) / 2;
      const maxY = (viewportH * (zoom - 1)) / 2;

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
      } catch (e) {
        console.warn("Failed to parse extension, defaulting to jpg");
      }

      const filename = `flowmanga_vision_${id}.${ext}`;
      const fullPath = await join(baseDir, filename);

      setDownloadProgress(30);

      // Use Rust backend for robust download
      await invoke("download_image", {
        url,
        filePath: fullPath,
        headers: {
          Referer: "https://www.zerochan.net/",
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
    clearTimeout(hudTimer.current);
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
          if (isSaved) isLiked ? unlikeImage(image.id) : likeImage(image.id);
          break;
        case "+":
        case "=":
          setZoom((z) => Math.min(z + 0.5, 20));
          break;
        case "-":
          setZoom((z) => Math.max(z - 0.5, 0.1));
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
  ]);

  useEffect(() => {
    refreshHud();
    return () => clearTimeout(hudTimer.current);
  }, [viewerIndex, refreshHud]);

  // Scroll zoom (Manually attached to avoid passive listener issues)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // More sensitive zoom for better feel
      const delta = -e.deltaY * 0.003;
      const newZoom = Math.min(Math.max(zoom * (1 + delta), 0.1), 30);
      setZoom(newZoom);
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

  // Base URLs from the image object
  const rawImageUrl = image
    ? "imageUrl" in image
      ? image.imageUrl
      : (image as any).coverUrl || ""
    : "";
  const previewUrl = image
    ? "previewUrl" in image
      ? image.previewUrl
      : (image as any).coverUrl || ""
    : "";
  const tags: string[] =
    image && "tags" in image && Array.isArray(image.tags) ? image.tags : [];
  const title = image
    ? "title" in image
      ? (image as any).title
      : tags[0] || "Untitled"
    : "";
  const source = image ? ("source" in image ? image.source : "zerochan") : "";
  const sourceUrl = image
    ? "url" in image
      ? (image as any).url
      : `https://www.zerochan.net/${image.id}`
    : "";

  // Derived High-Res URL with format fallback logic
  const imageUrl = React.useMemo(() => {
    if (!rawImageUrl) return "";

    // Ensure we aren't using an optimized preview format for the high-res view
    let url = rawImageUrl;
    if (url.match(/\.(avif)$/i)) {
      url = url.replace(/\.(avif)$/i, ".jpg");
    }

    // Apply extension fallbacks based on error count
    if (imageErrorCount === 1) return url.replace(/\.[^.]+$/, ".png");
    if (imageErrorCount === 2) return url.replace(/\.[^.]+$/, ".jpg");
    if (imageErrorCount === 3) return url.replace(/\.[^.]+$/, ".webp");

    return url;
  }, [rawImageUrl, imageErrorCount]);

  const isUpgrading = imageUrl !== previewUrl && !highResError;

  useEffect(() => {
    if (isOpen && image) {
      setImageErrorCount(0);
      setShowAllTags(false);
      setHighResLoaded(false);
      setHighResError(false);
      setLocalUrl(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsHighResLoading(imageUrl !== previewUrl);

      // Check for local version
      const checkLocal = async () => {
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
              console.log("[ImageViewer] Using local version:", fullPath);
              setLocalUrl(convertFileSrc(fullPath));
              setIsHighResLoading(false);
              setHighResLoaded(true);
              return;
            }
          }
        } catch (e) {
          console.error("[ImageViewer] Local check failed:", e);
        }
      };

      checkLocal();
    }
  }, [isOpen, image?.id, imageUrl, previewUrl, downloadPath]);

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
                {imageUrl !== previewUrl && !highResError && (
                  <motion.img
                    key={localUrl || imageUrl}
                    src={localUrl || imageUrl}
                    alt={title}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      height: "auto",
                      transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                    }}
                    onLoad={(e) => {
                      setHighResLoaded(true);
                      setIsHighResLoading(false);
                      setHighResError(false);
                    }}
                    onError={() => {
                      if (imageErrorCount < 3) {
                        setImageErrorCount((prev) => prev + 1);
                      } else {
                        setHighResError(true);
                        setIsHighResLoading(false);
                      }
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
                  <motion.img
                    src={previewUrl}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      height: "auto",
                      transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                    }}
                    className="object-contain select-none absolute inset-0 m-auto grayscale-[0.5]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    draggable={false}
                  />
                )}
              </div>

              {/* High-Res Loading Indicator */}
              {isHighResLoading && !highResError && (
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
                        onClick={() =>
                          isSaved
                            ? isLiked
                              ? unlikeImage(image.id)
                              : likeImage(image.id)
                            : saveImage(image as any)
                        }
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

                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] transition-all"
                      >
                        <ExternalLink size={16} />
                        View on Zerochan
                      </a>
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
                                    ? (rec as any).previewUrl
                                    : (rec as any).coverUrl
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
