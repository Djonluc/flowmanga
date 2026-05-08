import { useRef, useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useReaderStore } from '../stores/useReaderStore';
import { convertFileSrc } from '@tauri-apps/api/core';

// Placeholder sounds (Creative Commons or Free use where possible, or generated noise)
// For now, we use online samples. In production, these should be local assets.
const SOUNDS: Record<string, string> = {
    lofi: 'https://stream.zeno.fm/0r0xa792kwzuv', // Lofi Hip Hop stream (example)
    rain: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg',
    cafe: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg',
    wind: 'https://actions.google.com/sounds/v1/weather/wind_blowing.ogg',
    space: 'https://actions.google.com/sounds/v1/science_fiction/space_station_ambience.ogg',
};

export const AmbientSoundPlayer = () => {
    const { ambientVolume, selectedAmbientSound } = useSettingsStore();
    const { autoScroll, slideshowActive, mode } = useReaderStore();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        let soundUrl = '';
        
        // Sync Logic: Music plays if:
        // 1. Manual sound is selected (not 'none')
        // 2. Content is moving (autoScroll in vertical or slideshowActive in slideshow)
        const isContentMoving = (mode === 'vertical' && autoScroll) || (mode === 'slideshow' && slideshowActive);
        const shouldPlay = (selectedAmbientSound !== 'none') && isContentMoving;

        if (shouldPlay) {
            if (selectedAmbientSound.includes('/') || selectedAmbientSound.includes('\\')) {
                soundUrl = convertFileSrc(selectedAmbientSound);
            } else {
                soundUrl = SOUNDS[selectedAmbientSound] || '';
            }
        }

        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.loop = true;
        }

        const audio = audioRef.current;

        if (soundUrl) {
            if (audio.src !== soundUrl) {
                audio.src = soundUrl;
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        if (e.name !== 'AbortError') {
                            console.warn("Audio autoplay blocked", e);
                        }
                    });
                }
            } else if (audio.paused) {
                audio.play().catch(() => {});
            }
        } else {
            audio.pause();
        }

        return () => {
        };
    }, [selectedAmbientSound, autoScroll, slideshowActive, mode]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = ambientVolume;
        }
    }, [ambientVolume]);

    return null; // Invisible component
};
