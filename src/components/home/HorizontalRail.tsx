import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight, RefreshCcw } from 'lucide-react';
import { MangaCard } from '../library/MangaCard';
import { Button } from '../ui/Button';
import clsx from 'clsx';

interface HorizontalRailProps {
    title: string;
    editorialTitle?: string;
    subtitle?: string;
    items: any[];
    onItemClick: (item: any) => void;
    onMenuClick?: (item: any, e: React.MouseEvent) => void;
    onViewAll?: () => void;
    icon?: React.ReactNode;
    variant?: 'portrait' | 'landscape';
    layout?: 'standard' | 'featured-first' | 'masonry';
    isScreenshotMode?: boolean;
    accentColor?: string;
    emptyMessage?: string;
    onRefresh?: () => void;
}

export const HorizontalRail = ({ 
    title,
    editorialTitle,
    subtitle,
    items, 
    onItemClick, 
    onMenuClick,
    onViewAll, 
    icon, 
    variant = 'portrait',
    layout = 'standard',
    isScreenshotMode = false,
    accentColor = "text-foreground",
    emptyMessage = "No items to display.",
    onRefresh
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
                <div className="flex flex-col min-w-0 z-10 relative">
                    {editorialTitle ? (
                        <div className="flex items-center justify-between mb-1">
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "w-10 h-10 rounded-2xl bg-surface-elevated border border-border-subtle flex items-center justify-center shadow-lg",
                                        accentColor
                                    )}>
                                        {icon}
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-none">
                                        {editorialTitle}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2 mt-3 ml-[52px]">
                                    <span className={clsx("text-[10px] font-black tracking-widest uppercase", accentColor)}>{title}</span>
                                    {subtitle && (
                                        <>
                                            <div className="w-px h-3 bg-border-subtle mx-1" />
                                            <p className="text-foreground-dim font-medium text-xs tracking-wide">
                                                {subtitle}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            {icon && (
                                <div className={clsx(
                                    "w-10 h-10 rounded-2xl bg-surface-elevated border border-border-subtle flex items-center justify-center shadow-lg",
                                    accentColor
                                )}>
                                    {icon}
                                </div>
                            )}
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground leading-none">{title}</h2>
                                {subtitle && <p className="text-foreground-dim font-medium text-xs tracking-wide mt-1">{subtitle}</p>}
                            </div>
                        </div>
                    )}
                </div>
                
                {items.length > 0 && (
                    <div className="flex flex-shrink-0 items-center gap-4">
                        {onRefresh && (
                            <button 
                                onClick={onRefresh}
                                className="w-8 h-8 rounded-full bg-surface-elevated border border-border-subtle flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-all active:scale-90"
                                title="Refresh/Randomize"
                            >
                                <RefreshCcw size={14} className="hover:rotate-180 transition-transform duration-500" />
                            </button>
                        )}
                        {layout !== 'masonry' && (
                        <div className="hidden gap-2 sm:flex">
                            <button 
                                onClick={() => scroll('left')}
                                className="w-8 h-8 rounded-full bg-surface-elevated border border-border-subtle flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                onClick={() => scroll('right')}
                                className="w-8 h-8 rounded-full bg-surface-elevated border border-border-subtle flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        )}
                        {onViewAll && (
                            <Button variant="ghost" size="sm" className="text-foreground-dim hover:text-foreground font-medium tracking-wide text-xs" onClick={onViewAll}>
                                <span className="hidden sm:inline">View All</span> <ArrowRight size={14} className="sm:ml-1.5" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {items.length > 0 ? (
                layout === 'masonry' ? (
                    <div className="flex flex-col xl:flex-row xl:items-stretch gap-6 xl:gap-10 px-4 sm:px-6 md:px-16 pb-12 pt-4 transition-all duration-300 w-full">
                        {/* Hero Item */}
                        {items[0] && (
                            <motion.div 
                                className="w-full xl:w-[38%] 2xl:w-[32%] flex-shrink-0 flex flex-col min-w-0"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <MangaCard 
                                    item={items[0]} 
                                    onClick={() => onItemClick(items[0])} 
                                    onMenuClick={onMenuClick ? (e) => onMenuClick(items[0], e) : undefined}
                                    variant="featured"
                                    orientation="portrait"
                                />
                            </motion.div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 2xl:gap-8 w-full min-w-0 xl:flex-1 content-start">
                            {(isScreenshotMode ? items.slice(1) : items.slice(1, 9)).map((item, idx) => (
                                <motion.div 
                                    key={`${item.id}-${idx}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="min-w-0 w-full flex flex-col"
                                >
                                    <MangaCard 
                                        item={item} 
                                        onClick={() => onItemClick(item)} 
                                        onMenuClick={onMenuClick ? (e) => onMenuClick(item, e) : undefined}
                                        variant="standard"
                                        orientation="portrait"
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="relative w-full group/rail">
                        {/* Fade overlay on the right edge */}
                        {!isScreenshotMode && (
                            <div className="absolute right-0 top-0 bottom-12 w-12 md:w-32 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 transition-opacity opacity-0 group-hover/rail:opacity-100" />
                        )}
                        <div 
                            ref={scrollRef}
                            className={clsx(
                                "flex items-stretch gap-4 sm:gap-5 md:gap-8 px-4 sm:px-6 md:px-16 pb-12 pt-4 transition-all duration-300 w-full",
                                isScreenshotMode 
                                    ? "flex-wrap justify-center overflow-visible" 
                                    : "overflow-x-auto no-scrollbar snap-x snap-mandatory"
                            )}
                        >
                        {layout === 'featured-first' && items[0] && (
                            <motion.div 
                                className="min-w-[280px] sm:min-w-[360px] lg:min-w-[420px] 2xl:min-w-[480px] snap-start"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                            >
                                <MangaCard 
                                    item={items[0]} 
                                    onClick={() => onItemClick(items[0])} 
                                    onMenuClick={onMenuClick ? (e) => onMenuClick(items[0], e) : undefined}
                                    variant="featured"
                                    orientation={variant}
                                />
                            </motion.div>
                        )}
                        
                        {(layout === 'featured-first' ? items.slice(1) : items).map((item, idx) => (
                            <motion.div 
                                key={`${item.id}-${idx}`}
                                className={clsx(
                                    "transition-all duration-300 flex flex-col",
                                    !isScreenshotMode && "snap-start",
                                    variant === 'landscape' 
                                        ? "w-[280px] sm:w-[340px] lg:w-[400px] flex-shrink-0" 
                                        : "w-[156px] sm:w-[176px] md:w-[204px] lg:w-[216px] 2xl:w-[232px] flex-shrink-0"
                                )}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                            >
                                <div className="w-full flex-1 min-h-0 flex flex-col">
                                <MangaCard 
                                    item={item} 
                                    onClick={() => onItemClick(item)} 
                                    onMenuClick={onMenuClick ? (e) => onMenuClick(item, e) : undefined}
                                    variant="standard"
                                    orientation={variant}
                                />
                                </div>
                            </motion.div>
                        ))}
                        
                        {/* Edge spacer to allow over-scrolling past the last card */}
                        {!isScreenshotMode && (
                            <div className="min-w-[1px] md:min-w-[32px] snap-end flex-shrink-0" />
                        )}
                    </div>
                    </div>
                )
            ) : (
                <div className="px-4 pb-8 md:px-16">
                     <div className="w-full px-4 py-10 border-2 border-dashed border-border-subtle rounded-2xl flex flex-col items-center justify-center text-foreground-dim gap-4 bg-surface-elevated md:py-12 md:rounded-[32px]">
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
