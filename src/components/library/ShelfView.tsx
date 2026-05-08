import { motion } from 'framer-motion';
import { useRef } from 'react';
import clsx from 'clsx';
import { convertFileSrc } from '@tauri-apps/api/core';

interface ShelfViewProps {
    allSeries: any[];
    onOpenItem: (item: any) => void;
}

export const ShelfView = ({ allSeries, onOpenItem }: ShelfViewProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Group items into rows (shelves)
    const shelfSize = 6;
    const shelves = [];
    for (let i = 0; i < allSeries.length; i += shelfSize) {
        shelves.push(allSeries.slice(i, i + shelfSize));
    }

    return (
        <div 
            ref={containerRef}
            className="pb-32 pt-10 px-8"
            style={{ perspective: '1000px' }}
        >
            <div className="flex flex-col gap-24">
                {shelves.map((shelf, shelfIndex) => (
                    <div key={shelfIndex} className="relative">
                        {/* Shelf Stand (3D Effect) */}
                        <div className="absolute -bottom-4 left-0 right-0 h-6 bg-gradient-to-b from-neutral-800 to-neutral-900 border-t border-white/10 rounded shadow-2xl" 
                             style={{ transform: 'rotateX(45deg)', transformOrigin: 'bottom' }} />
                        <div className="absolute -bottom-8 left-4 right-4 h-4 bg-black/40 blur-md rounded-full shadow-2xl" />

                        <div className="flex justify-start gap-8 items-end px-4">
                            {shelf.map((item) => (
                                <Book 
                                    key={item.id || item.path} 
                                    item={item} 
                                    onClick={() => onOpenItem(item)} 
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Book = ({ item, onClick }: { item: any, onClick: () => void }) => {
    const isSeries = 'books' in item;
    const coverSrc = item?.cover 
        ? (item.cover.startsWith('http') ? item.cover : convertFileSrc(item.cover))
        : null;

    return (
        <motion.div
            className="relative cursor-pointer group"
            whileHover={{ 
                z: 50, 
                rotateY: -15, 
                scale: 1.1,
                y: -10 
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={onClick}
            style={{ 
                transformStyle: 'preserve-3d',
                width: '140px',
                aspectRatio: '2/3'
            }}
        >
            {/* 3D Book Container */}
            <div className="w-full h-full relative" style={{ transformStyle: 'preserve-3d' }}>
                {/* Front Cover */}
                <div className={clsx(
                    "absolute inset-0 z-10 bg-neutral-800 rounded-sm overflow-hidden shadow-2xl border",
                    isSeries ? "border-blue-500/30" : "border-white/5"
                )}>
                    {coverSrc ? (
                        <img src={coverSrc} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                           <span className="text-xs p-2 text-center font-bold uppercase opacity-30">{item.title}</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-white/10" />
                    
                    {isSeries ? (
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">
                            {item.books?.length || 0}
                        </div>
                    ) : item.meta?.chapter ? (
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-neutral-900 border border-white/10 text-white text-[10px] font-bold rounded">
                            CH {item.meta.chapter}
                        </div>
                    ) : null}

                    {/* Progress Bar */}
                    {!isSeries && item.progress && item.progress.totalPages > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40 backdrop-blur-sm">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(item.progress.currentPage / (item.progress.totalPages - 1)) * 100}%` }}
                                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                            />
                        </div>
                    )}
                </div>

                {/* Book Spine (3D Depth) */}
                <div 
                    className={clsx(
                        "absolute top-0 bottom-0 -left-4 w-4 brightness-75 rounded-l-sm",
                        isSeries ? "bg-blue-900" : "bg-neutral-700"
                    )}
                    style={{ 
                        transform: 'rotateY(-90deg)', 
                        transformOrigin: 'right',
                        boxShadow: 'inset -5px 0 10px rgba(0,0,0,0.5)'
                    }}
                />

                {/* Pages Side (Right) */}
                <div 
                    className="absolute top-1 bottom-1 -right-1 w-1 bg-white/80"
                    style={{ 
                        transform: 'rotateY(90deg)', 
                        transformOrigin: 'left'
                    }}
                />
            </div>

            {/* Title Tooltip on Hover */}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none border border-white/10 shadow-xl">
                {item.title}
            </div>
        </motion.div>
    );
};
