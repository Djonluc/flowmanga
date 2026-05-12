import React from 'react';
import { Folder } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { VideoFolder } from '../../stores/useVideoStore';

interface VideoFolderGridProps {
  folders: VideoFolder[];
  onSelectFolder: (folder: VideoFolder) => void;
}

export const VideoFolderGrid: React.FC<VideoFolderGridProps> = ({ folders, onSelectFolder }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-6">
      {folders.map(folder => (
        <div 
          key={folder.id}
          onClick={() => onSelectFolder(folder)}
          className="group cursor-pointer flex flex-col items-center"
        >
           {/* Folder Icon / Cover */}
           <div className="relative w-full aspect-[2/3] bg-[#050505] rounded-3xl overflow-hidden border border-white/5 transition-all duration-500 hover:scale-105 hover:border-blue-500/50 shadow-2xl group-hover:shadow-blue-500/10">
               {folder.videos[0]?.thumbnailPath ? (
                   <img 
                      src={convertFileSrc(folder.videos[0].thumbnailPath)} 
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"
                   />
               ) : (
                   <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
                       <Folder className="w-16 h-16 text-foreground group-hover:text-blue-500/50 transition-colors" />
                   </div>
               )}
               
               <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-6 pt-12">
                   <div className="bg-blue-600/20 backdrop-blur-md border border-blue-500/20 px-3 py-1 rounded-full text-[10px] font-black tracking-widest text-blue-400 inline-block">
                    {folder.videos.length} ITEMS
                   </div>
               </div>
           </div>

           <h3 className="mt-4 text-foreground font-black text-xs uppercase tracking-widest text-center truncate w-full px-4 opacity-50 group-hover:opacity-100 transition-opacity">
               {folder.name}
           </h3>
        </div>
      ))}
    </div>
  );
};
