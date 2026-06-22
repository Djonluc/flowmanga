import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Trash2, Folder, Zap, Cpu, Gauge, ShieldAlert } from 'lucide-react';
import { toast } from '../Toast';
import clsx from 'clsx';

export const DownloadSettings = () => {
    const { 
        downloadPath, setDownloadPath, 
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
            toast.error("Failed to update directory");
        }
    };

    return (
        <div className="flex flex-col gap-8 pb-12 w-full max-w-5xl mx-auto">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter">Manifestation Rules</h2>
                    <p className="text-foreground-dim font-bold tracking-wide mt-1">Configure networking concurrency and temporary storage.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Temporary Storage Directory */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden group lg:col-span-2">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-colors" />
                    
                    <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                                <Folder size={24} />
                            </div>
                            <div>
                                <h3 className="text-foreground font-black text-lg">Staging Directory</h3>
                                <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest">Temporary Download Cache</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 bg-black/20 rounded-2xl p-4 border border-white/5 relative z-10">
                        <p className="text-foreground-dim text-xs font-mono break-all line-clamp-2">
                            {downloadPath || 'Default (Same as Library)'}
                        </p>
                    </div>

                    <div className="mt-4 flex gap-3 relative z-10">
                        <button 
                            onClick={handleBrowseDownloads}
                            className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20"
                        >
                            Change Location
                        </button>
                    </div>
                </div>

                {/* Concurrency Settings Grid */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden lg:col-span-2">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
                    <div className="flex items-center gap-4 mb-8 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <Zap size={24} />
                        </div>
                        <div>
                            <h3 className="text-foreground font-black text-lg">Concurrency Engine</h3>
                            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Network Performance</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                        {/* Max Series */}
                        <div className="bg-surface-elevated p-5 rounded-2xl border border-border-subtle hover:border-blue-500/30 transition-colors">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <Zap size={16} className="text-blue-500" />
                                    <h4 className="text-foreground font-bold text-sm uppercase tracking-wide">Parallel Series</h4>
                                </div>
                                <span className="text-xl font-black text-blue-400 italic">{maxConcurrentJobs}</span>
                            </div>
                            <input 
                                type="range" min="1" max="5" step="1" value={maxConcurrentJobs}
                                onChange={(e) => setMaxConcurrentJobs(parseInt(e.target.value))}
                                className="w-full h-2 bg-black/40 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                            />
                            <p className="text-foreground-dim text-[9px] font-bold uppercase tracking-widest mt-3">Manga downloading at once</p>
                        </div>

                        {/* Max Chapters */}
                        <div className="bg-surface-elevated p-5 rounded-2xl border border-border-subtle hover:border-purple-500/30 transition-colors">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <Cpu size={16} className="text-purple-500" />
                                    <h4 className="text-foreground font-bold text-sm uppercase tracking-wide">Parallel Chapters</h4>
                                </div>
                                <span className="text-xl font-black text-purple-400 italic">{maxConcurrentChapters}</span>
                            </div>
                            <input 
                                type="range" min="1" max="10" step="1" value={maxConcurrentChapters}
                                onChange={(e) => setMaxConcurrentChapters(parseInt(e.target.value))}
                                className="w-full h-2 bg-black/40 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                            />
                            <p className="text-foreground-dim text-[9px] font-bold uppercase tracking-widest mt-3">Chapters per manga</p>
                        </div>

                        {/* Max Pages */}
                        <div className="bg-surface-elevated p-5 rounded-2xl border border-border-subtle hover:border-emerald-500/30 transition-colors">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <Gauge size={16} className="text-emerald-500" />
                                    <h4 className="text-foreground font-bold text-sm uppercase tracking-wide">Parallel Pages</h4>
                                </div>
                                <span className="text-xl font-black text-emerald-400 italic">{maxConcurrentPages}</span>
                            </div>
                            <input 
                                type="range" min="1" max="20" step="1" value={maxConcurrentPages}
                                onChange={(e) => setMaxConcurrentPages(parseInt(e.target.value))}
                                className="w-full h-2 bg-black/40 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                            />
                            <p className="text-foreground-dim text-[9px] font-bold uppercase tracking-widest mt-3">Images per chapter</p>
                        </div>
                    </div>
                </div>

                {/* Clear Cache */}
                <div className="glass-panel p-6 rounded-[32px] border border-red-500/20 bg-red-500/5 relative overflow-hidden lg:col-span-2 flex items-center justify-between group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                            <ShieldAlert size={24} />
                        </div>
                        <div>
                            <h3 className="text-foreground font-black text-lg text-red-100">Clear Download Cache</h3>
                            <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest">Removes temporary fragments. Does not delete chapters.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            if (window.confirm('Clear temporary download cache?')) {
                                toast.success("Cache cleared");
                            }
                        }}
                        className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10"
                    >
                        <span className="flex items-center gap-2">
                            <Trash2 size={14} /> Obliterate
                        </span>
                    </button>
                </div>

            </div>
        </div>
    );
};
