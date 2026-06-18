import React, { useEffect, useState } from 'react';
import { useImageCollectionStore } from '../useImageCollectionStore';
import { MasonryGrid } from './MasonryGrid';
import { Folder, Plus, Trash2 } from 'lucide-react';
import { useSlideshowStore } from '../useSlideshowStore';

export const MyCollectionTab = () => {
  const { folders, savedImages, loadFolders, loadSavedImages, createFolder, deleteFolder } = useImageCollectionStore();
  const slideshow = useSlideshowStore();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  useEffect(() => {
    loadFolders();
    loadSavedImages(activeFolderId);
  }, [activeFolderId]);

  const handleCreateFolder = () => {
    const name = prompt("Enter folder name:");
    if (name) createFolder(name);
  };

  return (
    <div className="w-full h-full flex flex-col relative bg-background">
      {/* Folder Header */}
      <div className="flex-none p-6 border-b border-border-subtle flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black uppercase tracking-widest text-foreground bg-gradient-to-r from-accent to-purple-500 bg-clip-text text-transparent w-max">
              {activeFolderId ? folders.find(f => f.id === activeFolderId)?.name : "All Saved Images"}
            </h2>
            <p className="text-xs font-bold text-foreground-muted uppercase tracking-widest mt-1">
              {savedImages.length} {savedImages.length === 1 ? 'Item' : 'Items'} in Collection
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeFolderId && (
              <button 
                onClick={() => {
                  if (confirm("Delete this folder? Images will not be deleted, just removed from the folder.")) {
                    deleteFolder(activeFolderId);
                    setActiveFolderId(null);
                  }
                }}
                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button 
              onClick={() => setActiveFolderId(null)}
              className={`px-4 py-2 font-bold text-sm uppercase tracking-widest rounded-xl transition-all ${!activeFolderId ? 'bg-accent text-white' : 'bg-surface border border-border-subtle text-foreground-muted hover:text-foreground'}`}
            >
              All Images
            </button>
          </div>
        </div>

        {/* Folder List */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 pt-2 px-1">
          <button 
            onClick={handleCreateFolder}
            className="flex-none h-12 px-5 border-2 border-dashed border-border-subtle hover:border-accent text-foreground-muted hover:text-accent rounded-xl flex items-center gap-2 transition-all font-black text-sm uppercase tracking-widest hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
          >
            <Plus size={18} strokeWidth={3} /> New Folder
          </button>
          
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setActiveFolderId(folder.id)}
              className={`group flex-none h-12 px-6 rounded-xl flex items-center gap-3 font-black text-sm uppercase tracking-widest transition-all border ${activeFolderId === folder.id ? 'bg-accent border-accent text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] -translate-y-0.5' : 'bg-surface border-border-subtle text-foreground-muted hover:text-foreground hover:border-white/20 hover:-translate-y-0.5 hover:shadow-lg'}`}
            >
              <Folder size={18} fill={activeFolderId === folder.id ? "currentColor" : "none"} className={`transition-all ${activeFolderId === folder.id ? 'text-white' : 'text-foreground-muted group-hover:text-accent'}`} />
              {folder.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden relative">
        {savedImages.length > 0 ? (
          <MasonryGrid 
            images={savedImages} 
            columns={5} 
            onImageClick={(_, index) => slideshow.start(index, savedImages)} 
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-foreground-muted">
            <div className="w-24 h-24 mb-6 rounded-full bg-white/5 flex items-center justify-center text-white/20">
              <Folder size={48} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-widest text-foreground mb-2">It's quiet in here...</h3>
            <p className="text-sm font-medium opacity-60">Save some images to this folder to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
};
