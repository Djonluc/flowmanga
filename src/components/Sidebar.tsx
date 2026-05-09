import { useSettingsStore } from '../stores/useSettingsStore';
import { useReadingStore } from '../stores/useReadingStore';
import { 
    Home, Library, Clock, Heart, Layers, Download, 
    BarChart2, Settings, Zap, ChevronDown, Bell,
    FolderOpen, MousePointer2, Lock, SidebarClose,
    ExternalLink, CheckCircle2, User
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useDownloadStore } from '../stores/useDownloadStore';
import { useState, useEffect } from 'react';
import { useLibraryStore } from '../stores/useLibraryStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { open as openShell } from '@tauri-apps/plugin-shell';
import clsx from 'clsx';
import type { SidebarMode } from '../stores/useSettingsStore';
import { toast } from './Toast';

export const Sidebar = () => {
    const { 
        sidebarMode, setSidebarMode, activeView, setActiveView,
        isSettingsOpen, toggleSettings,
        toggleDownloadPanel
    } = useSettingsStore();
    const { queue } = useDownloadStore();

    const [isHovered, setIsHovered] = useState(false);
    const [currentlyReading, setCurrentlyReading] = useState<any>(null);
    const { series } = useLibraryStore();

    useEffect(() => {
        const loadRecentHistory = async () => {
            try {
                const { getDb } = await import('../services/db');
                const db = getDb();
                const history = await db.select<any[]>(`
                    SELECT rp.*, c.title, c.chapterNumber, s.coverPath as cover, c.filePath, s.title as seriesTitle
                    FROM ReadingProgress rp
                    JOIN Chapters c ON rp.chapterId = c.id
                    JOIN Series s ON rp.seriesId = s.id
                    ORDER BY rp.lastReadAt DESC
                    LIMIT 1
                `);
                
                if (history.length > 0) {
                    const item = history[0];
                    if (!item.totalPages || item.currentPage < item.totalPages) {
                        setCurrentlyReading(item);
                    }
                }
            } catch (e) {
                console.error("Sidebar: Failed to load recent history", e);
            }
        };

        loadRecentHistory();
        const interval = setInterval(loadRecentHistory, 10000);
        return () => clearInterval(interval);
    }, []);
    
    const isExpanded = sidebarMode === 'expanded' || (sidebarMode === 'hover' && isHovered);

    const navItems = [
        { icon: <Home size={20} />, label: 'Home', view: 'home' as const },
        { icon: <Library size={20} />, label: 'Library', view: 'library' as const },
        { icon: <Download size={20} />, label: 'Transfers', view: 'downloads' as const },
        { icon: <Clock size={20} />, label: 'History', view: 'history' as const },
        { icon: <Heart size={20} />, label: 'Favorites', view: 'favorites' as const },
        { icon: <Layers size={20} />, label: 'Collections', view: 'collections' as const },
        { icon: <BarChart2 size={20} />, label: 'Analytics', view: 'stats' as const },
        { icon: <Settings size={20} />, label: 'Settings', view: 'settings' as const },
    ];

    const cycleMode = () => {
        const modes: SidebarMode[] = ['expanded', 'hover', 'collapsed'];
        const currentIdx = modes.indexOf(sidebarMode);
        const nextIdx = (currentIdx + 1) % modes.length;
        setSidebarMode(modes[nextIdx]);
    };

    return (
        <motion.div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            initial={false}
            animate={{ width: isExpanded ? 220 : 68 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={clsx(
                "hidden md:flex flex-col h-[calc(100vh-2rem)] z-40 relative group flex-shrink-0",
                "m-4 rounded-[32px] glass-panel shadow-cinematic overflow-hidden"
            )}
        >
            {/* Logo */}
            <div className="h-20 flex items-center px-6 mb-2 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-[0_8px_16px_rgba(99,102,241,0.3)] flex-shrink-0">
                         <Zap size={22} fill="currentColor" className="drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
                    </div>
                    <motion.div 
                        animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -10 }}
                        className="flex flex-col whitespace-nowrap"
                    >
                        <span className="font-bold text-lg tracking-tight text-white leading-none">
                             FlowManga
                        </span>
                    </motion.div>
                </div>
            </div>

            {/* Nav Items */}
            <div className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto no-scrollbar">
                {navItems.map((item) => (
                    <NavButton 
                        key={item.view}
                        icon={item.icon} 
                        label={item.label} 
                        expanded={isExpanded}
                        active={activeView === item.view}
                        onClick={() => {
                            if (item.view === 'settings') toggleSettings();
                            else {
                                useReadingStore.getState().reset();
                                setActiveView(item.view);
                            }
                        }}
                    />
                ))}
            </div>

            {/* Currently Reading Widget */}
            {currentlyReading && isExpanded && (
                <div className="px-4 py-4 mt-auto">
                    <div className="text-[10px] font-bold text-neutral-600 tracking-widest uppercase mb-3 ml-1">
                        Currently Reading
                    </div>
                    <div 
                        className="group flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] transition-all cursor-pointer border border-white/5"
                        onClick={async () => {
                            const fullSeries = series.find(s => s.id === currentlyReading.seriesId);
                            const sequence = fullSeries ? fullSeries.books.map(b => ({
                                id: b.id, path: b.path, title: b.title
                            })) : [];
                            await useReadingStore.getState().openFolder(
                                currentlyReading.filePath || currentlyReading.path, 
                                currentlyReading.seriesId, 
                                currentlyReading.chapterId,
                                sequence,
                                currentlyReading.currentPage
                            );
                        }}
                    >
                        <div className="w-12 h-16 rounded-lg overflow-hidden bg-neutral-900 flex-shrink-0 shadow-xl relative">
                            {currentlyReading.cover ? (
                                <img src={currentlyReading.cover.startsWith('http') ? currentlyReading.cover : convertFileSrc(currentlyReading.cover)} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-neutral-800 bg-neutral-900"><Zap size={14} /></div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-white text-xs font-bold truncate leading-tight group-hover:text-indigo-400">{currentlyReading.seriesTitle}</h4>
                            <p className="text-[10px] text-neutral-500 font-medium truncate mt-1">
                                Page {currentlyReading.currentPage} / {currentlyReading.totalPages > 0 ? currentlyReading.totalPages : '?'}
                            </p>
                            <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-500" 
                                    style={{ width: `${(currentlyReading.currentPage / (Math.max(currentlyReading.totalPages, 1))) * 100}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Section */}
            <div className="p-4 border-t border-white/5 bg-white/[0.02]">
                <div 
                    onClick={() => {}}
                    className={clsx(
                        "flex items-center gap-3 p-2 rounded-2xl transition-colors hover:bg-white/5 cursor-default",
                        !isExpanded && "justify-center"
                    )}
                >
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-500/20 flex-shrink-0 bg-neutral-900 flex items-center justify-center">
                        <img 
                            src="https://api.dicebear.com/7.x/avataaars/svg?seed=VoidWalker" 
                            alt="Avatar" 
                            className="w-full h-full object-cover" 
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <User size={18} className="text-neutral-600" />
                    </div>
                    {isExpanded && (
                        <div className="flex-1 min-w-0 flex items-center justify-between">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white text-sm font-bold truncate">VoidWalker</span>
                                    <span className="bg-indigo-500 text-[8px] font-black px-1.5 py-0.5 rounded-md text-white uppercase tracking-tighter">PRO</span>
                                </div>
                                <span className="text-neutral-500 text-[10px] font-medium">Premium Member</span>
                            </div>
                            <ChevronDown size={16} className="text-neutral-500" />
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const NavButton = ({ icon, label, active, onClick, expanded, badge }: any) => (
    <button 
        onClick={onClick}
        className={clsx(
            "group relative flex items-center h-12 w-full rounded-2xl transition-all duration-200 outline-none",
            active ? 'bg-indigo-500/10 text-indigo-400 shadow-sm shadow-indigo-500/5' : 'text-neutral-500 hover:text-white hover:bg-white/5'
        )}
    >
        {active && (
            <motion.div layoutId="activeStrip" className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
        )}
        <div className="w-[64px] flex items-center justify-center flex-shrink-0">{icon}</div>
        <motion.span 
            animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -10 }}
            className={clsx("font-semibold text-sm whitespace-nowrap", !expanded && "hidden")}
        >
            {label}
        </motion.span>
        {badge && expanded && (
            <span className="ml-auto mr-4 bg-indigo-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                {badge}
            </span>
        )}
    </button>
);
