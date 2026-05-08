import { useSettingsStore } from '../stores/useSettingsStore';
import { useReadingStore } from '../stores/useReadingStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useDownloadStore } from '../stores/useDownloadStore';
import { Search, Command, LayoutGrid, SlidersHorizontal, Download } from 'lucide-react';
import clsx from 'clsx';

export const TopBar = () => {
    const { activeView, toggleDownloadPanel, toggleSettings, libraryViewMode, setLibraryViewMode } = useSettingsStore();
    const { images } = useReadingStore();
    const { searchQuery, setSearchQuery } = useLibraryStore();
    const { activeJobIds, queue } = useDownloadStore();

    const activeCount = activeJobIds.length;
    const queueCount = queue.length;
    const hasDownloads = activeCount > 0 || queueCount > 0;

    // Don't show global top bar in reader mode if it has its own
    if (images.length > 0) return null;

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (value.trim() && activeView !== 'library') {
            useSettingsStore.getState().setActiveView('library');
        }
    };

    return (
        <div className="min-h-16 border-b border-white/5 bg-background/40 backdrop-blur-3xl flex items-center justify-between gap-3 px-4 py-3 md:px-10 sticky top-0 z-30 no-drag">
            <div className="flex min-w-0 items-center gap-4">
                <h1 className="truncate text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500 italic md:tracking-[0.4em]">
                    {activeView === 'home' ? 'Discover' : 
                     activeView === 'library' ? 'My Collection' :
                     activeView === 'videos' ? 'Screenroom' :
                     activeView === 'history' ? 'Recents' :
                     activeView === 'stats' ? 'Stats' :
                     (activeView as string).toUpperCase()}
                </h1>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:gap-6">
                <div className="relative group min-w-0 flex-1 sm:max-w-64">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-blue-400 transition-colors" />
                    <input 
                        type="text"
                        placeholder="Search library..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full min-w-0 bg-white/5 border border-white/5 rounded-xl py-2 pl-10 pr-10 text-xs focus:outline-none focus:bg-white/10 focus:border-blue-500/30 transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-neutral-500 font-bold uppercase tracking-tighter">
                        <Command size={10} />
                        <span>K</span>
                    </div>
                </div>

                <div className="hidden h-4 w-px bg-white/10 sm:block" />

                 {/* Download Indicator */}
                 <button 
                    onClick={toggleDownloadPanel}
                    className={clsx(
                        "flex flex-shrink-0 items-center gap-2 px-3 py-1.5 rounded-full transition-all border",
                        !hasDownloads && "hidden sm:flex",
                        hasDownloads || activeCount > 0
                            ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20" 
                            : "bg-transparent border-transparent text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                    )}
                >
                    <Download size={16} className={clsx(activeCount > 0 && "animate-bounce")} />
                    {(hasDownloads || activeCount > 0) && (
                        <span className="text-[10px] font-bold">{activeCount > 0 ? activeCount : queueCount}</span>
                    )}
                </button>

                <div className="hidden h-4 w-px bg-white/10 sm:block" />

                <div className="flex flex-shrink-0 items-center gap-1 md:gap-2">
                    <button 
                        onClick={toggleSettings}
                        className="hidden p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors sm:block"
                        title="Settings"
                    >
                        <SlidersHorizontal size={18} />
                    </button>
                    {activeView === 'library' && (
                        <button 
                            onClick={() => setLibraryViewMode(libraryViewMode === 'grid' ? 'shelf' : 'grid')}
                            className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
                            title={`Switch to ${libraryViewMode === 'grid' ? 'Shelf' : 'Grid'} view`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
