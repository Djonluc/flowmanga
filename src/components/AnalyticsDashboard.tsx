import { useAnalyticsStore } from '../stores/useAnalyticsStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { motion } from 'framer-motion';
import { Clock, BookOpen, Flame, Zap, Trophy, Star, Target, BarChart2, CheckCircle2 } from 'lucide-react';
import { AnalyticsGraph } from './AnalyticsGraph';
import { GenreDistribution } from './GenreDistribution';

export const AnalyticsDashboard = () => {
    const { totalTimeReading, pagesRead, booksCompleted, currentStreak, longestStreak, getFavoriteSeries } = useAnalyticsStore();
    const { series } = useLibraryStore();

    // Metrics
    const hours = Math.floor(totalTimeReading / 3600);
    const minutes = Math.floor((totalTimeReading % 3600) / 60);
    
    const hoursDecimal = totalTimeReading / 3600;
    const velocity = hoursDecimal > 0 ? Math.round(pagesRead / hoursDecimal) : 0;
    
    const favoriteId = getFavoriteSeries();
    const favoriteSeries = favoriteId ? series.find(s => s.id === favoriteId)?.title : 'N/A';

    const stats = [
        { label: 'Time Read', value: `${hours}h ${minutes}m`, icon: <Clock size={20} />, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        { label: 'Pages Read', value: pagesRead.toLocaleString(), icon: <BookOpen size={20} />, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'Velocity', value: `${velocity} p/h`, icon: <Zap size={20} />, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        { label: 'Current Streak', value: `${currentStreak} Days`, icon: <Flame size={20} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ];
    
    const secondaryStats = [
         { label: 'Longest Streak', value: `${longestStreak} Days`, icon: <Trophy size={18} />, color: 'text-purple-400' },
         { label: 'Books Completed', value: booksCompleted.toString(), icon: <CheckCircle2 size={18} className="text-cyan-500" />, color: 'text-cyan-500' },
         { label: 'Favorite Series', value: favoriteSeries || 'None', icon: <Star size={18} />, color: 'text-pink-500' },
    ];

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full w-full p-[clamp(1rem,3vw,2rem)] overflow-y-auto no-scrollbar relative max-w-[1920px] mx-auto"
        >
            <div className="flex flex-col gap-6 mb-[clamp(1.5rem,4vw,3rem)] px-4 pt-2 shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-[clamp(0.75rem,2vw,1.25rem)]">
                            <div className="w-[clamp(2.5rem,5vw,3rem)] h-[clamp(2.5rem,5vw,3rem)] rounded-[clamp(0.75rem,1.5vw,1.25rem)] bg-white/5 border border-white/10 flex items-center justify-center shadow-lg text-indigo-500">
                                <BarChart2 size={24} />
                            </div>
                            <h2 className="text-[clamp(1.5rem,4vw,2.5rem)] font-black tracking-tight text-foreground leading-none italic uppercase">
                                Analytics
                            </h2>
                        </div>
                        <div className="flex items-center gap-2 mt-4 opacity-60">
                            <p className="text-[clamp(9px,1vw,11px)] font-black text-foreground-dim uppercase tracking-[0.3em]">
                                Reading Activity & Deep Insights
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 pb-20 flex flex-col gap-[clamp(2rem,5vw,4rem)]">
                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[clamp(1rem,2vw,1.5rem)]">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1, type: 'spring', damping: 20 }}
                            className="p-[clamp(1.5rem,3vw,2rem)] rounded-[clamp(1.5rem,3vw,2rem)] border border-white/5 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden group hover:bg-white/[0.04] transition-all flex flex-col shadow-2xl"
                        >
                            <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity ${stat.color.replace('text', 'bg')}`} />
                            
                            <div className="flex items-center gap-4 mb-8">
                                <div className={`p-[clamp(0.75rem,1.5vw,1rem)] rounded-[clamp(0.75rem,1.5vw,1rem)] ${stat.bg} ${stat.color} shadow-lg shadow-black/20`}>
                                    {stat.icon}
                                </div>
                                <div className="text-[clamp(8px,0.8vw,10px)] font-black text-foreground-dim uppercase tracking-[0.4em] leading-none">{stat.label}</div>
                            </div>
                            <div className="text-[clamp(1.5rem,3vw,2.25rem)] font-black text-foreground tracking-tighter truncate mt-auto leading-none italic">{stat.value}</div>
                        </motion.div>
                    ))}
                </div>

                {/* Insights Section */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-[clamp(1rem,2vw,1.5rem)]">
                    {/* Activity Graph */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="xl:col-span-8 p-[clamp(1.5rem,3vw,2.5rem)] rounded-[clamp(2rem,4vw,2.5rem)] border border-white/5 bg-white/[0.01] relative overflow-hidden shadow-2xl"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <h4 className="text-[clamp(12px,1.2vw,14px)] font-black text-foreground uppercase tracking-[0.4em] italic">Temporal Flow</h4>
                        </div>
                        <div className="h-[clamp(200px,40vh,400px)] w-full">
                            <AnalyticsGraph />
                        </div>
                    </motion.div>

                    {/* Genre Distribution */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="xl:col-span-4 p-[clamp(1.5rem,3vw,2.5rem)] rounded-[clamp(2rem,4vw,2.5rem)] border border-white/5 bg-white/[0.01] bg-gradient-to-br from-white/[0.02] to-transparent shadow-2xl"
                    >
                         <div className="flex items-center justify-between mb-8">
                            <h4 className="text-[clamp(12px,1.2vw,14px)] font-black text-foreground uppercase tracking-[0.4em] italic">Genre Spectrum</h4>
                        </div>
                        <div className="h-[clamp(200px,40vh,400px)] w-full">
                            <GenreDistribution />
                        </div>
                    </motion.div>
                </div>

                {/* Secondary Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-[clamp(0.75rem,1.5vw,1.25rem)]">
                    {secondaryStats.map((stat, i) => (
                        <motion.div 
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + (i * 0.1) }}
                            className="flex items-center gap-5 p-[clamp(1rem,2vw,1.5rem)] rounded-[clamp(1.25rem,2.5vw,1.75rem)] bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group shadow-xl"
                        >
                            <div className={`p-[clamp(0.5rem,1vw,0.75rem)] rounded-[clamp(0.5rem,1vw,0.75rem)] bg-white/5 ${stat.color} group-hover:scale-110 transition-transform shadow-inner`}>
                                {stat.icon}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[clamp(7px,0.7vw,9px)] font-black text-foreground-dim uppercase tracking-[0.3em] mb-1.5">{stat.label}</span>
                                <span className="text-[clamp(12px,1.2vw,15px)] font-black text-foreground truncate w-full italic" title={stat.value}>{stat.value}</span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};
