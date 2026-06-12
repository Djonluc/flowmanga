import React, { useEffect, useState } from 'react';
import { useVideoStore, type VideoFolder } from '../../stores/useVideoStore';
import { VideoFolderGrid } from './VideoFolderGrid';
import { VideoCard } from './VideoCard';
import { VideoPlayer } from './VideoPlayer';
import { ArrowLeft, Plus } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

export const VideoLibrary: React.FC = () => {
  const { folders, loadFromDb, playVideo, currentVideo } = useVideoStore();
  const [selectedFolder, setSelectedFolder] = useState<VideoFolder | null>(null);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  const handleScanFolder = async () => {
     const selected = await open({
       directory: true,
       multiple: false,
     });

     if (selected && typeof selected === 'string') {
         try {
             await useVideoStore.getState().addFolder(selected);
         } catch (err) {
             console.error('Failed to scan video folder', err);
         }
     }
  };

  return (
    <div className="h-full w-full bg-transparent text-foreground overflow-hidden flex flex-col relative">
      {/* Video Player Overlay */}
      {currentVideo && <VideoPlayer />}

      {/* Header */}
      <div className="flex items-center justify-between p-8 border-b border-border-subtle bg-background/50 backdrop-blur-2xl z-10">
         <div className="flex items-center space-x-6">
             {selectedFolder && (
                 <button 
                    onClick={() => setSelectedFolder(null)}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 group"
                 >
                     <ArrowLeft className="w-5 h-5 text-foreground-dim group-hover:text-foreground" />
                 </button>
             )}
             <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground leading-none">
                    {selectedFolder ? selectedFolder.name : 'VIDEOS'}
                </h1>
                <p className="text-foreground-dim font-bold text-xs uppercase tracking-widest mt-2">
                    {selectedFolder ? `${selectedFolder.videos.length} items discovered` : `${folders.length} linked sources`}
                </p>
             </div>
         </div>

         <button 
            onClick={handleScanFolder}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-blue-500/20 active:scale-95"
         >
             <Plus className="w-5 h-5" />
             <span>Add Folder</span>
         </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
          {selectedFolder ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-6">
                  {selectedFolder.videos.map(video => (
                      <VideoCard 
                         key={video.id} 
                         video={video} 
                         onClick={() => playVideo(video, selectedFolder)}
                      />
                  ))}
              </div>
          ) : (
              folders.length > 0 ? (
                  <VideoFolderGrid 
                     folders={folders} 
                     onSelectFolder={setSelectedFolder} 
                  />
              ) : (
                  <div className="h-full flex flex-col items-center justify-center p-12">
                      <div className="max-w-md w-full p-10 rounded-[48px] bg-white/[0.02] border border-white/5 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 -z-10" />
                          <div className="w-20 h-20 rounded-3xl bg-blue-600/20 flex items-center justify-center mb-6">
                              <Plus className="w-10 h-10 text-blue-500" />
                          </div>
                           <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">No Videos Yet</h2>
                          <p className="text-foreground-dim font-bold text-xs uppercase tracking-widest mb-8">Link a folder to populate your archive.</p>
                          <button 
                            onClick={handleScanFolder}
                            className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-neutral-200 transition-all active:scale-95"
                          >
                              Link Source Directory
                          </button>
                      </div>
                  </div>
              )
          )}
      </div>
    </div>
  );
};
