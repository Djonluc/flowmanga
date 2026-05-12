import { useEffect, useRef } from 'react';
import { useReadingStore } from '../../stores/useReadingStore';
import { useReaderStore } from '../../stores/useReaderStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { extractMoodColor } from '../../utils/eye';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';

// Global cache for dominant colors to prevent redundant analysis
const colorCache = new Map<string, string>();

export const AdaptiveUI = () => {
    const { images, currentPageIndex } = useReadingStore();
    const { setCurrentThemeColor } = useReaderStore();
    const { ambientMode } = useSettingsStore();
    const lastExtractedIndex = useRef<number>(-1);
    const extractionDebounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Passive observation only
        const currentImg = images[currentPageIndex];
        if (!currentImg) return;

        // Check cache first for immediate response
        if (colorCache.has(currentImg)) {
            setCurrentThemeColor(colorCache.get(currentImg)!);
            lastExtractedIndex.current = currentPageIndex;
            return;
        }

        if (currentPageIndex === lastExtractedIndex.current) return;
        
        // Debounce extraction to ensure zero impact on scroll performance
        if (extractionDebounceRef.current) clearTimeout(extractionDebounceRef.current);

        extractionDebounceRef.current = setTimeout(async () => {
            lastExtractedIndex.current = currentPageIndex;
            
            try {
                let finalSrc = currentImg;
                if (currentImg.startsWith('http')) {
                    finalSrc = await invoke<string>('proxy_image', { url: currentImg });
                } else {
                    finalSrc = convertFileSrc(currentImg);
                }

                const img = new Image();
                img.src = finalSrc;
                if (!currentImg.startsWith('http')) {
                    img.crossOrigin = "anonymous";
                }

                img.onload = () => {
                    const mood = extractMoodColor(img);
                    if (mood) {
                        const process = (c: number) => Math.round(c * 0.6);
                        const darkHex = `#${process(mood.r).toString(16).padStart(2, '0')}${process(mood.g).toString(16).padStart(2, '0')}${process(mood.b).toString(16).padStart(2, '0')}`;
                        
                        colorCache.set(currentImg, darkHex);
                        setCurrentThemeColor(darkHex);
                    }
                };
            } catch (err) {
                console.warn(`[Atmosphere] Extraction failed:`, err);
            }
        }, 100); // 100ms debounce for much more fluid transitions during scroll

        return () => {
            if (extractionDebounceRef.current) clearTimeout(extractionDebounceRef.current);
        };
    }, [currentPageIndex, images, ambientMode, setCurrentThemeColor]);

    useEffect(() => {
        lastExtractedIndex.current = -1;
    }, [images]);

    return null;
};
