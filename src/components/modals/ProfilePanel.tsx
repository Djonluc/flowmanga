import { motion } from 'framer-motion';
import { useModalStore } from '../../stores/useModalStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { User, X, Flame, BookOpen, Clock, Activity, Target } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';

export const ProfilePanel = () => {
    const { isProfilePanelOpen, closeProfilePanel } = useModalStore();
    const { series } = useLibraryStore();

    if (!isProfilePanelOpen) return null;

    // Derived Mock Stats (in a real app, from an analytics store)
    const totalSeries = series.length;
    const totalChapters = series.reduce((acc, s) => acc + (s.books?.length || 0), 0);
    const favoriteTags = Array.from(new Set(
        series
            .filter(s => s.tags.includes('favorite'))
            .flatMap(s => s.tags)
            .filter(t => t !== 'favorite')
    )).slice(0, 3);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                onClick={closeProfilePanel} 
            />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden"
            >
                {/* Header Profile Info */}
                <div className="relative p-8 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 opacity-50" />
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 blur-[50px] rounded-full" />
                    
                    <button 
                        onClick={closeProfilePanel}
                        className="absolute top-4 right-4 p-2 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors backdrop-blur-md z-10"
                    >
                        <X size={18} />
                    </button>

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-indigo-500/30 bg-neutral-900 shadow-[0_0_30px_rgba(99,102,241,0.3)] mb-4 p-1">
                            <div className="w-full h-full rounded-full overflow-hidden bg-black flex items-center justify-center">
                                <img 
                                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=VoidWalker" 
                                    alt="Avatar" 
                                    className="w-full h-full object-cover" 
                                />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">VoidWalker</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500 text-[10px] font-black text-white uppercase tracking-widest shadow-[0_0_10px_rgba(99,102,241,0.5)]">
                                PRO Rank
                            </span>
                            <span className="text-xs text-neutral-400 font-medium">Archivist</span>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="p-6 bg-white/[0.02] border-t border-white/5 grid grid-cols-2 gap-4">
                    <StatCard icon={<Flame className="text-orange-500" />} label="Read Streak" value="12 Days" />
                    <StatCard icon={<BookOpen className="text-indigo-400" />} label="Total Series" value={totalSeries} />
                    <StatCard icon={<Layers className="text-purple-400" />} label="Volumes" value={totalChapters} />
                    <StatCard icon={<Clock className="text-green-400" />} label="Time Read" value="48h" />
                </div>

                {/* Archetype & Genres */}
                <div className="p-6 space-y-6">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <Target size={16} className="text-neutral-500" />
                            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Reading Archetype</h3>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                            <h4 className="text-sm font-bold text-white">The Binge Reader</h4>
                            <p className="text-[11px] text-neutral-500 mt-1">You tend to finish entire volumes in single sessions, favoring completed series.</p>
                        </div>
                    </div>

                    {favoriteTags.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Activity size={16} className="text-neutral-500" />
                                <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Top Genres</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {favoriteTags.map(tag => (
                                    <span key={tag} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-neutral-300">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

const StatCard = ({ icon, label, value }: { icon: any, label: string, value: string | number }) => (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-4 group hover:bg-white/[0.05] transition-colors">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <div>
            <div className="text-lg font-black text-white leading-none mb-1">{value}</div>
            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{label}</div>
        </div>
    </div>
);
