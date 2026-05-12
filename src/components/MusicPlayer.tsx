import { useEffect, useRef, useState, useCallback } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, Volume2, VolumeX, Music, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export const MusicPlayer = ({ isExpanded }: { isExpanded: boolean }) => {
    const { 
        selectedAmbientSound, 
        availableSounds, 
        ambientVolume, 
        setAmbientVolume,
        setSelectedAmbientSound 
    } = useSettingsStore();

    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showVolume, setShowVolume] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Filter out 'none' to get actual tracks
    const playlist = availableSounds.filter(s => s.name !== 'none');
    
    // Find current track index
    const currentTrackIndex = playlist.findIndex(s => s.path === selectedAmbientSound);
    const currentTrack = currentTrackIndex >= 0 ? playlist[currentTrackIndex] : null;

    // Sync playback state with actual audio element events
    const getMasterAudio = () => (window as any).masterAudio as HTMLAudioElement | undefined;

    // Sync volume with audio element
    useEffect(() => {
        const audio = getMasterAudio();
        if (audio) {
            audio.volume = isMuted ? 0 : ambientVolume;
        }
    }, [ambientVolume, isMuted]);

    const handlePlay = useCallback(() => {
        setIsPlaying(true);
        setIsLoading(false);
        setHasError(false);
    }, []);

    const handlePause = useCallback(() => {
        setIsPlaying(false);
    }, []);

    const handleWaiting = useCallback(() => {
        setIsLoading(true);
    }, []);

    const handleCanPlay = useCallback(() => {
        setIsLoading(false);
    }, []);

    const handleError = useCallback(() => {
        setIsLoading(false);
        setHasError(true);
        setIsPlaying(false);
    }, []);

    // Bind native audio events for accurate state sync
    useEffect(() => {
        const audio = getMasterAudio();
        if (!audio) return;

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('waiting', handleWaiting);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);

        // Sync initial state
        setIsPlaying(!audio.paused);
        setIsLoading(audio.networkState === 2); // Loading

        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('waiting', handleWaiting);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
        };
    }, [handlePlay, handlePause, handleWaiting, handleCanPlay, handleError]);

    const togglePlay = () => {
        const audio = getMasterAudio();
        if (!audio) return;

        if (!currentTrack && playlist.length > 0) {
            setSelectedAmbientSound(playlist[0].path);
            return;
        }

        if (hasError) {
            setHasError(false);
            setIsLoading(true);
            audio.load();
            audio.play().catch(console.error);
            return;
        }

        if (audio.paused) {
            audio.play().catch(console.error);
        } else {
            audio.pause();
        }
    };

    const playNext = () => {
        if (playlist.length === 0) return;
        const nextIndex = (currentTrackIndex + 1) % playlist.length;
        setSelectedAmbientSound(playlist[nextIndex].path);
    };

    const handleTrackEnd = () => {
        playNext();
    };

    // Listen for track end on master audio
    useEffect(() => {
        const audio = getMasterAudio();
        if (!audio) return;
        audio.onended = handleTrackEnd;
        return () => { if (audio.onended === handleTrackEnd) audio.onended = null; };
    }, [handleTrackEnd]);

    // Get display name for current track
    const getTrackName = () => {
        if (hasError) return 'Playback Error';
        if (isLoading) return 'Loading...';
        if (currentTrack) return currentTrack.name.replace(/\.[^/.]+$/, "");
        if (playlist.length === 0) return 'No Tracks Available';
        return 'Select a Track';
    };

    const getStatusLabel = () => {
        if (hasError) return 'Error — Tap to Retry';
        if (isLoading) return 'Buffering';
        if (isPlaying) return 'Now Playing';
        if (currentTrack) return 'Paused';
        return 'Idle';
    };

    // If no tracks exist and we are collapsed, render nothing to save space
    if (playlist.length === 0 && !isExpanded) return null;

    return (
        <div className="p-4 border-t border-white/5 bg-white/[0.02] overflow-visible relative group/player">
            <div className={clsx("flex items-center gap-3", !isExpanded && "justify-center")}>
                
                {/* Album Art / Icon */}
                <div 
                    onClick={togglePlay}
                    className={clsx(
                        "w-10 h-10 rounded-xl overflow-hidden border flex-shrink-0 flex items-center justify-center cursor-pointer relative group/art",
                        hasError 
                            ? "bg-rose-950 border-rose-500/30" 
                            : "bg-neutral-900 border-white/10"
                    )}
                >
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 flex items-center justify-center transition-opacity z-10">
                        {isLoading ? (
                            <Loader2 size={14} className="text-white animate-spin" />
                        ) : isPlaying ? (
                            <Pause size={14} className="text-white" />
                        ) : (
                            <Play size={14} className="text-white ml-0.5" />
                        )}
                    </div>
                    {isPlaying && !hasError && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                            <motion.div 
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                className="w-6 h-6 rounded-full bg-indigo-500/30 blur-md"
                            />
                        </div>
                    )}
                    <Music size={16} className={clsx(
                        "transition-colors",
                        hasError ? "text-rose-400" : isPlaying ? "text-indigo-400" : "text-neutral-500"
                    )} />
                </div>

                {/* Track Info (Expanded) */}
                {isExpanded && (
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                            <span className={clsx(
                                "text-xs font-bold truncate",
                                hasError ? "text-rose-400" : "text-white"
                            )}>
                                {getTrackName()}
                            </span>
                        </div>
                        <span className={clsx(
                            "text-[9px] font-black uppercase tracking-widest mt-0.5",
                            hasError ? "text-rose-500/60" : isPlaying ? "text-indigo-400/60" : "text-neutral-500"
                        )}>
                            {getStatusLabel()}
                        </span>
                    </div>
                )}

                {/* Controls (Expanded) — show whenever expanded and tracks exist */}
                {isExpanded && playlist.length > 0 && (
                    <div className="flex items-center gap-2">
                        <div 
                            className="relative"
                            onMouseEnter={() => setShowVolume(true)}
                            onMouseLeave={() => setShowVolume(false)}
                        >
                            <button 
                                onClick={() => setIsMuted(!isMuted)}
                                className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                            >
                                {isMuted || ambientVolume === 0 ? <VolumeX size={12} /> : <Volume2 size={12} />}
                            </button>
                            
                            {/* Hover Volume Slider */}
                            <AnimatePresence>
                                {showVolume && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-8 h-24 bg-neutral-900 border border-white/10 rounded-xl flex items-center justify-center py-3 shadow-xl z-50"
                                    >
                                        <input 
                                            type="range" 
                                            min="0" max="1" step="0.05"
                                            value={isMuted ? 0 : ambientVolume}
                                            onChange={(e) => {
                                                setIsMuted(false);
                                                setAmbientVolume(parseFloat(e.target.value));
                                            }}
                                            className="w-16 h-1 -rotate-90 appearance-none bg-white/10 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white cursor-pointer"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <button 
                            onClick={playNext}
                            disabled={playlist.length <= 1}
                            className={clsx(
                                "w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors",
                                playlist.length <= 1 ? "text-neutral-700 cursor-not-allowed" : "text-neutral-400 hover:text-white"
                            )}
                        >
                            <SkipForward size={12} />
                        </button>
                    </div>
                )}
            </div>
            
            {/* Expanded Progress Bar Visualization */}
            {isExpanded && isPlaying && !hasError && (
                <div className="absolute top-0 left-0 right-0 h-px bg-white/5">
                    <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
                    />
                </div>
            )}
        </div>
    );
};
