import { motion } from 'framer-motion';
import { useAnalyticsStore } from '../stores/useAnalyticsStore';

export const ActivityHeatmap = () => {
    const { getLastThirtyDays } = useAnalyticsStore();
    const data = getLastThirtyDays();

    const maxPages = Math.max(...data.map(d => d.pages), 1);

    const getIntensity = (pages: number) => {
        if (pages === 0) return 'bg-white/5';
        const ratio = pages / maxPages;
        if (ratio < 0.25) return 'bg-blue-500/20';
        if (ratio < 0.5) return 'bg-blue-500/40';
        if (ratio < 0.75) return 'bg-blue-500/70 shadow-[0_0_10px_rgba(59,130,246,0.3)]';
        return 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]';
    };

    return (
        <div className="mt-8 border-t border-white/5 pt-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-foreground-dim uppercase tracking-widest">30-Day Activity Heatmap</h3>
                <div className="flex items-center gap-1">
                    <span className="text-[8px] font-black text-foreground-muted uppercase mr-1">Less</span>
                    <div className="w-1.5 h-1.5 rounded-sm bg-white/5" />
                    <div className="w-1.5 h-1.5 rounded-sm bg-blue-500/20" />
                    <div className="w-1.5 h-1.5 rounded-sm bg-blue-500/50" />
                    <div className="w-1.5 h-1.5 rounded-sm bg-blue-500" />
                    <span className="text-[8px] font-black text-foreground-muted uppercase ml-1">More</span>
                </div>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
                {data.map((day, i) => (
                    <motion.div
                        key={day.date}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className={`w-4 h-4 rounded-sm ${getIntensity(day.pages)} transition-all group relative`}
                    >
                         {/* Tooltip */}
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-white text-black text-[8px] font-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                            {day.pages} pages on {new Date(day.date).toLocaleDateString()}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
