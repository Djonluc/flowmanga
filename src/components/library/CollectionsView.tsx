import { motion } from "framer-motion";
import { Layers, Plus, Trash2, FolderOpen, Sparkles, Shuffle } from "lucide-react";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { useModalStore } from "../../stores/useModalStore";
import { MangaCard } from "../library/MangaCard";
import { toast } from "../Toast";

export const CollectionsView = () => {
  const { collections, series, deleteCollection, createCollection, setSelectedSeriesId } = useLibraryStore();
  const { openInputModal } = useModalStore();

  const handleCreateCollection = () => {
    openInputModal({
      title: "New Collection",
      placeholder: "Collection name...",
      description: "Group your favorite albums and series.",
      onSubmit: (name) => {
        createCollection(name);
        toast.success("Collection created");
      },
    });
  };

  return (
    <div className="h-full flex flex-col gap-8 p-6 overflow-y-auto no-scrollbar">
      {/* Header Actions */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <Layers size={24} />
            </div>
            <div>
                <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase italic">Collections</h2>
                <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-1">Manage your curated albums</p>
            </div>
        </div>

        <button
          onClick={handleCreateCollection}
          className="px-6 py-3 bg-white text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-neutral-200 transition-all active:scale-95 flex items-center gap-2 shadow-xl shadow-white/5"
        >
          <Plus size={16} />
          Create New
        </button>
      </div>

      {/* Collections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
        {collections.map((collection) => (
          <motion.div
            key={collection.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-white/[0.03] border border-white/5 rounded-[32px] p-6 hover:bg-white/[0.05] transition-all"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <FolderOpen size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-foreground truncate max-w-[150px]">{collection.name}</h3>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this collection?")) deleteCollection(collection.id);
                  }}
                  className="p-2 text-foreground-dim hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-lg bg-white/5 text-[10px] font-black text-foreground-dim uppercase tracking-widest">
                  {collection.seriesIds.length} Items
                </span>
                <span className="px-3 py-1 rounded-lg bg-indigo-500/10 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                    Album
                </span>
              </div>

              {/* Preview Stack */}
              <div className="relative h-40 mt-2">
                 {collection.seriesIds.length > 0 ? (
                    collection.seriesIds.slice(0, 3).map((sid, idx) => {
                        const s = series.find(x => x.id === sid);
                        if (!s) return null;
                        return (
                            <div 
                                key={sid}
                                className="absolute inset-0 rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-500"
                                style={{ 
                                    transform: `translateX(${idx * 12}px) translateY(${idx * 8}px) scale(${1 - idx * 0.05})`,
                                    zIndex: 10 - idx,
                                    opacity: 1 - idx * 0.3
                                }}
                            >
                                <img src={s.cover || undefined} className="w-full h-full object-cover" alt="" />
                            </div>
                        );
                    })
                 ) : (
                    <div className="w-full h-full rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-foreground-muted gap-2">
                        <Plus size={24} className="opacity-20" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Empty Collection</span>
                    </div>
                 )}
              </div>
            </div>
          </motion.div>
        ))}

        {collections.length === 0 && (
            <div className="col-span-full py-20 border-2 border-dashed border-white/5 rounded-[48px] flex flex-col items-center justify-center text-center gap-4 bg-white/[0.01]">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-foreground-muted">
                    <Layers size={32} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-foreground/40">No Collections Yet</h3>
                    <p className="text-foreground-muted text-xs mt-1">Start by creating a new album group</p>
                </div>
            </div>
        )}
      </div>

      {/* Random Discoveries / Shuffle Section */}
      <section className="mt-12 px-4 mb-20">
         <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Shuffle size={20} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">Random Discoveries</h3>
                    <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-1">Randomly picked from your collections</p>
                </div>
            </div>
            <button className="text-foreground-dim hover:text-foreground transition-colors">
                <Sparkles size={20} />
            </button>
         </div>

         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {series
                .sort(() => Math.random() - 0.5)
                .slice(0, 6)
                .map((item) => (
                    <MangaCard 
                        key={item.id}
                        item={item}
                        onClick={() => setSelectedSeriesId(item.id)}
                        density="comfortable"
                    />
                ))
            }
         </div>
      </section>
    </div>
  );
};
