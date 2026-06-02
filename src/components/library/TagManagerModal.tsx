import { useState, useEffect } from 'react';
import { X, Plus, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLibraryStore } from '../../stores/useLibraryStore';

interface TagManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    seriesId: string;
    initialTags: string[];
}

export const TagManagerModal = ({ isOpen, onClose, seriesId, initialTags }: TagManagerModalProps) => {
    const { updateTags } = useLibraryStore();
    const [tags, setTags] = useState<string[]>(initialTags);
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        setTags(initialTags);
    }, [initialTags, isOpen]);

    const handleAddTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags([...tags, newTag.trim()]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSave = async () => {
        if (seriesId === 'discovery') {
            const { useDiscoveryStore } = await import('../../stores/useDiscoveryStore');
            useDiscoveryStore.getState().searchByTags(tags);
            onClose();
            return;
        }
        await updateTags(seriesId, tags);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />
                
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    className="relative w-full max-w-sm bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <Tag size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-foreground">Manage Tags</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-foreground-dim hover:text-foreground transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Input */}
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                placeholder="Add a tag..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-foreground placeholder:text-foreground-dim focus:outline-none focus:border-blue-500/50"
                            />
                            <button 
                                onClick={handleAddTag}
                                disabled={!newTag.trim()}
                                className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl text-foreground transition-colors"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        {/* Tag List */}
                        <div className="flex flex-wrap gap-2 min-h-[100px] content-start">
                            {tags.length > 0 ? (
                                tags.map(tag => (
                                    <span key={tag} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-white/10 text-sm font-medium text-foreground border border-white/5">
                                        {tag}
                                        <button 
                                            onClick={() => handleRemoveTag(tag)}
                                            className="p-1 hover:bg-white/20 rounded-full text-foreground-dim hover:text-red-400 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </span>
                                ))
                            ) : (
                                <p className="text-foreground-muted text-sm italic w-full text-center py-4">No tags yet.</p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="pt-4 mt-2 border-t border-white/5 flex justify-end gap-3">
                            <button 
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl text-foreground-dim hover:text-foreground hover:bg-white/5 transition-colors font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                className="px-6 py-2 rounded-xl bg-white text-black font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
