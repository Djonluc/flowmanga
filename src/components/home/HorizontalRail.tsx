import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { MangaCard } from '../library/MangaCard';
import { Button } from '../ui/Button';

interface HorizontalRailProps {
    title: string;
    icon?: React.ReactNode;
    items: any[];
    onItemClick: (item: any) => void;
    onViewAll?: () => void;
    onMenuClick?: (item: any, e: React.MouseEvent) => void;
    emptyMessage?: string;
    accentColor?: string;
}

export const HorizontalRail = ({ 
    title, 
    icon, 
    items, 
    onItemClick, 
    onViewAll, 
    onMenuClick,
    emptyMessage = "No items found",
    accentColor = "text-white"
}: HorizontalRailProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const { current } = scrollRef;
            const scrollAmount = direction === 'left' ? -current.offsetWidth / 2 : current.offsetWidth / 2;
            current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between gap-4 px-4 md:px-16">
                <div className="flex min-w-0 items-center gap-3 md:gap-4">
                    {icon && (
                        <div className={`w-10 h-10 flex-shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${accentColor} shadow-lg`}>
                            {icon}
                        </div>
                    )}
                    <h2 className="min-w-0 truncate text-2xl font-black text-white uppercase italic tracking-tight md:text-3xl">{title}</h2>
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
                            <Button variant="ghost" size="sm" className="text-neutral-600 hover:text-white font-black uppercase tracking-widest text-[10px]" onClick={onViewAll}>
                                <span className="hidden sm:inline">VIEW ALL</span> <ArrowRight size={14} className="sm:ml-2" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {items.length > 0 ? (
                <div 
                    ref={scrollRef}
                    className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-8 snap-x snap-mandatory md:gap-6 md:px-16"
                >
                    {items.map((item, idx) => (
                        <motion.div 
                            key={`${item.id}-${idx}`}
                            className="min-w-[160px] snap-start sm:min-w-[200px]"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
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
                        <p className="max-w-[260px] text-center font-black uppercase leading-relaxed tracking-[0.16em] text-xs opacity-60 md:max-w-none md:tracking-[0.2em]">{emptyMessage}</p>
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
