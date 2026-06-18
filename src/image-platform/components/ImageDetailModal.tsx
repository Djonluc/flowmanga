import React from 'react';
import type { PlatformImage } from '../types';
import { useSlideshowStore } from '../useSlideshowStore';
import { useImageCollectionStore } from '../useImageCollectionStore';
import { Download, Heart, FolderPlus, ListPlus, Play, ExternalLink, X, Tag, Loader2, Star, RefreshCw, Folder, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { getDb } from '../../services/db';
import { toast } from '../../components/Toast';
import { writeFile, mkdir, remove } from '@tauri-apps/plugin-fs';
import { pictureDir, join } from '@tauri-apps/api/path';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useMediaLoader } from '../../hooks/useMediaLoader';

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

export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({ image, images, index, onClose, onNavigate, onSearchTag, favoriteTags = [], onToggleFavorite }) => {
  const slideshow = useSlideshowStore();
  const { savedImages, saveImage, removeSavedImage, folders, loadFolders, refreshMetadata, updateLocalPath } = useImageCollectionStore();
  const imageDownloadPath = useSettingsStore(state => state.imageDownloadPath);
  const { proxyViaTauri, needsProxy } = useMediaLoader();
  const [showFolderMenu, setShowFolderMenu] = React.useState(false);
  const [showAllTags, setShowAllTags] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isRefreshingMeta, setIsRefreshingMeta] = React.useState(false);

  React.useEffect(() => {
    loadFolders();
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!onNavigate) return;
      if (e.key === 'ArrowLeft') {
        onNavigate(index - 1);
      } else if (e.key === 'ArrowRight') {
        onNavigate(index + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, onNavigate]);

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
    try {
      setIsDownloading(true);
      
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
          "Referer": "no-referrer"
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
      setIsDownloading(false);
      setIsDownloading(false);
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

  const isVideo = image.fullUrl?.match(/\.(mp4|webm)(?:\?|$)/i) || image.sampleUrl?.match(/\.(mp4|webm)(?:\?|$)/i);

  // Group tags roughly by heuristics if we don't have perfect provider metadata
  // Ideally providers would give us typed tags, but for now we heuristically separate them if they have prefixes
  const characterTags = image.tags.filter(t => typeof t === 'string' && t.startsWith("character:"));
  const artistTags = image.tags.filter(t => typeof t === 'string' && t.startsWith("artist:"));
  const seriesTags = image.tags.filter(t => typeof t === 'string' && t.startsWith("series:"));
  const generalTags = image.tags.filter(t => typeof t === 'string' && !t.startsWith("character:") && !t.startsWith("artist:") && !t.startsWith("series:"));

  const [thumbnailSrc, setThumbnailSrc] = React.useState<string | null>(null);
  const [fullSrc, setFullSrc] = React.useState<string | null>(null);
  const [isFullLoaded, setIsFullLoaded] = React.useState(false);
  const [isThumbLoaded, setIsThumbLoaded] = React.useState(false);

  React.useEffect(() => {
    setIsFullLoaded(false);
    setIsThumbLoaded(false);
    setThumbnailSrc(null);
    setFullSrc(null);

    const loadImages = async () => {
      // 0. Instantly load local file if we have it downloaded
      if (currentLocalPath) {
        const localSrc = convertFileSrc(currentLocalPath);
        setThumbnailSrc(localSrc);
        setFullSrc(localSrc);
        return;
      }

      // 1. Instantly load the thumbnail
      const thumbUrl = image.thumbnailUrl || image.sampleUrl || "";
      if (needsProxy(thumbUrl)) {
         proxyViaTauri(thumbUrl).then(setThumbnailSrc);
      } else {
         setThumbnailSrc(thumbUrl);
      }

      // 2. Load the full image in the background
      const targetUrl = image.fullUrl || image.sampleUrl || "";
      if (needsProxy(targetUrl)) {
         proxyViaTauri(targetUrl).then(setFullSrc);
      } else {
         setFullSrc(targetUrl);
      }
    };
    
    loadImages();
  }, [currentLocalPath, image.thumbnailUrl, image.sampleUrl, image.fullUrl, needsProxy, proxyViaTauri]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-6xl h-full max-h-[90vh] bg-surface rounded-2xl overflow-hidden shadow-2xl flex border border-border-subtle"
        onClick={e => e.stopPropagation()}
      >
        {/* Left Side: Media */}
        <div className="flex-1 bg-black/50 relative flex items-center justify-center group overflow-hidden">
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
                referrerPolicy="no-referrer"
                onLoadedData={() => setIsFullLoaded(true)}
              />
            </>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              {!isThumbLoaded && !isFullLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground-muted gap-4 z-0">
                  <Loader2 size={48} className="animate-spin text-accent" />
                  <span className="font-black tracking-widest uppercase text-xs">Loading Image...</span>
                </div>
              )}
              {thumbnailSrc && (
                <img 
                  src={thumbnailSrc}
                  alt="Thumbnail"
                  className={`absolute inset-0 w-full h-full object-contain blur-md transition-opacity duration-300 z-10 ${isFullLoaded ? 'opacity-0' : (isThumbLoaded ? 'opacity-100' : 'opacity-0')}`}
                  referrerPolicy="no-referrer"
                  onLoad={() => setIsThumbLoaded(true)}
                  onError={() => setIsThumbLoaded(true)}
                />
              )}
              {fullSrc && (
                <img 
                  src={fullSrc}
                  alt="Detail view"
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 z-20 ${isFullLoaded ? 'opacity-100' : 'opacity-0'}`}
                  referrerPolicy="no-referrer"
                  onLoad={() => setIsFullLoaded(true)}
                  onError={() => setIsFullLoaded(true)}
                />
              )}
            </div>
          )}
          
          <button 
            onClick={onClose}
            className="absolute top-4 left-4 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-all backdrop-blur-md"
          >
            <X size={24} />
          </button>
        </div>

        {/* Right Side: Info & Actions */}
        <div className="w-[400px] bg-surface-elevated overflow-y-auto no-scrollbar flex flex-col border-l border-border-subtle">
          
          {/* Header Metadata */}
          <div className="p-6 border-b border-border-subtle flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-accent/20 text-accent font-black text-xs uppercase tracking-widest rounded-full">
                {image.providerId}
              </span>
              <span className="text-xs text-foreground-muted font-bold">
                {new Date(image.createdAt).toLocaleDateString()}
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
                await open(image.sourceUrl);
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

          {/* Tags */}
          <div className="p-6 flex flex-col gap-6">
            
            {artistTags.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-red-400 flex items-center gap-2">
                  <Tag size={12} /> Artist
                </h3>
                <div className="flex flex-wrap gap-2">
                  {artistTags.map(t => (
                    <button key={t} onClick={() => { onSearchTag(t.replace("artist:", "")); onClose(); }} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 rounded-lg text-sm transition-all">
                      {t.replace("artist:", "")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {seriesTags.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                  <Tag size={12} /> Series
                </h3>
                <div className="flex flex-wrap gap-2">
                  {seriesTags.map(t => (
                    <div key={t} className="flex group">
                      <button onClick={() => { onSearchTag(t.replace("series:", "").replace("copyright:", "")); onClose(); }} className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-l-lg text-sm transition-all border-r-0">
                        {t.replace("series:", "").replace("copyright:", "")}
                      </button>
                      <button onClick={() => onToggleFavorite && onToggleFavorite(t)} className={`px-2 py-1.5 border border-purple-500/20 rounded-r-lg transition-all ${favoriteTags.includes(t) ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-purple-500/5 hover:bg-yellow-500/20 text-yellow-500/50 hover:text-yellow-500'}`}>
                        <Star size={12} fill={favoriteTags.includes(t) ? "currentColor" : "none"} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {characterTags.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-green-400 flex items-center gap-2">
                  <Tag size={12} /> Character
                </h3>
                <div className="flex flex-wrap gap-2">
                  {characterTags.map(t => (
                    <div key={t} className="flex group">
                      <button onClick={() => { onSearchTag(t.replace("character:", "")); onClose(); }} className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20 rounded-l-lg text-sm transition-all border-r-0">
                        {t.replace("character:", "")}
                      </button>
                      <button onClick={() => onToggleFavorite && onToggleFavorite(t)} className={`px-2 py-1.5 border border-green-500/20 rounded-r-lg transition-all ${favoriteTags.includes(t) ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-green-500/5 hover:bg-yellow-500/20 text-yellow-500/50 hover:text-yellow-500'}`}>
                        <Star size={12} fill={favoriteTags.includes(t) ? "currentColor" : "none"} />
                      </button>
                    </div>
                  ))}
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
                {(showAllTags ? generalTags : generalTags.slice(0, 20)).map(t => (
                  <div key={t} className="flex group">
                    <button onClick={() => { onSearchTag(t); onClose(); }} className="px-3 py-1 bg-surface border border-border-subtle hover:border-blue-500/50 text-foreground-muted hover:text-foreground rounded-l-lg text-sm transition-all border-r-0">
                      {t}
                    </button>
                    <button onClick={() => onToggleFavorite && onToggleFavorite(t)} className={`px-2 py-1 border border-border-subtle rounded-r-lg transition-all ${favoriteTags.includes(t) ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-surface hover:bg-yellow-500/20 text-yellow-500/50 hover:text-yellow-500'}`}>
                      <Star size={12} fill={favoriteTags.includes(t) ? "currentColor" : "none"} />
                    </button>
                  </div>
                ))}
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
