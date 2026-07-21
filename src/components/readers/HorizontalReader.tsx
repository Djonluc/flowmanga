import { useEffect } from 'react';
import { useReadingStore } from '../../stores/useReadingStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';

export const HorizontalReader = () => {
  const { images, currentPageIndex: currentIndex, nextPage, prevPage } = useReadingStore();
  const { readingDirection, fitMode, isAutoScrolling, slideshowInterval } = useSettingsStore();

  // Auto-advance logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isAutoScrolling) {
      interval = setInterval(() => {
          nextPage();
      }, slideshowInterval);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [isAutoScrolling, slideshowInterval, nextPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
         readingDirection === 'ltr' ? nextPage() : prevPage();
      } else if (e.key === 'ArrowLeft') {
         readingDirection === 'ltr' ? prevPage() : nextPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage, readingDirection]);

  const currentImage = images[currentIndex];
  
  if (!currentImage) return null;

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden group">
      {/* Navigation Zones */}
      <button type="button" aria-label="Previous page" className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer" onClick={() => readingDirection === 'ltr' ? prevPage() : nextPage()} title="Previous" />
      <button type="button" aria-label="Next page" className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer" onClick={() => readingDirection === 'ltr' ? nextPage() : prevPage()} title="Next" />
      
      {/* Navigation Indicators */}
      <button 
        className="absolute left-4 z-20 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
        onClick={() => readingDirection === 'ltr' ? prevPage() : nextPage()}
      >
        <ChevronLeft size={32} />
      </button>

      <button 
        className="absolute right-4 z-20 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
        onClick={() => readingDirection === 'ltr' ? nextPage() : prevPage()}
      >
        <ChevronRight size={32} />
      </button>

      {/* Image Render */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={currentImage}
          src={currentImage?.startsWith('http') ? currentImage : convertFileSrc(currentImage)}
          alt={`Page ${currentIndex + 1}`}
          initial={{ opacity: 0, x: readingDirection === 'ltr' ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: readingDirection === 'ltr' ? -20 : 20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`max-w-full max-h-full shadow-2xl ${fitMode === 'width' ? 'w-full object-contain' : fitMode === 'height' ? 'h-full object-contain' : 'object-contain'}`}
        />
      </AnimatePresence>

      {/* Page Number */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-black/50 rounded-full text-white text-sm backdrop-blur-sm">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}
