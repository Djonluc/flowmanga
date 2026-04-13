import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReadingStore } from '../../stores/useReadingStore';
import { useReaderStore } from '../../stores/useReaderStore';
import { convertFileSrc } from '@tauri-apps/api/core';

export const ReaderBottomBar = ({ visible }: { visible: boolean }) => {
    const { currentPageIndex: currentIndex, images, setPageIndex: setPage } = useReadingStore();
    const { 
        setCurrentPage: setReaderPage,
        mode,
        slideshowActive,
        setSlideshowActive
    } = useReaderStore();
    const totalPages = images.length;
    
    const [hoverProgress, setHoverProgress] = useState<number | null>(null);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const barRef = useRef<HTMLDivElement>(null);

    const progress = totalPages > 0 ? ((currentIndex + 1) / totalPages) * 100 : 0;

    const getIndexFromEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!barRef.current) return null;
        const rect = barRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const p = x / rect.width;
        return {
            progress: p * 100,
            index: Math.max(0, Math.min(totalPages - 1, Math.floor(p * totalPages)))
        };
    }, [totalPages]);

    /**
     * Core navigation function that synchronizes BOTH stores.
     * This is critical for slideshow/single page modes which read
     * from useReaderStore.currentPage, while useReadingStore is the
     * source of truth for progress persistence.
     */
    const navigateToPage = useCallback((index: number) => {
        // Update the reading store (source of truth for persistence)
        setPage(index);
        // Also update the reader store (consumed by Slideshow + SinglePage readers)
        setReaderPage(index);

        // If slideshow is active, briefly pause and restart so the timer
        // resets from the new position instead of jumping back
        if (mode === 'slideshow' && slideshowActive) {
            setSlideshowActive(false);
            // Restart after a tick to let state settle
            setTimeout(() => setSlideshowActive(true), 50);
        }
    }, [setPage, setReaderPage, mode, slideshowActive, setSlideshowActive]);

    const handleMouseMove = (e: React.MouseEvent) => {
        const result = getIndexFromEvent(e);
        if (!result) return;
        setHoverProgress(result.progress);
        setPreviewIndex(result.index);
        
        // If dragging, actively update the page
        if (isDragging) {
            navigateToPage(result.index);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        const result = getIndexFromEvent(e);
        if (result) {
            navigateToPage(result.index);
        }

        const handleGlobalMove = (ev: MouseEvent) => {
            const r = getIndexFromEvent(ev);
            if (r) {
                navigateToPage(r.index);
                setHoverProgress(r.progress);
                setPreviewIndex(r.index);
            }
        };

        const handleGlobalUp = () => {
            setIsDragging(false);
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
        };

        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('mouseup', handleGlobalUp);
    };

    const handleClick = (e: React.MouseEvent) => {
        // Only handle click if not from a drag operation
        if (isDragging) return;
        const result = getIndexFromEvent(e);
        if (result) {
            navigateToPage(result.index);
        }
    };

    // Get page image src (handles both local and remote)
    const getPreviewSrc = (index: number): string => {
        const img = images[index];
        if (!img) return '';
        try {
            return img.startsWith('http') ? img : convertFileSrc(img);
        } catch {
            return '';
        }
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: -12, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.95 }}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[55] w-full max-w-[90%] md:max-w-4xl px-8 py-4 bg-black/40 backdrop-blur-[64px] border border-white/10 rounded-[40px] shadow-[0_-32px_128px_rgba(0,0,0,0.6)] flex items-center gap-8 pointer-events-auto"
                >
                    {/* Left Stats */}
                    <div className="flex flex-col items-start gap-0 min-w-[80px]">
                        <span className="text-[8px] font-black text-accent uppercase tracking-[0.4em]">Progress</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-white italic tracking-tighter">{currentIndex + 1}</span>
                            <span className="text-[10px] font-bold text-neutral-500">/ {totalPages}</span>
                        </div>
                    </div>

                    {/* Progress Slider Body */}
                    <div className="flex-1 relative group">
                        {/* Preview Thumbnail */}
                        <AnimatePresence>
                            {previewIndex !== null && hoverProgress !== null && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20, scale: 0.8 }}
                                    animate={{ opacity: 1, y: -40, scale: 1 }}
                                    exit={{ opacity: 0, y: -20, scale: 0.8 }}
                                    className="absolute bottom-12 z-50 pointer-events-none"
                                    style={{ left: `${hoverProgress}%`, transform: 'translateX(-50%)' }}
                                >
                                    <div className="bg-neutral-900/90 backdrop-blur-2xl border border-white/10 p-2 rounded-[24px] shadow-[0_32px_96px_rgba(0,0,0,0.8)] flex flex-col items-center gap-2">
                                        <div className="w-40 aspect-[3/4] overflow-hidden rounded-[16px] bg-black ring-1 ring-white/10">
                                            {images[previewIndex] && (
                                                <img 
                                                    src={getPreviewSrc(previewIndex)} 
                                                    className="w-full h-full object-cover"
                                                    alt="Preview"
                                                />
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center py-1">
                                            <span className="text-[8px] font-black text-white uppercase tracking-[0.3em]">
                                                Page {previewIndex + 1}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-[8px] border-transparent border-t-neutral-900/90" />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div 
                            ref={barRef}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={() => { if (!isDragging) { setHoverProgress(null); setPreviewIndex(null); } }}
                            onMouseDown={handleMouseDown}
                            onClick={handleClick}
                            className="relative h-12 flex items-center cursor-pointer select-none"
                        >
                            {/* Track */}
                            <div className="absolute inset-x-0 h-[3px] bg-white/5 rounded-full overflow-hidden transition-all group-hover:h-2">
                                {/* Current Progress */}
                                <motion.div 
                                    className="absolute inset-y-0 left-0 bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)] rounded-full z-10"
                                    initial={false}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                                />
                                {/* Hover Shadow */}
                                {hoverProgress !== null && (
                                    <div 
                                        className="absolute inset-y-0 left-0 bg-white/10 rounded-full z-0"
                                        style={{ width: `${hoverProgress}%` }}
                                    />
                                )}
                            </div>

                            {/* Handle Point */}
                            <motion.div
                                className={`absolute w-4 h-4 bg-white border-4 border-blue-500 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] z-20 pointer-events-none transition-opacity ${isDragging ? 'opacity-100 scale-125' : 'opacity-0 group-hover:opacity-100'}`}
                                animate={{ left: `${progress}%` }}
                                transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                                style={{ transform: 'translateX(-50%)' }}
                            />
                        </div>
                    </div>

                    {/* Right Percentage */}
                    <div className="text-right flex flex-col items-end min-w-[80px]">
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em]">Completion</span>
                        <span className="text-xl font-black text-blue-500 italic tracking-tighter">{Math.round(progress)}%</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
