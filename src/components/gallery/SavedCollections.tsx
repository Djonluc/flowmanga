/**
 * SavedCollections
 *
 * Displays user-created gallery folders and saved images.
 */

import React from "react";
import { FolderOpen, Plus, Trash2, Pin, Heart, Image } from "lucide-react";
import { motion } from "framer-motion";
import { useGalleryStore } from "../../stores/useGalleryStore";
import { useModalStore } from "../../stores/useModalStore";
import { GalleryImageCard } from "./GalleryImageCard";
import { toast } from "../Toast";

const GALLERY_SOURCES = new Set([
  "zerochan",
  "danbooru",
  "konachan",
  "yandere",
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
    openViewer,
  } = useGalleryStore();
  const { openInputModal } = useModalStore();

  const gallerySavedImages = savedImages.filter(
    (image) =>
      image.contentType === "gallery" ||
      image.contentType === "album" ||
      GALLERY_SOURCES.has(image.source),
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
        <button
          onClick={handleCreateFolder}
          className="px-5 py-2.5 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 transition-all active:scale-95 flex items-center gap-2"
        >
          <Plus size={14} /> New Folder
        </button>
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
