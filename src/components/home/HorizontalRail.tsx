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
            <div className="flex items-center justify-between px-16">
                <div className="flex items-center gap-4">
                    {icon && (
                        <div className={`w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${accentColor} shadow-lg`}>
                            {icon}
                        </div>
                    )}
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tight">{title}</h2>
                </div>
                
                {items.length > 0 && (
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
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
                                VIEW ALL <ArrowRight size={14} className="ml-2" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {items.length > 0 ? (
                <div 
                    ref={scrollRef}
                    className="flex gap-6 overflow-x-auto no-scrollbar px-16 pb-8 snap-x snap-mandatory"
                >
                    {items.map((item, idx) => (
                        <motion.div 
                            key={item.id || idx}
                            className="min-w-[200px] snap-start"
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
                <div className="px-16 pb-8">
                     <div className="w-full py-12 border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-neutral-600 gap-4 bg-white/[0.01]">
                        <p className="font-black uppercase tracking-[0.2em] text-xs opacity-60">{emptyMessage}</p>
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
