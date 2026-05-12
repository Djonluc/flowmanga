import { motion } from 'framer-motion';
import { useAnalyticsStore } from '../stores/useAnalyticsStore';
import { ActivityHeatmap } from './ActivityHeatmap';

export const AnalyticsGraph = () => {
    const { getLastSevenDays } = useAnalyticsStore();
    const data = getLastSevenDays();

    // Calculate scaling
    const maxPages = Math.max(...data.map(d => d.pages), 10); // Minimum scale of 10
    const chartHeight = 120;

    return (
        <div className="w-full flex flex-col gap-6">
            {/* Header / Legend */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-foreground italic uppercase tracking-widest">Consistency</h3>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-tighter">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <span className="text-foreground-dim">Pages Read (Weekly)</span>
                    </div>
                </div>
            </div>

            {/* SVG Chart */}
            <div className="relative h-[160px] w-full flex items-end justify-between px-2">
                {data.map((day, i) => {
                    const height = (day.pages / maxPages) * chartHeight;
                    const date = new Date(day.date);
                    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });

                    return (
                        <div key={day.date} className="flex flex-col items-center gap-3 flex-1">
                            {/* Bar Container */}
                            <div className="relative w-full flex items-end justify-center group h-[120px]">
                                {/* Tooltip on Hover */}
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-white text-black text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                    {day.pages} pages
                                </div>
                                
                                <motion.div 
                                    initial={{ height: 0 }}
                                    animate={{ height: `${height}px` }}
                                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 100, damping: 15 }}
                                    className="w-10 rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-400 relative group-hover:from-blue-500 group-hover:to-cyan-400 transition-colors shadow-lg shadow-blue-500/10"
                                >
                                    {/* Glass reflection */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent w-1/3" />
                                </motion.div>
                            </div>

                            {/* Label */}
                            <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest">
                                {dayLabel}
                            </span>
                        </div>
                    );
                })}

                {/* Grid Lines (Background) */}
                <div className="absolute inset-x-0 bottom-[40px] flex flex-col justify-between h-[120px] -z-10 opacity-20 pointer-events-none">
                    <div className="w-full h-px bg-white/10" />
                    <div className="w-full h-px bg-white/10" />
                    <div className="w-full h-px bg-white/10" />
                    <div className="w-full h-px bg-white/10" />
                </div>
            </div>

            <ActivityHeatmap />
        </div>
    );
};
