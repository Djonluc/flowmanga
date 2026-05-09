import { useSettingsStore } from '../stores/useSettingsStore';
import { useReadingStore } from '../stores/useReadingStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useDownloadStore } from '../stores/useDownloadStore';
import { useModalStore } from '../stores/useModalStore';
import { Search, Command, LayoutGrid, SlidersHorizontal, Download, Bell, RefreshCcw, Filter, Plus } from 'lucide-react';
import clsx from 'clsx';

export const TopBar = () => {
    const { activeView, toggleDownloadPanel, toggleSettings, libraryViewMode, setLibraryViewMode } = useSettingsStore();
    const { images } = useReadingStore();
    const { searchQuery, setSearchQuery } = useLibraryStore();
    const { activeJobIds, queue } = useDownloadStore();
    const { openImportModal } = useModalStore();
    const activeCount = activeJobIds.length;
    const queueCount = queue.length;
    const hasDownloads = activeCount > 0 || queueCount > 0;

    if (images.length > 0) return null;

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (value.trim() && activeView !== 'library') {
            useSettingsStore.getState().setActiveView('library');
        }
    };

    return (
        <div className="h-16 flex items-center justify-between gap-6 px-6 md:px-10 sticky top-0 z-30 no-drag bg-transparent">
            {/* Search Section */}
            <div className="flex-1 max-w-2xl">
                <div className="relative group">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-indigo-400 transition-colors" />
                    <input 
                        id="global-search"
                        type="text"
                        placeholder="Search manga, genres, authors..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-2.5 pl-12 pr-16 text-xs font-medium focus:outline-none focus:bg-white/[0.06] focus:border-indigo-500/30 transition-all placeholder:text-neutral-600"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                        <Command size={10} />
                        <span>K</span>
                    </div>
                </div>
            </div>

            {/* Actions Section */}
            <div className="flex items-center gap-2">
                <TopBarButton 
                    icon={<Plus size={18} />} 
                    title="Import Manga" 
                    onClick={() => openImportModal()}
                />
                <TopBarButton icon={<Filter size={18} />} title="Filter" />
                <TopBarButton 
                    icon={<LayoutGrid size={18} />} 
                    title="Layout Mode" 
                    onClick={() => setLibraryViewMode(libraryViewMode === 'grid' ? 'shelf' : 'grid')}
                    active={activeView === 'library'}
                />
                <TopBarButton icon={<RefreshCcw size={18} />} title="Sync Library" />
                
                <div className="w-px h-6 bg-white/5 mx-2" />
                
                {/* Download Indicator */}
                <button 
                    onClick={toggleDownloadPanel}
                    className={clsx(
                        "relative p-2.5 rounded-xl transition-all border border-transparent",
                        hasDownloads ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20" : "text-neutral-400 hover:text-white hover:bg-white/5"
                    )}
                >
                    <Download size={18} className={clsx(activeCount > 0 && "animate-bounce")} />
                    {hasDownloads && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-indigo-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                            {activeCount > 0 ? activeCount : queueCount}
                        </span>
                    )}
                </button>

                {/* Notifications */}
                <button className="relative p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
                    <Bell size={20} />
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
                </button>
            </div>
        </div>
    );
};

const TopBarButton = ({ icon, title, onClick, active }: any) => (
    <button 
        onClick={onClick}
        className={clsx(
            "p-2.5 rounded-xl transition-all border border-transparent",
            active ? "bg-white/5 text-white" : "text-neutral-500 hover:text-white hover:bg-white/5"
        )}
        title={title}
    >
        {icon}
    </button>
);
