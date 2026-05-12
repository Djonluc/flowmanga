import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useDiscoveryStore } from '../../stores/useDiscoveryStore';
import { Folder, Shield, Zap, Info, CheckCircle2, Loader2, RefreshCw, Monitor, Minus, Plus } from 'lucide-react';
import { toast } from '../Toast';
import { useState } from 'react';
import clsx from 'clsx';

export const GeneralSettings = () => {
    const { 
        zoomScale, setZoomScale,
        libraryPath, 
        setLibraryPath, 
    } = useSettingsStore();
    const { verifyLibraryIntegrity, scanLibrary } = useLibraryStore();
    const { forceRefresh } = useDiscoveryStore();
    const [isVerifying, setIsVerifying] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleBrowseLibrary = async () => {
        try {
            const selected = await openDialog({
                directory: true,
                multiple: false,
                defaultPath: libraryPath || undefined
            });
            if (selected && typeof selected === 'string') {
                setLibraryPath(selected);
                toast.success("Archive path updated. Starting manifestation...");
                await scanLibrary(selected);
                toast.success("Scan complete!");
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to update library path");
        }
    };

    const handleVerifyIntegrity = async () => {
        setIsVerifying(true);
        toast.info("Verifying library integrity...");
        try {
            const removedCount = await verifyLibraryIntegrity();
            if (removedCount > 0) {
                toast.success(`Integrity check complete. Removed ${removedCount} missing entries.`);
            } else {
                toast.success("Archive integrity verified. No issues found.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Verification failed");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleForceRefresh = async () => {
        setIsRefreshing(true);
        toast.info("Clearing discovery cache and fetching fresh data...");
        try {
            await forceRefresh();
            toast.success("Discovery engine successfully reset!");
        } catch (e) {
            console.error(e);
            toast.error("Failed to refresh discovery engine");
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="space-y-10 pb-12">
            {/* Archive Section */}
            <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                    <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
                        Archive Management
                    </h4>
                </div>
                
                <div className="group bg-white/5 p-6 rounded-[32px] border border-white/5 hover:border-blue-500/20 transition-all duration-500">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-5 overflow-hidden">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-500">
                                <Folder size={28} />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mb-1">Target Directory</span>
                                <span className="text-foreground text-base font-bold truncate opacity-80" title={libraryPath || 'Not set'}>
                                    {libraryPath || 'No directory selected'}
                                </span>
                                <p className="text-foreground-muted text-[10px] font-medium mt-1">Main storage for your manga collection and metadata.</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleBrowseLibrary}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-foreground border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap"
                        >
                            Change Location
                        </button>
                    </div>
                </div>
            </div>

             {/* Safety & System */}
             <section className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                    <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
                        Display & Interface
                    </h4>
                </div>

                <div className="group bg-white/5 p-6 rounded-[32px] border border-white/5 hover:border-amber-500/20 transition-all duration-500">
                    <div className="flex items-center justify-between gap-10">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-500">
                                <Zap size={28} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <Monitor size={14} className="text-amber-500" />
                                    <span className="text-foreground text-base font-bold tracking-tight">UI Viewing Scale</span>
                                </div>
                                <p className="text-foreground-muted text-[10px] font-medium mt-1 leading-relaxed max-w-md">
                                    Adjust the native visual density of the application. This behaves like browser zoom (CTRL + Scroll) and persists across restarts.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-3 min-w-[240px]">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl font-black text-foreground italic tracking-tighter">
                                    {Math.round(zoomScale * 100)}%
                                </span>
                                <button 
                                    onClick={() => setZoomScale(1.0)}
                                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-foreground-dim hover:text-foreground transition-all"
                                >
                                    Reset
                                </button>
                            </div>
                            <input 
                                type="range" 
                                min="0.5" 
                                max="2.0" 
                                step="0.05"
                                value={zoomScale}
                                onChange={(e) => setZoomScale(parseFloat(e.target.value))}
                                className="w-full h-1.5 appearance-none bg-white/5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 mb-6 pt-4">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                    <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
                        Maintenance & System
                    </h4>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    {/* Reset Discovery Cache */}
                    <div className="group bg-white/5 p-6 rounded-[32px] border border-white/5 flex items-center justify-between hover:border-indigo-500/20 transition-all duration-500">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform duration-500">
                                <RefreshCw size={28} className={clsx(isRefreshing && "animate-spin")} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-indigo-500 text-[10px] font-black uppercase tracking-widest mb-1">Global Discovery</span>
                                <span className="text-foreground text-base font-bold tracking-tight">Force Reset Engine</span>
                                <p className="text-foreground-muted text-[10px] font-medium mt-1 max-w-[300px]">Clear all cached discovery data and fetch fresh recommended content from all sources.</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleForceRefresh}
                            disabled={isRefreshing}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-foreground border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                        >
                            {isRefreshing ? 'Refreshing...' : 'Reset Now'}
                        </button>
                    </div>

                    <div className="group bg-white/5 p-6 rounded-[32px] border border-white/5 flex items-center justify-between hover:border-emerald-500/20 transition-all duration-500">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:rotate-12 transition-transform duration-500">
                                <Shield size={28} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1">Integrity Check</span>
                                <span className="text-foreground text-base font-bold">Verify Database Sync</span>
                                <p className="text-foreground-muted text-[10px] font-medium mt-1">Reconcile library with disk. Removes broken links.</p>
                            </div>
                        </div>
                        <button 
                            disabled={isVerifying}
                            className={clsx(
                                "px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                isVerifying && "opacity-50 cursor-not-allowed"
                            )}
                            onClick={handleVerifyIntegrity}
                        >
                            {isVerifying ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                            {isVerifying ? 'Verifying...' : 'Start Check'}
                        </button>
                    </div>

                    <div className="bg-white/5 p-6 rounded-[32px] border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-foreground-dim">
                                <Info size={28} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mb-1">App Info</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-foreground text-base font-bold tracking-tight">FlowManga V2</span>
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-500 text-[9px] font-black rounded-md uppercase tracking-widest border border-blue-500/20">Production</span>
                                </div>
                                <p className="text-foreground-muted text-[10px] font-medium mt-1">Powered by Tauri Framework & React 19</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                            <CheckCircle2 size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">System Stable</span>
                        </div>
                    </div>
                 </div>
            </section>
        </div>
    );
};
