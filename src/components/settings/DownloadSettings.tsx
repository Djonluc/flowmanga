import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Trash2, Folder, Zap, Cpu, Gauge } from 'lucide-react';
import { toast } from '../Toast';
import clsx from 'clsx';

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
                toast.success("Download directory updated");
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to update directory");
        }
    };

    return (
        <div className="space-y-10 pb-12">
            <section className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                    <h4 className="text-white font-black uppercase tracking-widest text-sm italic">
                        Storage Configuration
                    </h4>
                </div>
                
                <div className="group bg-white/5 p-6 rounded-[32px] border border-white/5 hover:border-purple-500/20 transition-all duration-500">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-5 overflow-hidden">
                            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform duration-500">
                                <Folder size={28} />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-purple-500 text-[10px] font-black uppercase tracking-widest mb-1">Download Directory</span>
                                <span className="text-white text-base font-bold truncate opacity-80" title={downloadPath || 'Default (Library)'}>
                                    {downloadPath || 'Same as Library'}
                                </span>
                                <p className="text-neutral-600 text-[10px] font-medium mt-1">Where temporary and final downloads are staged.</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleBrowseDownloads}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap"
                        >
                            Change Location
                        </button>
                    </div>
                </div>
            </section>

            {/* Global Concurrency */}
            <section className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                    <h4 className="text-white font-black uppercase tracking-widest text-sm italic">
                        Concurrency & Performance
                    </h4>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white/5 p-8 rounded-[32px] border border-white/5 space-y-8">
                        {/* Jobs */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                        <Zap size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-white text-sm font-bold uppercase tracking-wider">Parallel Series</span>
                                        <span className="text-neutral-500 text-[10px] font-medium">How many manga can download at once.</span>
                                    </div>
                                </div>
                                <span className="text-lg font-black text-blue-500 italic tabular-nums">{maxConcurrentJobs}</span>
                            </div>
                            <input 
                                type="range" min="1" max="5" step="1"
                                value={maxConcurrentJobs}
                                onChange={(e) => setMaxConcurrentJobs(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>

                        {/* Chapters */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                        <Cpu size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-white text-sm font-bold uppercase tracking-wider">Parallel Chapters</span>
                                        <span className="text-neutral-500 text-[10px] font-medium">Chapters per manga processed simultaneously.</span>
                                    </div>
                                </div>
                                <span className="text-lg font-black text-purple-500 italic tabular-nums">{maxConcurrentChapters}</span>
                            </div>
                            <input 
                                type="range" min="1" max="10" step="1"
                                value={maxConcurrentChapters}
                                onChange={(e) => setMaxConcurrentChapters(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>

                        {/* Pages */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                        <Gauge size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-white text-sm font-bold uppercase tracking-wider">Parallel Pages</span>
                                        <span className="text-neutral-500 text-[10px] font-medium">Images per chapter downloaded simultaneously.</span>
                                    </div>
                                </div>
                                <span className="text-lg font-black text-emerald-500 italic tabular-nums">{maxConcurrentPages}</span>
                            </div>
                            <input 
                                type="range" min="1" max="20" step="1"
                                value={maxConcurrentPages}
                                onChange={(e) => setMaxConcurrentPages(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>
                    </div>
                </div>
            </section>

             <section className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-red-500 rounded-full" />
                    <h4 className="text-white font-black uppercase tracking-widest text-sm italic">
                        Maintenance
                    </h4>
                </div>
                
                 <div className="bg-red-500/5 p-8 rounded-[32px] border border-red-500/10 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <span className="text-white font-bold uppercase tracking-wide">Clear Download Cache</span>
                        <span className="text-neutral-500 text-[10px] font-medium">Removes temporary files. Does not delete chapters.</span>
                    </div>
                    <button 
                        className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                        onClick={() => {
                            if (window.confirm('Clear temporary download cache?')) {
                                toast.success("Cache cleared");
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
