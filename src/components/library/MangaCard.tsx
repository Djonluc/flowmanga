import { motion } from 'framer-motion';
import { Play, MoreVertical, FolderOpen } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import clsx from 'clsx';

interface MangaCardProps {
    item: any;
    onClick: () => void;
    onMenuClick?: (e: React.MouseEvent, action?: 'rename' | 'delete' | 'tag') => void;
    density?: 'compact' | 'comfortable' | 'cinematic';
}

export const MangaCard = ({ item, onClick, onMenuClick, density = 'comfortable' }: MangaCardProps) => {
    const isSeries = 'books' in item;
    
    // Derived state
    const title = item.title;
    const coverSrc = (item.cover || item.coverUrl) ? ((item.cover || item.coverUrl).startsWith('http') ? (item.cover || item.coverUrl) : convertFileSrc(item.cover || item.coverUrl)) : '';
    const progress = !isSeries && item.progress ? (item.progress.currentPage / item.progress.totalPages) * 100 : 0;
    const badge = isSeries ? `${item.books.length}` : null;
    const tags = item.tags || [];

    const handleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onMenuClick) onMenuClick(e);
    };

    return (
        <motion.div
            layout 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="group relative flex flex-col gap-3 cursor-pointer"
            onClick={onClick}
        >
            {/* Card Image Container */}
            <div className={clsx(
                "relative overflow-hidden bg-neutral-900 shadow-xl transition-all duration-300",
                "border border-white/5 group-hover:border-accent/30 rounded-[12px] aspect-[2/3]",
                density === 'cinematic' && "rounded-[24px]"
            )}>
                {/* Image */}
                {coverSrc ? (
                    <img 
                        src={coverSrc} 
                        alt={title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-1"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 text-neutral-600 font-black p-4 text-center text-[10px] uppercase tracking-widest gap-2">
                        <FolderOpen size={24} className="opacity-20" />
                        NO COVER
                    </div>
                )}

                {/* Overlay: Advanced Actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-[4px]">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); onClick(); }}
                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                        title="Continue Reading"
                    >
                        <Play size={24} fill="currentColor" className="ml-1" />
                    </motion.button>
                    
                    <button 
                        onClick={handleMenu}
                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-90 backdrop-blur-md" 
                        title="More Options"
                    >
                         <MoreVertical size={20} />
                    </button>
                </div>

                {/* Badges */}
                <div className="absolute top-3 right-3 flex flex-col gap-1 items-end pointer-events-none">
                     {isSeries && (
                         <span className="px-2 py-1 rounded-md bg-black/80 backdrop-blur text-[9px] font-black text-white border border-white/10 uppercase tracking-widest">
                             {badge} VOLS
                         </span>
                     )}
                     
                     {/* New Badge */}
                     {isSeries && item.updatedAt && (new Date().getTime() - new Date(item.updatedAt).getTime() < 3 * 24 * 60 * 60 * 1000) && (
                         <span className="px-2 py-1 rounded-md bg-blue-500 text-[9px] font-black text-white shadow-lg uppercase tracking-widest animate-pulse">
                             NEW
                         </span>
                     )}

                     {(!isSeries && (item.chapterNumber !== undefined || item.meta?.chapter)) && (
                         <span className="px-2 py-1 rounded-md bg-accent text-[9px] font-black text-white shadow-lg uppercase tracking-widest">
                             CH {item.chapterNumber || item.meta?.chapter}
                         </span>
                     )}
                </div>

                {/* Progress Bar (Glow mode) */}
                {!isSeries && progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60 overflow-hidden">
                        <div 
                            className="h-full bg-accent shadow-[0_0_12px_var(--color-accent-glow)] transition-all duration-300" 
                            style={{ width: `${progress}%` }} 
                        />
                    </div>
                )}
            </div>

            {/* Metadata (Clean V3 style) */}
            <div className="space-y-1.5 px-0.5">
                <h3 className={clsx(
                    "font-black text-white leading-snug truncate group-hover:text-accent transition-colors uppercase italic tracking-tight",
                    density === 'compact' && "text-[11px]",
                    density === 'comfortable' && "text-sm",
                    density === 'cinematic' && "text-base"
                )}>
                    {item.displayName || title}
                </h3>
                
                <div className="flex items-center justify-between gap-2 overflow-hidden">
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.1em] truncate">
                        {isSeries ? 'Series' : (item.seriesTitle || item.meta?.series || 'Single Issue')}
                    </p>
                    
                    {tags && tags.length > 0 && (
                        <div className={clsx(
                            "flex overflow-hidden flex-wrap",
                            density === 'compact' ? "gap-1 max-h-4 ml-auto" : "gap-1.5 max-h-5"
                        )}>
                            {tags.slice(0, density === 'compact' ? 1 : 3).map((tag: string) => (
                                <span 
                                    key={tag} 
                                    className={clsx(
                                        "flex-shrink-0 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 font-black uppercase tracking-tight transition-colors",
                                        density === 'compact' ? "text-[7px] text-neutral-600" : "text-[8px] text-neutral-400 hover:text-white"
                                    )}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
