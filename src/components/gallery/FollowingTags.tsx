/**
 * FollowingTags
 * 
 * Manage and quickly search your favorited tags.
 */

import React from 'react';
import { Tag, Trash2, Search, ArrowRight } from 'lucide-react';
import { useGalleryStore } from '../../stores/useGalleryStore';
import { useModalStore } from '../../stores/useModalStore';

export const FollowingTags: React.FC = () => {
  const { 
    favoriteTags, unfavoriteTag, searchByTags, setActiveTab 
  } = useGalleryStore();

  const handleTagClick = (tag: string) => {
    setActiveTab('search');
    searchByTags(tag);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-500">
            <Tag size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">Following Tags</h3>
            <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-0.5">Your curated visual streams</p>
          </div>
        </div>
        
        <button
          onClick={() => {
            const { openInputModal } = useModalStore.getState();
            openInputModal({
              title: "Follow New Tag",
              placeholder: "Enter tag name...",
              description: "This tag will be added to your followed list for quick access.",
              onSubmit: (tag) => {
                if (tag.trim()) {
                  useGalleryStore.getState().favoriteTag(tag.trim().toLowerCase());
                }
              }
            });
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 text-[10px] font-black uppercase tracking-widest transition-all border border-pink-500/20"
        >
          <Tag size={12} />
          Follow Tag
        </button>
      </div>

      {favoriteTags.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {favoriteTags.map(tag => (
            <div
              key={tag}
              role="button"
              tabIndex={0}
              className="group flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:bg-white/[0.05] transition-all cursor-pointer"
              onClick={() => handleTagClick(tag)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleTagClick(tag);
                }
              }}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                  <Search size={14} />
                </div>
                <span className="text-sm font-bold text-foreground truncate">{tag}</span>
              </div>
              
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unfavoriteTag(tag);
                  }}
                  className="p-2 text-foreground-dim hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
                <ArrowRight size={14} className="text-foreground-dim" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-center gap-4 bg-white/[0.01]">
          <Tag size={32} className="text-foreground-dim/20" />
          <div>
            <p className="text-foreground/40 text-sm font-bold">No tags followed yet</p>
            <p className="text-foreground-dim text-xs mt-1">Favorite tags during search to see them here</p>
          </div>
        </div>
      )}
    </div>
  );
};
