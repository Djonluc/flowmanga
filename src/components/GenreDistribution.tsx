import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAnalyticsStore } from '../stores/useAnalyticsStore';
import { useLibraryStore } from '../stores/useLibraryStore';



const GENRE_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F43F5E', // Rose
    '#84CC16', // Lime
];

export const GenreDistribution = () => {
    const { seriesTime } = useAnalyticsStore();
    const { series } = useLibraryStore();

    const genreStats = useMemo(() => {
        const stats: Record<string, number> = {};
        
        Object.entries(seriesTime).forEach(([seriesId, seconds]) => {
            const s = series.find(item => item.id === seriesId);
            if (s && s.tags) {
                // If a series has tags, distribute time equally among them
                const tags = s.tags.length > 0 ? s.tags : ['Uncategorized'];
                const timePerTag = seconds / tags.length;
                
                tags.forEach(tag => {
                    stats[tag] = (stats[tag] || 0) + timePerTag;
                });
            } else if (seconds > 0) {
                stats['Uncategorized'] = (stats['Uncategorized'] || 0) + seconds;
            }
        });

        const totalSeconds = Object.values(stats).reduce((a, b) => a + b, 0);
        
        return Object.entries(stats)
            .map(([name, seconds], index) => ({
                name,
                seconds,
                color: GENRE_COLORS[index % GENRE_COLORS.length],
                percentage: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0
            }))
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 8); // Top 8 genres
    }, [seriesTime, series]);

    if (genreStats.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 h-full text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-neutral-700" />
                </div>
                <h3 className="text-sm font-black text-neutral-400 uppercase tracking-widest">No Genre Data</h3>
                <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest mt-2">Start reading to see insights</p>
            </div>
        );
    }

    // Donut Chart Params
    const size = 200;
    const strokeWidth = 24;
    const center = size / 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const chartSegments = genreStats.map((stat, index) => {
        const previousPercent = genreStats
            .slice(0, index)
            .reduce((sum, current) => sum + current.percentage, 0);

        return {
            ...stat,
            offset: (previousPercent / 100) * circumference,
        };
    });

    return (
        <div className="flex flex-col gap-8 h-full">
            <h3 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Genre Distribution</h3>
            
            <div className="flex flex-col lg:flex-row items-center gap-12 flex-1">
                {/* Donut Chart */}
                <div className="relative w-[200px] h-[200px] flex-shrink-0 group">
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 drop-shadow-2xl">
                        {chartSegments.map((stat) => (
                            <motion.circle
                                key={stat.name}
                                initial={{ strokeDasharray: `0 ${circumference}` }}
                                animate={{ strokeDasharray: `${(stat.percentage / 100) * circumference} ${circumference}` }}
                                transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="transparent"
                                stroke={stat.color}
                                strokeWidth={strokeWidth}
                                strokeDashoffset={-stat.offset}
                                className="scale-95 origin-center group-hover:scale-100 transition-transform duration-500"
                            />
                        ))}
                    </svg>
                    
                    {/* Center Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-tight">Top Genre</span>
                        <span className="text-xl font-black text-white italic tracking-tighter truncate max-w-[140px] px-2 uppercase">
                            {genreStats[0].name}
                        </span>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {genreStats.map((stat, i) => (
                        <motion.div 
                            key={stat.name}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.8 + (i * 0.1) }}
                            className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors"
                        >
                            <div className="w-2 h-2 rounded-full shadow-lg" style={{ backgroundColor: stat.color, boxShadow: `0 0 10px ${stat.color}44` }} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-black text-white truncate uppercase tracking-tight">{stat.name}</span>
                                    <span className="text-[9px] font-black text-neutral-500">{Math.round(stat.percentage)}%</span>
                                </div>
                                <div className="mt-1 h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                                     <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${stat.percentage}%` }}
                                        transition={{ delay: 1 + (i * 0.1), duration: 0.8 }}
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: stat.color }}
                                     />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};
