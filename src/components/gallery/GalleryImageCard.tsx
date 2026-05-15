/**
 * GalleryImageCard
 * 
 * Shared card component for displaying gallery images across all tabs.
 * Premium glassmorphism design with hover actions.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Download, FolderPlus, Eye, Play } from 'lucide-react';

interface GalleryImageCardProps {
  id: string;
  imageUrl: string;
  previewUrl?: string;
  title?: string;
  tags?: string[];
  liked?: boolean;
  saved?: boolean;
  onView?: () => void;
  onLike?: () => void;
  onSave?: () => void;
  onPlay?: () => void;
  onAddToFolder?: () => void;
}

export const GalleryImageCard: React.FC<GalleryImageCardProps> = ({
  id,
  imageUrl,
  previewUrl,
  title,
  tags = [],
  liked = false,
  saved = false,
  onView,
  onLike,
  onSave,
  onPlay,
  onAddToFolder,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const displayUrl = previewUrl || imageUrl;
  const displayTitle = title || tags[0] || 'Untitled';

  return (
    <motion.div
      className="relative group cursor-pointer overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06]"
      style={{ aspectRatio: '3/4' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onView}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02 }}
    >
      {/* Scanning Lines Effect */}
      <div className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-500 opacity-0 group-hover:opacity-10 ${
        isHovered ? 'opacity-10' : ''
      }`} 
      style={{ 
        backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
        backgroundSize: '100% 2px, 3px 100%' 
      }} />

      {/* Image */}
      <img
        src={displayUrl}
        alt={displayTitle}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover transition-all duration-700 ${
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
        } ${isHovered ? 'scale-110 blur-[1px]' : ''}`}
      />

      {/* Shimmer Placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-transparent animate-pulse" />
      )}

      {/* Gradient Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300 ${
        isHovered ? 'opacity-100' : 'opacity-70'
      }`} />

      {/* Neon border glow on hover */}
      <div className={`absolute inset-0 rounded-2xl transition-all duration-500 ${
        isHovered 
          ? 'shadow-[inset_0_0_30px_rgba(168,85,247,0.3)] border border-purple-500/50 ring-1 ring-purple-500/30' 
          : 'border border-white/5'
      }`} />

      {/* Chromatic Aberration Simulation (Subtle shift) */}
      {isHovered && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30 mix-blend-screen scale-105 transition-transform duration-500">
          <img src={displayUrl} className="w-full h-full object-cover opacity-50 translate-x-1" alt="" />
          <img src={displayUrl} className="w-full h-full object-cover opacity-50 -translate-x-1 text-red-500" alt="" />
        </div>
      )}

      {/* Action Buttons (top-right) */}
      <div className={`absolute top-4 right-4 flex flex-col gap-2 z-20 transition-all duration-300 ${
        isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}>
        {onLike && (
          <button
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            className={`p-2.5 rounded-xl backdrop-blur-2xl transition-all active:scale-90 border border-white/10 ${
              liked
                ? 'bg-pink-500/90 text-white shadow-lg shadow-pink-500/30 border-pink-400'
                : 'bg-black/60 text-white/70 hover:bg-black/80 hover:text-pink-400'
            }`}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          </button>
        )}
        {onSave && !saved && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            className="p-2.5 rounded-xl bg-black/60 text-white/70 hover:bg-purple-500/90 hover:text-white backdrop-blur-2xl transition-all active:scale-90 shadow-xl border border-white/10"
          >
            <Download size={16} />
          </button>
        )}
        {onAddToFolder && saved && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToFolder(); }}
            className="p-2.5 rounded-xl bg-black/60 text-white/70 hover:bg-indigo-500/90 hover:text-white backdrop-blur-2xl transition-all active:scale-90 shadow-xl border border-white/10"
          >
            <FolderPlus size={16} />
          </button>
        )}
        {onPlay && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(); }}
            className="p-2.5 rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-500/40 transition-all active:scale-90 border border-purple-400"
          >
            <Play size={16} fill="currentColor" />
          </button>
        )}
      </div>

      {/* Saved indicator */}
      {saved && (
        <div className="absolute top-4 left-4 z-20">
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-purple-600/90 backdrop-blur-xl border border-purple-400/50 shadow-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
            <span className="text-[8px] font-black text-white uppercase tracking-widest">In Library</span>
          </div>
        </div>
      )}

      {/* Bottom Info */}
      <div className={`absolute bottom-0 left-0 right-0 p-5 z-20 transition-all duration-500 ${
        isHovered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}>
        <h4 className="text-white text-base font-black italic uppercase tracking-tighter truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          {displayTitle}
        </h4>
        {tags.length > 0 && (
          <div className="flex gap-1.5 mt-2 overflow-hidden">
            {tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-1 rounded-lg bg-white/10 text-white/80 text-[8px] font-black uppercase tracking-widest truncate backdrop-blur-xl border border-white/5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

    </motion.div>
  );
};
