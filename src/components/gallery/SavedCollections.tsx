/**
 * SavedCollections
 *
 * Displays user-created gallery folders and saved images.
 */

import React from "react";
import { Flame, Compass, Sparkles, FolderOpen, Film, Search, Tag, Plus, Trash2, HardDrive, FolderPlus, Settings, Heart, Pin } from 'lucide-react';
import { motion } from "framer-motion";
import { useGalleryStore } from "../../stores/useGalleryStore";
import { useModalStore } from "../../stores/useModalStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { ContentFilter } from "../../services/ContentFilter";
import { GalleryImageCard } from "./GalleryImageCard";
import { toast } from "../Toast";

const GALLERY_SOURCES = new Set([
  "zerochan",
  "danbooru",
  "konachan",
  "yandere",
  "gelbooru",
  "sankaku",
  "rule34",
  "safebooru",
]);

export const SavedCollections: React.FC = () => {
  const {
    savedImages,
    folders,
    createFolder,
    deleteFolder,
    togglePinFolder,
    likeImage,
    unlikeImage,
    smartCollections,
    localFolders,
    addLocalFolder,
    removeLocalFolder,
    createUserSmartCollection,
    deleteUserSmartCollection,
    togglePinUserSmartCollection,
    updateUserSmartCollection,
    openViewer,
  } = useGalleryStore();
  const { showAdultContent } = useSettingsStore();
  const { openInputModal } = useModalStore();

  const [selectedSmartCollection, setSelectedSmartCollection] = React.useState<any | null>(null);

  React.useEffect(() => {
    useGalleryStore.getState().loadUserSmartCollections();
  }, []);

  // Re-generate smart collections when adult content filter changes
  React.useEffect(() => {
    useGalleryStore.getState().generateSmartCollections();
  }, [showAdultContent]);

  const gallerySavedImages = savedImages.filter(
    (image) =>
      (image.contentType === "gallery" ||
      image.contentType === "album" ||
      GALLERY_SOURCES.has(image.source)) &&
      (showAdultContent || !ContentFilter.isAdult(image)),
  );

  const likedImages = gallerySavedImages.filter((i) => i.liked);
  const unsortedImages = gallerySavedImages.filter((i) => !i.folderId);

  const handleCreateFolder = () => {
    openInputModal({
      title: "New Gallery Folder",
      placeholder: "Folder name...",
      description: "Organize your saved images.",
      onSubmit: (name) => {
        createFolder(name);
        toast.success("Folder created");
      },
    });
  };

  const handleCreateSmartCollection = () => {
    openInputModal({
      title: "New Smart Collection",
      placeholder: "Tags (comma separated)...",
      description: "Match images with ALL these tags. Example: girl, elf, cyberpunk",
      onSubmit: (tagsStr) => {
        const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
        if (tags.length === 0) return;
        
        const name = tags.length === 1 ? tags[0] : tags.join(" + ");
        createUserSmartCollection(name, tags);
      },
    });
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <FolderOpen size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">
              Saved Collections
            </h3>
            <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-0.5">
              {savedImages.length} images saved
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateSmartCollection}
            className="px-5 py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <Plus size={14} /> Smart Collection
          </button>
          <button
            onClick={handleCreateFolder}
            className="px-5 py-2.5 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 transition-all active:scale-95 flex items-center gap-2"
          >
            <Plus size={14} /> New Folder
          </button>
        </div>
      </div>

      {/* Liked Images Section */}
      {likedImages.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Heart size={16} className="text-pink-500" />
            <h4 className="text-sm font-black text-foreground uppercase tracking-wider">
              Liked ({likedImages.length})
            </h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {likedImages.slice(0, 12).map((img, idx) => (
              <GalleryImageCard
                key={img.id}
                id={img.id}
                imageUrl={img.imageUrl}
                previewUrl={img.previewUrl}
                title={img.tags[0]}
                tags={img.tags}
                liked={true}
                saved={true}
                onView={() => openViewer(img, likedImages, idx)}
                onLike={() => unlikeImage(img.id)}
                onDelete={() => {
                  if (confirm("Remove image from library entirely?")) {
                    useGalleryStore.getState().unsaveImage(img.id);
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Folders Grid */}
      {folders.length > 0 && (
        <section>
          <h4 className="text-sm font-black text-foreground uppercase tracking-wider mb-4">
            Folders
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {folders.map((folder) => {
              const folderImages = savedImages.filter(
                (i) => i.folderId === folder.id,
              );
              return (
                <motion.div
                  key={folder.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      {folder.pinned && (
                        <Pin size={12} className="text-amber-500" />
                      )}
                      <h5 className="text-base font-bold text-foreground truncate">
                        {folder.name}
                      </h5>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => togglePinFolder(folder.id)}
                        className="p-1.5 text-foreground-dim hover:text-amber-500 transition-colors"
                      >
                        <Pin size={12} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete folder?"))
                            deleteFolder(folder.id);
                        }}
                        className="p-1.5 text-foreground-dim hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[9px] font-black text-foreground-dim uppercase tracking-widest">
                      {folderImages.length} images
                    </span>
                  </div>
                  {/* Preview Mosaic */}
                  <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden h-24">
                    {folderImages.slice(0, 3).map((img) => (
                      <img
                        key={img.id}
                        src={img.previewUrl || img.imageUrl}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ))}
                    {folderImages.length === 0 && (
                      <div className="col-span-3 flex items-center justify-center bg-white/[0.02] text-foreground-dim/20">
                        <Image size={20} />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Smart Collections Section */}
      {smartCollections.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-purple-500" />
            <h4 className="text-sm font-black text-foreground uppercase tracking-wider">
              Smart Collections
            </h4>
            <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-[8px] font-black text-purple-400 uppercase tracking-widest">
              Auto-Generated
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {smartCollections.map((smart) => (
              <motion.div
                key={smart.tag}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group bg-purple-500/5 border border-purple-500/10 rounded-2xl p-5 hover:bg-purple-500/10 transition-all cursor-pointer"
                onClick={() => setSelectedSmartCollection(smart)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h5 className="text-base font-black text-white uppercase tracking-tight truncate">
                      {smart.tag}
                    </h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-purple-400/60 uppercase tracking-widest">
                      {smart.count} items
                    </span>
                    {smart.isManual && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (smart.id && confirm("Delete smart collection?")) {
                            deleteUserSmartCollection(smart.id);
                          }
                        }}
                        className="p-1 text-purple-400/40 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Preview Mosaic */}
                <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden h-20 opacity-60 group-hover:opacity-100 transition-opacity">
                  {smart.images.slice(0, 3).map((img) => (
                    <img
                      key={img.id}
                      src={img.previewUrl || img.imageUrl}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ))}
                  {smart.images.length === 0 && (
                    <div className="col-span-3 flex items-center justify-center bg-white/[0.02] text-white/5">
                      <Sparkles size={20} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Selected Collection View Modal-like Overlay or Inline */}
      {selectedSmartCollection && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl p-8 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedSmartCollection(null)}
                  className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all"
                >
                  <FolderOpen size={20} className="rotate-180" />
                </button>
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">
                    {selectedSmartCollection.tag}
                  </h2>
                  <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest mt-1">
                    Smart Collection • {selectedSmartCollection.count} Results
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {selectedSmartCollection.isManual && (
                  <button 
                    onClick={() => {
                      const usc = useGalleryStore.getState().userSmartCollections.find(c => c.id === selectedSmartCollection.id);
                      if (!usc) return;
                      openInputModal({
                        title: "Edit Smart Collection",
                        defaultValue: usc.tags.join(", "),
                        placeholder: "Tags...",
                        description: "Update the tags for this collection.",
                        onSubmit: (tagsStr) => {
                          const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
                          if (tags.length === 0) return;
                          updateUserSmartCollection(usc.id, selectedSmartCollection.tag, tags);
                          // Refresh selected view if needed (though store update might trigger it if we bind it right)
                          setSelectedSmartCollection({ ...selectedSmartCollection, tags } as any);
                        }
                      });
                    }}
                    className="p-3.5 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all"
                  >
                    <Settings size={18} />
                  </button>
                )}
                <button 
                  onClick={() => useGalleryStore.getState().startSlideshowFromContext(selectedSmartCollection.images)}
                  className="px-8 py-3.5 bg-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-purple-400 transition-all active:scale-95 shadow-lg shadow-purple-500/20"
                >
                  Play Slideshow
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {selectedSmartCollection.images.map((img, idx) => (
                <GalleryImageCard
                  key={img.id}
                  id={img.id}
                  imageUrl={img.imageUrl}
                  previewUrl={img.previewUrl}
                  title={img.tags[0]}
                  tags={img.tags}
                  liked={img.liked}
                  saved={true}
                  onView={() => openViewer(img, selectedSmartCollection.images, idx)}
                  onDelete={() => {
                    if (confirm("Remove image from library entirely?")) {
                      useGalleryStore.getState().unsaveImage(img.id);
                      // Update local state to reflect deletion
                      setSelectedSmartCollection(prev => 
                        prev ? { ...prev, images: prev.images.filter(i => i.id !== img.id) } : null
                      );
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Local Media Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-sky-400" />
            <h4 className="text-sm font-black text-foreground uppercase tracking-wider">
              Local Media
            </h4>
          </div>
          <button 
            onClick={addLocalFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            <FolderPlus size={14} /> Add Folder
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {localFolders.map((local) => (
            <div key={local.id} className="relative group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex items-center justify-between hover:bg-white/[0.05] transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0">
                  <FolderOpen size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{local.name}</p>
                  <p className="text-[9px] text-foreground-dim truncate opacity-60 uppercase tracking-widest">{local.path}</p>
                </div>
              </div>
              <button 
                onClick={() => removeLocalFolder(local.id)}
                className="p-2 text-foreground-dim hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {localFolders.length === 0 && (
            <div className="col-span-full py-8 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center gap-2 bg-white/[0.01]">
              <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest opacity-40">
                No local folders linked
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Unsorted Images */}
      {unsortedImages.length > 0 && (
        <section>
          <h4 className="text-sm font-black text-foreground uppercase tracking-wider mb-4">
            Unsorted ({unsortedImages.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {unsortedImages.map((img, idx) => (
              <GalleryImageCard
                key={img.id}
                id={img.id}
                imageUrl={img.imageUrl}
                previewUrl={img.previewUrl}
                title={img.tags[0]}
                tags={img.tags}
                liked={img.liked}
                saved={true}
                onView={() => openViewer(img, unsortedImages, idx)}
                onLike={() =>
                  img.liked ? unlikeImage(img.id) : likeImage(img.id)
                }
                onDelete={() => {
                  if (confirm("Remove image from library entirely?")) {
                    useGalleryStore.getState().unsaveImage(img.id);
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {savedImages.length === 0 && folders.length === 0 && (
        <div className="py-20 border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-center gap-4 bg-white/[0.01]">
          <FolderOpen size={32} className="text-foreground-dim/20" />
          <div>
            <p className="text-foreground/40 text-sm font-bold">
              No saved images yet
            </p>
            <p className="text-foreground-dim text-xs mt-1">
              Browse Trending or Discover to start saving
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
