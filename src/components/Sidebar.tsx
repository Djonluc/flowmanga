import { useSettingsStore } from '../stores/useSettingsStore';
import { useReadingStore } from '../stores/useReadingStore';
import { Home, Library, FolderOpen, Activity, Settings, Zap, Film, Lock, SidebarClose, MousePointer2, ExternalLink, CheckCircle2, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDownloadStore } from '../stores/useDownloadStore';
import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { open as openShell } from '@tauri-apps/plugin-shell';
import clsx from 'clsx';
import type { SidebarMode } from '../stores/useSettingsStore';

export const Sidebar = () => {
    const { 
        sidebarMode, setSidebarMode, activeView, setActiveView,
        isSettingsOpen, toggleSettings,
        toggleDownloadPanel
    } = useSettingsStore();
    const { queue } = useDownloadStore();

    const [isHovered, setIsHovered] = useState(false);
    
    // Logic: Expanded Mode OR (Hover Mode AND Hovered)
    const isExpanded = sidebarMode === 'expanded' || (sidebarMode === 'hover' && isHovered);

    const navItems = [
        { icon: <Home size={20} />, label: 'Home', view: 'home' as const },
        { icon: <Library size={20} />, label: 'My Manga', view: 'library' as const },
        { icon: <Film size={20} />, label: 'Videos', view: 'videos' as const },
        { icon: <Activity size={20} />, label: 'Stats', view: 'stats' as const },
    ];

    const cycleMode = () => {
        const modes: SidebarMode[] = ['expanded', 'hover', 'collapsed'];
        const currentIdx = modes.indexOf(sidebarMode);
        const nextIdx = (currentIdx + 1) % modes.length;
        setSidebarMode(modes[nextIdx]);
    };

    const getModeIcon = () => {
        switch (sidebarMode) {
            case 'expanded': return <Lock size={16} />;
            case 'hover': return <MousePointer2 size={16} />;
            case 'collapsed': return <SidebarClose size={16} />;
        }
    };

    const getModeLabel = () => {
        switch (sidebarMode) {
            case 'expanded': return "Always Expanded";
            case 'hover': return "Expand on Hover";
            case 'collapsed': return "Always Collapsed";
        }
    };

    const handleQuickOpen = async () => {
        try {
            const path = await open({
                directory: true,
                multiple: false
            });

            if (path && typeof path === 'string') {
                const images: string[] = await invoke('read_folder', { path });
                if (images && images.length > 0) {
                    useReadingStore.getState().openFolder(path);
                }
            }
        } catch (err) {
            console.error("Quick open failed", err);
        }
    };

    return (
        <motion.div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            initial={false}
            animate={{ 
                width: isExpanded ? 240 : 72, 
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={clsx(
                "hidden md:flex flex-col h-full z-40 relative group flex-shrink-0",
                "border-r border-white/5 bg-background/95 backdrop-blur-3xl"
            )}
        >
            {/* Logo / Header */}
            <div className="h-16 flex items-center px-4 mb-2 overflow-hidden flex-shrink-0">
               <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 flex-shrink-0 relative z-10">
                        <Zap size={20} fill="currentColor" className="text-white" />
                   </div>
                   
                   <motion.div 
                       animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -20 }}
                       className="flex flex-col whitespace-nowrap overflow-hidden"
                   >
                       <span className="font-bold text-base tracking-tight text-white leading-none">
                            FLOW<span className="text-indigo-400">MANGA</span>
                       </span>
                       <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium leading-none mt-1">
                            My Reader
                       </span>
                   </motion.div>
               </div>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto no-scrollbar">
                
                {/* Main Nav */}
                <div className="space-y-1">
                     {navItems.map((item) => (
                        <NavButton 
                            key={item.view}
                            icon={item.icon} 
                            label={item.label} 
                            expanded={isExpanded}
                            active={activeView === item.view} 
                            onClick={() => {
                                useReadingStore.getState().reset();
                                setActiveView(item.view);
                            }}
                        />
                    ))}

                    <NavButton 
                        icon={<FolderOpen size={20} />} 
                        label="Quick Open" 
                        expanded={isExpanded}
                        onClick={handleQuickOpen}
                    />
                </div>

                <div className="my-4 h-px bg-white/5 mx-2" />
                
                {/* Sources Section */}
                <div className="space-y-1">
                    <div className={clsx(
                        "text-[10px] font-bold text-neutral-500 uppercase tracking-wider px-3 py-2 transition-opacity duration-300",
                         isExpanded ? "opacity-100" : "opacity-0 hidden"
                    )}>
                        Sources
                    </div>
                    
                    <div className={clsx("space-y-1", !isExpanded && "flex flex-col items-center")}>
                         <SourceItem 
                            name="MangaDex" 
                            color="bg-[#FF6740]" 
                            expanded={isExpanded} 
                            onClick={() => openShell('https://mangadex.org')}
                         />
                         <SourceItem 
                            name="LuaComic" 
                            color="bg-blue-500" 
                            expanded={isExpanded} 
                            onClick={() => openShell('https://luacomic.org')}
                         />
                    </div>

                     <NavButton 
                        icon={<ExternalLink size={18} />} 
                        label="Request Source" 
                        expanded={isExpanded}
                        onClick={() => openShell('https://github.com/djonluc/flowmamga/issues')}
                        className="mt-2 text-neutral-500 hover:text-white"
                    />
                </div>

                {/* Downloads Section (Conditional) */}
                {(queue.length > 0) && (
                    <div className="mt-6 space-y-1">
                        <div className={clsx(
                            "text-[10px] font-bold text-neutral-500 uppercase tracking-wider px-3 py-2 transition-opacity duration-300",
                             isExpanded ? "opacity-100" : "opacity-0 hidden"
                        )}>
                            Downloads
                        </div>
                        <NavButton 
                            icon={<Download size={20} className={queue.some(j => j.status === 'downloading') ? "text-blue-500" : ""} />} 
                            label={`Downloads (${queue.length})`} 
                            expanded={isExpanded}
                            onClick={toggleDownloadPanel}
                            className={queue.some(j => j.status === 'downloading') ? "text-blue-400" : ""}
                        />
                        {isExpanded && queue.some(j => j.status === 'downloading') && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="px-3 py-2"
                            >
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-blue-500"
                                        animate={{ width: `${queue.find(j => j.status === 'downloading')?.progress || 0}%` }}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <div className="p-3 mt-auto bg-black/20 backdrop-blur-md">
                <NavButton 
                    icon={<Settings size={20} />} 
                    label="Settings" 
                    expanded={isExpanded}
                    active={isSettingsOpen}
                    onClick={toggleSettings}
                />
                
                <button
                    onClick={cycleMode}
                    className={clsx(
                        "mt-2 w-full flex items-center rounded-lg text-xs font-medium transition-colors border border-transparent h-10",
                        isExpanded ? "justify-between px-3 bg-white/5 hover:bg-white/10 hover:border-white/5" : "justify-center text-neutral-500 hover:text-white"
                    )}
                    title={getModeLabel()}
                >
                    <div className="flex items-center gap-3">
                         <div className={clsx("text-neutral-400", !isExpanded && "mx-auto")}>
                            {getModeIcon()}
                         </div>
                         {isExpanded && <span className="text-neutral-400">{getModeLabel()}</span>}
                    </div>
                </button>
            </div>
        </motion.div>
    );
};

const NavButton = ({ icon, label, active, onClick, expanded, className }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, expanded: boolean, className?: string }) => (
    <button 
        onClick={onClick}
        className={clsx(
            "group relative flex items-center h-10 w-full rounded-lg transition-all duration-200 outline-none flex-shrink-0",
            active 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
              : 'text-neutral-400 hover:text-white hover:bg-white/5',
            className
        )}
        title={!expanded ? label : undefined}
    >
        {/* Active Indicator Strip (Vertical Pill) */}
        {active && (
            <motion.div 
                layoutId="activeStrip"
                className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
            />
        )}

        {/* Icon Container - consistently sized to ensure alignment */}
        <div className="w-[48px] flex items-center justify-center flex-shrink-0 z-10">
            {icon}
        </div>
        
        {/* Label - fades in/out based on expansion */}
        <motion.span 
            initial={false}
            animate={{ 
                opacity: expanded ? 1 : 0, 
                width: expanded ? 'auto' : 0,
                display: expanded ? 'block' : 'none'
            }}
            transition={{ duration: 0.2 }}
            className="font-medium text-sm whitespace-nowrap overflow-hidden"
        >
            {label}
        </motion.span>
    </button>
);

const SourceItem = ({ name, color, expanded, disabled, onClick }: { name: string, color: string, expanded: boolean, disabled?: boolean, onClick?: () => void }) => (
    <div 
        onClick={onClick}
        className={clsx(
            "flex items-center h-9 w-full rounded-lg transition-all duration-200 px-3 gap-3",
            disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5 cursor-pointer",
            !expanded && "justify-center px-0"
        )}
    >
         <div className={clsx("w-2 h-2 rounded-full", color)} />
         
         <motion.div 
            animate={{ 
                opacity: expanded ? 1 : 0, 
                width: expanded ? 'auto' : 0,
                display: expanded ? 'flex' : 'none'
            }}
            className="flex-1 items-center justify-between overflow-hidden whitespace-nowrap"
         >
             <span className="text-sm font-medium text-neutral-300">{name}</span>
             {!disabled && <CheckCircle2 size={12} className="text-green-500" />}
         </motion.div>
    </div>
);
