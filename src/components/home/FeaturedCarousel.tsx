import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useReadingStore } from '../../stores/useReadingStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { Series } from '../../stores/useLibraryStore';
import { Button } from '../ui/Button';

type FeaturedSeries = Series & { coverUrl?: string };

export const FeaturedCarousel = () => {
    const { series } = useLibraryStore();
    const { openFolder } = useReadingStore();
    const [currentIndex, setCurrentIndex] = useState(0);
    const featuredItems = useMemo<FeaturedSeries[]>(() => {
        if (series.length === 0) return [];
        return [...series]
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
            .slice(0, 5);
    }, [series]);

    const nextSlide = () => {
        if (featuredItems.length <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
    };

    const prevSlide = () => {
        if (featuredItems.length <= 1) return;
        setCurrentIndex((prev) => (prev - 1 + featuredItems.length) % featuredItems.length);
    };

    useEffect(() => {
        if (featuredItems.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % featuredItems.length);
        }, 8000);
        return () => clearInterval(timer);
    }, [featuredItems.length]);

    if (featuredItems.length === 0) return null;

    const currentItem = featuredItems[Math.min(currentIndex, featuredItems.length - 1)];

    return (
        <div className="relative h-[60vh] min-h-[500px] w-full mb-12 overflow-hidden group">
            {/* Ambient Background Layer */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentItem.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0 z-0"
                >
                    {(currentItem.cover || currentItem.coverUrl) ? (
                        <img 
                            src={(currentItem.cover || currentItem.coverUrl).startsWith('http') ? (currentItem.cover || currentItem.coverUrl) : convertFileSrc(currentItem.cover || currentItem.coverUrl)} 
                            className="w-full h-full object-cover opacity-50 scale-100" 
                            alt="Background"
                        />
                    ) : (
                        <div className="w-full h-full bg-neutral-900" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0A0A0A] to-transparent pointer-events-none" />
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#0A0A0A] to-transparent pointer-events-none" />
                </motion.div>
            </AnimatePresence>

            {/* Content Layer */}
            <div className="absolute inset-0 z-10 flex flex-col justify-end p-16 max-w-7xl mx-auto w-full">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentItem.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="space-y-6 max-w-2xl"
                    >
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-accent/20 border border-accent/20 text-accent rounded-full text-[10px] font-black uppercase tracking-widest">
                                Featured Series
                            </span>
                            {currentItem.tags?.[0] && (
                                <span className="px-3 py-1 bg-white/5 border border-white/10 text-neutral-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    {currentItem.tags[0]}
                                </span>
                            )}
                        </div>

                        <h1 className="text-6xl md:text-7xl font-black text-white leading-[0.9] tracking-tighter uppercase italic line-clamp-2">
                            {currentItem.title}
                        </h1>

                        <p className="text-neutral-400 font-medium text-sm leading-relaxed max-w-xl line-clamp-3">
                            {currentItem.description || "No description available for this series."}
                        </p>

                        <div className="flex items-center gap-4 pt-4">
                            <Button 
                                size="lg" 
                                className="h-14 px-8 text-sm shadow-2xl shadow-accent/20 hover:scale-105" 
                                onClick={() => {
                                    if (currentItem.books && currentItem.books.length > 0) {
                                        // Find first book with progress or just first book
                                        const bookToOpen = currentItem.books.find((b) => 
                                            b.progress && b.progress.currentPage < b.progress.totalPages
                                        ) || currentItem.books[0];
                                        openFolder(bookToOpen.path, currentItem.id, bookToOpen.id);
                                    }
                                }}
                            >
                                <Play size={20} fill="currentColor" className="mr-3" /> READ NOW
                            </Button>
                            <Button 
                                variant="secondary" 
                                size="lg" 
                                className="h-14 px-8 text-sm bg-white/5 border-white/10 hover:bg-white/10"
                                onClick={() => {
                                    useLibraryStore.getState().setSelectedSeriesId(currentItem.id);
                                    useSettingsStore.getState().setActiveView('library');
                                }}
                            >
                                <Info size={20} className="mr-3" /> DETAILS
                            </Button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Controls */}
            <div className="absolute bottom-16 right-16 z-20 flex gap-2">
                <button 
                    onClick={prevSlide}
                    className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-md"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-1 px-2">
                    {featuredItems.map((_, idx) => (
                        <div 
                            key={idx}
                            className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-accent' : 'w-2 bg-white/20'}`} 
                        />
                    ))}
                </div>
                <button 
                    onClick={nextSlide}
                    className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-md"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Cover Art Spotlight (Right Side) */}
            <div className="absolute right-32 top-1/2 -translate-y-1/2 z-0 hidden lg:block opacity-100 mix-blend-normal pointer-events-none">
                 <AnimatePresence mode="wait">
                    <motion.div
                        key={currentItem.id}
                        initial={{ opacity: 0, x: 100, rotate: 10 }}
                        animate={{ opacity: 1, x: 0, rotate: 6 }}
                        exit={{ opacity: 0, x: -100, rotate: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                         {(currentItem.cover || currentItem.coverUrl) && (
                            <img 
                                src={(currentItem.cover || currentItem.coverUrl).startsWith('http') ? (currentItem.cover || currentItem.coverUrl) : convertFileSrc(currentItem.cover || currentItem.coverUrl)} 
                                className="h-[600px] w-auto rounded-[40px] shadow-2xl rotate-6" 
                                alt="Cover Art"
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
