import { useEffect, useState, useMemo } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useReadingStore } from '../stores/useReadingStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useVideoStore } from '../stores/useVideoStore';
import { motion } from 'framer-motion';
import { Clock, Sparkles, PlusCircle, Play, Film, Zap, Tag, Edit2, Trash2 } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { FeaturedCarousel } from './home/FeaturedCarousel';
import { HorizontalRail } from './home/HorizontalRail';
import { ScraperService } from '../services/ScraperService';
import { useScraperStore } from '../stores/useScraperStore';
import { toast } from './Toast';

export const HomeView = () => {
    const { series, setLoading, refreshMangaMetadata, renameSeries } = useLibraryStore();
    const { openFolder } = useReadingStore();
    const { currentVideo } = useVideoStore();
    const { setActiveView } = useSettingsStore();

    const { setUrl, setAutoOpenModal } = useScraperStore();
    const [continueReading, setContinueReading] = useState<any[]>([]);
    const [trending, setTrending] = useState<any[]>([]);
    const [externalRecent, setExternalRecent] = useState<any[]>([]);
    const [personalized, setPersonalized] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalSeries: 0, totalChapters: 0, unreadCount: 0 });

    // Modals
    const [activeMenu, setActiveMenu] = useState<{ x: number, y: number, item: any } | null>(null);
    const [tagManagerItem, setTagManagerItem] = useState<{ id: string, tags: string[] } | null>(null);
    const [renameItem, setRenameItem] = useState<{ id: string, title: string } | null>(null);

    useEffect(() => {
        loadRecentHistory();
        loadStats();
        fetchExternalData();
    }, [series]);

    const fetchExternalData = async () => {
        try {
            const [trendingData, recentData] = await Promise.all([
                ScraperService.getTrending(12),
                ScraperService.getRecentlyUpdated(12)
            ]);
            setTrending(trendingData.filter(ext => !series.some(s => s.mangaId === ext.id || s.title.toLowerCase() === ext.title.toLowerCase())));
            setExternalRecent(recentData.filter(ext => !series.some(s => s.mangaId === ext.id || s.title.toLowerCase() === ext.title.toLowerCase())));
            
            // Personal recommendations based on most used tags
            const allTags = series.flatMap(s => s.tags || []);
            const tagCounts: Record<string, number> = {};
            allTags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
            const topTags = Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([tag]) => tag);
            
            if (topTags.length > 0) {
                const recs = await ScraperService.searchByTags(topTags, 12);
                setPersonalized(recs.filter(ext => !series.some(s => s.mangaId === ext.id || s.title.toLowerCase() === ext.title.toLowerCase())));
            }
        } catch (e) {
            console.error("HomeView: External fetch error", e);
        }
    };

    const loadStats = async () => {
        const totalSeries = series.length;
        const totalChapters = series.reduce((acc, s) => acc + (s.books?.length || 0), 0);
        // Simplified unread for now
        setStats({ totalSeries, totalChapters, unreadCount: 0 });
    };

    const handleAction = async (action: 'tag' | 'rename' | 'delete' | 'refresh', item: any) => {
        setActiveMenu(null);
        if (action === 'tag') {
            setTagManagerItem({ id: item.id, tags: item.tags || [] });
        } else if (action === 'rename') {
            setRenameItem({ id: item.id, title: item.title });
        } else if (action === 'refresh') {
            const { toast } = await import('./Toast');
            toast.info(`Refreshing metadata for ${item.title}...`);
            await refreshMangaMetadata(item.id);
            toast.success('Metadata updated');
        } else if (action === 'delete') {
            toast.info('Visit Library to delete content.');
        }
    };

    const handleMenuClick = (item: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveMenu({ x: e.clientX, y: e.clientY, item });
    };

    const loadRecentHistory = async () => {
        try {
            const { getDb } = await import('../services/db');
            const db = getDb();
            const history = await db.select<any[]>(`
                SELECT rp.*, c.title, s.coverPath as cover, c.filePath, s.title as seriesTitle, s.tags as seriesTags, s.updatedAt as seriesUpdatedAt
                FROM ReadingProgress rp
                JOIN Chapters c ON rp.chapterId = c.id
                JOIN Series s ON rp.seriesId = s.id
                ORDER BY rp.lastReadAt DESC
                LIMIT 12
            `);
            
            const activeReading = history.filter(item => {
                if (!item.totalPages || item.totalPages === 0) return true;
                return item.currentPage < item.totalPages;
            }).map(item => ({
                ...item,
                id: item.seriesId, // Map to series ID for menu actions
                title: item.seriesTitle,
                tags: item.seriesTags ? item.seriesTags.split(',') : [],
                updatedAt: item.seriesUpdatedAt
            }));

            setContinueReading(activeReading);
        } catch (e) {
            console.error("Failed to load home history", e);
        }
    };

    const recentlyAdded = useMemo(() => {
        return [...series]
            .sort((a, b) => (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime()))
            .slice(0, 12); 
    }, [series]);

    const recentlyUpdatedLocal = useMemo(() => {
        return [...series]
            .sort((a, b) => (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime()))
            .slice(0, 12);
    }, [series]);

    const handleOpenItem = async (item: any) => {
        if ('books' in item) {
            // It's a series, open its first book or its detailed view
            useLibraryStore.getState().setSelectedSeriesId(item.id);
            setActiveView('library');
        } else {
            try {
                setLoading(true);
                // Find sequence from series in store
                const fullSeries = series.find(s => s.id === item.seriesId);
                const sequence = fullSeries ? fullSeries.books.map(b => ({
                    id: b.id,
                    path: b.path,
                    title: b.title
                })) : [];

                await openFolder(
                    item.filePath || item.path, 
                    item.seriesId, 
                    item.chapterId || item.id,
                    sequence,
                    item.currentPage // Pass current page for resume
                );
            } catch (err) {
                console.error("Failed to open content", err);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="h-full overflow-y-auto no-scrollbar pb-32 bg-transparent">
            
            <FeaturedCarousel />

            <div className="space-y-16">
                {/* Continue Reading Rail */}
                {continueReading.length > 0 && (
                    <HorizontalRail 
                        title="Resume Session"
                        icon={<Clock size={20} />}
                        items={continueReading}
                        onItemClick={handleOpenItem}
                        onMenuClick={handleMenuClick}
                        onViewAll={() => setActiveView('library')}
                        accentColor="text-accent"
                    />
                )}

                {/* Library Statistics Summary */}
                <section className="px-16 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 flex flex-col gap-2 group hover:bg-white/[0.04] transition-all">
                            <span className="text-neutral-500 font-bold uppercase text-[10px] tracking-[0.2em] group-hover:text-accent transition-colors">Library Status</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-white italic">{stats.totalSeries}</span>
                                <span className="text-neutral-600 font-bold uppercase text-xs">Series</span>
                            </div>
                        </div>
                        <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 flex flex-col gap-2 group hover:bg-white/[0.04] transition-all">
                            <span className="text-neutral-500 font-bold uppercase text-[10px] tracking-[0.2em] group-hover:text-purple-500 transition-colors">Storage Summary</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-white italic">{stats.totalChapters}</span>
                                <span className="text-neutral-600 font-bold uppercase text-xs">Local Items</span>
                            </div>
                        </div>
                        <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 flex flex-col gap-2 group hover:bg-white/[0.04] transition-all">
                            <span className="text-neutral-500 font-bold uppercase text-[10px] tracking-[0.2em] group-hover:text-yellow-500 transition-colors">Digital Stream</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black text-white italic">Active</span>
                                <span className="text-neutral-600 font-bold uppercase text-xs">MangaDex Sync</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Recently Added Rail */}
                <HorizontalRail 
                    title="Recently Added"
                    icon={<PlusCircle size={20} />}
                    items={recentlyAdded}
                    onItemClick={handleOpenItem}
                    onMenuClick={handleMenuClick}
                    onViewAll={() => setActiveView('library')}
                    accentColor="text-purple-500"
                    emptyMessage="Link a source folder to populate your library."
                />

                {/* Local Recently Updated Rail */}
                <HorizontalRail 
                    title="Library Updates"
                    icon={<Zap size={20} />}
                    items={recentlyUpdatedLocal}
                    onItemClick={handleOpenItem}
                    onMenuClick={handleMenuClick}
                    onViewAll={() => setActiveView('library')}
                    accentColor="text-blue-500"
                />

                {/* trending items from MangaDex */}
                {trending.length > 0 && (
                    <HorizontalRail 
                        title="Trending on MangaDex"
                        icon={<Sparkles size={20} />}
                        items={trending}
                        onItemClick={(item) => {
                            setUrl(`https://mangadex.org/title/${item.id}`);
                            setAutoOpenModal(true);
                        }}
                        accentColor="text-yellow-500"
                    />
                )}

                {/* Personal Recommendations */}
                {personalized.length > 0 && (
                    <HorizontalRail 
                        title="Recommended For You"
                        icon={<Tag size={20} />}
                        items={personalized}
                        onItemClick={(item) => {
                            setUrl(`https://mangadex.org/title/${item.id}`);
                            setAutoOpenModal(true);
                        }}
                        accentColor="text-accent"
                    />
                )}

                {/* Recently Updated MangaDex */}
                {externalRecent.length > 0 && (
                    <HorizontalRail 
                        title="Recent Global Releases"
                        icon={<Zap size={20} />}
                        items={externalRecent}
                        onItemClick={(item) => {
                            setUrl(`https://mangadex.org/title/${item.id}`);
                            setAutoOpenModal(true);
                        }}
                        accentColor="text-blue-500"
                    />
                )}

                {/* Active Video (Kept as specialized section) */}
                {currentVideo && (
                    <section className="px-16 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-lg shadow-red-500/5">
                                <Film size={20} />
                            </div>
                            <h2 className="text-3xl font-black text-white uppercase italic tracking-tight">Active Screening</h2>
                        </div>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.98 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            className="relative group cursor-pointer overflow-hidden rounded-[40px] border border-white/5 bg-neutral-900 aspect-[21/9] shadow-2xl max-w-4xl"
                            onClick={() => setActiveView('videos')}
                        >
                            <img 
                                src={currentVideo.thumbnailPath ? convertFileSrc(currentVideo.thumbnailPath) : ''} 
                                className="w-full h-full object-cover opacity-40 group-hover:scale-105 group-hover:opacity-60 transition-all duration-1000"
                                alt="Video thumbnail"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
                            <div className="absolute inset-x-0 bottom-0 p-12 z-20 flex items-end justify-between">
                                <div className="space-y-2">
                                    <span className="text-red-500 font-black text-[10px] uppercase tracking-[0.4em] flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> IN PROGRESS
                                    </span>
                                    <h3 className="text-4xl font-black text-white uppercase italic">{currentVideo.title}</h3>
                                    <p className="text-neutral-500 font-bold uppercase text-xs tracking-widest">{currentVideo.resolution} Stream</p>
                                </div>
                                <div className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center shadow-2xl shadow-white/20 transform group-hover:scale-110 transition-transform">
                                    <Play size={32} fill="currentColor" className="ml-1" />
                                </div>
                            </div>
                        </motion.div>
                    </section>
                )}

            </div>

            {/* Modals & Overlays */}
            {tagManagerItem && (
                <TagManagerModal 
                    isOpen={true}
                    onClose={() => { setTagManagerItem(null); }}
                    seriesId={tagManagerItem.id}
                    initialTags={tagManagerItem.tags}
                />
            )}

            {renameItem && (
                <InputModal 
                    isOpen={true}
                    onClose={() => setRenameItem(null)}
                    title="Rename Series"
                    placeholder="New title..."
                    description={`Renaming: ${renameItem.title}`}
                    onSubmit={(newTitle) => {
                        renameSeries(renameItem.id, newTitle);
                    }}
                />
            )}

            <ContextMenu activeMenu={activeMenu} onAction={handleAction} onClose={() => setActiveMenu(null)} />
        </div>
    );
};

// Re-using the same ContextMenu component logic
const ContextMenu = ({ activeMenu, onAction, onClose }: { activeMenu: any, onAction: (a: any, i: any) => void, onClose: () => void }) => {
    if (!activeMenu) return null;
    return (
        <div className="fixed inset-0 z-[100]" onClick={onClose}>
            <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            style={{ left: activeMenu.x, top: activeMenu.y }}
            className="absolute bg-neutral-900 border border-white/10 rounded-xl shadow-2xl py-2 min-w-[180px] backdrop-blur-xl"
            >
                <button 
                onClick={() => onAction('tag', activeMenu.item)}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-white hover:bg-white/10 transition-colors"
                >
                    <Tag size={16} className="text-blue-400" />
                    Manage Tags
                </button>
                <button 
                onClick={() => onAction('rename', activeMenu.item)}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-white hover:bg-white/10 transition-colors"
                >
                    <Edit2 size={16} className="text-purple-400" />
                    Rename Series
                </button>
                <button 
                onClick={() => onAction('refresh', activeMenu.item)}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-white hover:bg-white/10 transition-colors"
                >
                    <Sparkles size={16} className="text-accent" />
                    Refresh Metadata
                </button>
                <div className="h-px bg-white/5 my-1" />
                <button 
                onClick={() => onAction('delete', activeMenu.item)}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                    <Trash2 size={16} />
                    Delete Series
                </button>
            </motion.div>
        </div>
    );
};

// Explicit imports for types/components used in modals
import { TagManagerModal } from './library/TagManagerModal';
import { InputModal } from './InputModal';
