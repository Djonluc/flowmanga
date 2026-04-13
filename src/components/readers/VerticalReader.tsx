import React, { useEffect, useRef } from 'react';
import { useReadingStore } from '../../stores/useReadingStore';
import { useReaderStore } from '../../stores/useReaderStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import clsx from 'clsx';
import { SmartImage } from '../SmartImage';
import { motion } from 'framer-motion';

export const VerticalReader = () => {
  const { images } = useReadingStore();
  const { autoScroll, scrollSpeed, setAutoScroll, isBoosted, imageFit, zoomLevel } = useReaderStore();
  const { gapSize } = useSettingsStore();
  const readerRef = useRef<HTMLDivElement>(null);
  
  const actualSpeed = isBoosted ? scrollSpeed * 4 : scrollSpeed;

  const getPageStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
        paddingTop: `${gapSize / 2}px`,
        paddingBottom: `${gapSize / 2}px`
    };

    if (imageFit === 'width' || imageFit === 'stretch') {
        return { ...baseStyle, width: '100%', display: 'flex', justifyContent: 'center' };
    }
    return { ...baseStyle, display: 'flex', justifyContent: 'center' };
  };

  const getImageClass = () => {
    switch (imageFit) {
        case 'width': return "w-full h-auto object-contain";
        case 'stretch': return "w-full h-full object-fill";
        case 'height': return "h-screen w-auto object-contain";
        case 'original': return "w-auto h-auto";
        default: return "max-w-full h-auto object-contain";
    }
  };
  
  // V2 AUTO-SCROLL ENGINE
  useEffect(() => {
    if (!autoScroll || !readerRef.current) return;

    let frameId: number;
    let lastTime = performance.now();

    const scrollStep = (time: number) => {
        const delta = time - lastTime;
        lastTime = time;

        const pixels = (actualSpeed / 1000) * delta;
        const container = readerRef.current!;
        const maxScroll = container.scrollHeight - container.clientHeight;

        if (container.scrollTop >= maxScroll - 1) {
            setAutoScroll(false);
            return;
        }

        container.scrollTop += pixels;
        frameId = requestAnimationFrame(scrollStep);
    };

    frameId = requestAnimationFrame(scrollStep);
    return () => cancelAnimationFrame(frameId);
  }, [autoScroll, scrollSpeed, setAutoScroll]);

  // PAUSE ON USER INTERACTION
  useEffect(() => {
      const stop = () => {
          if (useReaderStore.getState().autoScroll) {
              setAutoScroll(false);
          }
      };

      const container = readerRef.current;
      container?.addEventListener("wheel", stop);
      container?.addEventListener("touchstart", stop);
      container?.addEventListener("mousedown", stop);

      return () => {
          container?.removeEventListener("wheel", stop);
          container?.removeEventListener("touchstart", stop);
          container?.removeEventListener("mousedown", stop);
      };
  }, [setAutoScroll]);

  // Scroll to resumed position or top on chapter/image change
  useEffect(() => {
      const state = useReadingStore.getState();
      const targetIndex = state.currentPageIndex;
      
      if (readerRef.current && images.length > 0) {
          // Small delay to ensure images are in the DOM for scrolling
          setTimeout(() => {
              const targetEl = readerRef.current?.querySelector(`[data-index="${targetIndex}"]`);
              if (targetEl) {
                  targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
              } else {
                  readerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
              }
          }, 100);
      }
  }, [images]);

  // V2: Intersection Observer for current page tracking
  useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  const idx = Number(entry.target.getAttribute('data-index'));
                  if (!isNaN(idx)) {
                      // Update global reading store directly
                      useReadingStore.getState().setPageIndex(idx);
                  }
              }
          });
      }, { 
          root: readerRef.current,
          threshold: 0.6 // 60% visibility triggers change
      });

      const pages = document.querySelectorAll('.manga-page');
      pages.forEach(p => observer.observe(p));

      return () => observer.disconnect();
  }, [images]); // Re-run when images change

  return (
    <div 
        ref={readerRef} 
        className="reader-scroll w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center bg-transparent select-none no-scrollbar"
        style={{ scrollBehavior: 'auto' }} 
    >
      {images.map((imagePath, index) => {
        const nextImage = images[index + 1];
        const isBoundary = nextImage && !nextImage.split('/').slice(0, -1).join('/').includes(imagePath.split('/').slice(0, -1).join('/'));

        return (
          <React.Fragment key={imagePath}>
            <motion.div
                data-index={index}
                className={clsx(
                    "manga-page transition-all duration-500",
                    (imageFit === 'width' || imageFit === 'stretch') ? "w-full" : "max-w-7xl px-4"
                )}
                style={getPageStyle()}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "800px" }}
            >
                <SmartImage
                    src={imagePath.startsWith('http') ? imagePath : convertFileSrc(imagePath)}
                    alt={`Page ${index + 1}`}
                    className={clsx(
                        getImageClass(),
                        "shadow-2xl transition-all duration-700"
                    )}
                    style={{ 
                        zoom: zoomLevel !== 100 ? `${zoomLevel}%` : undefined,
                        transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined
                    }}
                />
            </motion.div>

            {isBoundary && (
              <div className="w-full py-24 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-blue-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="w-px h-16 bg-gradient-to-b from-transparent via-blue-500/50 to-transparent mb-6" />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-2 z-10"
                >
                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.5em] mb-2">Boundary Reached</p>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4">
                    Chapter Complete <span className="text-blue-500">→</span> Next Unit
                  </h3>
                </motion.div>
                <div className="w-px h-16 bg-gradient-to-b from-transparent via-blue-500/50 to-transparent mt-6" />
              </div>
            )}
          </React.Fragment>
        );
      })}
      
      <div className="py-60 flex flex-col items-center opacity-20">
          <div className="w-12 h-1 bg-white/20 rounded-full mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white">Archive Edge</p>
      </div>
      
      {/* Sentinel for Next Chapter Trigger */}
      <BottomTrigger onTrigger={() => useReadingStore.getState().goToNextChapter()} />
    </div>
  );
};

const BottomTrigger = ({ onTrigger }: { onTrigger: () => void }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                onTrigger();
            }
        }, { rootMargin: '200px' });
        
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [onTrigger]);

    return <div ref={ref} className="h-4 w-full" />;
};
