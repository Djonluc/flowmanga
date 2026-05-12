import { useEffect } from "react";
import { useReadingStore } from "../../stores/useReadingStore";
import { useReaderStore } from "../../stores/useReaderStore";
import { convertFileSrc } from "@tauri-apps/api/core";
import { SmartImage } from "../SmartImage";
import { motion, AnimatePresence } from "framer-motion";

export const SinglePageReader = () => {
  const { images, currentPageIndex } = useReadingStore();
  // We intentionally bypass the V2 ReaderStore here for direct index access 
  // to avoid desync bugs during rapid navigation.

  const currentImage = images[currentPageIndex];

  // Preload Logic
  useEffect(() => {
    if (currentPageIndex < images.length - 1) {
      const img = new Image();
      img.src = images[currentPageIndex + 1].startsWith("http")
        ? images[currentPageIndex + 1]
        : convertFileSrc(images[currentPageIndex + 1]);
    }
  }, [currentPageIndex, images]);

  if (!currentImage) return null;

  return (
    <div className="single-page w-full h-full flex items-center justify-center bg-transparent overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentImage}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full flex items-center justify-center"
        >
          <SmartImage
            src={
              currentImage.startsWith("http")
                ? currentImage
                : convertFileSrc(currentImage)
            }
            alt={`Page ${currentPageIndex + 1}`}
            className="max-w-full max-h-full object-contain shadow-[0_0_100px_rgba(0,0,0,0.8)]"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
