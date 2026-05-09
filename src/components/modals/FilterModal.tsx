import { motion, AnimatePresence } from 'framer-motion';
import { useModalStore } from '../../stores/useModalStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { Filter, X, Tag, Settings2, RefreshCcw, Check, Library as LibraryIcon, Database, Bookmark } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

export const FilterModal = () => {
    const { isFilterModalOpen, closeFilterModal } = useModalStore();
    const { 
        filterTags, filterSource, filterStatus,
        toggleFilterTag, setFilterSource, setFilterStatus, clearFilterTags,
        series 
    } = useLibraryStore();

    const [allTags, setAllTags] = useState<string[]>([]);
    const [allSources, setAllSources] = useState<string[]>([]);

    useEffect(() => {
        if (isFilterModalOpen) {
            const tags = new Set<string>();
            const sources = new Set<string>();
            
            series.forEach(s => {
                if (s.tags) s.tags.forEach(t => tags.add(t));
                if (s.source) sources.add(s.source);
            });
            
            setAllTags(Array.from(tags).sort());
            setAllSources(Array.from(sources).sort());
        }
    }, [isFilterModalOpen, series]);

    const handleClearAll = () => {
        clearFilterTags();
        setFilterSource(null);
        setFilterStatus(null);
    };

    if (!isFilterModalOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                onClick={closeFilterModal} 
            />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                            <Filter size={20} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Advanced Filters</h2>
                            <p className="text-xs text-neutral-500 font-medium">Refine your library view</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleClearAll}
                            className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <RefreshCcw size={14} /> Clear All
                        </button>
                        <button 
                            onClick={closeFilterModal}
                            className="p-2 text-neutral-500 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                    
                    {/* Status Filters */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-neutral-400 font-bold uppercase tracking-widest text-[10px]">
                            <Bookmark size={14} /> Reading Status
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <FilterChip 
                                active={filterStatus === 'unread'} 
                                onClick={() => setFilterStatus(filterStatus === 'unread' ? null : 'unread')}
                                label="Unread" 
                            />
                            <FilterChip 
                                active={filterStatus === 'reading'} 
                                onClick={() => setFilterStatus(filterStatus === 'reading' ? null : 'reading')}
                                label="Reading" 
                            />
                            <FilterChip 
                                active={filterStatus === 'completed'} 
                                onClick={() => setFilterStatus(filterStatus === 'completed' ? null : 'completed')}
                                label="Completed" 
                            />
                        </div>
                    </section>

                    {/* Source Filters */}
                    {allSources.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-neutral-400 font-bold uppercase tracking-widest text-[10px]">
                                <Database size={14} /> Source Origin
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {allSources.map(source => (
                                    <FilterChip 
                                        key={source}
                                        active={filterSource === source} 
                                        onClick={() => setFilterSource(filterSource === source ? null : source)}
                                        label={source} 
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Tag Filters */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-neutral-400 font-bold uppercase tracking-widest text-[10px]">
                            <Tag size={14} /> Tags & Genres
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => toggleFilterTag(tag)}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                                        filterTags.includes(tag) 
                                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]" 
                                            : "bg-white/[0.03] text-neutral-400 border-white/5 hover:bg-white/10 hover:text-white"
                                    )}
                                >
                                    {tag}
                                </button>
                            ))}
                            {allTags.length === 0 && (
                                <span className="text-xs text-neutral-600 font-medium">No tags found in library.</span>
                            )}
                        </div>
                    </section>
                    
                </div>
                
                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-end">
                    <button 
                        onClick={closeFilterModal}
                        className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Check size={16} /> Apply Filters
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const FilterChip = ({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) => (
    <button
        onClick={onClick}
        className={clsx(
            "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border",
            active 
                ? "bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
                : "bg-white/[0.03] text-neutral-400 border-white/5 hover:bg-white/10 hover:text-white"
        )}
    >
        {active && <Check size={14} />}
        {label}
    </button>
);
