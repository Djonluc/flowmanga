import { useEffect, useState, useRef, useMemo } from "react";
import { useScraperStore } from "../stores/useScraperStore";
import { useLibraryStore } from "../stores/useLibraryStore";
import { useReadingStore } from "../stores/useReadingStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useModalStore } from "../stores/useModalStore";
import {
  FolderOpen,
  PlusCircle,
  LayoutGrid,
  Library as LibraryIcon,
  Tag,
  Edit2,
  Trash2,
  X,
  Sparkles,
  Bell,
  Heart,
  Layers,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ShelfView } from "./library/ShelfView";
import { GridView } from "./library/GridView";
import { CollectionsView } from "./library/CollectionsView";
import { LibraryFilterDrawer } from "./library/LibraryFilterDrawer";
import { toast } from "./Toast";
import { MangaDetails } from "./library/MangaDetails";
import { ScraperService } from "../services/ScraperService";
import { ContentFilter } from "../services/ContentFilter";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useProxiedImage } from '../hooks/useProxiedImage';
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import clsx from "clsx";
import type { Series } from "../stores/useLibraryStore";

const ProxiedLibraryImage = ({ src, className, alt }: { src: string, className?: string, alt?: string }) => {
  const { src: proxiedSrc, handleError } = useProxiedImage(src);
  return <img src={proxiedSrc} className={className} alt={alt} onError={() => handleError()} />;
};

export const LibraryGrid = () => {
  const {
    series,
    addMangaFolder,
    loadFromDb,
    isLoading,
    setLoading,
    searchQuery,
    filterGenre,
    filterTags,
    filterSource,
    filterStatus,
    selectedSeriesId,
    setSearchQuery,
    setFilterGenre,
    toggleFilterTag,
    clearFilterTags,
    setFilterSource,
    setSelectedSeriesId,
    renameSeries,
    refreshMangaMetadata,
    selectionMode,
    selectedIds,
    toggleSelectionMode,
    toggleSelectedId,
    clearSelection,
    bulkDelete,
  } = useLibraryStore();

  const { setUrl, setAutoOpenModal, autoOpenModal } = useScraperStore();
  const { openFolder } = useReadingStore();
  const {
    activeView,
    libraryViewMode,
    libraryDensity,
    setLibraryViewMode,
    setLibraryDensity,
    isInitializing,
    showAdultContent,
  } = useSettingsStore();
  const {
    openImportModal,
    openTagManager,
    openInputModal,
    openDeleteModal,
    openQuickView,
  } = useModalStore();

  const tagRef = useRef<HTMLDivElement>(null);

  const scrollTags = (direction: "left" | "right") => {
    if (tagRef.current) {
      const { scrollLeft, clientWidth } = tagRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth * 0.5
          : scrollLeft + clientWidth * 0.5;
      tagRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<{
    x: number;
    y: number;
    item: any;
  } | null>(null);

  // External Recommendations
  const [externalResults, setExternalResults] = useState<any[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);

  useEffect(() => {
    if (filterTags.length > 0) {
      const fetchExternal = async () => {
        setIsSearchingExternal(true);
        try {
          const results = await ScraperService.getRecommendationsByTags(
            filterTags,
            12,
            false,
            "manga",
          );
          const filtered = results.filter((ext) => {
            const extTitle = (ext.title || "").toLowerCase();
            return !series.some((s) => {
              const sTitle = (s.title || "").toLowerCase();
              return s.mangaId === ext.id || sTitle === extTitle;
            });
          });
          setExternalResults(filtered);
        } catch (e) {
          console.error("Failed to fetch external recommendations", e);
        } finally {
          setIsSearchingExternal(false);
        }
      };
      fetchExternal();
    } else {
      setExternalResults([]);
    }
  }, [filterTags, series]);

  useEffect(() => {
    if (!isInitializing) {
      loadFromDb();
    }
  }, [loadFromDb, isInitializing]);

  useEffect(() => {
    if (autoOpenModal) {
      openImportModal();
      setAutoOpenModal(false);
    }
  }, [autoOpenModal, setAutoOpenModal, openImportModal]);

  // --- Filtering Logic ---
  const displayItems = useMemo(() => {
    if (selectedSeriesId) {
      const selectedSeries = series.find((s) => s.id === selectedSeriesId);
      if (!selectedSeries) return [];
      return selectedSeries.books.filter((book) =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    let baseSeries = series;

    // Apply View-Specific Filtering
    if (activeView === "updates") {
      baseSeries = series.filter(
        (s) =>
          s.updatedAt &&
          new Date().getTime() - new Date(s.updatedAt).getTime() <
            7 * 24 * 60 * 60 * 1000,
      );
    } else if (activeView === "favorites") {
      baseSeries = series.filter(
        (s) =>
          s.tags && s.tags.some((t) => t && t.toLowerCase() === "favorite"),
      );
    }

    return baseSeries.filter((s) => {
      const title = s.title || "";
      const author = s.author || "";
      const matchesSearch =
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.tags && s.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
      const matchesTags =
        filterTags.length === 0 ||
        filterTags.every((tag) => s.tags && s.tags.includes(tag));
      const matchesSource = !filterSource || s.source === filterSource;
      const isAdult = ContentFilter.isAdult(s);

      const hasProgress = s.books && s.books.some(b => b.progress && b.progress.currentPage > 0);
      const isCompleted = s.books && s.books.length > 0 && s.books.every(b => b.progress && b.progress.currentPage >= (b.progress.totalPages || 1) - 1);
      
      let matchesStatus = true;
      if (filterStatus === 'unread') matchesStatus = !hasProgress;
      else if (filterStatus === 'reading') matchesStatus = hasProgress && !isCompleted;
      else if (filterStatus === 'completed') matchesStatus = isCompleted;
      
      return matchesSearch && matchesTags && matchesSource && matchesStatus && !isAdult;
    });
  }, [series, selectedSeriesId, searchQuery, activeView, filterTags, filterSource, filterStatus, showAdultContent]);
  const GLOBAL_TAGS = [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
    "Horror", "Mystery", "Psychological", "Romance", 
    "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
    "Isekai", "Shounen", "Shoujo", "Seinen", "Josei", "Mecha"
  ];
  
  const allTags = useMemo(() => {
    const rawTags = Array.from(
      new Set([...GLOBAL_TAGS, ...series.flatMap((s) => s.tags || [])]),
    ).sort();

    return showAdultContent 
      ? rawTags 
      : rawTags.filter(tag => !ContentFilter.isAdultTag(tag));
  }, [series, showAdultContent]);

  const handleAction = async (
    action: "tag" | "rename" | "delete" | "refresh" | "favorite",
    item: any,
  ) => {
    setActiveMenu(null);
    if (action === "tag") {
      openTagManager(item.id, item.tags || []);
    } else if (action === "rename") {
      openInputModal({
        title: "Rename Series",
        placeholder: "New title...",
        description: `Renaming: ${item.title}`,
        initialValue: item.displayName || item.title,
        onSubmit: async (newTitle) => {
          await useLibraryStore.getState().setSeriesDisplayTitle(item.id, newTitle);
          toast.success("Series renamed");
        },
      });
    } else if (action === "refresh") {
      toast.info(`Refreshing metadata for ${item.title}...`);
      await refreshMangaMetadata(item.id);
      toast.success("Metadata updated");
    } else if (action === "delete") {
      const isSeries = "books" in item;
      openDeleteModal({
        id: item.id,
        path: item.path,
        title: item.title,
        count: isSeries ? item.books.length : 1,
        isSeries,
      });
    } else if (action === "favorite") {
      await useLibraryStore.getState().toggleFavorite(item.id);
      toast.success(
        item.tags?.includes("favorite")
          ? "Removed from favorites"
          : "Added to favorites",
      );
    }
  };

  const handleMenuClick = (
    item: any,
    action?: "rename" | "delete" | "tag" | "refresh",
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    if (action) {
      handleAction(action, item);
    } else if (e) {
      const menuWidth = 200;
      const menuHeight = 250;
      const padding = 12;
      const x = Math.min(e.clientX, window.innerWidth - menuWidth - padding);
      const y = Math.min(e.clientY, window.innerHeight - menuHeight - padding);
      setActiveMenu({ x: Math.max(padding, x), y: Math.max(padding, y), item });
    }
  };

  const handleSelectLibrary = async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setLoading(true);
      try {
        await addMangaFolder(selected);
        toast.success("Library folder added!");
      } catch (e) {
        console.error("[Library] Error adding folder", e);
        toast.error("Failed to add folder");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOpenItem = async (item: any) => {
    if (selectionMode) {
      toggleSelectedId(item.id);
      return;
    }

    if ("books" in item) {
      setSelectedSeriesId(item.id);
      setSearchQuery("");
    } else {
      await openFolder(item.path, item.seriesId, item.id);
    }
  };

  const getHeaderInfo = () => {
    switch (activeView) {
      case "updates":
        return {
          title: "Recent Updates",
          icon: <Bell className="text-accent" />,
        };
      case "favorites":
        return {
          title: "My Favorites",
          icon: <Heart className="text-accent" />,
        };
      case "collections":
        return {
          title: "Collections",
          icon: <Layers className="text-accent" />,
        };
      case "downloads":
        return {
          title: "Summons",
          icon: <Download size={20} className="text-accent" />,
        };
      default:
        return {
          title: "My Archive",
          icon: <LibraryIcon className="text-accent" />,
        };
    }
  };

  const header = getHeaderInfo();

  return (
    <div className="h-full relative overflow-hidden">
      <AnimatePresence mode="wait">
        {selectedSeriesId ? (
          <MangaDetails
            key="details"
            seriesId={selectedSeriesId}
            onBack={() => {
              setSelectedSeriesId(null);
              setSearchQuery("");
            }}
          />
        ) : (
          <motion.div
            key="library"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col"
          >
            {activeView === "collections" ? (
              <CollectionsView />
            ) : series.length === 0 ? (
              <EmptyState
                onImport={() => openImportModal()}
                onLink={handleSelectLibrary}
              />
            ) : (
              <div
                className="h-full p-4 overflow-y-auto no-scrollbar flex flex-col relative"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
              >
                {isDragging && <DragOverlay />}

                <div className="flex flex-col gap-6 mb-4 px-4 pt-2 z-10 shrink-0">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-surface-elevated border border-border-subtle flex items-center justify-center shadow-lg">
                          {header.icon}
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-foreground leading-none">
                          {header.title}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <p className="text-foreground-dim font-medium text-xs tracking-wide">
                          {series.length} Total
                        </p>
                        <div className="w-px h-3 bg-border-subtle" />
                        <p className="text-foreground-dim font-medium text-xs tracking-wide">
                          {displayItems.length} Filtered
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="relative w-64">
                          <input
                              type="text"
                              placeholder="Search library..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-surface-elevated border border-border-subtle rounded-full pl-10 pr-4 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-foreground-muted shadow-sm"
                          />
                          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" />
                      </div>

                      <button
                          onClick={() => setIsFilterDrawerOpen(true)}
                          className={clsx(
                              "px-4 py-2.5 rounded-full transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2 border",
                              (filterTags.length > 0 || filterSource || filterStatus)
                                ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                                : "bg-surface-elevated text-foreground-dim border-border-subtle hover:text-foreground hover:bg-surface-raised"
                          )}
                      >
                          <Filter size={14} /> Filters
                          {(filterTags.length > 0 || filterSource || filterStatus) && (
                              <span className="w-2 h-2 rounded-full bg-white ml-1" />
                          )}
                      </button>

                      <button
                        onClick={toggleSelectionMode}
                        className={clsx(
                          "px-4 py-2.5 rounded-full transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2 border",
                          selectionMode
                            ? "bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-500/20"
                            : "bg-surface-elevated text-foreground-dim border-border-subtle hover:text-foreground hover:bg-surface-raised"
                        )}
                      >
                        <Layers size={14} />
                        {selectionMode ? "Cancel Selection" : "Batch Actions"}
                      </button>

                      {activeView === "collections" && (
                        <button
                          onClick={() => {
                            useModalStore.getState().openInputModal({
                              title: "New Faction",
                              placeholder: "Faction name...",
                              onSubmit: (name) => {
                                useLibraryStore.getState().createCollection(name);
                                toast.success("Faction created");
                              },
                            });
                          }}
                          className="px-4 py-2.5 bg-accent text-white hover:opacity-90 rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-[0.97] flex items-center gap-2 shadow-lg shadow-accent/20 border border-accent"
                        >
                          <PlusCircle size={14} /> New Faction
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {isLoading ? (
                    <LoadingDisplay />
                  ) : displayItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-foreground-dim">
                            {searchQuery || filterTags.length > 0 || filterSource || filterStatus ? <Search size={28} /> : <LibraryIcon size={28} />}
                        </div>
                        <h3 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">
                            {searchQuery || filterTags.length > 0 || filterSource || filterStatus ? "No Matches Found" : "Library Empty"}
                        </h3>
                        <p className="text-foreground-muted text-sm font-medium mb-8 max-w-sm">
                            {searchQuery || filterTags.length > 0 || filterSource || filterStatus 
                                ? "Try adjusting your filters or search query to find what you're looking for." 
                                : "Your library is empty. Import local folders or discover new series from the network."}
                        </p>
                        <div className="flex items-center gap-4">
                            {searchQuery || filterTags.length > 0 || filterSource || filterStatus ? (
                                <button onClick={() => { setSearchQuery(""); clearFilterTags(); setFilterSource(null); setFilterStatus(null); }} className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-foreground text-xs font-black uppercase tracking-widest transition-all border border-white/10">
                                    Clear All Filters
                                </button>
                            ) : (
                                <>
                                    <button onClick={handleSelectLibrary} className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-foreground text-xs font-black uppercase tracking-widest transition-all border border-white/10 flex items-center gap-2">
                                        <FolderOpen size={14} /> Add Local Folder
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                  ) : libraryViewMode === "shelf" ? (
                    <ShelfView
                      allSeries={displayItems as Series[]}
                      onOpenItem={handleOpenItem}
                    />
                  ) : (
                    <GridView
                      items={displayItems}
                      onOpenItem={handleOpenItem}
                      onMenuClick={handleMenuClick}
                      density={libraryDensity}
                      isSelectionMode={selectionMode}
                      selectedIds={selectedIds}
                    />
                  )}
                </div>

                {/* External Discoveries */}
                {filterTags.length > 0 && (
                  <div className="mt-12 mb-20 px-4">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                          <Sparkles size={18} />
                        </div>
                        <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">
                          Spirit Revelations
                        </h3>
                      </div>
                      {isSearchingExternal && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-foreground-dim uppercase tracking-widest animate-pulse">
                          <RefreshCw size={12} className="animate-spin" />
                          Sensing Aether...
                        </div>
                      )}
                    </div>

                    {externalResults.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
                        {externalResults.map((item) => (
                          <motion.div
                            key={`ext-${item.id}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => openQuickView(item)}
                            className="group cursor-pointer"
                          >
                            <div className="aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 bg-white/5 relative mb-3">
                              <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                                <LibraryIcon size={32} />
                              </div>
                              <ProxiedLibraryImage
                                src={item.coverUrl || item.cover}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700 opacity-60 group-hover:opacity-100"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                <span className="text-[10px] font-black text-foreground uppercase tracking-widest">
                                  View Tome
                                </span>
                              </div>
                              <div className="absolute top-2 right-2 px-2 py-1 bg-accent/80 text-white text-[8px] font-black rounded-lg uppercase tracking-widest backdrop-blur-md">
                                Web
                              </div>
                            </div>
                            <h4 className="text-xs font-bold text-foreground-dim group-hover:text-foreground truncate transition-colors uppercase tracking-tight">
                              {item.title}
                            </h4>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      !isSearchingExternal && (
                        <div className="p-12 border border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-center opacity-40">
                          <Tag size={32} className="text-foreground-muted mb-4" />
                          <p className="text-xs font-bold text-foreground-muted uppercase tracking-widest">
                            No spirits found for these sigils
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
                
                {/* Selection Mode Action Bar */}
                <AnimatePresence>
                    {selectionMode && (
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-surface/90 backdrop-blur-3xl border border-border-strong rounded-full px-6 py-4 flex items-center gap-6 shadow-2xl z-50"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-foreground font-black text-sm">{selectedIds.length}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-dim">Selected</span>
                            </div>
                            
                            <div className="w-px h-6 bg-border-subtle" />

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        if (selectedIds.length === displayItems.length) clearSelection();
                                        else displayItems.forEach(item => toggleSelectedId(item.id));
                                    }}
                                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-surface-raised text-foreground-dim hover:text-foreground transition-all"
                                >
                                    {selectedIds.length === displayItems.length ? "Deselect All" : "Select All"}
                                </button>
                                
                                <button
                                    onClick={() => {
                                        openTagManager('batch', []);
                                    }}
                                    disabled={selectedIds.length === 0}
                                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                                >
                                    <Tag size={14} /> Apply Tags
                                </button>
                                
                                <button
                                    onClick={() => bulkDelete()}
                                    disabled={selectedIds.length === 0}
                                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                                >
                                    <Trash2 size={14} /> Delete Selected
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <LibraryFilterDrawer 
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        allTags={allTags}
      />
      
      <ContextMenu
        activeMenu={activeMenu}
        onAction={handleAction}
        onClose={() => setActiveMenu(null)}
      />
    </div>
  );
};

const EmptyState = ({
  onImport,
  onLink,
}: {
  onImport: () => void;
  onLink: () => void;
}) => (
  <div className="flex flex-col items-center justify-center h-full p-12 bg-background/40 backdrop-blur-md">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-xl w-full p-10 rounded-[48px] bg-surface-elevated border border-border-subtle shadow-cinematic flex flex-col items-center text-center relative overflow-hidden"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-accent/10 blur-[100px] rounded-full -z-10 animate-pulse" />
      <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-accent to-accent/60 p-6 shadow-2xl shadow-accent/20 mb-8 transform -rotate-6">
        <FolderOpen size={48} className="text-foreground" />
      </div>
      <h1 className="text-4xl font-bold text-foreground tracking-tight mb-4">
        Archive <span className="text-accent">Silent</span>
      </h1>
      <p className="text-foreground-dim font-medium text-sm tracking-wide leading-relaxed mb-10 max-w-sm">
        Connect your tomes to begin the incantation.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        <button
          onClick={onImport}
          className="p-6 rounded-[24px] bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-left group"
        >
          <PlusCircle
            size={24}
            className="text-accent mb-3 group-hover:scale-110 transition-transform"
          />
          <span className="block text-foreground font-semibold text-xs tracking-wide">
            Acquire Tome
          </span>
        </button>
        <button
          onClick={onLink}
          className="p-6 rounded-[24px] bg-accent hover:opacity-90 shadow-xl shadow-accent/20 transition-all text-left group"
        >
          <FolderOpen
            size={24}
            className="text-foreground mb-3 group-hover:scale-110 transition-transform"
          />
          <span className="block text-foreground font-semibold text-xs tracking-wide">
            Connect Realm
          </span>
        </button>
      </div>
    </motion.div>
  </div>
);

const DragOverlay = () => (
  <div className="absolute inset-0 z-50 bg-accent/20 backdrop-blur-sm border-4 border-accent border-dashed m-4 rounded-xl flex items-center justify-center pointer-events-none">
    <div className="bg-surface/90 p-6 rounded-2xl text-foreground transform scale-110">
      <FolderOpen size={48} className="mx-auto mb-2 text-accent" />
      <h3 className="text-xl font-bold">Unseal Folder</h3>
    </div>
  </div>
);

const LoadingDisplay = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-sm z-10 rounded-xl">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-foreground font-medium">Sensing Tome Aether...</p>
    </div>
  </div>
);

const NoResultsState = () => (
  <div className="h-full flex flex-col items-center justify-center text-center p-8">
    <FolderOpen size={48} className="text-foreground-muted mb-4" />
    <h3 className="text-xl font-bold text-foreground-dim">No Tomes Found</h3>
    <p className="text-xs text-foreground-muted mt-2">The sigils reveal nothing</p>
  </div>
);

const ContextMenu = ({
  activeMenu,
  onAction,
  onClose,
}: {
  activeMenu: any;
  onAction: (a: any, i: any) => void;
  onClose: () => void;
}) => {
  if (!activeMenu) return null;
  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        style={{ left: activeMenu.x, top: activeMenu.y }}
        className="absolute bg-surface border border-border-subtle rounded-xl shadow-cinematic py-2 min-w-[200px] backdrop-blur-xl"
      >
        <button
          onClick={() => onAction("tag", activeMenu.item)}
          className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-foreground hover:bg-white/10 transition-colors"
        >
          <Tag size={16} className="text-indigo-400" />
          Manage Tags
        </button>
        <button
          onClick={() => onAction("rename", activeMenu.item)}
          className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-foreground hover:bg-white/10 transition-colors"
        >
          <Edit2 size={16} className="text-purple-400" />
          Rename Series
        </button>
        <button
          onClick={() => onAction("refresh", activeMenu.item)}
          className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-foreground hover:bg-white/10 transition-colors"
        >
          <Sparkles size={16} className="text-accent" />
          Refresh Metadata
        </button>
        <button
          onClick={() => onAction("favorite", activeMenu.item)}
          className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-foreground hover:bg-white/10 transition-colors"
        >
          <Heart size={16} className="text-red-400" />
          Add to Favorites
        </button>
        <div className="h-px bg-white/5 my-1" />
        <button
          onClick={() => onAction("delete", activeMenu.item)}
          className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={16} />
          Delete Series
        </button>
      </motion.div>
    </div>
  );
};
