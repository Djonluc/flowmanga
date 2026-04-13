import { useEffect, useRef } from 'react';
import { useReadingStore } from '../../stores/useReadingStore';
import { useReaderStore } from '../../stores/useReaderStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { extractMoodColor } from '../../utils/eye';
import { convertFileSrc } from '@tauri-apps/api/core';

export const AdaptiveUI = () => {
    const { images, currentPageIndex } = useReadingStore();
    const { setCurrentThemeColor } = useReaderStore();
    const { ambientMode } = useSettingsStore();
    const lastExtractedIndex = useRef<number>(-1);
    const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (ambientMode !== 'adaptive-vibrant') return;
        if (currentPageIndex === lastExtractedIndex.current) return;

        const currentImg = images[currentPageIndex];
        if (!currentImg) return;

        // Clear any pending extraction
        if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
        }

        // Debounce: wait 100ms to avoid thrashing during rapid scroll
        throttleTimerRef.current = setTimeout(() => {
            lastExtractedIndex.current = currentPageIndex;
            
            const img = new Image();
            const imgSrc = currentImg.startsWith('http') ? currentImg : convertFileSrc(currentImg);
            img.src = imgSrc;
            img.crossOrigin = "anonymous";

            img.onload = () => {
                const mood = extractMoodColor(img);
                if (mood) {
                    // Darken the color for ambient background use
                    const darken = (c: number) => Math.round(c * 0.45);
                    const toHex = (c: number) => c.toString(16).padStart(2, '0');
                    const darkHex = `#${toHex(darken(mood.r))}${toHex(darken(mood.g))}${toHex(darken(mood.b))}`;
                    setCurrentThemeColor(darkHex);
                }
            };
        }, 100);

        return () => {
            if (throttleTimerRef.current) {
                clearTimeout(throttleTimerRef.current);
            }
        };
    }, [currentPageIndex, images, ambientMode, setCurrentThemeColor]);

    // Reset extraction tracking when images change (new chapter)
    useEffect(() => {
        lastExtractedIndex.current = -1;
    }, [images]);

    return null; // Side-effect only component
};
