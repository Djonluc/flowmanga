import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Sparkles, X, ChevronRight, Check } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { open } from '@tauri-apps/plugin-dialog';
import { mkdir } from '@tauri-apps/plugin-fs';

interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (path: string) => void;
}

export function LocationModal({ isOpen, onClose, onSuccess }: LocationModalProps) {
    const { setDownloadPath, setFirstRunComplete, getRecommendedPath } = useSettingsStore();

    const handleRecommended = async () => {
        try {
            const path = await getRecommendedPath();
            await mkdir(path, { recursive: true });
            setDownloadPath(path);
            setFirstRunComplete(true);
            onSuccess(path);
            onClose();
        } catch (err) {
            console.error('Failed to create recommended directory:', err);
        }
    };

    const handleChoose = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select Downloads Folder'
            });

            if (selected && !Array.isArray(selected)) {
                // As per "Even Better UX": create FlowManga subfolder if doesn't end with it?
                // Actually, let's just use what they chose but suggest/append if safe.
                // The prompt says: "Automatically create SelectedFolder/FlowManga/"
                const { join } = await import('@tauri-apps/api/path');
                const flowPath = await join(selected, 'FlowManga');
                await mkdir(flowPath, { recursive: true });
                
                setDownloadPath(flowPath);
                setFirstRunComplete(true);
                onSuccess(flowPath);
                onClose();
            }
        } catch (err) {
            console.error('Failed to select directory:', err);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-xl"
                    />
                    
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                    >
                        {/* Header Decoration */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600" />
                        
                        <div className="p-8 space-y-8">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black text-foreground italic tracking-tighter uppercase">
                                        Setup <span className="text-blue-500">Library</span>
                                    </h2>
                                    <p className="text-foreground-dim text-sm font-medium">Choose where FlowManga should store your downloads</p>
                                </div>
                                <button 
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/10 rounded-full text-foreground-dim hover:text-foreground transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="grid gap-4">
                                {/* Recommended Option */}
                                <button
                                    onClick={handleRecommended}
                                    className="group relative flex items-center gap-6 p-6 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 hover:border-blue-500/50 rounded-2xl transition-all text-left overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Sparkles size={80} className="text-blue-500" />
                                    </div>
                                    
                                    <div className="p-4 bg-blue-600 rounded-xl shadow-lg">
                                        <Sparkles size={24} className="text-foreground" />
                                    </div>
                                    
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-foreground">Use Recommended</h3>
                                            <span className="px-2 py-0.5 bg-blue-600 text-[10px] font-black uppercase rounded text-foreground tracking-widest">Auto</span>
                                        </div>
                                        <p className="text-sm text-foreground-dim">Creates FlowManga folder in your Documents</p>
                                    </div>
                                    
                                    <ChevronRight size={20} className="text-foreground-muted group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                                </button>

                                {/* Custom Option */}
                                <button
                                    onClick={handleChoose}
                                    className="group flex items-center gap-6 p-6 bg-surface/50 hover:bg-surface-raised border border-white/5 hover:border-white/20 rounded-2xl transition-all text-left"
                                >
                                    <div className="p-4 bg-surface-raised rounded-xl border border-white/10">
                                        <FolderOpen size={24} className="text-foreground-dim group-hover:text-foreground transition-colors" />
                                    </div>
                                    
                                    <div className="flex-1 space-y-1">
                                        <h3 className="text-lg font-bold text-foreground group-hover:text-blue-400 transition-colors">Choose Custom Folder</h3>
                                        <p className="text-sm text-foreground-dim">Pick any directory on your computer</p>
                                    </div>
                                    
                                    <ChevronRight size={20} className="text-foreground-muted group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                                </button>
                            </div>

                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-4">
                                <div className="mt-1 p-1 bg-green-500/20 rounded text-green-500">
                                    <Check size={14} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-foreground-muted">Why this matters?</p>
                                    <p className="text-[10px] text-foreground-dim leading-relaxed font-medium">
                                        Standardizing your library prevents duplicates, enables automatic metadata tagging, 
                                        and ensures a clean reading experience across all your devices.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-black/40 border-t border-white/5 text-center">
                            <p className="text-[10px] text-foreground-muted font-bold uppercase tracking-widest">
                                You can change this location anytime in settings
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
