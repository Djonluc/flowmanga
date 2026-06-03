import { useEffect, useRef } from 'react';
import { useMusicStore } from '../stores/useMusicStore';
import { useSettingsStore } from '../stores/useSettingsStore';

/**
 * OfflineAudioEngine — invisible, singleton component.
 * Mounts once in App.tsx, never unmounts, drives all audio playback.
 * Reads from useMusicStore and controls a persistent HTMLAudioElement.
 */
export const OfflineAudioEngine = () => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const { isInitializing } = useSettingsStore();

    const {
        currentTrackPath,
        volume,
        isMuted,
        repeat,
        savedPosition,
        loadTracks,
        setIsPlaying,
        setCurrentPosition,
        setDuration,
        setSavedPosition,
        playNext,
        resolveTrackSrc,
    } = useMusicStore();

    // --- Initialize persistent audio element once ---
    useEffect(() => {
        if (!audioRef.current) {
            const audio = new Audio();
            audio.id = 'offline-audio-engine';
            audio.preload = 'auto';
            audioRef.current = audio;
            // Expose for MusicPlayer UI synchronization
            (window as any).offlineAudio = audio;
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, []);

    // --- Load tracks on startup (after app initializes) ---
    useEffect(() => {
        if (!isInitializing) {
            loadTracks();
        }
    }, [isInitializing]);

    // --- Handle track changes ---
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || isInitializing) return;

        if (!currentTrackPath) {
            audio.pause();
            return;
        }

        const src = resolveTrackSrc(currentTrackPath);

        // Only reload if track actually changed
        if (audio.src !== src) {
            audio.src = src;
            audio.load();
            
            const shouldPlay = useMusicStore.getState().isPlaying;
            if (shouldPlay) {
                audio.play().catch(err => {
                    if (err.name !== 'AbortError') {
                        console.warn('[OfflineAudio] Autoplay blocked or failed:', err);
                    }
                });
            }
        }
    }, [currentTrackPath, isInitializing]);

    // --- Restore saved position on first load of a track ---
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || savedPosition <= 0) return;

        const restoreOnce = () => {
            if (savedPosition > 0 && audio.duration > savedPosition) {
                audio.currentTime = savedPosition;
            }
            audio.removeEventListener('loadedmetadata', restoreOnce);
        };

        audio.addEventListener('loadedmetadata', restoreOnce);
        return () => audio.removeEventListener('loadedmetadata', restoreOnce);
    }, [currentTrackPath]);

    // --- Volume / Mute ---
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
    }, [volume, isMuted]);

    // --- Wire native audio events → store ---
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => {
            setCurrentPosition(audio.currentTime);
            // Save position every 5 seconds for restore-on-restart
            if (Math.floor(audio.currentTime) % 5 === 0) {
                setSavedPosition(audio.currentTime);
            }
        };
        const onLoadedMetadata = () => setDuration(audio.duration);
        const onEnded = () => {
            setIsPlaying(false);
            const currentRepeat = useMusicStore.getState().repeat;
            if (currentRepeat === 'one') {
                audio.currentTime = 0;
                audio.play().catch(console.error);
            } else if (currentRepeat === 'all' || currentRepeat === 'none') {
                playNext();
            }
        };

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('ended', onEnded);
        };
    }, [setIsPlaying, setCurrentPosition, setDuration, setSavedPosition, playNext]);

    return null;
};
