import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { Folder, Shield, Zap, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from '../Toast';
import { useState } from 'react';
import clsx from 'clsx';

export const GeneralSettings = () => {
    const { 
        libraryPath, 
        setLibraryPath, 
    } = useSettingsStore();
    const { verifyLibraryIntegrity, scanLibrary } = useLibraryStore();
    const [isVerifying, setIsVerifying] = useState(false);

    const handleBrowseLibrary = async () => {
        try {
            const selected = await openDialog({
                directory: true,
                multiple: false,
                defaultPath: libraryPath || undefined
            });
            if (selected && typeof selected === 'string') {
                setLibraryPath(selected);
                toast.success("Library path updated. Starting scan...");
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
                toast.success("Library integrity verified. No issues found.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Verification failed");
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="space-y-10 pb-12">
            {/* Library Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                    <h4 className="text-white font-black uppercase tracking-widest text-sm italic">
                        Library Management
                    </h4>
                </div>
                
                <div className="group bg-white/5 p-6 rounded-[32px] border border-white/5 hover:border-blue-500/20 transition-all duration-500">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-5 overflow-hidden">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-500">
                                <Folder size={28} />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-neutral-400 text-[10px] font-black uppercase tracking-widest mb-1">Target Directory</span>
                                <span className="text-white text-base font-bold truncate opacity-80" title={libraryPath || 'Not set'}>
                                    {libraryPath || 'No directory selected'}
                                </span>
                                <p className="text-neutral-600 text-[10px] font-medium mt-1">Main storage for your manga collection and metadata.</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleBrowseLibrary}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap"
                        >
                            Change Location
                        </button>
                    </div>
                </div>
            </section>

             {/* Safety & System */}
             <section className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                    <h4 className="text-white font-black uppercase tracking-widest text-sm italic">
                        Maintenance & System
                    </h4>
                </div>
                
                 <div className="grid grid-cols-1 gap-4">
                    <div className="group bg-white/5 p-6 rounded-[32px] border border-white/5 flex items-center justify-between hover:border-emerald-500/20 transition-all duration-500">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:rotate-12 transition-transform duration-500">
                                <Shield size={28} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1">Integrity Check</span>
                                <span className="text-white text-base font-bold">Verify Database Sync</span>
                                <p className="text-neutral-600 text-[10px] font-medium mt-1">Reconcile library with disk. Removes broken links.</p>
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
                            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-neutral-400">
                                <Info size={28} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-neutral-500 text-[10px] font-black uppercase tracking-widest mb-1">App Info</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-white text-base font-bold tracking-tight">FlowManga V2</span>
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-500 text-[9px] font-black rounded-md uppercase tracking-widest border border-blue-500/20">Production</span>
                                </div>
                                <p className="text-neutral-600 text-[10px] font-medium mt-1">Powered by Tauri Framework & React 19</p>
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
