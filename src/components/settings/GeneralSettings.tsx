import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useDiscoveryStore } from '../../stores/useDiscoveryStore';
import { useGalleryStore } from '../../stores/useGalleryStore';
import { Folder, Shield, Zap, Info, CheckCircle2, Loader2, RefreshCw, Monitor, FolderOpen, ScanSearch, Download, HardDrive, Globe } from 'lucide-react';
import { AppVersionService } from '../../services/AppVersionService';
import { toast } from '../Toast';
import { useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useImageCollectionStore } from '../../image-platform/useImageCollectionStore';

export const GeneralSettings = () => {
    const { 
        zoomScale, setZoomScale,
        libraryPath, setLibraryPath,
        imageDownloadPath, setImageDownloadPath,
        networkProxy, setNetworkProxy
    } = useSettingsStore();
    
    const { verifyLibraryIntegrity, scanLibrary, rebuildCollectionIndex } = useLibraryStore();
    const { downloadPath, setDownloadPath } = useGalleryStore();
    const reindexLocalFolder = useImageCollectionStore(state => state.reindexLocalFolder);
    const { forceRefresh } = useDiscoveryStore();
    
    const [isVerifying, setIsVerifying] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRebuilding, setIsRebuilding] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    
    const defaultCollectionPath = 'Documents/FlowManga Collection';

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
            const message = e instanceof Error ? e.message : String(e);
            console.error('[GeneralSettings] Manga archive scan failed', e);
            toast.error(`Failed to scan manga folder: ${message}`);
        }
    };

    const handleVerifyIntegrity = async () => {
        setIsVerifying(true);
        try {
            const removedCount = await verifyLibraryIntegrity();
            if (removedCount > 0) toast.success(`Integrity check complete. Removed ${removedCount} missing entries.`);
            else toast.success("Archive integrity verified. No issues found.");
        } catch (e) {
            toast.error("Verification failed");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleForceRefresh = async () => {
        setIsRefreshing(true);
        try {
            await forceRefresh();
            toast.success("Discovery engine successfully reset!");
        } catch (e) {
            toast.error("Failed to refresh discovery engine");
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleRebuildCollection = async () => {
        setIsRebuilding(true);
        try {
            await rebuildCollectionIndex();
        } catch (e) {
        } finally {
            setIsRebuilding(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 pb-12 w-full max-w-5xl mx-auto">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter">Core Systems</h2>
                    <p className="text-foreground-dim font-bold tracking-wide mt-1">Manage storage paths, UI scale, and system maintenance.</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">System Stable</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Primary Storage Card */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full group-hover:bg-blue-500/20 transition-colors" />
                    
                    <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <HardDrive size={24} />
                            </div>
                            <div>
                                <h3 className="text-foreground font-black text-lg">Manga Archive</h3>
                                <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Primary Storage</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 bg-black/20 rounded-2xl p-4 border border-white/5 relative z-10">
                        <p className="text-foreground-dim text-xs font-mono break-all line-clamp-2">
                            {libraryPath || 'No directory selected'}
                        </p>
                    </div>

                    <div className="mt-4 flex gap-3 relative z-10">
                        <button 
                            onClick={handleBrowseLibrary}
                            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
                        >
                            Change Path
                        </button>
                    </div>
                </div>

                {/* Collection Storage Card */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full group-hover:bg-purple-500/20 transition-colors" />
                    
                    <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                                <FolderOpen size={24} />
                            </div>
                            <div>
                                <h3 className="text-foreground font-black text-lg">Image Collections</h3>
                                <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest">Downloads & Saves</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 bg-black/20 rounded-2xl p-4 border border-white/5 relative z-10">
                        <p className="text-foreground-dim text-xs font-mono break-all line-clamp-2">
                            {imageDownloadPath || downloadPath || defaultCollectionPath}
                        </p>
                    </div>

                    <div className="mt-4 flex gap-3 relative z-10">
                        <button 
                            onClick={async () => {
                                try {
                                    const selected = await openDialog({ directory: true, multiple: false, defaultPath: imageDownloadPath || downloadPath || undefined });
                                    if (selected && typeof selected === 'string') {
                                        setImageDownloadPath(selected);
                                        await setDownloadPath(selected);
                                        const report = await reindexLocalFolder(selected);
                                        toast.success(`Collection folder scanned: ${report.scanned} files found, ${report.imported} imported`);
                                    }
                                } catch (e) {
                                    const message = e instanceof Error ? e.message : String(e);
                                    console.error('[GeneralSettings] Image collection scan failed', e);
                                    toast.error(`Failed to scan image collection: ${message}`);
                                }
                            }}
                            className="flex-1 py-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-purple-500/20"
                        >
                            Change Path
                        </button>
                    </div>
                </div>

                {/* Display Scale */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden group col-span-1 lg:col-span-2">
                     <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 blur-[60px] rounded-full" />
                     
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <Monitor size={28} />
                            </div>
                            <div>
                                <h3 className="text-foreground font-black text-lg">Interface Scale</h3>
                                <p className="text-foreground-dim text-xs font-medium mt-1 max-w-sm">Adjust the native visual density. Behaves exactly like browser zoom (CTRL + Scroll).</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-4 flex-1 max-w-md">
                            <div className="flex items-center justify-between">
                                <span className="text-2xl font-black text-foreground italic">{Math.round(zoomScale * 100)}%</span>
                                <button onClick={() => setZoomScale(1.0)} className="text-[10px] text-foreground-dim hover:text-amber-500 uppercase tracking-widest font-bold transition-colors">Reset</button>
                            </div>
                            <input 
                                type="range" min="0.5" max="2.0" step="0.05" value={zoomScale}
                                onChange={(e) => setZoomScale(parseFloat(e.target.value))}
                                className="w-full h-2 bg-black/40 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                            />
                        </div>
                     </div>
                </div>

                {/* Network Proxy */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden group col-span-1 lg:col-span-2">
                     <div className="absolute top-0 left-0 w-48 h-48 bg-blue-500/5 blur-[60px] rounded-full" />
                     
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <Globe size={28} />
                            </div>
                            <div>
                                <h3 className="text-foreground font-black text-lg">Network Proxy</h3>
                                <p className="text-foreground-dim text-xs font-medium mt-1 max-w-sm">Route booru traffic through a proxy (e.g. socks5://127.0.0.1:9050)</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-4 flex-1 max-w-md">
                            <input 
                                type="text"
                                placeholder="Leave blank for direct connection..."
                                value={networkProxy}
                                onChange={(e) => setNetworkProxy(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm font-medium text-foreground outline-none focus:border-blue-500/50 transition-colors"
                            />
                        </div>
                     </div>
                </div>

                {/* Maintenance & System Grid */}
                <div className="col-span-1 lg:col-span-2 space-y-4 pt-6">
                    <h3 className="text-foreground font-black uppercase tracking-widest text-sm italic opacity-50 mb-4">Maintenance Rituals</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MaintenanceCard 
                            icon={<RefreshCw size={24} className={clsx(isRefreshing && "animate-spin")} />}
                            title="Reset Discovery"
                            desc="Clear discovery cache and fetch fresh network data."
                            color="text-indigo-400"
                            bg="bg-indigo-500/10"
                            onClick={handleForceRefresh}
                            loading={isRefreshing}
                        />
                        <MaintenanceCard 
                            icon={<Shield size={24} />}
                            title="Integrity Check"
                            desc="Reconcile database with local disk storage."
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                            onClick={handleVerifyIntegrity}
                            loading={isVerifying}
                        />
                        <MaintenanceCard 
                            icon={<Folder size={24} />}
                            title="Rebuild Index"
                            desc="Deep scan library to regenerate metadata."
                            color="text-cyan-400"
                            bg="bg-cyan-500/10"
                            onClick={handleRebuildCollection}
                            loading={isRebuilding}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
};

const MaintenanceCard = ({ icon, title, desc, color, bg, onClick, loading }: any) => (
    <button 
        onClick={onClick}
        disabled={loading}
        className="glass-panel p-5 rounded-3xl border border-border-subtle hover:border-white/20 transition-all text-left group disabled:opacity-50 relative overflow-hidden"
    >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg} ${color} mb-4 group-hover:scale-110 transition-transform`}>
            {loading ? <Loader2 size={24} className="animate-spin" /> : icon}
        </div>
        <h4 className="text-foreground font-bold text-sm">{title}</h4>
        <p className="text-foreground-dim text-[10px] font-medium mt-1 leading-relaxed">{desc}</p>
    </button>
);
