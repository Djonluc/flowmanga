import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Maximize, Minimize, Repeat, Shuffle, ArrowLeft, ListVideo 
} from 'lucide-react';
import { useVideoStore } from '../../stores/useVideoStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { VideoPlaylist } from './VideoPlaylist';

export const VideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { 
    currentVideo, isPlaying, volume, playbackRate, folders,
    togglePlay, nextVideo, prevVideo, setVolume, setPlaybackRate, 
    updateVideoProgress 
  } = useVideoStore();

  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const folder = folders.find(f => f.id === currentVideo?.folderId);
  const repeatMode = folder?.repeatMode || 'off';
  const isShuffled = folder?.shuffleEnabled || false;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) video.play().catch(() => togglePlay(false));
    else video.pause();
    
    video.volume = volume;
    video.playbackRate = playbackRate;
  }, [isPlaying, volume, playbackRate, currentVideo, togglePlay]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showPlaylist) setShowControls(false); 
    }, 2000);
  }, [isPlaying, showPlaylist]);

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
       await containerRef.current.requestFullscreen();
       setIsFullscreen(true);
    } else {
       await document.exitFullscreen();
       setIsFullscreen(false);
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentVideo) return;
      
      switch(e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (videoRef.current) videoRef.current.currentTime += 5;
          break;
        case 'ArrowLeft':
          if (videoRef.current) videoRef.current.currentTime -= 5;
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentVideo, togglePlay]);

  const handleTimeUpdate = () => {
     if (videoRef.current) {
        const time = videoRef.current.currentTime;
        setCurrentTime(time);
        
        if (Math.floor(time) % 5 === 0 && currentVideo) {
            updateVideoProgress(currentVideo.id, time);
        }
     }
  };
  
  const handleLoadedMetadata = () => {
     if (videoRef.current && currentVideo) {
        setDuration(videoRef.current.duration);
        if (currentVideo.lastPosition && currentVideo.lastPosition > 0) {
            videoRef.current.currentTime = currentVideo.lastPosition;
        }
        if (isPlaying) videoRef.current.play();
     }
  };

  const handleEnded = () => {
     if (repeatMode === 'one') {
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        }
     } else {
        nextVideo();
     }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (videoRef.current) videoRef.current.currentTime = time;
      setCurrentTime(time);
  };

  const formatTime = (seconds: number) => {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  if (!currentVideo) return null;

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-black flex flex-col justify-center items-center group overflow-hidden ${!showControls && !showPlaylist ? 'cursor-none' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && !showPlaylist && setShowControls(false)}
    >
        <video
           ref={videoRef}
           src={currentVideo.filePath ? convertFileSrc(currentVideo.filePath) : undefined}
           className="max-w-full max-h-full object-contain"
           onTimeUpdate={handleTimeUpdate}
           onLoadedMetadata={handleLoadedMetadata}
           onEnded={handleEnded}
           onClick={() => togglePlay()}
        />

        {/* Top Bar */}
        <div className={`absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center space-x-4">
                <button 
                  onClick={() => useVideoStore.setState({ currentVideo: null, isPlaying: false })}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                    <ArrowLeft className="text-white w-6 h-6" />
                </button>
                <div className="flex flex-col">
                  <h2 className="text-white font-medium truncate">{currentVideo.title}</h2>
                  {currentVideo.resolution && (
                    <span className="text-[10px] text-foreground-dim">{currentVideo.resolution}</span>
                  )}
                </div>
            </div>
        </div>

        {/* Bottom Controls */}
        <div className={`absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            
            <div className="flex items-center space-x-3 mb-4 group/seek">
                <span className="text-xs text-foreground-muted w-10 text-right">{formatTime(currentTime)}</span>
                <input 
                   type="range" 
                   min={0} 
                   max={duration || 100} 
                   value={currentTime} 
                   onChange={handleSeek}
                   className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
                />
                <span className="text-xs text-foreground-muted w-10">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button onClick={prevVideo} className="text-foreground-muted hover:text-white p-2 rounded-full transition-colors">
                        <SkipBack className="w-6 h-6" />
                    </button>
                    <button onClick={() => togglePlay()} className="text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all scale-110">
                        {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                    </button>
                    <button onClick={nextVideo} className="text-foreground-muted hover:text-white p-2 rounded-full transition-colors">
                        <SkipForward className="w-6 h-6" />
                    </button>

                    <div className="group/vol flex items-center space-x-2 ml-4">
                        <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="text-foreground-muted hover:text-white transition-colors">
                            {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <input 
                           type="range" 
                           min={0} 
                           max={1} 
                           step={0.1}
                           value={volume}
                           onChange={(e) => setVolume(parseFloat(e.target.value))}
                           className="w-0 overflow-hidden group-hover/vol:w-24 transition-all h-1 bg-gray-500 accent-blue-500"
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <button 
                       onClick={() => setPlaybackRate(playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : playbackRate === 2 ? 0.5 : 1)}
                       className="text-xs font-bold text-foreground-muted hover:text-white border border-gray-500 px-2 py-1 rounded transition-colors"
                    >
                        {playbackRate}x
                    </button>

                    <div className="flex bg-white/5 rounded-full p-1 space-x-1">
                      <button 
                          onClick={() => useVideoStore.getState().toggleShuffle()}
                          className={`p-1.5 rounded-full ${isShuffled ? 'text-blue-400 bg-white/10' : 'text-foreground-dim hover:text-foreground-muted'}`}
                          title={`Shuffle: ${isShuffled ? 'ON' : 'OFF'}`}
                      >
                          <Shuffle className="w-4 h-4" />
                      </button>
                      <button 
                          onClick={() => useVideoStore.getState().toggleRepeat()}
                          className={`p-1.5 rounded-full ${repeatMode !== 'off' ? 'text-blue-400 bg-white/10' : 'text-foreground-dim hover:text-foreground-muted'}`}
                          title={`Repeat: ${repeatMode.toUpperCase()}`}
                      >
                          <Repeat className="w-4 h-4" />
                          {repeatMode === 'one' && (
                              <span className="absolute text-[8px] font-bold top-1 right-1">1</span>
                          )}
                      </button>
                    </div>

                    <div className="w-px h-6 bg-white/20 mx-2" />

                    <button 
                        onClick={() => setShowPlaylist(true)} 
                        className={`text-foreground-muted hover:text-white p-2 transition-colors ${showPlaylist ? 'text-blue-400' : ''}`}
                        title="Playlist"
                    >
                        <ListVideo className="w-5 h-5" />
                    </button>

                    <button onClick={toggleFullscreen} className="text-foreground-muted hover:text-white p-2 transition-colors">
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
        
        <VideoPlaylist isOpen={showPlaylist} onClose={() => setShowPlaylist(false)} />
    </div>
  );
};
