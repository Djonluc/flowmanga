import { useRef, useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
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
    const { ambientVolume, selectedAmbientSound, readingMode, isAutoScrolling } = useSettingsStore();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        let soundUrl = '';
        
        // Music plays if:
        // 1. Manual sound is selected (not 'none')
        // 2. Automate slideshow is active
        const shouldPlay = (selectedAmbientSound !== 'none') || (readingMode === 'slideshow' && isAutoScrolling);

        if (shouldPlay) {
            if (selectedAmbientSound !== 'none') {
                // If it's a path (contains slashes or starts with drive letter)
                if (selectedAmbientSound.includes('/') || selectedAmbientSound.includes('\\')) {
                    soundUrl = convertFileSrc(selectedAmbientSound);
                } else {
                    soundUrl = SOUNDS[selectedAmbientSound] || '';
                }
            } else {
                // Default to a cozy lofi/rain vibe for slideshow if no manual sound is set
                soundUrl = SOUNDS.lofi; 
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
            }
        } else {
            audio.pause();
            audio.src = '';
        }

        return () => {
            // No need to pause here if we want continuous play, but reacting to theme/selection change
        };
    }, [selectedAmbientSound, readingMode, isAutoScrolling]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = ambientVolume;
        }
    }, [ambientVolume]);

    return null; // Invisible component
};
