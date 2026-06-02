import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { convertFileSrc } from '@tauri-apps/api/core';

export interface MusicTrack {
  name: string;
  path: string;
  playlist: string;
}

export type RepeatMode = 'none' | 'all' | 'one';

interface MusicState {
  // Playlist data (loaded at runtime, not persisted)
  tracks: MusicTrack[];
  isLoadingTracks: boolean;

  // Custom user sources (persisted)
  customFolders: string[];
  customStreams: MusicTrack[];

  // Persisted playback state
  currentTrackPath: string | null;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  savedPosition: number;    // seconds, restored on app launch
  activePlaylist: string;   // e.g. 'lofi'

  // Runtime-only playback state (not persisted)
  isPlaying: boolean;
  currentPosition: number;
  duration: number;

  // Actions
  loadTracks: () => Promise<void>;
  setTracks: (tracks: MusicTrack[]) => void;
  addCustomFolder: (path: string) => void;
  removeCustomFolder: (path: string) => void;
  addCustomStream: (track: MusicTrack) => void;
  removeCustomStream: (path: string) => void;

  setCurrentTrackPath: (path: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (vol: number) => void;
  setIsMuted: (muted: boolean) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setCurrentPosition: (pos: number) => void;
  setDuration: (dur: number) => void;
  setSavedPosition: (pos: number) => void;
  setActivePlaylist: (playlist: string) => void;

  // Track navigation
  playNext: () => void;
  playPrev: () => void;
  playTrack: (path: string) => void;

  // Derived helpers (called inline)
  getCurrentTrack: () => MusicTrack | null;
  getPlaylistTracks: () => MusicTrack[];
  resolveTrackSrc: (path: string) => string;
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      tracks: [],
      isLoadingTracks: false,
      customFolders: [],
      customStreams: [],
      currentTrackPath: null,
      volume: 0.5,
      isMuted: false,
      shuffle: false,
      repeat: 'all',
      savedPosition: 0,
      activePlaylist: 'lofi',
      isPlaying: false,
      currentPosition: 0,
      duration: 0,

      loadTracks: async () => {
        set({ isLoadingTracks: true });
        try {
          const state = get();
          const { invoke } = await import('@tauri-apps/api/core');
          
          // Pass customFolders to the Rust backend to scan
          const raw = await invoke<MusicTrack[]>('list_ambient_sounds', {
            customFolders: state.customFolders
          });
          
          // Merge custom web streams
          const combinedTracks = [...raw, ...state.customStreams];
          set({ tracks: combinedTracks, isLoadingTracks: false });

          // If no current track is set but tracks exist, auto-select first
          const updatedState = get();
          if (!updatedState.currentTrackPath && combinedTracks.length > 0) {
            const lofiTracks = combinedTracks.filter(t => t.playlist === updatedState.activePlaylist);
            const firstTrack = lofiTracks[0] || combinedTracks[0];
            set({ currentTrackPath: firstTrack.path });
          }
        } catch (err) {
          console.error('[MusicStore] Failed to load tracks:', err);
          set({ isLoadingTracks: false });
        }
      },

      setTracks: (tracks) => set({ tracks }),
      
      addCustomFolder: (path) => {
        set(s => {
          if (s.customFolders.includes(path)) return s;
          return { customFolders: [...s.customFolders, path] };
        });
      },
      removeCustomFolder: (path) => {
        set(s => ({ customFolders: s.customFolders.filter(p => p !== path) }));
      },
      addCustomStream: (track) => {
        set(s => {
          if (s.customStreams.some(t => t.path === track.path)) return s;
          return { customStreams: [...s.customStreams, track] };
        });
      },
      removeCustomStream: (path) => {
        set(s => ({ customStreams: s.customStreams.filter(t => t.path !== path) }));
      },

      setCurrentTrackPath: (path) => set({ currentTrackPath: path, savedPosition: 0 }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setVolume: (vol) => set({ volume: vol }),
      setIsMuted: (muted) => set({ isMuted: muted }),
      toggleMute: () => set(s => ({ isMuted: !s.isMuted })),
      toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
      cycleRepeat: () => set(s => {
        const order: RepeatMode[] = ['all', 'one', 'none'];
        const idx = order.indexOf(s.repeat);
        return { repeat: order[(idx + 1) % order.length] };
      }),
      setCurrentPosition: (pos) => set({ currentPosition: pos }),
      setDuration: (dur) => set({ duration: dur }),
      setSavedPosition: (pos) => set({ savedPosition: pos }),
      setActivePlaylist: (playlist) => set({ activePlaylist: playlist }),

      playTrack: (path) => set({ currentTrackPath: path, savedPosition: 0, isPlaying: true }),

      playNext: () => {
        const { getPlaylistTracks, currentTrackPath, shuffle } = get();
        const list = getPlaylistTracks();
        if (list.length === 0) return;

        const currentIdx = list.findIndex(t => t.path === currentTrackPath);
        let nextIdx: number;
        if (shuffle) {
          do {
            nextIdx = Math.floor(Math.random() * list.length);
          } while (list.length > 1 && nextIdx === currentIdx);
        } else {
          nextIdx = (currentIdx + 1) % list.length;
        }
        set({ currentTrackPath: list[nextIdx].path, savedPosition: 0 });
      },

      playPrev: () => {
        const { getPlaylistTracks, currentTrackPath, currentPosition } = get();
        const list = getPlaylistTracks();
        if (list.length === 0) return;

        // If more than 3 seconds in, restart current track
        if (currentPosition > 3) {
          set({ savedPosition: 0, currentPosition: 0 });
          // Signal the engine to seek to 0
          const audio = (window as any).offlineAudio as HTMLAudioElement | undefined;
          if (audio) { audio.currentTime = 0; }
          return;
        }

        const currentIdx = list.findIndex(t => t.path === currentTrackPath);
        const prevIdx = (currentIdx - 1 + list.length) % list.length;
        set({ currentTrackPath: list[prevIdx].path, savedPosition: 0 });
      },

      getCurrentTrack: () => {
        const { tracks, currentTrackPath } = get();
        return tracks.find(t => t.path === currentTrackPath) ?? null;
      },

      getPlaylistTracks: () => {
        const { tracks, activePlaylist } = get();
        const playlistTracks = tracks.filter(t => t.playlist === activePlaylist);
        return playlistTracks.length > 0 ? playlistTracks : tracks;
      },

      resolveTrackSrc: (path: string) => {
        if (path.startsWith('http')) return path;
        return convertFileSrc(path);
      },
    }),
    {
      name: 'flowmanga-music',
      // Only persist settings, not runtime state
      partialize: (state) => ({
        customFolders: state.customFolders,
        customStreams: state.customStreams,
        currentTrackPath: state.currentTrackPath,
        volume: state.volume,
        isMuted: state.isMuted,
        shuffle: state.shuffle,
        repeat: state.repeat,
        savedPosition: state.savedPosition,
        activePlaylist: state.activePlaylist,
      }),
    }
  )
);
