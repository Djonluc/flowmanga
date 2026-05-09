import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, MoreVertical, FolderOpen, Heart } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useLibraryStore } from '../../stores/useLibraryStore';
import clsx from 'clsx';

interface MangaCardProps {
    item: any;
    onClick: () => void;
    onMenuClick?: (e: React.MouseEvent, action?: 'rename' | 'delete' | 'tag') => void;
    density?: 'compact' | 'comfortable' | 'cinematic';
    isNew?: boolean;
    isSelectionMode?: boolean;
    isSelected?: boolean;
}

export const MangaCard = ({ 
    item, onClick, onMenuClick, density = 'comfortable', 
    isNew, isSelectionMode, isSelected 
}: MangaCardProps) => {
    const { toggleFavorite } = useLibraryStore();
    const [hasImageError, setHasImageError] = useState(false);
    const isSeries = 'books' in item;
    
    // Derived state
    const title = item.title;
    const rawCover = item.cover || item.coverUrl || item.coverPath;
    const coverSrc = rawCover ? (rawCover.startsWith('http') ? rawCover : convertFileSrc(rawCover)) : '';
    const progress = !isSeries && item.progress ? (item.progress.currentPage / (item.progress.totalPages || 1)) * 100 : 
                     (item.currentPage && item.totalPages) ? (item.currentPage / (item.totalPages || 1)) * 100 : 0;
    
    const isFavorite = item.tags?.includes('favorite') || item.seriesTags?.includes('favorite');
    const badge = isSeries ? `${item.books.length}` : null;
    const tags = item.tags || [];

    const handleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onMenuClick) onMenuClick(e);
    };

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleFavorite(item.seriesId || item.id);
    };

    return (
        <motion.div
            layout 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -8, scale: 1.02 }}
            className="group relative flex flex-col gap-4 cursor-pointer"
            onClick={onClick}
        >
            {/* Ambient Glow Backdrop */}
            <div className="ambient-glow" style={{ '--accent-glow': isFavorite ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)' } as any} />

            {/* Card Image Container */}
            <div className={clsx(
                "relative overflow-hidden bg-[#0a0a0b] shadow-premium transition-all duration-700",
                "group-hover:shadow-cinematic aspect-[2/3]",
                density === 'compact' && "rounded-2xl",
                density === 'comfortable' && "rounded-[32px]",
                density === 'cinematic' && "rounded-[48px]",
                isSelected && "ring-4 ring-indigo-500 ring-offset-4 ring-offset-[#050505] scale-95"
            )}>
                {/* Selection Indicator */}
                <AnimatePresence>
                    {isSelectionMode && (
                        <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute top-4 left-4 z-50"
                        >
                            <div className={clsx(
                                "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center backdrop-blur-xl shadow-2xl",
                                isSelected 
                                    ? "bg-indigo-500 border-indigo-400 text-white" 
                                    : "bg-black/40 border-white/20 text-transparent"
                            )}>
                                {isSelected && (
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-[3]">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {/* Image */}
                {coverSrc && !hasImageError ? (
                    <img 
                        src={coverSrc} 
                        alt={title} 
                        className="w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-110"
                        loading="lazy"
                        onError={() => setHasImageError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/[0.03] text-neutral-600 font-medium p-4 text-center text-xs tracking-wide gap-2">
                        <FolderOpen size={24} className="opacity-20" />
                        {hasImageError ? 'Broken Link' : 'No Cover'}
                    </div>
                )}

                {/* Hover Overlay: Cinematic FAB */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-700 flex flex-col items-center justify-center backdrop-blur-[4px]">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        whileHover={{ scale: 1.15, rotate: 5 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                    >
                        <Play size={24} fill="currentColor" className="ml-1" />
                    </motion.div>
                </div>
                
                {/* Quick Actions (Top Right) */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-20 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500">
                    <button 
                        onClick={handleMenu}
                        className="w-10 h-10 rounded-2xl bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-xl transition-all shadow-2xl border border-white/10" 
                    >
                         <MoreVertical size={16} />
                    </button>
                    <button 
                        onClick={handleToggleFavorite}
                        className={clsx(
                            "w-10 h-10 rounded-2xl flex items-center justify-center backdrop-blur-xl transition-all shadow-2xl border border-white/10",
                            isFavorite ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-black/40 hover:bg-black/60 text-white"
                        )}
                    >
                         <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
                    </button>
                </div>

                {/* Progress Badge (Bottom Left of Image) */}
                {progress > 0 && (
                    <div className="absolute bottom-4 left-4 z-20">
                        <span className="px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-xl text-[10px] font-black text-white border border-white/10 shadow-2xl">
                            {Math.round(progress)}%
                        </span>
                    </div>
                )}

                {/* New Badge (Top Left of Image) */}
                {(isNew || (item.updatedAt && (new Date().getTime() - new Date(item.updatedAt).getTime() < 3 * 24 * 60 * 60 * 1000))) && (
                    <div className="absolute top-4 left-4 z-20">
                        <span className="px-3 py-1 rounded-xl bg-indigo-500 text-[10px] font-black text-white shadow-xl tracking-tight uppercase">
                            New
                        </span>
                    </div>
                )}
            </div>

            {/* Metadata Container */}
            <div className="space-y-2 px-2">
                <div className="space-y-1">
                    <h3 className="font-black text-white leading-tight truncate group-hover:text-indigo-400 transition-colors text-sm tracking-tight">
                        {item.displayName || title}
                    </h3>
                    <div className="flex items-center justify-between gap-2 overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest truncate">
                            {isSeries ? `${item.books.length} Volumes` : `Chapter ${item.chapterNumber || item.meta?.chapter || '?'}`}
                        </p>
                    </div>
                </div>

                {/* Progress Line: Thin and Elegant */}
                {progress > 0 && (
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                        <div 
                            className={clsx(
                                "h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(99,102,241,0.6)]",
                                isFavorite ? "bg-red-500" : "bg-indigo-500"
                            )} 
                            style={{ width: `${progress}%` }} 
                        />
                    </div>
                )}
            </div>
        </motion.div>
    );
};
