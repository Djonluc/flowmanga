import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Download, ShieldAlert } from 'lucide-react';

interface SafetyCheckModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAction: (action: 'update' | 'redownload') => void;
    mangaTitle: string;
}

export function SafetyCheckModal({ isOpen, onClose, onAction, mangaTitle }: SafetyCheckModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md"
                    />
                    
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-[#0d0d0d] border border-orange-500/20 rounded-3xl overflow-hidden shadow-2xl"
                    >
                        <div className="p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-orange-500/20 rounded-2xl">
                                    <ShieldAlert size={28} className="text-orange-500" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black text-foreground italic tracking-tighter uppercase">Series Exists</h2>
                                    <p className="text-foreground-dim text-xs font-medium">What would you like to do?</p>
                                </div>
                            </div>

                            <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl">
                                <p className="text-sm text-foreground-muted font-medium">
                                    <span className="text-orange-400 font-bold">"{mangaTitle}"</span> is already in your library.
                                </p>
                            </div>

                            <div className="grid gap-3">
                                <button
                                    onClick={() => onAction('update')}
                                    className="group flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/50 rounded-2xl transition-all text-left"
                                >
                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                        <RefreshCw size={18} className="text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-foreground">Update Existing</p>
                                        <p className="text-[10px] text-foreground-dim">Only download missing chapters</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => onAction('redownload')}
                                    className="group flex items-center gap-4 p-4 bg-white/5 hover:bg-surface border border-white/5 hover:border-orange-500/50 rounded-2xl transition-all text-left"
                                >
                                    <div className="p-2 bg-orange-500/20 rounded-lg">
                                        <Download size={18} className="text-orange-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-foreground">Redownload All</p>
                                        <p className="text-[10px] text-foreground-dim">Overwrite everything in the folder</p>
                                    </div>
                                </button>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-surface hover:bg-surface-raised text-foreground-dim font-bold rounded-2xl transition-all text-xs uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
