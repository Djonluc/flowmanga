import { useRef, useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { convertFileSrc } from '@tauri-apps/api/core';

export const AmbientSoundPlayer = () => {
    const { 
        selectedAmbientSound, 
        ambientVolume,
        isInitializing 
    } = useSettingsStore();
    
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Master Audio Initialization
    useEffect(() => {
        if (!audioRef.current) {
            const audio = new Audio();
            audio.id = "global-master-audio";
            audio.loop = true;
            audio.preload = "auto";
            audioRef.current = audio;

            // Expose for debugging if needed, but primarily controlled via store
            (window as any).masterAudio = audio;
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, []);

    // Handle Volume
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = ambientVolume;
        }
    }, [ambientVolume]);

    // Handle Source Changes
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || isInitializing) return;

        if (!selectedAmbientSound || selectedAmbientSound === 'none') {
            audio.pause();
            audio.src = "";
            return;
        }

        // Legacy keyword mapping for backward compatibility
        const legacyMap: Record<string, string> = {
            lofi: 'https://stream.zeno.fm/0r0xa792kwzuv',
            rain: 'https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg',
            cafe: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg',
            wind: 'https://actions.google.com/sounds/v1/weather/wind_blowing.ogg',
            space: 'https://actions.google.com/sounds/v1/science_fiction/space_station_ambience.ogg',
        };

        const resolvedSound = legacyMap[selectedAmbientSound] || selectedAmbientSound;

        const src = resolvedSound.startsWith('http')
            ? resolvedSound
            : convertFileSrc(resolvedSound);

        if (audio.src !== src) {
            audio.src = src;
            audio.load();
            
            // Auto-play on change
            audio.play().catch(err => {
                console.warn("[MasterAudio] Autoplay prevented or failed:", err);
            });
        }
    }, [selectedAmbientSound, isInitializing]);

    return null; // Master controller is invisible
};
