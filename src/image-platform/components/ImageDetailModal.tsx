import React from 'react';
import type { PlatformImage } from '../types';
import { useSlideshowStore } from '../useSlideshowStore';
import { useImageCollectionStore } from '../useImageCollectionStore';
import { Download, Heart, FolderPlus, ListPlus, Play, ExternalLink, X, Tag } from 'lucide-react';
import clsx from 'clsx';
import { getDb } from '../../services/db';

interface ImageDetailModalProps {
  image: PlatformImage;
  images: PlatformImage[];
  index: number;
  onClose: () => void;
  onNavigate?: (newIndex: number) => void;
  onSearchTag: (tag: string) => void;
}

export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({ image, images, index, onClose, onNavigate, onSearchTag }) => {
  const slideshow = useSlideshowStore();
  const { folders, saveImage, loadFolders, savedImages, removeSavedImage } = useImageCollectionStore();
  const [showFolderMenu, setShowFolderMenu] = React.useState(false);
  const [showAllTags, setShowAllTags] = React.useState(false);

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

  const isFavorited = savedImages.some(img => img.id === image.id);

  const handleFavoriteToggle = async () => {
    if (isFavorited) {
      await removeSavedImage(image.id);
    } else {
      await saveImage(image, null);
    }
  };

  const handleDownload = async () => {
    try {
      // In a full implementation, you'd fetch the binary array buffer here
      // const response = await fetch(image.fullUrl);
      // const buffer = await response.arrayBuffer();
      // await writeBinaryFile(`downloads/${image.id}.jpg`, new Uint8Array(buffer), { dir: BaseDirectory.Picture });
      alert("Download initiated (Placeholder)");
    } catch (e) {
      console.error(e);
    }
  };

  const isVideo = image.fullUrl?.match(/\.(mp4|webm)(?:\?|$)/i) || image.sampleUrl?.match(/\.(mp4|webm)(?:\?|$)/i);

  // Group tags roughly by heuristics if we don't have perfect provider metadata
  // Ideally providers would give us typed tags, but for now we heuristically separate them if they have prefixes
  const characterTags = image.tags.filter(t => typeof t === 'string' && t.startsWith("character:"));
  const artistTags = image.tags.filter(t => typeof t === 'string' && t.startsWith("artist:"));
  const generalTags = image.tags.filter(t => typeof t === 'string' && !t.startsWith("character:") && !t.startsWith("artist:"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-6xl h-full max-h-[90vh] bg-surface rounded-2xl overflow-hidden shadow-2xl flex border border-border-subtle"
        onClick={e => e.stopPropagation()}
      >
        {/* Left Side: Media */}
        <div className="flex-1 bg-black/50 relative flex items-center justify-center group overflow-hidden">
          {isVideo ? (
            <video 
              src={image.fullUrl || image.sampleUrl}
              autoPlay
              loop
              controls
              className="w-full h-full object-contain"
            />
          ) : (
            <img 
              src={image.fullUrl || image.sampleUrl}
              alt="Detail view"
              className="w-full h-full object-contain"
            />
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
            <button onClick={handleDownload} className="h-10 bg-surface hover:bg-surface-raised border border-border-subtle rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-foreground transition-all">
              <Download size={16} /> Download
            </button>
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
            <div className="relative">
              <button onClick={() => setShowFolderMenu(!showFolderMenu)} className="w-full h-10 bg-surface hover:bg-surface-raised border border-border-subtle rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-foreground transition-all">
                <FolderPlus size={16} /> Save to...
              </button>
              {showFolderMenu && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-surface-elevated border border-border-subtle rounded-xl shadow-2xl p-2 z-50 flex flex-col max-h-[200px] overflow-y-auto">
                  {folders.map(f => (
                    <button 
                      key={f.id} 
                      onClick={() => { saveImage(image, f.id); setShowFolderMenu(false); alert("Saved to " + f.name); }}
                      className="text-left px-3 py-2 hover:bg-surface rounded-lg text-sm font-bold transition-all"
                    >
                      {f.name}
                    </button>
                  ))}
                  {folders.length === 0 && <span className="text-xs text-foreground-muted p-2">No folders</span>}
                </div>
              )}
            </div>
            <button 
              onClick={async () => {
                const { open } = await import('@tauri-apps/plugin-shell');
                await open(image.sourceUrl);
              }}
              className="h-10 bg-surface hover:bg-surface-raised border border-border-subtle rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-foreground transition-all"
            >
              <ExternalLink size={16} /> Original
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
                    <button key={t} onClick={() => { onSearchTag(t); onClose(); }} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 rounded-lg text-sm transition-all">
                      {t.replace("artist:", "")}
                    </button>
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
                    <button key={t} onClick={() => { onSearchTag(t); onClose(); }} className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20 rounded-lg text-sm transition-all">
                      {t.replace("character:", "")}
                    </button>
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
                  <button key={t} onClick={() => { onSearchTag(t); onClose(); }} className="px-3 py-1 bg-surface border border-border-subtle hover:border-blue-500/50 text-foreground-muted hover:text-foreground rounded-lg text-sm transition-all">
                    {t}
                  </button>
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
