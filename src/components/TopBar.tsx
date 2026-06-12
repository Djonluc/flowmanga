import { useSettingsStore } from '../stores/useSettingsStore';
import { useReadingStore } from '../stores/useReadingStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useDownloadStore } from '../stores/useDownloadStore';
import { useModalStore } from '../stores/useModalStore';
import { useAutomationStore } from '../stores/useAutomationStore';
import { useDiscoveryStore } from '../stores/useDiscoveryStore';
import { Search, Command, LayoutGrid, SlidersHorizontal, Download, Bell, RefreshCcw, Filter, Plus, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect } from 'react';

export const TopBar = () => {
    const { activeView, toggleDownloadPanel, toggleSettings, libraryViewMode, setLibraryViewMode } = useSettingsStore();
    const { images } = useReadingStore();
    const { searchQuery, setSearchQuery, bulkRefreshMetadata } = useLibraryStore();
    const { activeJobIds, queue } = useDownloadStore();
    const { openImportModal, openFilterModal, openNotificationCenter } = useModalStore();
    const { isChecking, checkForUpdates } = useAutomationStore();
    const { query: discoverQuery, setQuery: setDiscoverQuery, search: discoverSearch, setActiveTab: setDiscoverTab } = useDiscoveryStore();

    const activeCount = activeJobIds.length;
    const queueCount = queue.length;
    const hasDownloads = activeCount > 0 || queueCount > 0;

    if (images.length > 0) return null;

    const [localQuery, setLocalQuery] = useState(activeView === 'discover' ? discoverQuery : searchQuery);

    // Sync local query when view changes or external store changes (if we clear it externally)
    useEffect(() => {
        setLocalQuery(activeView === 'discover' ? discoverQuery : searchQuery);
    }, [activeView, discoverQuery, searchQuery]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (activeView === 'discover') {
                if (discoverQuery !== localQuery) setDiscoverQuery(localQuery);
            } else {
                if (searchQuery !== localQuery) {
                    setSearchQuery(localQuery);
                    if (localQuery.trim() && activeView !== 'library') {
                        useSettingsStore.getState().setActiveView('library');
                    }
                }
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [localQuery, activeView]);

    const handleSearchChange = (value: string) => {
        setLocalQuery(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && activeView === 'discover') {
            if (discoverQuery.trim()) {
                setDiscoverTab("search");
                discoverSearch(discoverQuery);
            }
        }
    };

    return (
        <div className="relative pt-4 pb-2">
            <div className="h-20 flex items-center justify-between gap-10 px-8 md:px-12 sticky top-0 z-30 no-drag bg-transparent">
            {/* Search Section - Made more prominent */}
            <div className="flex-1 max-w-3xl">
                <div className="relative group/search">
                    <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground-dim group-hover/search:text-accent transition-colors" />
                    <input 
                        id="global-search"
                        type="text"
                        placeholder={activeView === 'discover' ? "Cast vision across all realms... (Press Enter)" : "Search for titles, genres, authors..."}
                        value={localQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-surface-elevated border border-border-subtle rounded-2xl py-3.5 pl-14 pr-20 text-sm font-semibold focus:outline-none focus:bg-surface-raised focus:border-accent/40 transition-all placeholder:text-foreground-dim shadow-2xl focus:shadow-accent-glow/5 group-hover/search:border-foreground-dim/10"
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border-subtle text-[10px] text-foreground-dim font-black uppercase tracking-widest shadow-lg">
                        <Command size={12} />
                        <span>K</span>
                    </div>
                </div>
            </div>

            {/* Actions Section */}
            <div className="flex items-center gap-3">
                <TopBarButton 
                    icon={<Plus size={20} />} 
                    title="Manifest Source" 
                    onClick={() => openImportModal()}
                />
                <TopBarButton 
                    icon={<Filter size={20} />} 
                    title="Filter" 
                    onClick={() => openFilterModal()}
                />
                <TopBarButton 
                    icon={<LayoutGrid size={20} />} 
                    title="Toggle View" 
                    onClick={() => setLibraryViewMode(libraryViewMode === 'grid' ? 'shelf' : 'grid')}
                    active={activeView === 'library'}
                />
                <TopBarButton 
                    icon={isChecking ? <Sparkles size={20} className="text-indigo-400 animate-pulse" /> : <RefreshCcw size={20} />} 
                    title={isChecking ? "Checking for updates..." : "Check Updates"} 
                    onClick={() => isChecking ? null : checkForUpdates()}
                    active={isChecking}
                />
                
                <div className="w-px h-8 bg-white/5 mx-3" />
                
                {/* Download Indicator */}
                <button 
                    onClick={toggleDownloadPanel}
                    className={clsx(
                        "relative p-3 rounded-2xl transition-all border border-transparent group/dl shadow-lg",
                        hasDownloads ? "bg-accent-soft border-accent/20 text-accent hover:bg-accent/20" : "text-foreground-dim hover:text-foreground hover:bg-surface-elevated hover:border-border-subtle"
                    )}
                >
                    <Download size={20} className={clsx("transition-transform", activeCount > 0 ? "animate-bounce" : "group-hover/dl:-translate-y-1")} />
                    {hasDownloads && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-accent-glow border-2 border-background">
                            {activeCount > 0 ? activeCount : queueCount}
                        </span>
                    )}
                </button>

                {/* Notifications */}
                <button 
                    onClick={() => openNotificationCenter()}
                    className="relative p-3 rounded-2xl text-foreground-dim hover:text-foreground hover:bg-surface-elevated border border-transparent hover:border-border-subtle transition-all shadow-lg"
                >
                    <Bell size={22} />
                    <span className="absolute top-3.5 right-3.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background shadow-lg shadow-red-500/20" />
                </button>
            </div>
            </div>
            {/* Atmospheric bottom fade - Theme aware */}
            <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none bg-gradient-to-t from-background/10 to-transparent" />
        </div>
    );
};

const TopBarButton = ({ icon, title, onClick, active }: any) => (
    <button 
        onClick={onClick}
        className={clsx(
            "p-3 rounded-2xl transition-all border border-transparent shadow-lg",
            active ? "bg-surface-raised text-foreground border-border-subtle" : "text-foreground-dim hover:text-foreground hover:bg-surface-elevated hover:border-border-subtle"
        )}
        title={title}
    >
        {icon}
    </button>
);
