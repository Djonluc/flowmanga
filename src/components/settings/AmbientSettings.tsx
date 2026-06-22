import { Volume2, Music2, Shuffle, Repeat, Repeat1, FolderOpen, Play, Pause, RefreshCw, Link, Trash2, Headphones, Plus } from 'lucide-react';
import { useMusicStore } from '../../stores/useMusicStore';
import clsx from 'clsx';
import { motion } from 'framer-motion';

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
    const playlistNames = Array.from(new Set(tracks.map(t => t.playlist))).sort();

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
                loadTracks();
            }
        } catch (e) {}
    };

    const handleAddStreamLink = () => {
        const url = window.prompt("Enter the direct audio stream URL (e.g., https://example.com/stream.mp3 or a radio link):");
        if (!url) return;
        const name = window.prompt("Enter a name for this stream:") || "Custom Stream";
        addCustomStream({ name, path: url, playlist: 'Custom Streams' });
        loadTracks();
    };

    const getAudio = (): HTMLAudioElement | undefined => (window as any).offlineAudio as HTMLAudioElement | undefined;

    const handlePlayPause = (trackPath: string) => {
        const audio = getAudio();
        if (!audio) return;
        if (currentTrack?.path === trackPath) {
            if (audio.paused) audio.play().catch(console.error);
            else audio.pause();
        } else {
            playTrack(trackPath);
        }
    };

    return (
        <div className="flex flex-col gap-8 pb-12 w-full max-w-5xl mx-auto">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter">Audio Experience</h2>
                    <p className="text-foreground-dim font-bold tracking-wide mt-1">Configure ambient background music and custom local sources.</p>
                </div>
            </div>

            {/* Now Playing / Master Control */}
            <div className="glass-panel p-8 rounded-[32px] border border-border-subtle relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-[24px] bg-indigo-500/10 border-2 border-indigo-500/20 flex flex-col items-center justify-center text-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.15)] flex-shrink-0 relative overflow-hidden">
                            {isPlaying && <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />}
                            <Headphones size={32} className={clsx(isPlaying && "animate-bounce")} />
                        </div>
                        <div>
                            <h3 className="text-foreground font-black text-xl line-clamp-1">{currentTrack ? currentTrack.name.replace(/[-_]/g, ' ') : 'Silence'}</h3>
                            <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mt-1">
                                {isPlaying ? 'Now Playing' : 'Playback Stopped'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3 w-full max-w-[300px]">
                        <div className="flex items-center justify-between w-full">
                            <button onClick={toggleMute} className="flex items-center gap-2 text-foreground-dim hover:text-indigo-400 transition-colors">
                                <Volume2 size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{isMuted ? 'Muted' : 'Volume'}</span>
                            </button>
                            <span className="text-lg font-black text-foreground italic">{isMuted ? '0%' : `${Math.round(volume * 100)}%`}</span>
                        </div>
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => {
                                useMusicStore.getState().setIsMuted(false);
                                setVolume(parseFloat(e.target.value));
                            }}
                            className="w-full h-2 bg-black/40 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                        />
                    </div>
                </div>

                <div className="flex gap-4 mt-8 pt-6 border-t border-white/5 relative z-10">
                    <button
                        onClick={toggleShuffle}
                        className={clsx(
                            'flex-1 flex items-center justify-center gap-3 p-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border',
                            shuffle ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-surface border-border-subtle text-foreground-dim hover:text-foreground hover:border-white/20'
                        )}
                    >
                        <Shuffle size={16} /> {shuffle ? 'Shuffle On' : 'Shuffle Off'}
                    </button>
                    <button
                        onClick={cycleRepeat}
                        className={clsx(
                            'flex-1 flex items-center justify-center gap-3 p-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border',
                            repeat !== 'none' ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-surface border-border-subtle text-foreground-dim hover:text-foreground hover:border-white/20'
                        )}
                    >
                        {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />} 
                        {repeat === 'none' ? 'No Repeat' : repeat === 'all' ? 'Repeat All' : 'Repeat One'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Playlist Explorer */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden flex flex-col h-[500px]">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                                <Music2 size={20} />
                            </div>
                            <div>
                                <h3 className="text-foreground font-black">Track Library</h3>
                                <p className="text-foreground-dim text-[10px] font-bold uppercase tracking-widest mt-0.5">{playlist.length} Tracks Available</p>
                            </div>
                        </div>
                        <button onClick={loadTracks} disabled={isLoadingTracks} className="p-2 bg-surface-elevated hover:bg-white/10 rounded-xl transition-all">
                            <RefreshCw size={16} className={clsx(isLoadingTracks && "animate-spin text-purple-400")} />
                        </button>
                    </div>

                    {playlistNames.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 mb-2">
                            {playlistNames.map(name => (
                                <button
                                    key={name}
                                    onClick={() => setActivePlaylist(name)}
                                    className={clsx(
                                        'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap',
                                        activePlaylist === name ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'bg-surface-elevated border-border-subtle text-foreground-dim hover:text-foreground'
                                    )}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                        {isLoadingTracks ? (
                            <div className="h-full flex items-center justify-center opacity-50">
                                <Loader />
                            </div>
                        ) : playlist.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
                                <Music2 size={48} className="text-foreground-dim" />
                                <div>
                                    <h4 className="text-foreground font-black text-sm uppercase tracking-widest">No Tracks</h4>
                                    <p className="text-foreground-dim text-xs font-bold mt-1">Add MP3 files to custom folders</p>
                                </div>
                            </div>
                        ) : (
                            playlist.map((track) => {
                                const isActive = currentTrack?.path === track.path;
                                return (
                                    <button
                                        key={track.path}
                                        onClick={() => handlePlayPause(track.path)}
                                        className={clsx(
                                            'w-full flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all text-left group',
                                            isActive ? 'bg-purple-500/10 border-purple-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' : 'bg-surface border-border-subtle hover:border-white/20'
                                        )}
                                    >
                                        <div className={clsx(
                                            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors shadow-inner',
                                            isActive ? 'bg-purple-500/20 text-purple-400' : 'bg-surface-elevated text-foreground-dim group-hover:text-foreground'
                                        )}>
                                            {isActive && isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-1" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className={clsx("text-sm font-bold truncate", isActive ? "text-purple-300" : "text-foreground")}>{track.name.replace(/[-_]/g, ' ')}</h4>
                                            <p className="text-[10px] text-foreground-dim font-black uppercase tracking-widest mt-0.5">{isActive && isPlaying ? 'Playing Now' : track.playlist}</p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Custom Sources */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <FolderOpen size={20} />
                            </div>
                            <div>
                                <h3 className="text-foreground font-black">Custom Sources</h3>
                                <p className="text-foreground-dim text-[10px] font-bold uppercase tracking-widest mt-0.5">Local folders & Web streams</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                        {/* Folders */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Local Directories</h4>
                                <button onClick={handleAddCustomFolder} className="text-[10px] font-bold text-foreground-dim hover:text-emerald-400 flex items-center gap-1 transition-colors">
                                    <Plus size={12} /> Add Folder
                                </button>
                            </div>
                            {customFolders.length === 0 && <p className="text-xs text-foreground-muted italic">No custom folders added.</p>}
                            {customFolders.map(folder => (
                                <div key={folder} className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated border border-border-subtle group">
                                    <span className="text-xs font-mono text-foreground-dim truncate max-w-[250px]">{folder}</span>
                                    <button onClick={() => { removeCustomFolder(folder); loadTracks(); }} className="text-foreground-dim hover:text-red-400 p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Streams */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Web Streams</h4>
                                <button onClick={handleAddStreamLink} className="text-[10px] font-bold text-foreground-dim hover:text-blue-400 flex items-center gap-1 transition-colors">
                                    <Plus size={12} /> Add Stream
                                </button>
                            </div>
                            {customStreams.length === 0 && <p className="text-xs text-foreground-muted italic">No custom streams added.</p>}
                            {customStreams.map(stream => (
                                <div key={stream.path} className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated border border-border-subtle group">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-foreground truncate">{stream.name}</span>
                                        <span className="text-[10px] font-mono text-foreground-dim truncate max-w-[250px]">{stream.path}</span>
                                    </div>
                                    <button onClick={() => { removeCustomStream(stream.path); loadTracks(); }} className="text-foreground-dim hover:text-red-400 p-1">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

const Loader = () => (
    <div className="flex items-center gap-2 text-foreground-dim">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-xs font-bold">Discovering tracks...</span>
    </div>
);
