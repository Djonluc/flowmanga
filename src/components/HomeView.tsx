import { useEffect, useState } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useReadingStore } from '../stores/useReadingStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useScraperStore } from '../stores/useScraperStore';
import { useModalStore } from '../stores/useModalStore';
import { Tag, Edit2, Sparkles, Trash2, ChevronRight, PlusCircle, Zap, Clock, TrendingUp, BarChart3, Activity as ActivityIcon, Bookmark, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FeaturedCarousel } from './home/FeaturedCarousel';
import { HorizontalRail } from './home/HorizontalRail';
import { ScraperService } from '../services/ScraperService';
import { convertFileSrc } from '@tauri-apps/api/core';
import clsx from 'clsx';

export const HomeView = () => {
    const { series, setLoading, refreshMangaMetadata, renameSeries, deleteSeries, loadFromDb } = useLibraryStore();
    const { openFolder } = useReadingStore();
    const { activeView, isInitializing, setActiveView } = useSettingsStore();
    const { openImportModal, openTagManager, openInputModal, openDeleteModal, openQuickView } = useModalStore();

    const [continueReading, setContinueReading] = useState<any[]>([]);
    const [recentlyAdded, setRecentlyAdded] = useState<any[]>([]);
    const [recentlyUpdatedLocal, setRecentlyUpdatedLocal] = useState<any[]>([]);
    const [trending, setTrending] = useState<any[]>([]);
    const [personalized, setPersonalized] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({});
    const [activity, setActivity] = useState<any[]>([]);
    const [activeMenu, setActiveMenu] = useState<{ x: number, y: number, item: any } | null>(null);

    const { coloredOnly } = useSettingsStore();

    useEffect(() => {
        if (!isInitializing) {
            loadFromDb();
            loadRecentHistory();
            loadStats();
            fetchExternalData();
            loadActivity();
        }
    }, [series, isInitializing, coloredOnly]);

    const fetchExternalData = async () => {
        try {
            const { coloredOnly } = useSettingsStore.getState();
            const existingIds = new Set(series.map(s => s.mangaId || s.id));
            
            // Get tags from favorites
            const favoriteTags = Array.from(new Set(
                series
                    .filter(s => s.tags.includes('favorite'))
                    .flatMap(s => s.tags)
                    .filter(t => t !== 'favorite')
            )).slice(0, 5); // Use top 5 tags

            const [trendRaw, personRaw] = await Promise.all([
                ScraperService.getTrending(20, coloredOnly),
                favoriteTags.length > 0 
                    ? ScraperService.getRecommendationsByTags(favoriteTags, 20, coloredOnly)
                    : ScraperService.getPersonalizedRecommendations(20, coloredOnly)
            ]);

            // Filter out existing manga
            const trend = trendRaw.filter(m => !existingIds.has(m.id)).slice(0, 12);
            const person = personRaw.filter(m => !existingIds.has(m.id)).slice(0, 12);

            setTrending(trend);
            setPersonalized(person);
        } catch (e) {
            console.error("Home: Failed to fetch external data", e);
        }
    };

    const loadRecentHistory = async () => {
        try {
            const { getDb } = await import('../services/db');
            const db = getDb();
            const history = await db.select<any[]>(`
                SELECT rp.*, c.title, c.chapterNumber, s.coverPath as cover, c.filePath, s.title as seriesTitle, s.tags as seriesTags, s.updatedAt as seriesUpdatedAt
                FROM ReadingProgress rp
                JOIN Chapters c ON rp.chapterId = c.id
                JOIN Series s ON rp.seriesId = s.id
                ORDER BY rp.lastReadAt DESC
                LIMIT 12
            `);
            setContinueReading(history);
            
            const added = [...series].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 12);
            setRecentlyAdded(added);

            const updated = [...series].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()).slice(0, 12);
            setRecentlyUpdatedLocal(updated);
        } catch (e) {
            console.error("Home: Failed to load history", e);
        }
    };

    const loadStats = async () => {
        const totalSeries = series.length;
        const totalChapters = series.reduce((acc, s) => acc + (s.books?.length || 0), 0);
        setStats({ totalSeries, totalChapters });
    };

    const loadActivity = async () => {
        try {
            const { getDb } = await import('../services/db');
            const db = getDb();
            const recent = await db.select<any[]>(`
                SELECT rp.*, s.title, s.coverPath as cover, s.id as seriesId, c.id as chapterId, c.filePath
                FROM ReadingProgress rp
                JOIN Series s ON rp.seriesId = s.id
                JOIN Chapters c ON rp.chapterId = c.id
                ORDER BY rp.lastReadAt DESC
                LIMIT 8
            `);
            setActivity(recent);
        } catch (e) {
            console.error("Home: Failed to load activity", e);
        }
    };

    const handleOpenItem = async (item: any) => {
        if ('seriesId' in item) {
            const fullSeries = series.find(s => s.id === item.seriesId);
            const sequence = fullSeries ? fullSeries.books.map(b => ({ id: b.id, path: b.path, title: b.title })) : [];
            await openFolder(item.filePath || item.path, item.seriesId, item.chapterId, sequence, item.currentPage);
        } else {
             setActiveView('library');
             useLibraryStore.getState().setSelectedSeriesId(item.id);
        }
    };

    const handleAction = async (action: 'tag' | 'rename' | 'delete' | 'refresh', item: any) => {
        setActiveMenu(null);
        if (action === 'tag') {
            openTagManager(item.seriesId || item.id, item.seriesTags || item.tags || []);
        } else if (action === 'rename') {
            openInputModal({
                title: 'Rename Series',
                placeholder: 'New title...',
                description: `Renaming: ${item.seriesTitle || item.title}`,
                initialValue: item.seriesTitle || item.title,
                onSubmit: (newTitle) => {
                    renameSeries(item.seriesId || item.id, newTitle);
                }
            });
        } else if (action === 'refresh') {
            await refreshMangaMetadata(item.seriesId || item.id);
        } else if (action === 'delete') {
            openDeleteModal({
                id: item.seriesId || item.id,
                path: item.filePath || item.path,
                title: item.seriesTitle || item.title,
                count: 1,
                isSeries: true
            });
        }
    };

    const handleMenuClick = (item: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const menuWidth = 220;
        const menuHeight = 240;
        const x = Math.min(e.clientX, window.innerWidth - menuWidth - 20);
        const y = Math.min(e.clientY, window.innerHeight - menuHeight - 20);
        setActiveMenu({ x, y, item });
    };

    const handleExternalClick = (item: any) => {
        openQuickView(item);
    };

    return (
        <div className="h-full flex overflow-hidden bg-transparent">
            <div className="flex-1 h-full overflow-y-auto no-scrollbar pb-40">
                <FeaturedCarousel />

                <div className="space-y-16 pt-8 pb-32 max-w-7xl mx-auto md:px-8">
                    {/* 1. Continue Journey */}
                    {continueReading.length > 0 && (
                        <HorizontalRail 
                            title="Continue Journey"
                            icon={<Clock size={20} />}
                            items={continueReading}
                            onItemClick={handleOpenItem}
                            onMenuClick={handleMenuClick}
                            onViewAll={() => setActiveView('library')}
                            accentColor="text-indigo-400"
                        />
                    )}

                    {/* 2. Picked For You */}
                    {personalized.length > 0 && (
                        <HorizontalRail 
                            title="Picked For You"
                            icon={<Sparkles size={20} />}
                            items={personalized}
                            onItemClick={handleExternalClick}
                            accentColor="text-indigo-400"
                        />
                    )}

                    {/* 3. Global Trending */}
                    {trending.length > 0 && (
                        <HorizontalRail 
                            title="Global Trending"
                            icon={<TrendingUp size={20} />}
                            items={trending}
                            onItemClick={handleExternalClick}
                            accentColor="text-indigo-400"
                        />
                    )}

                    {/* 4. New Arrivals */}
                    <HorizontalRail 
                        title="New Arrivals"
                        icon={<PlusCircle size={20} />}
                        items={recentlyAdded}
                        onItemClick={handleOpenItem}
                        onMenuClick={handleMenuClick}
                        onViewAll={() => setActiveView('library')}
                        accentColor="text-indigo-400"
                    />

                    {/* 5. Library Pulse */}
                    <HorizontalRail 
                        title="Library Pulse"
                        icon={<Zap size={20} />}
                        items={recentlyUpdatedLocal}
                        onItemClick={handleOpenItem}
                        onMenuClick={handleMenuClick}
                        onViewAll={() => setActiveView('library')}
                        accentColor="text-indigo-400"
                    />
                </div>
            </div>

            <RightPanel 
                continueReading={continueReading}
                stats={stats}
                activity={activity}
                trending={trending}
                onItemClick={handleOpenItem}
            />

            <ContextMenu activeMenu={activeMenu} onAction={handleAction} onClose={() => setActiveMenu(null)} />
        </div>
    );
};

const RightPanel = ({ continueReading, stats, activity, trending, onItemClick }: any) => {
    const mainItem = continueReading[0];

    return (
        <div className="hidden xl:flex w-72 h-full flex-col border-l border-white/5 bg-[#0A0A0A]/60 backdrop-blur-3xl p-6 space-y-12 overflow-y-auto no-scrollbar shadow-2xl transition-all duration-500">
            {/* Primary Focus - Vertical Slide Animation */}
            {mainItem && (
                <section className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                        <Bookmark size={16} className="text-indigo-500" />
                        <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">Active Session</h3>
                    </div>
                    <div 
                        onClick={() => onItemClick(mainItem)}
                        className="group relative aspect-[16/10] rounded-[24px] overflow-hidden border border-white/10 shadow-2xl cursor-pointer active:scale-95 transition-all mx-2"
                    >
                        {/* Precise vertical slide: Top to Bottom and resets */}
                        <div className="absolute inset-0">
                            <motion.img 
                                src={mainItem.cover ? (mainItem.cover.startsWith('http') ? mainItem.cover : convertFileSrc(mainItem.cover)) : ''} 
                                className="w-full h-[180%] object-cover origin-top" 
                                animate={{
                                    y: ["0%", "-44%"]
                                }}
                                transition={{
                                    duration: 15,
                                    repeat: Infinity,
                                    repeatType: "reverse",
                                    ease: "linear"
                                }}
                                alt="" 
                            />
                        </div>
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-5">
                            <h4 className="text-white font-black text-sm tracking-tight leading-tight truncate group-hover:text-indigo-400 transition-colors">{mainItem.seriesTitle}</h4>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-indigo-400 text-[9px] font-black uppercase tracking-widest">
                                    Page {mainItem.currentPage} / {mainItem.totalPages > 0 ? mainItem.totalPages : '?'}
                                </p>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md border border-white/5">
                                    <Zap size={10} className="text-indigo-400" />
                                    <span className="text-[8px] font-black text-white uppercase tracking-tighter">Live</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <section className="space-y-6 px-2">
                <div className="flex items-center gap-3">
                    <BarChart3 size={16} className="text-neutral-500" />
                    <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em]">Insights</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.05] transition-all">
                        <span className="block text-3xl font-black text-white group-hover:text-indigo-400 transition-colors">{stats.totalSeries || 0}</span>
                        <span className="text-[10px] text-neutral-600 font-black uppercase tracking-widest mt-1 block">Series</span>
                    </div>
                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.05] transition-all">
                        <span className="block text-3xl font-black text-white group-hover:text-indigo-400 transition-colors">{stats.totalChapters || 0}</span>
                        <span className="text-[10px] text-neutral-600 font-black uppercase tracking-widest mt-1 block">Volumes</span>
                    </div>
                </div>
            </section>

            <section className="space-y-6 px-2">
                <div className="flex items-center gap-3">
                    <ActivityIcon size={16} className="text-neutral-500" />
                    <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em]">Live Feed</h3>
                </div>
                <div className="space-y-4">
                    {activity.map((item: any, idx: number) => (
                        <motion.div 
                            key={idx} 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => onItemClick(item)} 
                            className="flex items-center gap-4 group cursor-pointer p-2 rounded-2xl hover:bg-white/5 transition-all"
                        >
                            <div className="w-14 h-18 rounded-xl bg-neutral-900 overflow-hidden flex-shrink-0 border border-white/5 shadow-lg">
                                 <img src={item.cover ? (item.cover.startsWith('http') ? item.cover : convertFileSrc(item.cover)) : ''} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-white text-[11px] font-black truncate group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{item.title}</h4>
                                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Read {new Date(item.lastReadAt).toLocaleDateString()}</p>
                                <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                     <div className="h-full bg-indigo-500/40" style={{ width: `${(item.currentPage / (item.totalPages || 1)) * 100}%` }} />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {trending.length > 0 && (
                <section className="space-y-6 px-2">
                    <div className="flex items-center gap-3">
                        <TrendingUp size={16} className="text-neutral-500" />
                        <h3 className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em]">Market Trends</h3>
                    </div>
                    <div className="space-y-3">
                        {trending.slice(0, 3).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                                <span className="text-indigo-500 font-black text-xs">#0{idx + 1}</span>
                                <span className="text-white text-[10px] font-bold truncate uppercase tracking-tight">{item.title}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

const ContextMenu = ({ activeMenu, onAction, onClose }: { activeMenu: any, onAction: (a: any, i: any) => void, onClose: () => void }) => {
    if (!activeMenu) return null;
    return (
        <div className="fixed inset-0 z-[100]" onClick={onClose}>
            <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            style={{ left: activeMenu.x, top: activeMenu.y }}
            className="absolute bg-[#0f0f11]/95 border border-white/10 rounded-[24px] shadow-[0_32px_64px_rgba(0,0,0,0.6)] py-3 min-w-[220px] backdrop-blur-2xl"
            >
                <MenuButton icon={<Tag size={16} className="text-indigo-400" />} label="Manage Tags" onClick={() => onAction('tag', activeMenu.item)} />
                <MenuButton icon={<Edit2 size={16} className="text-indigo-400" />} label="Rename Series" onClick={() => onAction('rename', activeMenu.item)} />
                <MenuButton icon={<Sparkles size={16} className="text-indigo-400" />} label="Refresh Info" onClick={() => onAction('refresh', activeMenu.item)} />
                <div className="h-px bg-white/5 my-2 mx-3" />
                <MenuButton icon={<Trash2 size={16} className="text-red-500" />} label="Delete Forever" onClick={() => onAction('delete', activeMenu.item)} danger />
            </motion.div>
        </div>
    );
};

const MenuButton = ({ icon, label, onClick, danger }: any) => (
    <button 
        onClick={onClick}
        className={clsx(
            "w-full px-5 py-3 text-left text-xs font-black uppercase tracking-widest flex items-center gap-4 transition-all",
            danger ? "text-red-500 hover:bg-red-500/10" : "text-white/80 hover:text-white hover:bg-white/5"
        )}
    >
        {icon}
        {label}
    </button>
);
