/**
 * SlideshowPlayer
 * 
 * Cinematic fullscreen slideshow with autoplay, transitions,
 * keyboard navigation, and ambient glow.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, SkipForward, SkipBack, Shuffle } from 'lucide-react';
import { useGalleryStore } from '../../stores/useGalleryStore';

export const SlideshowPlayer: React.FC = () => {
  const {
    isSlideshowPlaying, slideshowImages, slideshowIndex,
    activeSlideshowId, slideshows,
    nextSlide, prevSlide, stopSlideshow
  } = useGalleryStore();

  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlTimer = useRef<any>(null);
  const autoTimer = useRef<any>(null);

  const activeShow = slideshows.find(s => s.id === activeSlideshowId);
  const interval = activeShow?.interval || 5000;
  const currentImage = slideshowImages[slideshowIndex];

  // Auto-advance
  useEffect(() => {
    if (!isSlideshowPlaying || isPaused || !activeShow) return;
    autoTimer.current = setInterval(() => nextSlide(), interval);
    return () => clearInterval(autoTimer.current);
  }, [isSlideshowPlaying, isPaused, interval, slideshowIndex, nextSlide, activeShow]);

  // Auto-hide controls
  const refreshControls = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlTimer.current);
    controlTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    if (!isSlideshowPlaying) return;
    refreshControls();
    return () => clearTimeout(controlTimer.current);
  }, [isSlideshowPlaying, slideshowIndex, refreshControls]);

  // Keyboard
  useEffect(() => {
    if (!isSlideshowPlaying) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': stopSlideshow(); break;
        case 'ArrowRight': case ' ': nextSlide(); refreshControls(); break;
        case 'ArrowLeft': prevSlide(); refreshControls(); break;
        case 'p': case 'P': setIsPaused(p => !p); refreshControls(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSlideshowPlaying, stopSlideshow, nextSlide, prevSlide, refreshControls]);

  if (!isSlideshowPlaying || !currentImage) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[9998] bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseMove={refreshControls}
    >
      {/* Ambient Background (blurred version of current image) */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={currentImage.previewUrl || currentImage.imageUrl}
          className="w-full h-full object-cover scale-125 blur-[80px] opacity-30"
          alt=""
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Main Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slideshowIndex}
          className="absolute inset-0 flex items-center justify-center p-8"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src={currentImage.imageUrl}
            alt={currentImage.tags?.[0] || ''}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </motion.div>
      </AnimatePresence>

      {/* Controls Overlay */}
      <motion.div
        className={`absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-500 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-lg mx-auto">
          {/* Progress Bar */}
          <div className="w-full h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
            <motion.div
              className="h-full bg-purple-500 rounded-full"
              style={{ width: `${((slideshowIndex + 1) / slideshowImages.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => prevSlide()}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">
              <SkipBack size={18} />
            </button>
            <button onClick={() => setIsPaused(p => !p)}
              className="p-4 rounded-2xl bg-purple-600/80 hover:bg-purple-600 text-white transition-all shadow-lg shadow-purple-500/20">
              {isPaused ? <Play size={22} /> : <Pause size={22} />}
            </button>
            <button onClick={() => nextSlide()}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all">
              <SkipForward size={18} />
            </button>
          </div>

          {/* Info */}
          <div className="text-center mt-4">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
              {slideshowIndex + 1} / {slideshowImages.length}
              {activeShow && ` · ${activeShow.name}`}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Close */}
      <button onClick={stopSlideshow}
        className={`absolute top-6 right-6 z-50 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}>
        <X size={20} />
      </button>
    </motion.div>
  );
};
