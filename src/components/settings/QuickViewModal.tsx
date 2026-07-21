import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Info, Star, Bookmark, Play, Globe, Tag, Sparkles, BookOpen, Image as ImageIcon, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import { useModalStore } from '../../stores/useModalStore';
import { useScraperStore } from '../../stores/useScraperStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { ScraperService } from '../../services/ScraperService';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useProxiedImage } from '../../hooks/useProxiedImage';
import clsx from 'clsx';

const ProxiedRailImage = ({ src, alt, className }: { src: string, alt: string, className?: string }) => {
    const { src: proxiedSrc, handleError } = useProxiedImage(src);
    return <img src={proxiedSrc} className={className} alt={alt} onError={handleError} />;
};

export const QuickViewModal = () => {
    const { quickViewItem, closeQuickView, openImportModal, openTagManager } = useModalStore();
    const { prefill } = useScraperStore();
    const { series, toggleFavorite, refreshMangaMetadata } = useLibraryStore();
    const [relatedItems, setRelatedItems] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const railRef = useRef<HTMLDivElement>(null);

    const libraryItem = series.find(s => s?.mangaId === quickViewItem?.id || s?.id === quickViewItem?.id);
    const isFavorite = libraryItem?.tags?.includes('favorite');

    useEffect(() => {
        const fetchRelated = async () => {
            if (!quickViewItem) return;
            try {
                const tags = (libraryItem?.tags || quickViewItem.tags || []).slice(0, 3);
                if (tags.length > 0) {
                    const domain = (quickViewItem.mediaDomain === "image" || quickViewItem.contentType === "gallery" || quickViewItem.contentType === "album") ? "image" : "manga";
                    const results = await ScraperService.getRecommendationsByTags(tags, 8, false, domain);
                    setRelatedItems((results || []).filter(r => r.id !== (quickViewItem.id || libraryItem?.mangaId || libraryItem?.id)));
                }
            } catch (e) {
                console.error("Failed to fetch related items", e);
                setRelatedItems([]);
            }
        };
        fetchRelated();
    }, [quickViewItem?.id, libraryItem?.id]);

    // Remove early return to allow AnimatePresence to work

    const handleImport = () => {
        const url = quickViewItem?.url || quickViewItem?.seriesUrl;

        if (url) {
            prefill({
                url,
                metadata: {
                    title: quickViewItem.title,
                    coverUrl: quickViewItem.coverUrl || quickViewItem.cover,
                    source: quickViewItem.source,
                    tags: quickViewItem.tags
                }
            }); 
            closeQuickView();
            openImportModal(url);
        }
    };

    const handleRefresh = async () => {
        if (libraryItem) {
            setIsRefreshing(true);
            await refreshMangaMetadata(libraryItem.id);
            setIsRefreshing(false);
        }
    };

    const handleFavoriteClick = async () => {
        if (libraryItem) {
            await toggleFavorite(libraryItem.id);
        }
    };

    const handleTagClick = async (tag: string) => {
        const { useDiscoveryStore } = await import('../../stores/useDiscoveryStore');
        const { toast } = await import('../Toast');
        const discStore = useDiscoveryStore.getState();
        discStore.setQuery(tag);
        discStore.setActiveTab('search');
        discStore.setActiveType('manga');
        useSettingsStore.getState().setActiveView('discover');
        closeQuickView();
        toast.info(`Seeking other "${tag}" mangas globally...`);
        await discStore.search(tag);
    };

    const rawCover = quickViewItem?.cover || quickViewItem?.coverUrl;
    const initialCoverSrc = rawCover ? (rawCover.startsWith('http') ? rawCover : convertFileSrc(rawCover)) : undefined;
    
    const { src: coverSrc, handleError } = useProxiedImage(initialCoverSrc || "");
    
    const isVideo = coverSrc?.match(/\.(mp4|webm|mov)$/i);

    const scrollRail = (direction: 'left' | 'right') => {
        if (railRef.current) {
            const { scrollLeft, clientWidth } = railRef.current;
            const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.6 : scrollLeft + clientWidth * 0.6;
            railRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    return (
        <AnimatePresence>
            {quickViewItem && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeQuickView}
                        className="absolute inset-0 bg-black/40 backdrop-blur-2xl"
                    />

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 40 }}
                        className="relative w-full max-w-5xl bg-background rounded-[48px] border border-border-subtle shadow-cinematic overflow-hidden flex flex-col md:flex-row h-auto max-h-[90vh]"
                    >
                        {/* Left Side: Cinematic Cover Art */}
                        <div className="w-full md:w-2/5 relative bg-surface overflow-hidden group">
                            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20 gap-4">
                                <ImageIcon size={64} className="text-foreground" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground">Cover Unavailable</span>
                            </div>
                            {coverSrc && (
                                <>
                                    {/* Blurred Backdrop */}
                                    {isVideo ? (
                                        <video 
                                            src={coverSrc}
                                            className="absolute inset-0 w-full h-full object-cover opacity-30 blur-3xl scale-150 z-0"
                                            autoPlay loop muted playsInline
                                        />
                                    ) : (
                                        <img 
                                            src={coverSrc}
                                            className="absolute inset-0 w-full h-full object-cover opacity-30 blur-3xl scale-150 z-0"
                                            alt=""
                                        />
                                    )}
                                    {/* Sharp Foreground Image */}
                                    {isVideo ? (
                                        <video 
                                            src={coverSrc} 
                                            className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-110 relative z-10 drop-shadow-2xl" 
                                            autoPlay loop muted playsInline
                                            onError={(e) => {
                                                handleError();
                                                if (coverSrc === initialCoverSrc) e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <img 
                                            src={coverSrc} 
                                            className="w-full h-full object-contain p-4 transition-transform duration-700 group-hover:scale-110 relative z-10 drop-shadow-2xl" 
                                            alt={quickViewItem?.title || ''} 
                                            onError={(e) => {
                                                handleError();
                                                if (coverSrc === initialCoverSrc) e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    )}
                                </>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-20" />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/20 z-20" />
                            
                            {/* Floating Stats */}
                            <div className="absolute bottom-8 left-8 right-8 flex items-center gap-4">
                                <div className="px-4 py-2 bg-surface-elevated backdrop-blur-xl border border-border-subtle rounded-2xl flex flex-col">
                                    <span className="text-[10px] text-foreground-dim font-black uppercase tracking-widest">Chapters</span>
                                    <span className="text-foreground font-black">{libraryItem?.books?.length || '?'}</span>
                                </div>
                                <div className="px-4 py-2 bg-surface-elevated backdrop-blur-xl border border-border-subtle rounded-2xl flex flex-col">
                                    <span className="text-[10px] text-foreground-dim font-black uppercase tracking-widest">Source</span>
                                    <span className="text-accent font-black uppercase text-xs truncate max-w-[100px]">{quickViewItem?.source || 'Web'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Information Hub */}
                        <div className="flex-1 p-8 md:p-14 flex flex-col min-w-0 bg-background overflow-y-auto custom-scrollbar">
                            <div className="space-y-10">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-6">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex items-center gap-3">
                                            <div className="px-4 py-1.5 bg-accent text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent-glow">
                                                {libraryItem ? 'In Collection' : 'Discovery'}
                                            </div>
                                            {libraryItem && (
                                                <button 
                                                    onClick={handleRefresh}
                                                    className={clsx(
                                                        "p-1.5 rounded-full bg-surface-elevated border border-border-subtle text-foreground-dim hover:text-foreground transition-all",
                                                        isRefreshing && "animate-spin text-accent"
                                                    )}
                                                    title="Refresh Metadata"
                                                >
                                                    <Sparkles size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <h2 className="text-4xl md:text-5xl font-black text-foreground leading-none tracking-tighter uppercase italic drop-shadow-2xl">
                                            {quickViewItem?.title}
                                        </h2>
                                    </div>
                                    <button 
                                        onClick={closeQuickView}
                                        className="p-3 rounded-full bg-surface-elevated hover:bg-surface-raised text-foreground-dim hover:text-foreground transition-all border border-border-subtle"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                {/* Interactive Tags */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-black text-foreground-muted uppercase tracking-[0.3em]">Taxonomy</h3>
                                        {libraryItem && (
                                            <button 
                                                onClick={() => openTagManager(libraryItem.id, libraryItem.tags)}
                                                className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors flex items-center gap-2"
                                            >
                                                <Tag size={12} />
                                                Edit Tags
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2.5">
                                        {(libraryItem?.tags || quickViewItem?.tags || []).map((tag: string, idx: number) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => handleTagClick(tag)}
                                                className="px-4 py-2 bg-surface-elevated border border-border-subtle hover:bg-accent-soft hover:border-accent/30 text-foreground-muted hover:text-accent rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                        {(libraryItem?.tags || []).length === 0 && !quickViewItem?.tags && (
                                            <button 
                                                onClick={handleRefresh}
                                                className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-indigo-500/20 transition-all"
                                            >
                                                <Play size={10} fill="currentColor" />
                                                Scrape Metadata
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Synopsis */}
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-foreground-dim uppercase tracking-[0.3em]">Background</h3>
                                    <p className="text-sm md:text-base text-foreground-muted font-medium leading-relaxed max-w-2xl">
                                        {libraryItem?.description || quickViewItem?.description || "No deep background available. This series has been identified by the FlowManga discovery engine as a high-potential addition to your library."}
                                    </p>
                                </div>

                                {/* Related rail inside modal */}
                                {relatedItems.length > 0 && (
                                    <div className="space-y-6 pt-4 relative group/rail">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Sparkles size={16} className="text-amber-400" />
                                                <h3 className="text-[10px] font-black text-foreground-dim uppercase tracking-[0.3em]">Similar Vibes</h3>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover/rail:opacity-100 transition-opacity">
                                                <button onClick={() => scrollRail('left')} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-foreground-dim hover:text-foreground transition-all"><ChevronLeft size={16} /></button>
                                                <button onClick={() => scrollRail('right')} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-foreground-dim hover:text-foreground transition-all"><ChevronRight size={16} /></button>
                                            </div>
                                        </div>
                                        <div ref={railRef} className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-4">
                                            {relatedItems.map((item, idx) => (
                                                <button
                                                    type="button"
                                                    key={idx} 
                                                    onClick={() => useModalStore.getState().openQuickView(item)}
                                                    className="min-w-[120px] aspect-[2/3] rounded-2xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer hover:scale-105 transition-all group relative"
                                                >
                                                    <ProxiedRailImage src={item.coverUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-3">
                                                        <span className="text-[8px] font-black text-foreground uppercase truncate">{item.title}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Row */}
                            <div className="mt-12 flex items-center gap-4">
                                {libraryItem ? (
                                     <button 
                                        onClick={() => {
                                            useSettingsStore.getState().setActiveView('library');
                                            useLibraryStore.getState().setSelectedSeriesId(libraryItem.id);
                                            closeQuickView();
                                        }}
                                        className="flex-1 h-18 bg-white/10 hover:bg-white/20 text-foreground rounded-[24px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-2xl border border-white/5"
                                    >
                                        <BookOpen size={22} />
                                        Enter Archive
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleImport}
                                        className="flex-[2] h-18 bg-indigo-500 hover:bg-indigo-600 text-white rounded-[24px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-[0_20px_40px_rgba(99,102,241,0.3)]"
                                    >
                                        <Download size={22} />
                                        Download
                                    </button>
                                )}
                                
                                <button 
                                    onClick={async () => {
                                        const sourceUrl = quickViewItem.url || quickViewItem.seriesUrl;
                                        if (sourceUrl) {
                                            const { open: openShell } = await import('@tauri-apps/plugin-shell');
                                            await openShell(sourceUrl);
                                        }
                                    }}
                                    className="flex-1 h-18 bg-white/5 hover:bg-white/10 text-foreground rounded-[24px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all border border-white/10"
                                    title="Open original site"
                                >
                                    <Globe size={20} />
                                    Read Online
                                </button>

                                <button 
                                    onClick={handleFavoriteClick}
                                    disabled={!libraryItem}
                                    className={clsx(
                                        "w-18 h-18 rounded-[24px] flex items-center justify-center transition-all backdrop-blur-xl border border-white/10",
                                        isFavorite ? "bg-amber-500 text-foreground shadow-[0_0_30px_rgba(245,158,11,0.4)] border-amber-400" : "bg-white/5 hover:bg-white/10 text-foreground",
                                        !libraryItem && "opacity-20 cursor-not-allowed"
                                    )}
                                >
                                    <Star size={24} fill={isFavorite ? "currentColor" : "none"} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
