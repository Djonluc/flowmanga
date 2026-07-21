import React from 'react';
import { Play, Clock } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Video } from '../../stores/useVideoStore';

interface VideoCardProps {
  video: Video;
  onClick: () => void;
  isCurrent?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, isCurrent }) => {
  // Format duration (seconds -> MM:SS)
  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`group relative aspect-video bg-[#050505] rounded-3xl overflow-hidden cursor-pointer transition-all duration-500 border border-white/5 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 ${isCurrent ? 'ring-2 ring-blue-500 shadow-2xl shadow-blue-500/20' : ''}`}
      onClick={onClick}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } }}
    >
      {/* Thumbnail */}
      {video.thumbnailPath ? (
        <img 
          src={convertFileSrc(video.thumbnailPath)} 
          alt={video.title}
          className="w-full h-full object-cover opacity-40 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
           <Play className="w-12 h-12 text-foreground group-hover:text-blue-500/50 transition-colors" />
        </div>
      )}

      {/* Overlay info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent p-6 flex flex-col justify-end">
         <h3 className="text-white font-black text-xs uppercase tracking-widest truncate group-hover:text-blue-400 transition-colors">{video.title}</h3>
         <div className="flex items-center text-[10px] font-bold text-foreground-dim mt-2 tracking-widest">
            <Clock className="w-3 h-3 mr-1.5 text-blue-500" />
            <span>{formatDuration(video.duration)}</span>
         </div>
      </div>

      {/* Play Overlay on Hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-blue-600/10 backdrop-blur-sm">
        <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/50 transform scale-50 group-hover:scale-100 transition-transform duration-500">
           <Play className="w-6 h-6 text-white fill-current translate-x-0.5" />
        </div>
      </div>
    </div>
  );
};
