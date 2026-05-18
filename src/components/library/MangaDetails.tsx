import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  Play,
  ArrowLeft,
  Clock,
  Library as LibraryIcon,
  User,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  ShieldCheck,
  Loader2,
  Wrench,
  Globe,
  Edit2,
  Bomb,
  Calendar,
  BookOpen,
  Download,
  Plus,
  Layers,
  History,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Share2,
  Bookmark,
  ArrowUpRight,
  HardDrive,
  ListFilter,
  LayoutGrid,
  Info,
  MoreHorizontal,
  Heart,
  Share,
  Database,
  PieChart,
  ArrowDownToLine,
  MoreVertical,
  FolderOpen,
  Trash,
  RotateCcw,
  FileOutput,
  Search,
  X,
} from "lucide-react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useLibraryStore, type Book } from "../../stores/useLibraryStore";
import { useReadingStore } from "../../stores/useReadingStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useDownloadStore } from "../../stores/useDownloadStore";
import { useModalStore } from "../../stores/useModalStore";
import { UpdateManager } from "../../services/UpdateManager";
import { toast } from "../Toast";
import { TagManagerModal } from "./TagManagerModal";
import clsx from "clsx";

interface MangaDetailsProps {
  seriesId: string;
  onBack: () => void;
}

export const MangaDetails: React.FC<MangaDetailsProps> = ({
  seriesId,
  onBack,
}) => {
  const {
    series,
    refreshMangaMetadata,
    toggleFavorite,
    deleteSeries,
    verifyLibraryIntegrity,
    refreshChapterThumbnails,
    clearReadingProgressForSeries,
    toggleFilterTag,
    scanLibrary,
    setSeriesDisplayTitle,
  } = useLibraryStore();
  const { openFolder } = useReadingStore();
  const { setAmbientImage } = useSettingsStore();
  const { queue: activeJobs } = useDownloadStore();
  const { openInputModal } = useModalStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accentColor, setAccentColor] = useState<string>("#6366f1");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [activeTab, setActiveTab] = useState<"all" | "downloaded">("all");
  const [remoteChapters, setRemoteChapters] = useState<any[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const [isTopMoreMenuOpen, setIsTopMoreMenuOpen] = useState(false);
  const [isActionsMoreMenuOpen, setIsActionsMoreMenuOpen] = useState(false);
  const [isDownloadSelectorOpen, setIsDownloadSelectorOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [heroBackground, setHeroBackground] = useState<string | null>(null);
  const [downloadRange, setDownloadRange] = useState({ start: "", end: "" });

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const selectedSeries = series.find((s) => s.id === seriesId);
  const coverSrc = selectedSeries?.cover
    ? selectedSeries.cover.startsWith("http")
      ? selectedSeries.cover
      : convertFileSrc(selectedSeries.cover)
    : "";

  const sortedChapters = useMemo(() => {
    if (!selectedSeries) return [];
    return [...selectedSeries.books].sort((a, b) => {
      const numA = parseFloat(a.meta.chapter || "0");
      const numB = parseFloat(b.meta.chapter || "0");
      return numB - numA;
    });
  }, [selectedSeries?.books]);

  const latestWithProgress = useMemo(() => {
    return [...sortedChapters]
      .sort((a, b) => {
        const numA = parseFloat(a.meta.chapter || "0");
        const numB = parseFloat(b.meta.chapter || "0");
        return numA - numB;
      })
      .filter((b) => b.progress && b.progress.currentPage > 0)
      .pop();
  }, [sortedChapters]);

  const readCount = sortedChapters.filter(
    (b) => b.progress && b.progress.currentPage >= b.progress.totalPages - 2,
  ).length;
  const totalCount = Math.max(sortedChapters.length, remoteChapters.length);
  const progressPercent =
    totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;
  const missingFromRemote = remoteChapters.filter(
    (rc) =>
      !sortedChapters.some((c) => c.meta.chapter === rc.number.toString()),
  );

  const filteredChapters = useMemo(() => {
    let base = [
      ...sortedChapters,
      ...missingFromRemote.map((rc) => ({ ...rc, isMissing: true })),
    ].sort((a, b) => {
      const numA = parseFloat(
        (a as any).meta?.chapter || (a as any).number || "0",
      );
      const numB = parseFloat(
        (b as any).meta?.chapter || (b as any).number || "0",
      );
      return numB - numA;
    });

    if (activeTab === "downloaded") {
      base = base.filter((item) => !(item as any).isMissing);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter((item) => {
        const num = (item as any).meta?.chapter || (item as any).number || "";
        const title = (item as any).title || "";
        return num.toString().includes(q) || title.toLowerCase().includes(q);
      });
    }

    return base;
  }, [sortedChapters, missingFromRemote, activeTab, searchQuery]);

  useEffect(() => {
    let active = true;
    if (!selectedSeries) return;

    setHeroBackground(null);

    if (coverSrc) setAmbientImage(coverSrc);

    if (coverSrc && active) {
      setHeroBackground(coverSrc);
    }

    const fetchRemote = async () => {
      setIsLoadingRemote(true);
      try {
        const seriesUrl = await UpdateManager.resolveSeriesUrl(
          selectedSeries.id,
        );
        if (seriesUrl) {
          const { ScraperService } =
            await import("../../services/ScraperService");
          const result = await ScraperService.scrapeChapter(seriesUrl);
          if (active && result.series?.chapters) {
            setRemoteChapters(result.series.chapters);
          }
        }
      } catch (e) {
        console.warn("[MangaDetails] Failed to fetch remote feed:", e);
      } finally {
        if (active) setIsLoadingRemote(false);
      }
    };

    void fetchRemote();

    return () => {
      active = false;
      setAmbientImage(null);
    };
  }, [
    selectedSeries?.id,
    selectedSeries?.path,
    selectedSeries?.books?.length,
    coverSrc,
    setAmbientImage,
  ]);

  const handleReadChapter = async (targetBook: Book, startPage?: number) => {
    const sequence = [...sortedChapters]
      .sort((a, b) => {
        const numA = parseFloat(a.meta.chapter || "0");
        const numB = parseFloat(b.meta.chapter || "0");
        return numA - numB;
      })
      .map((b) => ({ id: b.id, path: b.path, title: b.title }));
    await openFolder(
      targetBook.path,
      targetBook.seriesId,
      targetBook.id,
      sequence,
      startPage,
    );
  };

  const handleContinueReading = () => {
    if (latestWithProgress) {
      handleReadChapter(
        latestWithProgress,
        latestWithProgress.progress?.currentPage,
      );
    } else {
      const first = [...sortedChapters].sort((a, b) => {
        const numA = parseFloat(a.meta.chapter || "0");
        const numB = parseFloat(b.meta.chapter || "0");
        return numA - numB;
      })[0];
      if (first) handleReadChapter(first, 0);
    }
  };

  const currentChapterDisplay = latestWithProgress
    ? latestWithProgress.meta.chapter || "1"
    : "1";
  const currentPageDisplay = latestWithProgress
    ? (latestWithProgress.progress?.currentPage || 0) + 1
    : 1;

  if (!selectedSeries) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background text-foreground-muted gap-4 p-8">
        <Loader2 className="animate-spin text-accent" size={36} />
        <p className="text-sm font-bold uppercase tracking-widest text-center">
          This volume is not in the archive.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-surface-elevated px-4 py-2 rounded-xl border border-border-subtle text-foreground hover:bg-surface-raised"
        >
          <ArrowLeft size={16} />
          Return to Archives
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col bg-background relative overflow-hidden selection:bg-accent/30 text-foreground font-['Inter',_sans-serif]"
    >
      {/* Cinematic Atmosphere Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AnimatePresence mode="wait">
          {heroBackground ? (
            <motion.div
              key={heroBackground}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 0.8, scale: 1.0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 2.2, ease: "easeOut" }}
              className="absolute inset-0 bg-center bg-cover bg-no-repeat blur-[4px] sm:blur-[8px] saturate-[1.1]"
              style={{
                backgroundImage: `url(${heroBackground})`,
                backgroundPosition: "center 20%",
              }}
            />
          ) : coverSrc ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 1.4 }}
              className="absolute inset-0 bg-center bg-cover scale-105 blur-[16px] sm:blur-[24px] saturate-[1.1]"
              style={{ backgroundImage: `url(${coverSrc})` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent opacity-30" />
          )}
        </AnimatePresence>

        {/* Multi-layered cinematic blending — localized protection instead of heavy global blur */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/30 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 min-h-[60%] bg-gradient-to-t from-background via-background/70 to-transparent" />

        {/* Subtle vignette for depth - Now theme-aware */}
        <div className="absolute inset-0 shadow-[inset_0_0_150px_var(--color-background)] opacity-40" />
      </div>

      <div className="z-50 p-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors text-xs font-bold uppercase tracking-widest group bg-surface-elevated px-4 py-2 rounded-xl backdrop-blur-xl border border-border-subtle"
        >
          <ArrowLeft
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />
          Return to Archives
        </button>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={async () => {
              const line = [
                selectedSeries.displayName,
                selectedSeries.seriesUrl || selectedSeries.path,
              ]
                .filter(Boolean)
                .join("\n");
              try {
                await navigator.clipboard.writeText(line);
                toast.success("Series details copied");
              } catch {
                toast.error("Could not copy to clipboard");
              }
            }}
            className="p-3 rounded-xl bg-surface-elevated hover:bg-surface-raised text-foreground-muted hover:text-foreground transition-all border border-border-subtle active:scale-95 shadow-2xl"
            title="Copy title and link or path"
          >
            <Share size={18} />
          </button>
          <div className="relative">
            <button
              onClick={() => setIsTopMoreMenuOpen(!isTopMoreMenuOpen)}
              className={clsx(
                "p-3 rounded-xl transition-all border active:scale-95 shadow-2xl",
                isTopMoreMenuOpen
                  ? "bg-foreground text-background border-foreground"
                  : "bg-surface-elevated border-border-subtle text-foreground-muted hover:text-foreground",
              )}
            >
              <MoreVertical size={18} />
            </button>

            <AnimatePresence>
              {isTopMoreMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsTopMoreMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute right-0 mt-4 w-64 bg-surface border border-border-subtle rounded-2xl p-2 z-50 shadow-cinematic backdrop-blur-3xl"
                  >
                    <MenuAction
                      icon={<FolderOpen size={14} />}
                      label="Open Manga Folder"
                      onClick={() => {
                        invoke("show_path_in_file_manager", {
                          path: selectedSeries.path,
                        });
                        setIsTopMoreMenuOpen(false);
                      }}
                    />
                    <MenuAction
                      icon={<RotateCcw size={14} />}
                      label="Rebuild Chapter Cache"
                      onClick={async () => {
                        toast.info("Regenerating chapter thumbnails…");
                        await refreshChapterThumbnails(selectedSeries.id);
                        toast.success("Thumbnails refreshed");
                        setIsTopMoreMenuOpen(false);
                      }}
                    />
                    <MenuAction
                      icon={<FileOutput size={14} />}
                      label="Export Metadata"
                      onClick={async () => {
                        try {
                          const metaPath = `${selectedSeries.path}/metadata.json`;
                          const content = await readTextFile(metaPath);
                          const dest = await save({
                            defaultPath: `${selectedSeries.displayName.replace(/[\\/:*?"<>|]/g, "-")}-metadata.json`,
                            filters: [{ name: "JSON", extensions: ["json"] }],
                          });
                          if (dest) {
                            await writeTextFile(dest, content);
                            toast.success("Metadata exported");
                          }
                        } catch (e) {
                          console.error(e);
                          toast.error("Export failed (missing metadata.json?)");
                        }
                        setIsTopMoreMenuOpen(false);
                      }}
                    />
                    <div className="h-px bg-border-subtle my-2 mx-2" />
                    <MenuAction
                      icon={<ShieldCheck size={14} />}
                      label="Verify All Chapters"
                      onClick={async () => {
                        await verifyLibraryIntegrity(selectedSeries.id);
                        toast.success("Chapter paths verified");
                        setIsTopMoreMenuOpen(false);
                      }}
                    />
                    <MenuAction
                      icon={<Edit2 size={14} />}
                      label="Rename Series"
                      onClick={() => {
                        openInputModal({
                          title: "Rename Series",
                          description:
                            "Set a custom local display title. The original source title will be preserved for syncing.",
                          placeholder: selectedSeries.title,
                          initialValue: selectedSeries.displayName,
                          onSubmit: async (newTitle) => {
                            await setSeriesDisplayTitle(
                              selectedSeries.id,
                              newTitle,
                            );
                            toast.success("Title updated");
                          },
                        });
                        setIsTopMoreMenuOpen(false);
                      }}
                    />
                    <MenuAction
                      icon={<Trash size={14} />}
                      label="Clear Reading History"
                      danger
                      onClick={async () => {
                        await clearReadingProgressForSeries(selectedSeries.id);
                        toast.success(
                          "Reading progress cleared for this series",
                        );
                        setIsTopMoreMenuOpen(false);
                      }}
                    />
                    <MenuAction
                      icon={<Bomb size={14} />}
                      label="Obliterate Series"
                      danger
                      onClick={async () => {
                        await deleteSeries(
                          selectedSeries.id,
                          selectedSeries.path,
                          true,
                        );
                        onBack();
                      }}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar z-10 px-8 lg:px-16 pb-20">
        <div className="max-w-[1600px] mx-auto space-y-12">
          <div className="flex flex-col lg:flex-row gap-12 pt-4 relative">
            <div className="relative group shrink-0 self-start">
              <div className="w-[280px] lg:w-[320px] aspect-[2/3] rounded-3xl overflow-hidden shadow-cinematic border border-border-subtle relative transition-transform duration-700 group-hover:scale-[1.02]">
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
                    <LibraryIcon size={64} className="text-foreground-dim" />
                  </div>
                )}
                <div className="absolute bottom-4 left-4">
                  <span className="px-3 py-1.5 rounded-xl bg-background/60 backdrop-blur-md border border-border-subtle text-[10px] font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    {selectedSeries.status || "Ongoing"}
                  </span>
                </div>
              </div>
              <div className="absolute -inset-4 bg-accent/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>

            <div className="flex-1 min-w-0 space-y-10 py-2">
              <div className="space-y-6 relative">
                {/* Readability Protection Mask */}
                <div className="absolute -inset-8 bg-gradient-radial from-background/90 via-background/50 to-transparent blur-2xl rounded-full pointer-events-none" />

                <motion.h1
                  layoutId={`title-${selectedSeries.id}`}
                  className="relative text-6xl lg:text-[100px] font-black tracking-tighter leading-[0.85] uppercase italic drop-shadow-cinematic"
                >
                  {selectedSeries.displayName}
                </motion.h1>
                <div className="flex flex-wrap items-center gap-x-12 gap-y-6 relative">
                  <MetadataItem
                    label="Architect"
                    value={selectedSeries.author || "Unknown"}
                    highlight
                  />
                  <MetadataItem
                    label="Visualizer"
                    value={selectedSeries.artist || "Anonymous"}
                  />
                  <MetadataItem
                    label="Chronology"
                    value={`${totalCount} Chapters`}
                  />
                  <MetadataItem
                    label="Archival State"
                    value={
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        Manifested
                      </div>
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 max-w-4xl items-center">
                {(tagsExpanded ? selectedSeries.tags : selectedSeries.tags.slice(0, 15)).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleFilterTag(tag)}
                    className="px-4 py-2 bg-surface-elevated hover:bg-surface-raised rounded-xl text-[10px] font-black uppercase tracking-widest text-foreground-dim border border-border-subtle transition-all active:scale-95"
                    title="Filter library by this tag"
                  >
                    {tag}
                  </button>
                ))}
                {selectedSeries.tags.length > 15 && (
                  <button
                    type="button"
                    onClick={() => setTagsExpanded(!tagsExpanded)}
                    className="px-4 py-2 bg-surface-elevated hover:bg-surface-raised rounded-xl text-[10px] font-black uppercase tracking-widest text-accent border border-accent/20 transition-all active:scale-95"
                  >
                    {tagsExpanded ? "Show Less" : `+${selectedSeries.tags.length - 15} More`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsTagManagerOpen(true)}
                  className="w-10 h-10 flex items-center justify-center bg-accent/5 border border-accent/20 rounded-xl text-accent hover:bg-accent hover:text-foreground transition-all"
                  title="Manage tags"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="relative group/synopsis max-w-4xl">
                <p
                  className={clsx(
                    "text-sm leading-relaxed text-foreground-muted transition-all duration-700",
                    !synopsisExpanded && "line-clamp-3",
                  )}
                >
                  {selectedSeries.description ||
                    "The archives are silent on this series' history. Awaiting manifestation..."}
                </p>
                <button
                  onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                  className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-accent hover:text-foreground transition-colors flex items-center gap-1 group/btn"
                >
                  {synopsisExpanded ? "Collapse Chronicle" : "Expand Chronicle"}
                  <ChevronRight
                    size={14}
                    className={clsx(
                      "transition-transform",
                      synopsisExpanded
                        ? "-rotate-90"
                        : "group-hover:translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="w-full lg:w-[320px] shrink-0">
              <div className="bg-surface-elevated border border-border-subtle rounded-[40px] p-10 space-y-10 backdrop-blur-3xl shadow-cinematic relative overflow-hidden group/vital">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover/vital:opacity-10 transition-opacity">
                  <PieChart size={120} />
                </div>
                <div className="space-y-8 relative">
                  <InfoItem
                    icon={<Globe size={18} />}
                    label="Archive Status"
                    value={selectedSeries.status || "Active"}
                    valueClass="text-accent"
                  />
                  <InfoItem
                    icon={<Layers size={18} />}
                    label="Total Scrolls"
                    value={totalCount.toString()}
                  />
                  <InfoItem
                    icon={<HardDrive size={18} />}
                    label="Archive Weight"
                    value="1.24 GB"
                  />
                  <InfoItem
                    icon={<Calendar size={18} />}
                    label="First Signal"
                    value="2025"
                  />
                  <InfoItem
                    icon={<Clock size={18} />}
                    label="Last Resonated"
                    value={new Date(
                      selectedSeries.updatedAt,
                    ).toLocaleDateString()}
                  />
                  <InfoItem
                    icon={<History size={18} />}
                    label="Read Duration"
                    value="14h 22m"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
            <button
              onClick={handleContinueReading}
              className="lg:col-span-5 h-28 bg-accent rounded-[32px] p-8 flex items-center gap-6 group hover:scale-[1.02] transition-all active:scale-95 shadow-accent-glow relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-foreground group-hover:rotate-12 transition-transform shadow-lg">
                <Play size={32} fill="currentColor" />
              </div>
              <div className="text-left relative">
                <div className="text-xl font-black uppercase tracking-widest text-foreground">
                  Continue Reading
                </div>
                <div className="text-xs text-foreground/70 font-bold uppercase tracking-widest mt-1 italic">
                  Chapter {currentChapterDisplay} • Page {currentPageDisplay}
                </div>
              </div>
            </button>

            <div className="lg:col-span-2 h-28">
              <ActionCard
                icon={<Download size={22} />}
                label="Manifest"
                sub={`${sortedChapters.length} / ${totalCount} Scrolls`}
                onClick={() => setIsDownloadSelectorOpen(true)}
              />
            </div>

            <div className="lg:col-span-2 h-28">
              <ActionCard
                icon={<RefreshCw size={22} />}
                label="Synchronize"
                sub="Verify missing gaps"
                loading={isRefreshing}
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await refreshMangaMetadata(selectedSeries.id);
                    toast.success("Chronology Harmonized");
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
              />
            </div>

            <div className="lg:col-span-3 flex gap-4 h-28">
              <button
                onClick={() => toggleFavorite(selectedSeries.id)}
                className={clsx(
                  "flex-1 h-full rounded-[32px] flex flex-col items-center justify-center gap-2 transition-all border group shadow-cinematic",
                  selectedSeries.tags.includes("favorite")
                    ? "bg-red-500/10 border-red-500/30 text-red-500"
                    : "bg-surface-elevated border-border-subtle text-foreground-dim hover:text-foreground",
                )}
              >
                <Heart
                  size={24}
                  fill={
                    selectedSeries.tags.includes("favorite")
                      ? "currentColor"
                      : "none"
                  }
                  className="group-hover:scale-110 transition-transform"
                />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  {selectedSeries.tags.includes("favorite")
                    ? "Favorited"
                    : "Favorite"}
                </span>
              </button>
              <div className="relative">
                <button
                  onClick={() =>
                    setIsActionsMoreMenuOpen(!isActionsMoreMenuOpen)
                  }
                  className={clsx(
                    "w-24 lg:w-28 h-full bg-surface-elevated border border-border-subtle rounded-[32px] flex flex-col items-center justify-center gap-2 transition-all group shadow-cinematic",
                    isActionsMoreMenuOpen
                      ? "bg-foreground text-background"
                      : "text-foreground-dim hover:text-foreground",
                  )}
                >
                  <MoreHorizontal
                    size={24}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    More
                  </span>
                </button>

                <AnimatePresence>
                  {isActionsMoreMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsActionsMoreMenuOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute bottom-full mb-4 left-0 w-64 bg-surface border border-border-subtle rounded-2xl p-2 z-50 shadow-cinematic backdrop-blur-3xl"
                      >
                        <MenuAction
                          icon={<HardDrive size={14} />}
                          label="Backup Manifest"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                selectedSeries.path,
                              );
                              toast.success("Series folder path copied");
                            } catch {
                              toast.error("Could not copy path");
                            }
                            setIsActionsMoreMenuOpen(false);
                          }}
                        />
                        <MenuAction
                          icon={<PieChart size={14} />}
                          label="View Deep Insights"
                          onClick={() => {
                            toast.info(
                              "Use History and Stats in the sidebar for reading analytics.",
                            );
                            setIsActionsMoreMenuOpen(false);
                          }}
                        />
                        <div className="h-px bg-border-subtle my-2 mx-2" />
                        <MenuAction
                          icon={<RotateCcw size={14} />}
                          label="Re-index Library"
                          onClick={async () => {
                            await scanLibrary(selectedSeries.path);
                            toast.success("Folder re-scanned");
                            setIsActionsMoreMenuOpen(false);
                          }}
                        />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="bg-surface-elevated border border-border-subtle rounded-[32px] p-10 flex items-center justify-between gap-12 backdrop-blur-xl relative overflow-hidden group/prog shadow-cinematic">
            <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover/prog:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center gap-6 shrink-0 relative">
              <div className="w-3 h-3 rounded-full bg-accent shadow-accent-glow animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-foreground-muted">
                Archival Resonance
              </span>
            </div>
            <div className="flex-1 h-3 bg-surface-raised rounded-full overflow-hidden relative shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="absolute inset-0 bg-accent shadow-accent-glow"
              />
            </div>
            <div className="flex items-center gap-16 shrink-0 relative">
              <span className="text-4xl font-black italic tracking-tighter text-foreground">
                {progressPercent}%
              </span>
              <div className="w-px h-10 bg-border-subtle" />
              <div className="text-right">
                <div className="text-2xl font-black italic uppercase tracking-tighter text-accent">
                  Chapter {currentChapterDisplay}
                </div>
                <div className="text-[10px] text-foreground-dim font-bold uppercase tracking-widest mt-1">
                  of {totalCount} chapters manifested
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-16">
            <div className="flex-1 space-y-10 min-w-0">
              <div className="flex items-center justify-between border-b border-white/5 pb-8">
                <div className="flex items-center gap-12">
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-4">
                    Archived Scrolls{" "}
                    <span className="px-3 py-1 rounded-xl bg-white/10 text-sm font-bold not-italic text-accent">
                      {totalCount}
                    </span>
                  </h2>
                  <div className="flex items-center bg-white/5 rounded-2xl p-1.5 border border-white/5">
                    <TabButton
                      active={activeTab === "all"}
                      label="All Scrolls"
                      onClick={() => setActiveTab("all")}
                    />
                    <TabButton
                      active={activeTab === "downloaded"}
                      label="Manifested"
                      onClick={() => setActiveTab("downloaded")}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-surface-elevated rounded-xl p-1 border border-border-subtle mr-4">
                    <AnimatePresence>
                      {isSearching && (
                        <motion.input
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 200, opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          autoFocus
                          placeholder="Search scrolls..."
                          className="bg-transparent border-none outline-none text-xs font-bold px-2 py-1 placeholder:text-foreground-dim"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      )}
                    </AnimatePresence>
                    <button
                      onClick={() => {
                        setIsSearching(!isSearching);
                        if (isSearching) setSearchQuery("");
                      }}
                      className={clsx(
                        "p-2.5 transition-colors rounded-lg",
                        isSearching
                          ? "text-accent bg-accent/10"
                          : "text-foreground-muted hover:text-foreground",
                      )}
                    >
                      {isSearching ? <X size={16} /> : <Search size={16} />}
                    </button>
                  </div>
                  <button
                    onClick={() => setViewMode("list")}
                    className={clsx(
                      "p-3 rounded-xl transition-all border",
                      viewMode === "list"
                        ? "bg-white text-black border-white shadow-xl"
                        : "text-foreground-dim hover:text-foreground border-transparent",
                    )}
                  >
                    <ListFilter size={20} />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={clsx(
                      "p-3 rounded-xl transition-all border",
                      viewMode === "grid"
                        ? "bg-white text-black border-white shadow-xl"
                        : "text-foreground-dim hover:text-foreground border-transparent",
                    )}
                  >
                    <LayoutGrid size={20} />
                  </button>
                </div>
              </div>

              <div
                className={clsx(
                  "grid gap-6",
                  viewMode === "grid"
                    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                    : "flex flex-col",
                )}
              >
                <AnimatePresence mode="popLayout">
                  {filteredChapters.map((item: any, idx) => {
                    if (item.isMissing) {
                      return (
                        <MissingChapterCard
                          key={`missing-${item.id || item.number}`}
                          item={item}
                          seriesId={selectedSeries.id}
                        />
                      );
                    }

                    const isRead =
                      item.progress &&
                      item.progress.currentPage >= item.progress.totalPages - 2;
                    const isCurrent = latestWithProgress?.id === item.id;
                    const percent = item.progress
                      ? Math.floor(
                          (item.progress.currentPage /
                            item.progress.totalPages) *
                            100,
                        )
                      : 0;
                    const chCover = item.cover
                      ? item.cover.startsWith("http")
                        ? item.cover
                        : convertFileSrc(item.cover)
                      : null;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => handleReadChapter(item)}
                        className={clsx(
                          "group relative flex items-center p-5 bg-surface-elevated hover:bg-surface-raised border rounded-[24px] transition-all cursor-pointer overflow-hidden",
                          isCurrent
                            ? "border-accent/40 bg-accent/10 shadow-accent-glow"
                            : "border-border-subtle hover:border-border-strong",
                        )}
                      >
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface shrink-0 border border-white/10 group-hover:border-white/20 transition-all shadow-lg">
                          {chCover ? (
                            <img
                              src={chCover}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              alt=""
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-foreground">
                              <BookOpen size={24} />
                            </div>
                          )}
                        </div>

                        <div className="ml-8 flex-1 min-w-0">
                          <div className="flex items-center gap-4">
                            <span className="text-foreground-dim font-black italic text-sm tracking-tighter w-8">
                              {item.meta.chapter || idx + 1}
                            </span>
                            <h4 className="text-foreground font-black text-base truncate uppercase italic tracking-tight group-hover:text-accent transition-colors">
                              Scroll {item.meta.chapter || idx + 1}
                            </h4>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-lg bg-accent/20 text-accent text-[9px] font-black uppercase tracking-[0.2em] animate-pulse">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-6 mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-foreground-dim group-hover:text-foreground-muted transition-colors">
                            <span className="flex items-center gap-2">
                              <Clock size={12} />{" "}
                              {new Date(
                                item.updatedAt || selectedSeries.updatedAt,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            {isCurrent ? (
                              <span className="text-accent">
                                {percent}% Synchronized
                              </span>
                            ) : (
                              <span>{item.totalPages || "?"} Pages</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-8 pr-2">
                          {isCurrent ? (
                            <button className="px-6 py-2.5 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-accent/30 hover:scale-105 active:scale-95">
                              Resonate
                            </button>
                          ) : (
                            <div className="flex items-center gap-4">
                              {isRead ? (
                                <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center border border-green-500/20 shadow-lg">
                                  <CheckCircle2 size={16} />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-white/5 text-foreground-muted flex items-center justify-center border border-white/5">
                                  <ArrowDownToLine size={16} />
                                </div>
                              )}
                            </div>
                          )}
                          <button className="p-2.5 text-foreground-muted hover:text-foreground transition-colors hover:bg-white/5 rounded-xl">
                            <MoreVertical size={20} />
                          </button>
                        </div>
                        {isCurrent && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            <div className="w-full xl:w-[420px] space-y-12 shrink-0">
              <SidebarPanel title="Series Chronicle">
                <div className="space-y-8">
                  <SidebarItem
                    label="Transcribed Title"
                    value={selectedSeries.displayName}
                  />
                  <SidebarItem
                    label="Archival Origin"
                    value={selectedSeries.source || "Local"}
                  />
                  <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground-muted block">
                      Thematic resonance
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {selectedSeries.tags.length > 0 ? (
                        selectedSeries.tags.map((t) => (
                          <button
                            key={`side-${t}`}
                            type="button"
                            onClick={() => toggleFilterTag(t)}
                            className="px-4 py-2 bg-white/5 rounded-xl text-[11px] font-bold text-foreground-dim border border-white/5 hover:border-accent/30 hover:text-accent transition-all text-left"
                            title="Toggle this tag in library filters"
                          >
                            {t}
                          </button>
                        ))
                      ) : (
                        <p className="text-[11px] text-foreground-muted italic leading-relaxed">
                          No tags yet. Use{" "}
                          <span className="font-bold text-foreground-dim">
                            Synchronize
                          </span>{" "}
                          for remote genres or add tags with + on the hero row.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </SidebarPanel>

              <SidebarPanel title="Archive Vitality">
                <div className="space-y-6">
                  <StatItem
                    icon={<LibraryIcon size={16} />}
                    label="Active Sessions"
                    value="12,432"
                    color="text-blue-400"
                  />
                  <StatItem
                    icon={<CheckCircle2 size={16} />}
                    label="Total Resonations"
                    value="8,921"
                    color="text-green-400"
                  />
                  <StatItem
                    icon={<Bookmark size={16} />}
                    label="Awaiting Spirits"
                    value="15,432"
                    color="text-foreground-dim"
                  />
                  <StatItem
                    icon={<Trash2 size={16} />}
                    label="Severed Connections"
                    value="1,234"
                    color="text-red-400"
                  />
                  <StatItem
                    icon={<Heart size={16} />}
                    label="High Affinity"
                    value="23,456"
                    color="text-red-500"
                  />
                  <div className="h-px bg-white/5 my-4" />
                  <div className="pt-2">
                    <StorageLabel
                      dot="bg-accent"
                      label="Image Manifests"
                      value="1.18 GB"
                    />
                    <div className="h-4" />
                    <StorageLabel
                      dot="bg-neutral-600"
                      label="Auxiliary Data"
                      value="60 MB"
                    />
                  </div>
                </div>
              </SidebarPanel>

              <SidebarPanel title="Archival Capacity">
                <div className="flex items-center gap-10">
                  <div className="relative w-32 h-32 shrink-0 group/storage">
                    <svg
                      className="w-full h-full -rotate-90"
                      viewBox="0 0 36 36"
                    >
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className="stroke-white/5"
                        strokeWidth="3"
                      />
                      <motion.circle
                        initial={{ strokeDasharray: "0, 100" }}
                        animate={{ strokeDasharray: "65, 100" }}
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className="stroke-accent"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-black italic group-hover:scale-110 transition-transform">
                        1.24 GB
                      </span>
                      <span className="text-[8px] text-foreground-muted font-black uppercase tracking-[0.3em] mt-1">
                        Weight
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-foreground-dim">
                        Archive Health
                      </div>
                      <div className="text-2xl font-black italic text-accent">
                        OPTIMAL
                      </div>
                    </div>
                    <p className="text-[10px] text-foreground-muted font-bold leading-relaxed uppercase tracking-wider">
                      Current manifestation is secured across 62 local scrolls.
                      Gaps detected: 0.
                    </p>
                  </div>
                </div>
              </SidebarPanel>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isDownloadSelectorOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsDownloadSelectorOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="w-full max-w-2xl bg-[#14151a] border border-white/10 rounded-[42px] p-12 relative z-10 shadow-[0_64px_128px_-32px_rgba(0,0,0,1)]"
            >
              <button
                onClick={() => setIsDownloadSelectorOpen(false)}
                className="absolute top-8 right-8 p-3 rounded-full bg-white/5 hover:bg-white/10 text-foreground-dim hover:text-foreground transition-all"
              >
                <X size={24} />
              </button>

              <div className="space-y-10">
                <div className="space-y-4">
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-4">
                    <Download size={32} className="text-accent" /> Precision{" "}
                    <span className="text-accent">Manifestation</span>
                  </h2>
                  <p className="text-foreground-dim text-sm font-bold uppercase tracking-widest leading-relaxed">
                    Choose the exact chapter resonance you wish to manifest into
                    the local archive.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <DownloadOption
                    icon={<Sparkles size={18} />}
                    label="Manifest Missing"
                    sub="Only fill archive gaps"
                    onClick={() => {
                      toast.success("Summoning missing scrolls...");
                      setIsDownloadSelectorOpen(false);
                      UpdateManager.checkForUpdates(selectedSeries.id);
                    }}
                  />
                  <DownloadOption
                    icon={<ArrowDownToLine size={18} />}
                    label="Manifest Latest"
                    sub="Get the newest scrolls"
                    onClick={() => {
                      toast.success("Summoning newest scrolls...");
                      setIsDownloadSelectorOpen(false);
                      UpdateManager.checkForUpdates(selectedSeries.id, 5);
                    }}
                  />
                </div>

                <div className="space-y-6 bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground-muted">
                    Manual Range Resonance
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex-1 space-y-2">
                      <span className="text-[8px] font-black text-foreground-muted uppercase tracking-widest ml-1">
                        Start Scroll
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. 1"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-black italic outline-none focus:border-accent transition-all"
                        value={downloadRange.start}
                        onChange={(e) =>
                          setDownloadRange({
                            ...downloadRange,
                            start: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="w-4 h-px bg-white/10 mt-6" />
                    <div className="flex-1 space-y-2">
                      <span className="text-[8px] font-black text-foreground-muted uppercase tracking-widest ml-1">
                        End Scroll
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. 62"
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-black italic outline-none focus:border-accent transition-all"
                        value={downloadRange.end}
                        onChange={(e) =>
                          setDownloadRange({
                            ...downloadRange,
                            end: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const start = parseFloat(downloadRange.start);
                      const end = parseFloat(downloadRange.end);
                      if (isNaN(start) || isNaN(end)) {
                        toast.error("Invalid Resonance Coordinates");
                        return;
                      }

                      const toDownload = remoteChapters.filter((rc) => {
                        const num = parseFloat(rc.number);
                        return num >= start && num <= end;
                      });

                      if (toDownload.length === 0) {
                        toast.error("No Scrolls found in range");
                        return;
                      }

                      toast.success(
                        `Manifesting ${toDownload.length} Scrolls...`,
                      );
                      setIsDownloadSelectorOpen(false);

                      // Map to the format UpdateManager expects
                      const chapters = toDownload.map((rc) => ({
                        id: rc.id,
                        attributes: { chapter: rc.number, title: rc.title },
                        chUrl: rc.url,
                        source: rc.source,
                      }));

                      await UpdateManager.downloadChapters(
                        selectedSeries.id,
                        chapters,
                      );
                    }}
                    className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-[0.3em] text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-2xl"
                  >
                    Commence Ritual
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <TagManagerModal
        isOpen={isTagManagerOpen}
        onClose={() => setIsTagManagerOpen(false)}
        seriesId={selectedSeries.id}
        initialTags={selectedSeries.tags}
      />
    </motion.div>
  );
};

const MenuAction = ({ icon, label, onClick, danger }: any) => (
  <button
    onClick={onClick}
    className={clsx(
      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group/item",
      danger
        ? "hover:bg-red-500/10 text-red-500/80 hover:text-red-500"
        : "hover:bg-accent/10 text-foreground-dim hover:text-accent",
    )}
  >
    <div
      className={clsx(
        "transition-transform group-hover/item:rotate-12",
        danger ? "text-red-500" : "text-accent",
      )}
    >
      {icon}
    </div>
    <span className="uppercase tracking-widest">{label}</span>
  </button>
);

const MetadataItem = ({ label, value, highlight }: any) => (
  <div className="space-y-1 group/meta">
    <span className="text-[10px] text-foreground-dim font-black uppercase tracking-[0.4em] group-hover:text-accent transition-colors">
      {label}
    </span>
    <div
      className={clsx(
        "text-sm font-bold tracking-wide drop-shadow-md",
        highlight
          ? "text-accent"
          : "text-foreground-muted group-hover:text-foreground transition-colors",
      )}
    >
      {value}
    </div>
  </div>
);

const DownloadOption = ({ icon, label, sub, onClick }: any) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-2 p-8 bg-surface-elevated hover:bg-accent border border-border-subtle hover:border-accent rounded-3xl transition-all group active:scale-95 shadow-cinematic"
  >
    <div className="w-12 h-12 rounded-2xl bg-background/20 group-hover:bg-white/20 flex items-center justify-center text-accent group-hover:text-foreground transition-all">
      {icon}
    </div>
    <div className="text-center">
      <div className="text-[11px] font-black uppercase tracking-widest group-hover:text-foreground">
        {label}
      </div>
      <div className="text-[8px] text-foreground-dim font-bold uppercase tracking-widest mt-1 group-hover:text-foreground/60">
        {sub}
      </div>
    </div>
  </button>
);

const InfoItem = ({ icon, label, value, valueClass }: any) => (
  <div className="flex items-center gap-5 group/info">
    <div className="w-12 h-12 rounded-2xl bg-surface-raised flex items-center justify-center text-foreground-dim group-hover/info:bg-accent-soft group-hover/info:text-accent transition-all duration-500 shadow-sm">
      {icon}
    </div>
    <div>
      <div className="text-[9px] font-black uppercase tracking-[0.3em] text-foreground-dim">
        {label}
      </div>
      <div
        className={clsx(
          "text-sm font-black uppercase tracking-tight mt-1",
          valueClass || "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  </div>
);

const ActionCard = ({ icon, label, sub, onClick, loading }: any) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="w-full h-full bg-surface-elevated hover:bg-surface-raised border border-border-subtle rounded-[32px] p-8 flex items-center gap-6 transition-all active:scale-95 group shadow-cinematic relative overflow-hidden"
  >
    <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="w-12 h-12 rounded-2xl bg-surface-raised flex items-center justify-center text-foreground-dim group-hover:text-accent transition-all group-hover:scale-110 shadow-sm">
      {loading ? <Loader2 size={24} className="animate-spin" /> : icon}
    </div>
    <div className="text-left relative">
      <div className="text-base font-black uppercase tracking-widest text-foreground group-hover:text-accent transition-colors">
        {label}
      </div>
      <div className="text-[10px] text-foreground-dim font-bold uppercase tracking-widest mt-1 italic">
        {sub}
      </div>
    </div>
  </button>
);

const TabButton = ({ active, label, onClick }: any) => (
  <button
    onClick={onClick}
    className={clsx(
      "px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
      active
        ? "bg-foreground text-background shadow-cinematic"
        : "text-foreground-dim hover:text-foreground",
    )}
  >
    {label}
  </button>
);

const SidebarPanel = ({ title, children }: any) => (
  <div className="bg-surface-elevated border border-border-subtle rounded-[40px] p-10 space-y-10 backdrop-blur-3xl shadow-cinematic relative overflow-hidden group/panel">
    <div className="absolute top-0 right-0 w-32 h-32 bg-accent-soft blur-[80px] rounded-full opacity-0 group-hover/panel:opacity-10 transition-opacity pointer-events-none" />
    <h3 className="text-xl font-black italic uppercase tracking-tighter text-foreground relative flex items-center gap-4">
      <div className="w-1.5 h-6 bg-accent rounded-full" />
      {title}
    </h3>
    <div className="relative">{children}</div>
  </div>
);

const SidebarItem = ({ label, value }: any) => (
  <div className="space-y-2">
    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground-dim block">
      {label}
    </span>
    <span className="text-sm font-bold text-foreground-muted block leading-relaxed tracking-wide italic">
      {value}
    </span>
  </div>
);

const StatItem = ({ icon, label, value, color }: any) => (
  <div className="flex items-center justify-between group cursor-default">
    <div className="flex items-center gap-4">
      <div
        className={clsx(
          "w-10 h-10 rounded-xl bg-surface-raised flex items-center justify-center text-foreground-dim group-hover:bg-accent-soft group-hover:text-accent transition-all duration-500 shadow-sm",
          color,
        )}
      >
        {icon}
      </div>
      <span className="text-xs font-bold text-foreground-dim uppercase tracking-widest group-hover:text-foreground transition-colors">
        {label}
      </span>
    </div>
    <span className="text-sm font-black italic text-foreground-muted group-hover:text-foreground transition-colors">
      {value}
    </span>
  </div>
);

const StorageLabel = ({ dot, label, value }: any) => (
  <div className="flex items-center justify-between group">
    <div className="flex items-center gap-3">
      <div className={clsx("w-2 h-2 rounded-full shadow-accent-glow", dot)} />
      <span className="text-[11px] font-black uppercase tracking-widest text-foreground-dim group-hover:text-foreground transition-colors">
        {label}
      </span>
    </div>
    <span className="text-[11px] font-black italic text-foreground-muted group-hover:text-foreground transition-colors">
      {value}
    </span>
  </div>
);

const MissingChapterCard = ({
  item,
  seriesId,
}: {
  item: any;
  seriesId: string;
}) => {
  const [isSummoning, setIsSummoning] = useState(false);

  return (
    <div className="group relative flex items-center p-5 bg-surface/50 border border-border-subtle border-dashed rounded-[24px] transition-all opacity-60 hover:opacity-100 hover:border-accent shadow-cinematic">
      <div className="w-16 h-16 rounded-xl bg-surface-raised flex items-center justify-center text-foreground-dim group-hover:text-accent group-hover:bg-accent-soft transition-all shrink-0">
        <Download size={24} />
      </div>
      <div className="ml-8 flex-1 min-w-0">
        <div className="flex items-center gap-4">
          <span className="text-foreground-dim font-black italic text-sm tracking-tighter w-8">
            {item.number}
          </span>
          <h4 className="text-foreground-muted font-black text-base truncate uppercase italic tracking-tight group-hover:text-foreground transition-colors">
            Scroll {item.number}
          </h4>
        </div>
        <div className="text-[10px] text-foreground-dim font-black uppercase tracking-[0.2em] mt-2 italic">
          Missing from Archive
        </div>
      </div>
      <button
        onClick={async (e) => {
          e.stopPropagation();
          setIsSummoning(true);
          try {
            toast.success(`Summoning Scroll ${item.number}...`);
            const remoteChapter = {
              id: item.id,
              attributes: {
                chapter: item.number,
                title: item.title,
              },
              chUrl: item.url,
              source: item.source,
            };
            await UpdateManager.downloadChapters(seriesId, [remoteChapter]);
          } finally {
            setIsSummoning(false);
          }
        }}
        disabled={isSummoning}
        className="px-6 py-3 bg-surface-raised hover:bg-accent text-foreground-dim hover:text-foreground rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-sm"
      >
        {isSummoning ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          "Manifest"
        )}
      </button>
    </div>
  );
};
