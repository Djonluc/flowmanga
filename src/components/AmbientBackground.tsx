import { useSettingsStore } from '../stores/useSettingsStore';
import { useReadingStore } from '../stores/useReadingStore';
import { useReaderStore } from '../stores/useReaderStore';
import { motion, AnimatePresence } from 'framer-motion';
import { convertFileSrc } from '@tauri-apps/api/core';

export const AmbientBackground = () => {
    // Global Settings
    const { 
        theme, 
        accentColor,
        ambientMode, 
        ambientImage: manualAmbientImage, // Renamed to distinguish
        ambientIntensity, 
        ambientBlur, 
        ambientBrightness, 
        showAmbientNoise,
    } = useSettingsStore();

    const { currentThemeColor } = useReaderStore();

    // Reading State (Direct Subscription)
    const { images, currentPageIndex } = useReadingStore();
    
    // Determine effective ambient image
    let effectiveImage = manualAmbientImage;

    // If in Reader view (images loaded), prioritize the current page
    if (images.length > 0) {
         const readingImg = images[currentPageIndex];
         if (readingImg) effectiveImage = readingImg;
    }
    
    const ambientImage = effectiveImage;

    // Define ambient gradients for each theme (Fallback / Gradient Mode)
    const gradients: Record<string, string> = {
        dark: `radial-gradient(circle at 50% 50%, ${accentColor}33, transparent 70%)`,
        light: `radial-gradient(circle at 50% 50%, ${accentColor}22, transparent 70%)`,
        oled: 'none', 
        paper: 'radial-gradient(circle at 50% 50%, rgba(139, 69, 19, 0.1), transparent 70%)',
        cyberpunk: 'radial-gradient(circle at 50% 50%, rgba(0, 255, 255, 0.1), transparent 60%), radial-gradient(circle at 80% 20%, rgba(255, 0, 255, 0.1), transparent 50%)',
    };

    if (ambientMode === 'oled') return null;

    // Check if we should show an image
    const showImage = (ambientMode === 'blurred-page' || ambientMode === 'blurred-cover') && !!ambientImage;

    // Show gradient if explicit gradient mode OR fallback (no image and not solid/oled)
    // If ambientMode is 'blurred-page' but no image, we SHOULD fall back to gradient/solid
    const showGradient = ambientMode === 'gradient' || 
                        ((ambientMode === 'blurred-page' || ambientMode === 'blurred-cover') && !ambientImage) ||
                        (!showImage && ambientMode !== 'solid');

    return (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
            {/* 1. Base Layer: Blurred Image */}
            <AnimatePresence mode="popLayout">
                {showImage && (
                    <motion.div
                        key={ambientImage} // Triggers crossfade on image change
                        initial={{ opacity: 0 }}
                        animate={{ opacity: ambientIntensity }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.2, ease: "easeInOut" }}
                        className="absolute inset-0 bg-cover bg-center will-change-transform"
                        style={{
                            backgroundImage: `url('${ambientImage.startsWith('http') ? ambientImage : convertFileSrc(ambientImage)}')`,
                            filter: `blur(${ambientBlur}px) brightness(${ambientBrightness}) saturate(1.2)`,
                            transform: 'scale(1.15)', // Prevent edge bleeding
                        }}
                    />
                )}
            </AnimatePresence>

            {/* 2. Gradient / Theme Layer */}
            <AnimatePresence>
                {showGradient && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="absolute inset-0"
                    >
                        <motion.div 
                            className="w-full h-full absolute inset-0"
                            animate={{ 
                                scale: [1, 1.1, 1],
                                rotate: [0, 1, -1, 0],
                            }}
                            transition={{ 
                                duration: 20, 
                                ease: "easeInOut", 
                                repeat: Infinity,
                                repeatType: "reverse" 
                            }}
                            style={{ 
                                background: gradients[theme] || gradients.dark,
                                transition: 'background 1s ease-in-out'
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 3. Adaptive Vibrant Layer */}
            <AnimatePresence>
                {ambientMode === 'adaptive-vibrant' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, backgroundColor: currentThemeColor }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="absolute inset-0"
                    />
                )}
            </AnimatePresence>

            {/* 4. Vignette (Focus on center) */}
            <div 
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 100%)'
                }}
            />

            {/* 4. Overlay Textures (Theme specific) */}
            {theme === 'paper' && (
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] mix-blend-multiply" />
            )}

            {/* 5. Noise Texture */}
            {showAmbientNoise && (
                <div 
                    className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
                    style={{
                         backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opactiy='0.5'/%3E%3C/svg%3E")`
                    }}
                />
            )}
            
            {/* 6. Global Dimmer (Consistency) */}
             <div className="absolute inset-0 bg-black/20" />
        </div>
    );
};
