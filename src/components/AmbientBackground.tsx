import { useState, useEffect } from "react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useReadingStore } from "../stores/useReadingStore";
import { useReaderStore } from "../stores/useReaderStore";
import { motion, AnimatePresence } from "framer-motion";
import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * AmbientBackground
 * Provides cinematic, adaptive atmosphere ONLY during reading sessions.
 * Scoped to prevent leakage into the main app interface.
 */
export const AmbientBackground = () => {
  const {
    ambientMode,
    ambientIntensity,
    ambientBlur,
    ambientBrightness,
    showAmbientNoise,
  } = useSettingsStore();

  const { currentThemeColor: readerThemeColor } = useReaderStore();
  const { images, currentPageIndex } = useReadingStore();

  const [layers, setLayers] = useState<{
    active: string | null;
    prev: string | null;
  }>({
    active: null,
    prev: null,
  });
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    const currentImg = images[currentPageIndex];
    if (currentImg !== layers.active) {
      setLayers((prev) => ({ active: currentImg, prev: prev.active }));
      setFlip((f) => !f);
    }
  }, [currentPageIndex, images]);

  // STRICT ISOLATION: Only render atmosphere if a reader session is active
  if (images.length === 0) return null;
  if (ambientMode === "oled") return null;

  const isAdaptive = ambientMode === "adaptive-vibrant";
  const showProjection =
    (ambientMode === "blurred-page" || ambientMode === "blurred-cover") &&
    !!layers.active;

  const effectiveIntensity = isAdaptive
    ? ambientIntensity
    : ambientIntensity * 0.4;
  const effectiveBlur = isAdaptive ? ambientBlur : ambientBlur * 0.5;

  const renderProjectionLayer = (img: string | null, isActive: boolean) => {
    if (!img) return null;
    const src = img.startsWith("http") ? img : convertFileSrc(img);
    return (
      <motion.div
        key={img + (isActive ? "active" : "prev")}
        initial={{ opacity: 0 }}
        animate={{ opacity: isActive ? effectiveIntensity : 0 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
        className="absolute inset-0 bg-cover bg-center will-change-transform pointer-events-none"
        style={{
          backgroundImage: `url('${src}')`,
          filter: `blur(${effectiveBlur}px) brightness(${ambientBrightness}) saturate(1.4)`,
          transform: "scale(1.1)", 
        }}
      />
    );
  };

  const moodOpacity = isAdaptive ? ambientIntensity : ambientIntensity * 0.3;
  const softeningBlur = Math.max(2, ambientBlur * 0.1);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none bg-background">
      {/* 1. Passive Page Projection (Diffusion) */}
      <AnimatePresence mode="popLayout">
        {showProjection && (
          <div className="absolute inset-0">
            {renderProjectionLayer(layers.prev, !flip)}
            {renderProjectionLayer(layers.active, flip)}
          </div>
        )}
      </AnimatePresence>

      {/* 2. Atmospheric Mood Layer (Reactive Color) */}
      <motion.div
        animate={{ backgroundColor: readerThemeColor }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        className="absolute inset-0 z-10 mix-blend-screen"
        style={{ opacity: moodOpacity }}
      />

      <motion.div
        animate={{
          background: `radial-gradient(circle at 50% 50%, ${readerThemeColor}88, transparent 80%),
                         radial-gradient(circle at 10% 10%, ${readerThemeColor}44, transparent 50%)`,
        }}
        transition={{ duration: 2, ease: "easeInOut" }}
        className="absolute inset-0 z-20 pointer-events-none"
        style={{ opacity: moodOpacity * 1.2 }}
      />

      {/* 3. Cinematic Depth Overlay */}
      <div
        className="absolute inset-0 z-30"
        style={{
          background:
            "radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.8) 100%)",
          mixBlendMode: "multiply",
        }}
      />

      {/* 4. Atmospheric Texture */}
      {showAmbientNoise && (
        <div
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay z-40"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      )}

      {/* 5. Fine Softening Pass (Dynamic Blur) */}
      <div
        className="absolute inset-0 z-50 bg-black/5"
        style={{ backdropFilter: `blur(${softeningBlur}px)` }}
      />
    </div>
  );
};
