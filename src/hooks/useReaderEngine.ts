import { useEffect } from 'react';
import { useReaderStore } from '../stores/useReaderStore';
import { useReadingStore } from '../stores/useReadingStore';

export const useReaderEngine = () => {
    const { seriesId } = useReadingStore();
    const { 
        mode,
        autoScroll, setAutoScroll, 
        scrollSpeed, setScrollSpeed,
        loadSeriesConfig,
        isBoosted, setIsBoosted,
        slideshowActive, setSlideshowActive
    } = useReaderStore();

    // Sync config when series ID is available
    useEffect(() => {
        if (seriesId) {
            loadSeriesConfig(seriesId);
        }
    }, [seriesId, loadSeriesConfig]);

    // Keyboard & Global Shortcut Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if in input
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            // Space: Toggle Auto-Scroll
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                setAutoScroll(!autoScroll);
            }

            // P: Toggle Pause Play
            if (e.code === 'KeyP' && !e.repeat) {
                e.preventDefault();
                if (mode === 'slideshow') {
                    setSlideshowActive(!slideshowActive);
                } else {
                    setAutoScroll(!autoScroll);
                }
            }

            // Arrow Keys: Speed Control
            if (e.code === 'ArrowUp') {
                e.preventDefault();
                setScrollSpeed(scrollSpeed + 5);
            }
            if (e.code === 'ArrowDown') {
                e.preventDefault();
                setScrollSpeed(scrollSpeed - 5);
            }

            // Alt: Speed Boost
            if (e.altKey) {
                setIsBoosted(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'AltLeft' || e.code === 'AltRight') {
                setIsBoosted(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [autoScroll, scrollSpeed, setAutoScroll, setScrollSpeed, mode, slideshowActive, setSlideshowActive]);

    // Derived State
    const actualSpeed = isBoosted ? scrollSpeed * 4 : scrollSpeed;

    return {
        isBoosted,
        actualSpeed
    };
};
