import { useCallback } from 'react';
import { useMusicStore } from '../stores/useMusicStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Pause, SkipForward, SkipBack,
    Volume2, VolumeX, Shuffle, Repeat, Repeat1,
    Music2, Loader2,
} from 'lucide-react';
import clsx from 'clsx';

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export const MusicPlayer = ({ isExpanded }: { isExpanded: boolean }) => {
    const {
        currentTrackPath,
        isPlaying,
        volume,
        isMuted,
        shuffle,
        repeat,
        currentPosition,
        duration,
        isLoadingTracks,
        getCurrentTrack,
        getPlaylistTracks,
        toggleMute,
        toggleShuffle,
        cycleRepeat,
        setVolume,
        playNext,
        playPrev,
        playTrack,
        setCurrentTrackPath,
    } = useMusicStore();

    const playlist = getPlaylistTracks();
    const currentTrack = getCurrentTrack();
    const isLoading = isLoadingTracks;

    const getAudio = (): HTMLAudioElement | undefined =>
        (window as any).offlineAudio as HTMLAudioElement | undefined;

    const togglePlay = useCallback(() => {
        const audio = getAudio();
        if (!audio) return;

        if (!currentTrackPath && playlist.length > 0) {
            setCurrentTrackPath(playlist[0].path);
            return;
        }

        if (audio.paused) {
            audio.play().catch(console.error);
        } else {
            audio.pause();
        }
    }, [currentTrackPath, playlist, setCurrentTrackPath]);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = getAudio();
        if (!audio) return;
        const pos = parseFloat(e.target.value);
        audio.currentTime = pos;
    };

    const handleNext = () => playNext();
    const handlePrev = () => playPrev();

    const getTrackDisplayName = () => {
        if (isLoading) return 'Discovering tracks…';
        if (!currentTrack) return playlist.length === 0 ? 'No tracks found' : 'Select a track';
        return currentTrack.name.replace(/[-_]/g, ' ');
    };

    const progress = duration > 0 ? (currentPosition / duration) * 100 : 0;

    // Collapsed mode: just the art icon
    if (!isExpanded) {
        if (playlist.length === 0) return null;
        return (
            <div className="p-3 border-t border-white/5 bg-white/[0.02] flex justify-center">
                <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center hover:bg-surface-raised transition-all group relative overflow-hidden"
                >
                    {isPlaying && (
                        <motion.div
                            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                            className="absolute inset-0 bg-indigo-500/20 rounded-xl"
                        />
                    )}
                    {isLoading ? (
                        <Loader2 size={16} className="animate-spin text-foreground-dim" />
                    ) : isPlaying ? (
                        <Pause size={16} className="text-indigo-400" />
                    ) : (
                        <Play size={16} className="text-foreground-dim ml-0.5" />
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="p-5 pb-8 border-t border-white/5 bg-white/[0.02] space-y-5 relative">

            {/* Animated progress line at top */}
            {isPlaying && (
                <div className="absolute top-0 left-0 right-0 h-px bg-white/5 overflow-hidden">
                    <motion.div
                        style={{ width: `${progress}%` }}
                        className="h-full bg-gradient-to-r from-indigo-500/60 to-purple-500/60"
                        transition={{ ease: 'linear' }}
                    />
                </div>
            )}

            {/* Track Info Row */}
            <div className="flex items-center gap-3">
                {/* Album Art Orb */}
                <button
                    onClick={togglePlay}
                    className={clsx(
                        'w-12 h-12 rounded-[14px] border flex-shrink-0 flex items-center justify-center relative overflow-hidden transition-all group shadow-sm',
                        isPlaying
                            ? 'bg-indigo-950/60 border-indigo-500/40'
                            : 'bg-surface border-white/10 hover:bg-surface-raised'
                    )}
                >
                    {isPlaying && (
                        <motion.div
                            animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0.05, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                            className="absolute inset-0 bg-indigo-500/30 rounded-xl"
                        />
                    )}
                    {isLoading ? (
                        <Loader2 size={15} className="animate-spin text-foreground-dim" />
                    ) : isPlaying ? (
                        <Pause size={15} className="text-indigo-300 relative z-10" />
                    ) : (
                        <Play size={15} className="text-foreground-dim ml-0.5 relative z-10" />
                    )}
                </button>

                {/* Track Name */}
                <div className="flex-1 min-w-0">
                    <p className={clsx(
                        'text-sm font-black truncate capitalize leading-tight tracking-tight',
                        isPlaying ? 'text-foreground' : 'text-foreground-dim'
                    )}>
                        {getTrackDisplayName()}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted mt-0.5">
                        {isLoading ? 'Loading…' : isPlaying ? 'Now Playing' : currentTrack ? 'Paused' : 'Idle'}
                    </p>
                </div>

                {/* Volume */}
                <div className="relative group/vol flex-shrink-0">
                    <button
                        onClick={toggleMute}
                        className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-foreground-dim hover:text-foreground transition-colors"
                    >
                        {isMuted || volume === 0
                            ? <VolumeX size={13} />
                            : <Volume2 size={13} />}
                    </button>
                    {/* Hover tooltip volume slider */}
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.9 }}
                            whileInView={{ opacity: 1, y: 0, scale: 1 }}
                            className="absolute bottom-9 left-1/2 -translate-x-1/2 hidden group-hover/vol:flex w-7 h-20 bg-surface border border-white/10 rounded-xl items-center justify-center py-3 shadow-xl z-50 after:content-[''] after:absolute after:-bottom-4 after:left-0 after:w-full after:h-4"
                        >
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={isMuted ? 0 : volume}
                                onChange={(e) => {
                                    useMusicStore.getState().setIsMuted(false);
                                    setVolume(parseFloat(e.target.value));
                                }}
                                className="w-14 h-1 -rotate-90 appearance-none bg-white/10 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white cursor-pointer"
                            />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Progress Bar */}
            {playlist.length > 0 && (
                <div className="space-y-1">
                    <div className="relative group/seek">
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            step="0.5"
                            value={currentPosition}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer h-1"
                        />
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-foreground-muted">
                        <span>{formatTime(currentPosition)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            )}

            {/* Controls Row */}
            {playlist.length > 0 && (
                <div className="flex items-center justify-center gap-4">
                    {/* Shuffle */}
                    <button
                        onClick={toggleShuffle}
                        className={clsx(
                            'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                            shuffle
                                ? 'text-indigo-400 bg-indigo-500/10'
                                : 'text-foreground-muted hover:text-foreground hover:bg-white/5'
                        )}
                        title="Shuffle"
                    >
                        <Shuffle size={12} />
                    </button>

                    {/* Prev */}
                    <button
                        onClick={handlePrev}
                        disabled={playlist.length <= 1}
                        className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-foreground-dim hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <SkipBack size={14} />
                    </button>

                    {/* Play / Pause (center) */}
                    <button
                        onClick={togglePlay}
                        className={clsx(
                            'w-10 h-10 rounded-xl flex items-center justify-center transition-all font-black shadow-lg',
                            isPlaying
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/30'
                                : 'bg-white text-black hover:bg-neutral-200'
                        )}
                    >
                        {isPlaying
                            ? <Pause size={16} />
                            : <Play size={16} className="ml-0.5" />}
                    </button>

                    {/* Next */}
                    <button
                        onClick={handleNext}
                        disabled={playlist.length <= 1}
                        className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-foreground-dim hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <SkipForward size={14} />
                    </button>

                    {/* Repeat */}
                    <button
                        onClick={cycleRepeat}
                        className={clsx(
                            'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                            repeat !== 'none'
                                ? 'text-indigo-400 bg-indigo-500/10'
                                : 'text-foreground-muted hover:text-foreground hover:bg-white/5'
                        )}
                        title={`Repeat: ${repeat}`}
                    >
                        {repeat === 'one'
                            ? <Repeat1 size={12} />
                            : <Repeat size={12} />}
                    </button>
                </div>
            )}

            {/* No tracks hint */}
            {!isLoading && playlist.length === 0 && (
                <div className="flex items-center gap-2 text-foreground-muted py-1">
                    <Music2 size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                        Add MP3s to assets/audio/lofi/
                    </span>
                </div>
            )}
        </div>
    );
};
