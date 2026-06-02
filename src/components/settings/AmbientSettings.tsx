import { useEffect, useState } from 'react';
import { Volume2, Music2, Shuffle, Repeat, Repeat1, FolderOpen, Play, Pause, RefreshCw, Plus, Trash2, Link } from 'lucide-react';
import { useMusicStore } from '../../stores/useMusicStore';
import clsx from 'clsx';

export const AmbientSettings = () => {
    const {
        volume, setVolume,
        isMuted, toggleMute,
        shuffle, toggleShuffle,
        repeat, cycleRepeat,
        isLoadingTracks,
        getCurrentTrack,
        getPlaylistTracks,
        loadTracks,
        playTrack,
        activePlaylist,
        setActivePlaylist,
        tracks,
        isPlaying,
        customFolders,
        customStreams,
        addCustomFolder,
        removeCustomFolder,
        addCustomStream,
        removeCustomStream,
    } = useMusicStore();

    const playlist = getPlaylistTracks();
    const currentTrack = getCurrentTrack();

    // Gather available playlist names
    const playlistNames = Array.from(new Set(tracks.map(t => t.playlist))).sort();

    // Open assets/audio/lofi/ folder in system explorer
    const handleOpenFolder = async () => {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const cwd = await invoke<string>('get_cwd').catch(() => null);
            if (!cwd) return;
            const { open } = await import('@tauri-apps/plugin-shell');
            await (open as any)(`${cwd}/assets/audio/${activePlaylist}`);
        } catch (e) {
            console.error('[AmbientSettings] Failed to open folder:', e);
        }
    };

    const handleAddCustomFolder = async () => {
        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select Custom Music Folder',
            });
            if (selected && typeof selected === 'string') {
                addCustomFolder(selected);
                loadTracks(); // Refresh to scan the new folder
            }
        } catch (e) {
            console.error('Failed to select custom folder:', e);
        }
    };

    const handleAddStreamLink = () => {
        const url = window.prompt("Enter the direct audio stream URL (e.g., https://example.com/stream.mp3 or a radio link):");
        if (!url) return;
        const name = window.prompt("Enter a name for this stream:") || "Custom Stream";
        addCustomStream({
            name,
            path: url,
            playlist: 'Custom Streams',
        });
        loadTracks();
    };

    const getAudio = (): HTMLAudioElement | undefined =>
        (window as any).offlineAudio as HTMLAudioElement | undefined;

    const handlePlayPause = (trackPath: string) => {
        const audio = getAudio();
        if (!audio) return;
        const isCurrentTrack = currentTrack?.path === trackPath;
        if (isCurrentTrack) {
            if (audio.paused) {
                audio.play().catch(console.error);
            } else {
                audio.pause();
            }
        } else {
            playTrack(trackPath);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Volume Control */}
            <section className="space-y-4">
                <h4 className="text-foreground font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Master Volume
                </h4>
                <div className="bg-white/5 p-6 rounded-[32px] border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={toggleMute}
                            className="flex items-center gap-3 text-foreground-dim hover:text-foreground transition-colors"
                        >
                            <Volume2 size={18} />
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {isMuted ? 'Muted' : 'Music Level'}
                            </span>
                        </button>
                        <span className="text-sm font-black text-indigo-400 italic">
                            {isMuted ? '—' : `${Math.round(volume * 100)}%`}
                        </span>
                    </div>
                    <input
                        type="range" min="0" max="1" step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                            useMusicStore.getState().setIsMuted(false);
                            setVolume(parseFloat(e.target.value));
                        }}
                        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                    />
                </div>
            </section>

            {/* Playback Settings */}
            <section className="space-y-4">
                <h4 className="text-foreground font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Playback Options
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={toggleShuffle}
                        className={clsx(
                            'flex items-center gap-3 p-5 rounded-[24px] border transition-all',
                            shuffle
                                ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                                : 'bg-white/2 border-white/5 text-foreground-dim hover:bg-white/5'
                        )}
                    >
                        <Shuffle size={20} />
                        <div className="text-left">
                            <div className="text-xs font-black uppercase tracking-widest">Shuffle</div>
                            <div className="text-[9px] text-foreground-muted mt-0.5">{shuffle ? 'On' : 'Off'}</div>
                        </div>
                    </button>

                    <button
                        onClick={cycleRepeat}
                        className={clsx(
                            'flex items-center gap-3 p-5 rounded-[24px] border transition-all',
                            repeat !== 'none'
                                ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                                : 'bg-white/2 border-white/5 text-foreground-dim hover:bg-white/5'
                        )}
                    >
                        {repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
                        <div className="text-left">
                            <div className="text-xs font-black uppercase tracking-widest">Repeat</div>
                            <div className="text-[9px] text-foreground-muted mt-0.5 capitalize">{repeat}</div>
                        </div>
                    </button>
                </div>
            </section>

            {/* Playlist Selector */}
            {playlistNames.length > 1 && (
                <section className="space-y-4">
                    <h4 className="text-foreground font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                        Playlist
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {playlistNames.map(name => (
                            <button
                                key={name}
                                onClick={() => setActivePlaylist(name)}
                                className={clsx(
                                    'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border',
                                    activePlaylist === name
                                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                        : 'bg-white/5 border-white/10 text-foreground-dim hover:text-foreground'
                                )}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Track Library */}
            <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="text-foreground font-black uppercase tracking-widest text-xs">
                        Track Library
                    </h4>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-foreground-dim">
                            {playlist.length} track{playlist.length !== 1 ? 's' : ''}
                        </span>
                        <button
                            onClick={loadTracks}
                            disabled={isLoadingTracks}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-foreground-dim hover:text-foreground transition-colors"
                            title="Refresh tracks"
                        >
                            <RefreshCw size={12} className={isLoadingTracks ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {isLoadingTracks ? (
                    <div className="py-8 flex items-center justify-center gap-3 text-foreground-dim">
                        <RefreshCw size={16} className="animate-spin" />
                        <span className="text-xs font-bold">Discovering tracks…</span>
                    </div>
                ) : playlist.length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-[24px] bg-white/5 flex items-center justify-center text-foreground-muted">
                            <Music2 size={32} />
                        </div>
                        <div>
                            <p className="text-sm font-black uppercase tracking-widest text-foreground-dim">No tracks found</p>
                            <p className="text-[10px] text-foreground-muted mt-1">
                                Add MP3 files to <code className="text-indigo-400">assets/audio/lofi/</code>
                            </p>
                        </div>
                        <button
                            onClick={handleOpenFolder}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/30 transition-all"
                        >
                            <FolderOpen size={14} />
                            Open Folder
                        </button>
                    </div>
                ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                        {playlist.map((track) => {
                            const isActive = currentTrack?.path === track.path;
                            return (
                                <button
                                    key={track.path}
                                    onClick={() => handlePlayPause(track.path)}
                                    className={clsx(
                                        'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left group',
                                        isActive
                                            ? 'bg-indigo-600/10 border-indigo-500/40 text-foreground'
                                            : 'bg-white/2 border-white/5 text-foreground-dim hover:bg-white/5 hover:text-foreground hover:border-white/10'
                                    )}
                                >
                                    <div className={clsx(
                                        'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
                                        isActive ? 'bg-indigo-600/20 text-indigo-300' : 'bg-white/5 text-foreground-muted group-hover:bg-white/10'
                                    )}>
                                        {isActive && isPlaying
                                            ? <Pause size={13} />
                                            : <Play size={13} className="ml-0.5" />}
                                    </div>
                                    <span className="text-xs font-bold capitalize truncate flex-1">
                                        {track.name.replace(/[-_]/g, ' ')}
                                    </span>
                                    {isActive && (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 flex-shrink-0">
                                            {isPlaying ? 'Playing' : 'Paused'}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Open Folder shortcut */}
            {playlist.length > 0 && (
                <section>
                    <button
                        onClick={handleOpenFolder}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground-muted hover:text-foreground transition-colors"
                    >
                        <FolderOpen size={13} />
                        Open default audio folder to add more tracks
                    </button>
                </section>
            )}

            {/* Custom Sources Management */}
            <section className="space-y-3 pt-4 border-t border-border/10">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground">Custom Sources</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAddCustomFolder}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-foreground-dim hover:text-foreground transition-all"
                            title="Add Custom Local Folder"
                        >
                            <FolderOpen size={14} />
                        </button>
                        <button
                            onClick={handleAddStreamLink}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-foreground-dim hover:text-foreground transition-all"
                            title="Add Online Stream URL"
                        >
                            <Link size={14} />
                        </button>
                    </div>
                </div>

                {customFolders.length > 0 && (
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest mb-2">Folders</div>
                        {customFolders.map(folder => (
                            <div key={folder} className="flex items-center justify-between group text-xs text-foreground-dim py-1">
                                <span className="truncate max-w-[180px]">{folder}</span>
                                <button 
                                    onClick={() => { removeCustomFolder(folder); loadTracks(); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-opacity"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {customStreams.length > 0 && (
                    <div className="space-y-1">
                        <div className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest mt-3 mb-2">Web Streams</div>
                        {customStreams.map(stream => (
                            <div key={stream.path} className="flex items-center justify-between group text-xs text-foreground-dim py-1">
                                <span className="truncate max-w-[180px]">{stream.name}</span>
                                <button 
                                    onClick={() => { removeCustomStream(stream.path); loadTracks(); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 transition-opacity"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};
