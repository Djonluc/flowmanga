import { useEffect } from 'react';
import { useReadingStore } from '../stores/useReadingStore';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';

export const usePreloader = (windowSize: number = 3) => {
    const { images, currentPageIndex } = useReadingStore();

    useEffect(() => {
        if (images.length === 0) return;

        const preloadImage = async (src: string) => {
            try {
                let finalSrc = src;
                if (src.startsWith('http')) {
                    finalSrc = await invoke<string>('proxy_image', { url: src });
                } else {
                    finalSrc = convertFileSrc(src);
                }
                const img = new Image();
                img.src = finalSrc;
            } catch (err) {
                console.warn(`[Preloader] Failed to proxy ${src}:`, err);
            }
        };

        // Progressive Preload Window: Current + next N, previous 2
        const start = Math.max(0, currentPageIndex - 2);
        const end = Math.min(images.length - 1, currentPageIndex + windowSize);

        for (let i = start; i <= end; i++) {
            preloadImage(images[i]);
        }

        // Cleanup/Unload logic handled defensively by SmartImage IntersectionObserver.
        // We focus on ensuring the NEXT several pages are hot in memory.
    }, [currentPageIndex, images, windowSize]);
};
