import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { MangaCard } from '../library/MangaCard';
import { Button } from '../ui/Button';

interface HorizontalRailProps {
    title: string;
    items: any[];
    onItemClick: (item: any) => void;
    onMenuClick?: (item: any, e: React.MouseEvent) => void;
    onViewAll?: () => void;
    icon?: React.ReactNode;
    accentColor?: string;
    emptyMessage?: string;
}

export const HorizontalRail = ({ 
    title, 
    items, 
    onItemClick, 
    onMenuClick,
    onViewAll, 
    icon, 
    accentColor = "text-white",
    emptyMessage = "No items to display."
}: HorizontalRailProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const { scrollLeft, clientWidth } = scrollRef.current;
            const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8;
            scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
        }
    };

    return (
        <section className="space-y-8">
            <div className="flex items-center justify-between gap-4 px-4 md:px-16">
                <div className="flex min-w-0 items-center gap-3 md:gap-4">
                    {icon && (
                        <div className={`w-9 h-9 flex-shrink-0 rounded-xl bg-white/5 flex items-center justify-center ${accentColor} opacity-80`}>
                            {icon}
                        </div>
                    )}
                    <h2 className="min-w-0 truncate text-xl font-black text-white uppercase italic tracking-tighter md:text-3xl">{title}</h2>
                </div>
                
                {items.length > 0 && (
                    <div className="flex flex-shrink-0 items-center gap-4">
                        <div className="hidden gap-2 sm:flex">
                            <button 
                                onClick={() => scroll('left')}
                                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                onClick={() => scroll('right')}
                                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        {onViewAll && (
                            <Button variant="ghost" size="sm" className="text-neutral-500 hover:text-white font-medium tracking-wide text-xs" onClick={onViewAll}>
                                <span className="hidden sm:inline">View All</span> <ArrowRight size={14} className="sm:ml-1.5" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {items.length > 0 ? (
                <div 
                    ref={scrollRef}
                    className="flex gap-5 overflow-x-auto no-scrollbar px-4 pb-10 snap-x snap-mandatory md:gap-7 md:px-16"
                >
                    {items.map((item, idx) => (
                        <motion.div 
                            key={`${item.id}-${idx}`}
                            className="min-w-[180px] snap-start sm:min-w-[220px]"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                        >
                            <MangaCard 
                                item={item} 
                                onClick={() => onItemClick(item)} 
                                onMenuClick={onMenuClick ? (e) => onMenuClick(item, e) : undefined}
                                density="compact"
                            />
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="px-4 pb-8 md:px-16">
                     <div className="w-full px-4 py-10 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-neutral-600 gap-4 bg-white/[0.01] md:py-12 md:rounded-[32px]">
                        <p className="max-w-[260px] text-center font-medium leading-relaxed tracking-wide text-xs opacity-60 md:max-w-none">{emptyMessage}</p>
                        {onViewAll && (
                             <Button variant="secondary" size="sm" onClick={onViewAll} className="opacity-50 hover:opacity-100">
                                Explore Library
                             </Button>
                        )}
                     </div>
                </div>
            )}
        </section>
    );
};
