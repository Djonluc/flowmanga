/**
 * SlideshowManager
 * 
 * Create, manage, and launch slideshow playlists.
 */

import React from 'react';
import { Play, Plus, Trash2, Film, Shuffle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGalleryStore } from '../../stores/useGalleryStore';
import { useModalStore } from '../../stores/useModalStore';
import { toast } from '../Toast';

export const SlideshowManager: React.FC = () => {
  const { slideshows, folders, savedImages, createSlideshow, deleteSlideshow, startSlideshow } = useGalleryStore();
  const { openInputModal } = useModalStore();

  const handleCreate = () => {
    openInputModal({
      title: 'New Slideshow',
      placeholder: 'Slideshow name...',
      description: 'Create an autoplay image playlist.',
      onSubmit: (name) => {
        createSlideshow(name);
        toast.success('Slideshow created');
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
            <Film size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">Slideshows</h3>
            <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-0.5">Cinematic autoplay playlists</p>
          </div>
        </div>
        <button onClick={handleCreate}
          className="px-5 py-2.5 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 transition-all active:scale-95 flex items-center gap-2">
          <Plus size={14} /> New Slideshow
        </button>
      </div>

      {slideshows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slideshows.map(show => {
            const tagList = show.tags ? show.tags.split(',').filter(Boolean) : [];
            const folder = show.folderId ? folders.find(f => f.id === show.folderId) : null;
            const imageCount = show.folderId
              ? savedImages.filter(i => i.folderId === show.folderId).length
              : show.tags
                ? savedImages.filter(i => i.tags.some(t => tagList.includes(t.toLowerCase()))).length
                : savedImages.length;

            return (
              <motion.div key={show.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="relative group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition-all">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-bold text-foreground truncate">{show.name}</h4>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startSlideshow(show.id)}
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all active:scale-90">
                      <Play size={14} />
                    </button>
                    <button onClick={() => { if (confirm('Delete slideshow?')) deleteSlideshow(show.id); }}
                      className="p-2 text-foreground-dim hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[9px] font-black text-foreground-dim uppercase tracking-widest">
                    {imageCount} images
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[9px] font-black text-foreground-dim uppercase tracking-widest">
                    {show.transition}
                  </span>
                  {show.shuffle && (
                    <span className="px-2 py-0.5 rounded-lg bg-violet-500/10 text-[9px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-1">
                      <Shuffle size={8} /> Shuffle
                    </span>
                  )}
                  {folder && (
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                      {folder.name}
                    </span>
                  )}
                  {tagList.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-[9px] font-black text-purple-400 uppercase tracking-widest">{t}</span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-center gap-4 bg-white/[0.01]">
          <Film size={32} className="text-foreground-dim/20" />
          <div>
            <p className="text-foreground/40 text-sm font-bold">No slideshows yet</p>
            <p className="text-foreground-dim text-xs mt-1">Create a cinematic playlist from your saved images</p>
          </div>
        </div>
      )}
    </div>
  );
};
