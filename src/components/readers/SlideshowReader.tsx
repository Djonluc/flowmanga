import { useEffect, useRef } from 'react';
import { useReadingStore } from '../../stores/useReadingStore';
import { useReaderStore } from '../../stores/useReaderStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { SmartImage } from '../SmartImage';
import { motion, AnimatePresence } from 'framer-motion';
import { FastForward, Rewind } from 'lucide-react';
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

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
    }, [slideshowActive, slideshowInterval, setCurrentPage]);

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

    const transitions: Record<string, { initial: any, animate: any, exit: any, transition: any }> = {
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
        </div>
    );
};
