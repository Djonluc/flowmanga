import { useEffect, useRef, useState } from 'react';
import { useReadingStore } from '../../stores/useReadingStore';
import { useReaderStore } from '../../stores/useReaderStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { SmartImage } from '../SmartImage';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, FastForward, Rewind } from 'lucide-react';
import clsx from 'clsx';

export const SlideshowReader = () => {
    const { images } = useReadingStore();
    const { 
        slideshowActive, 
        currentPage, 
        setCurrentPage, 
        setSlideshowActive,
        totalPages 
    } = useReaderStore();
    
    const { slideshowInterval, slideshowTransition } = useSettingsStore();
    const [showHud, setShowHud] = useState(false);
    const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Trigger HUD on state change
    useEffect(() => {
        setShowHud(true);
        if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
        hudTimeoutRef.current = setTimeout(() => setShowHud(false), 800);
    }, [slideshowActive]);

    // SLIDESHOW ENGINE
    useEffect(() => {
        if (!slideshowActive) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        intervalRef.current = setInterval(() => {
            const next = useReaderStore.getState().currentPage + 1;
            setCurrentPage(next);
            useReadingStore.getState().setPageIndex(next);
        }, slideshowInterval); 

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [slideshowActive, slideshowInterval]);

    // End of Chapter Check
    useEffect(() => {
        if (currentPage >= totalPages && totalPages > 0) {
            const store = useReadingStore.getState();
            if (store.currentChapterIndex + 1 < store.chapters.length) {
                store.goToNextChapter();
            } else {
                setSlideshowActive(false);
                setCurrentPage(totalPages - 1);
                useReadingStore.getState().setPageIndex(totalPages - 1);
            }
        }
    }, [currentPage, totalPages, setSlideshowActive, setCurrentPage]);

    const currentImage = images[currentPage];
    if (!currentImage) return null;

    const transitions: Record<string, any> = {
        fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.8 } },
        slide: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '-100%' }, transition: { duration: 0.5, ease: "easeInOut" } },
        none: { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } },
    };
    
    const activeTransition = transitions[slideshowTransition] || transitions.fade;

    const togglePlayback = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSlideshowActive(!slideshowActive);
    };

    const nextSlide = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentPage < totalPages - 1) {
            setCurrentPage(currentPage + 1);
            useReadingStore.getState().setPageIndex(currentPage + 1);
        }
    };

    const prevSlide = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
            useReadingStore.getState().setPageIndex(currentPage - 1);
        }
    };

    return (
        <div 
            className="slideshow-reader w-full h-full flex items-center justify-center bg-transparent overflow-hidden relative cursor-pointer"
            onClick={togglePlayback}
        >
            <AnimatePresence mode="wait">
                <motion.div
                   key={currentImage}
                   {...activeTransition}
                   className="w-full h-full flex items-center justify-center px-4"
                >
                    <SmartImage
                        src={currentImage.startsWith('http') ? currentImage : convertFileSrc(currentImage)}
                        alt={`Slide ${currentPage + 1}`}
                        className="max-w-full max-h-full object-contain shadow-2xl"
                    />
                </motion.div>
            </AnimatePresence>

            {/* Play/Pause HUD Overlay */}
            <AnimatePresence>
                {showHud && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.5 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                    >
                        <div className="w-24 h-24 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white">
                            {slideshowActive ? <Play size={40} fill="currentColor" /> : <Pause size={40} fill="currentColor" />}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Quick Navigation Zones */}
            <div className="absolute inset-y-0 left-0 w-1/4 group cursor-west-resize" onClick={prevSlide}>
                <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Rewind size={32} className="text-foreground opacity-50" />
                </div>
            </div>
            <div className="absolute inset-y-0 right-0 w-1/4 group cursor-east-resize" onClick={nextSlide}>
                <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <FastForward size={32} className="text-foreground opacity-50" />
                </div>
            </div>
            
            {/* Status Indicator */}
            <div className="absolute bottom-10 left-10 flex items-center gap-3 bg-black/60 backdrop-blur-2xl border border-white/10 px-6 py-3 rounded-full shadow-2xl z-40">
                <div className={clsx("w-2 h-2 rounded-full", slideshowActive ? "bg-green-500 animate-pulse" : "bg-yellow-500")} />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] leading-none">
                        Slideshow {slideshowActive ? 'Active' : 'Paused'}
                    </span>
                    <span className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest mt-1">
                        Interval: {(slideshowInterval / 1000).toFixed(1)}s <span className="text-foreground/20 px-1">•</span> Page {currentPage + 1}/{totalPages}
                    </span>
                </div>
            </div>
        </div>
    );
};
