import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (deleteFiles: boolean) => void;
    title: string;
    itemCount?: number;
    isSeries: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ 
    isOpen, onClose, onConfirm, title, itemCount, isSeries 
}) => {
    const [deleteFiles, setDeleteFiles] = useState(false);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-md bg-[#090909] border border-red-500/20 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.1)] overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 pb-0 flex items-start gap-4">
                    <div className="p-3 rounded-full bg-red-500/10 text-red-500">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-foreground uppercase italic tracking-tight">
                            Delete {isSeries ? 'Series' : 'Item'}?
                        </h3>
                        <p className="text-foreground-dim text-sm mt-1 leading-relaxed">
                            This action is <span className="text-red-400 font-bold">permanent</span> and cannot be undone.
                        </p>
                    </div>
                </div>

                {/* Content Details */}
                <div className="p-6">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <h4 className="font-bold text-foreground mb-1 truncate">{title}</h4>
                        {isSeries && itemCount !== undefined && (
                            <p className="text-xs text-foreground-dim font-medium uppercase tracking-wider">
                                Contains {itemCount} {itemCount === 1 ? 'Chapter' : 'Chapters'}
                            </p>
                        )}
                    </div>

                    <label className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10 cursor-pointer hover:bg-red-500/10 transition-colors group">
                        <div className="relative flex items-center justify-center">
                            <input 
                                type="checkbox" 
                                className="peer h-5 w-5 appearance-none rounded border border-white/10 bg-white/5 checked:bg-red-600 checked:border-red-600 transition-all cursor-pointer"
                                id="deleteFiles"
                                checked={deleteFiles}
                                onChange={(e) => setDeleteFiles(e.target.checked)}
                            />
                            <X size={12} className="absolute text-foreground opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                        <span className="text-sm text-foreground-muted font-medium group-hover:text-foreground transition-colors">
                            Also delete files from disk
                        </span>
                    </label>
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-foreground font-bold text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => onConfirm(deleteFiles)}
                        className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] flex items-center justify-center gap-2 group"
                    >
                        <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                        <span>Delete Forever</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
