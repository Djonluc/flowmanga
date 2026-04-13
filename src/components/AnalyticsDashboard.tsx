import { useAnalyticsStore } from '../stores/useAnalyticsStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { motion } from 'framer-motion';
import { Clock, BookOpen, Flame, Zap, Trophy, Star, Target } from 'lucide-react';
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
        { label: 'Time Read', value: `${hours}h ${minutes}m`, icon: <Clock size={22} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Pages Read', value: pagesRead.toLocaleString(), icon: <BookOpen size={22} />, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'Velocity', value: `${velocity} p/h`, icon: <Zap size={22} />, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        { label: 'Current Streak', value: `${currentStreak} Days`, icon: <Flame size={22} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    ];
    
    const secondaryStats = [
         { label: 'Longest Streak', value: `${longestStreak} Days`, icon: <Trophy size={20} />, color: 'text-purple-400' },
         { label: 'Books Completed', value: booksCompleted.toString(), icon: <CheckCircle size={20} className="text-cyan-500" />, color: 'text-cyan-500' }, // Note: using icon here directly or component
         { label: 'Favorite Series', value: favoriteSeries || 'None', icon: <Star size={20} />, color: 'text-pink-500' },
    ];

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full w-full p-12 overflow-y-auto custom-scrollbar bg-[#050505]"
        >
            <header className="mb-16">
                <div className="flex items-center gap-3 mb-2">
                    <Target size={16} className="text-blue-500" />
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">My Activity</span>
                </div>
                <motion.h2 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-6xl font-black tracking-tighter text-white uppercase italic"
                >
                    MY <span className="text-blue-500">STATS</span>
                </motion.h2>
                <div className="h-0.5 w-24 bg-blue-500/50 mt-4 rounded-full" />
            </header>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1, type: 'spring', damping: 20 }}
                        className="p-8 rounded-[40px] border border-white/5 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden group hover:bg-white/[0.04] transition-all"
                    >
                         <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity ${stat.color.replace('text', 'bg')}`} />
                        
                        <div className="flex items-center justify-between mb-8">
                            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} shadow-lg shadow-black/20`}>
                                {stat.icon}
                            </div>
                        </div>
                        <div className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] mb-1">{stat.label}</div>
                        <div className="text-4xl font-black text-white tracking-tight truncate">{stat.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Insights Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12 mb-12">
                {/* Activity Graph */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-8 p-10 rounded-[48px] border border-white/5 bg-white/[0.01] relative overflow-hidden"
                >
                    <AnalyticsGraph />
                </motion.div>

                {/* Genre Distribution */}
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="lg:col-span-4 p-10 rounded-[48px] border border-white/5 bg-white/[0.01] bg-gradient-to-br from-white/[0.02] to-transparent"
                >
                    <GenreDistribution />
                </motion.div>
            </div>

            {/* Secondary Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {secondaryStats.map((stat, i) => (
                      <motion.div 
                         key={stat.label}
                         initial={{ opacity: 0, y: 20 }}
                         animate={{ opacity: 1, y: 0 }}
                         transition={{ delay: 0.6 + (i * 0.1) }}
                         className="flex items-center gap-6 p-6 rounded-[32px] bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
                     >
                         <div className={`p-3 rounded-xl bg-white/5 ${stat.color} group-hover:scale-110 transition-transform`}>
                             {stat.icon}
                         </div>
                         <div>
                             <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{stat.label}</span>
                             <div className="text-xl font-black text-white truncate max-w-[200px]" title={stat.value}>{stat.value}</div>
                         </div>
                     </motion.div>
                 ))}
            </div>
        </motion.div>
    );
};

// Simple icon component if needed, though we favor lucide
const CheckCircle = ({ size, className }: { size: number, className: string }) => (
    <BookOpen size={size} className={className} />
);
