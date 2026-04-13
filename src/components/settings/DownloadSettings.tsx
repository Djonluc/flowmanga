import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Trash2, Folder } from 'lucide-react';

export const DownloadSettings = () => {
    const { 
        downloadPath, 
        setDownloadPath, 
        maxConcurrentJobs, setMaxConcurrentJobs,
        maxConcurrentChapters, setMaxConcurrentChapters,
        maxConcurrentPages, setMaxConcurrentPages
    } = useSettingsStore();

    const handleBrowseDownloads = async () => {
        try {
            const selected = await openDialog({
                directory: true,
                multiple: false,
                defaultPath: downloadPath || undefined
            });
            if (selected && typeof selected === 'string') {
                setDownloadPath(selected);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-8">
            <section className="space-y-4">
                <h4 className="text-white font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Storage Configuration
                </h4>
                
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500">
                            <Folder size={20} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Download Directory</span>
                            <span className="text-white text-sm font-medium truncate opacity-80" title={downloadPath || 'Default (Library)'}>
                                {downloadPath || 'Same as Library'}
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={handleBrowseDownloads}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap"
                    >
                        Change
                    </button>
                </div>
            </section>

            {/* Global Concurrency */}
            <section className="space-y-4">
                <h4 className="text-white font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Global Concurrency
                </h4>
                <div className="bg-white/5 p-6 rounded-[32px] border border-white/5 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-white text-xs font-bold uppercase tracking-wider">Concurrent Downloads</span>
                                <span className="text-neutral-500 text-[10px]">How many manga can download at once.</span>
                            </div>
                            <span className="text-sm font-black text-purple-500 italic">{maxConcurrentJobs}</span>
                        </div>
                        <input 
                            type="range" min="1" max="5" step="1"
                            value={maxConcurrentJobs}
                            onChange={(e) => setMaxConcurrentJobs(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>
                </div>
            </section>

            {/* Item Concurrency */}
            <section className="space-y-4">
                <h4 className="text-white font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Internal Parallelism
                </h4>
                <div className="bg-white/5 p-6 rounded-[32px] border border-white/5 space-y-8">
                    {/* Chapters */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-white text-xs font-bold uppercase tracking-wider">Parallel Chapters</span>
                                <span className="text-neutral-500 text-[10px]">Chapters per manga processed simultaneously.</span>
                            </div>
                            <span className="text-sm font-black text-blue-500 italic">{maxConcurrentChapters}</span>
                        </div>
                        <input 
                            type="range" min="1" max="10" step="1"
                            value={maxConcurrentChapters}
                            onChange={(e) => setMaxConcurrentChapters(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    {/* Pages */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-white text-xs font-bold uppercase tracking-wider">Parallel Pages</span>
                                <span className="text-neutral-500 text-[10px]">Images per chapter downloaded simultaneously.</span>
                            </div>
                            <span className="text-sm font-black text-accent italic">{maxConcurrentPages}</span>
                        </div>
                        <input 
                            type="range" min="1" max="20" step="1"
                            value={maxConcurrentPages}
                            onChange={(e) => setMaxConcurrentPages(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent"
                        />
                    </div>
                </div>
            </section>

             <section className="space-y-4">
                <h4 className="text-white font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Maintenance
                </h4>
                
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between px-6 py-8">
                    <div className="flex flex-col gap-1">
                        <span className="text-white font-bold uppercase tracking-wide">Clear Download Cache</span>
                        <span className="text-neutral-500 text-xs">Removes temporary files. Does not delete chapters.</span>
                    </div>
                    <button 
                        className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                        onClick={() => {
                            if (confirm('Clear temporary download cache?')) {
                                // Logic to clear cache would go here
                            }
                        }}
                    >
                        <Trash2 size={16} />
                        Clear Cache
                    </button>
                </div>
            </section>
        </div>
    );
};
