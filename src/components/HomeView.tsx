import { useEffect, useState } from "react";
import { useLibraryStore } from "../stores/useLibraryStore";
import { useReadingStore } from "../stores/useReadingStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useScraperStore } from "../stores/useScraperStore";
import { useModalStore } from "../stores/useModalStore";
import {
  Tag,
  Edit2,
  Trash2,
  ChevronRight,
  PlusCircle,
  Clock,
  TrendingUp,
  BarChart3,
  Activity as ActivityIcon,
  Bookmark,
  Plus,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FeaturedCarousel } from "./home/FeaturedCarousel";
import { HorizontalRail } from "./home/HorizontalRail";
import { MangaCard } from "./library/MangaCard";
import { Sparkles, Zap } from "lucide-react";
import * as htmlToImage from "html-to-image";
import { ScraperService } from "../services/ScraperService";
import { DiscoveryService } from "../services/DiscoveryService";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import clsx from "clsx";
import { toast } from "./Toast";
import { ContextMenu } from "./shared/ContextMenu";

export const HomeView = () => {
  const {
    series,
    setLoading,
    refreshMangaMetadata,
    renameSeries,
    deleteSeries,
    loadFromDb,
  } = useLibraryStore();
  const { openFolder } = useReadingStore();
  const {
    activeView,
    isInitializing,
    setActiveView,
    isScreenshotMode,
    toggleScreenshotMode,
  } = useSettingsStore();
  const {
    openImportModal,
    openTagManager,
    openInputModal,
    openDeleteModal,
    openQuickView,
  } = useModalStore();

  const [continueReading, setContinueReading] = useState<any[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<any[]>([]);
  const [recentlyUpdatedLocal, setRecentlyUpdatedLocal] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [personalized, setPersonalized] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [activity, setActivity] = useState<any[]>([]);
  const [activeMenu, setActiveMenu] = useState<{
    x: number;
    y: number;
    item: any;
  } | null>(null);

  const { coloredOnly } = useSettingsStore();

  useEffect(() => {
    if (!isInitializing) {
      loadRecentHistory();
      loadStats();
      loadActivity();
    }
  }, [series, isInitializing]);

  useEffect(() => {
    if (!isInitializing) {
      fetchExternalData();
    }
  }, [isInitializing, coloredOnly]);

  const fetchExternalData = async () => {
    try {
      const { coloredOnly } = useSettingsStore.getState();
      const existingIds = new Set(series.map((s) => s.mangaId || s.id));

      // Get tags from favorites
      const favoriteTags = Array.from(
        new Set(
          series
            .filter((s) => s.tags.includes("favorite"))
            .flatMap((s) => s.tags)
            .filter((t) => t !== "favorite"),
        ),
      ).slice(0, 5); // Use top 5 tags

      const [trendRaw, personRaw] = await Promise.all([
        DiscoveryService.getRandom(30, coloredOnly),
        favoriteTags.length > 0
          ? ScraperService.getRecommendationsByTags(
              favoriteTags,
              20,
              coloredOnly,
            )
          : ScraperService.getPersonalizedRecommendations(20, coloredOnly),
      ]);

      // Filter out existing manga and shuffle for variety
      const trend = trendRaw.filter((m) => !existingIds.has(m.id)).slice(0, 12);
      const person = personRaw
        .filter((m) => !existingIds.has(m.id))
        .sort(() => Math.random() - 0.5) // Randomize for variety as requested
        .slice(0, 12);

      setTrending(trend);
      setPersonalized(person);
    } catch (e) {
      console.error("Home: Failed to fetch external data", e);
    }
  };

  const loadRecentHistory = async () => {
    try {
      const { getDb } = await import("../services/db");
      const db = getDb();
      const history = await db.select<any[]>(`
                SELECT rp.*, c.title, c.chapterNumber, s.coverPath as cover, c.filePath, s.title as seriesTitle, s.tags as seriesTags, s.updatedAt as seriesUpdatedAt
                FROM ReadingProgress rp
                JOIN Chapters c ON rp.chapterId = c.id
                JOIN Series s ON rp.seriesId = s.id
                ORDER BY rp.lastReadAt DESC
            `);
      
      // Group by series to remove duplicates, keeping only the most recently read chapter per series
      const uniqueSeries = new Set();
      const groupedHistory = history.filter(item => {
          if (uniqueSeries.has(item.seriesId)) return false;
          uniqueSeries.add(item.seriesId);
          return true;
      }).slice(0, 12);
      
      setContinueReading(groupedHistory);

      const added = [...series]
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        )
        .slice(0, 12);
      setRecentlyAdded(added);

      const updated = [...series]
        .sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() -
            new Date(a.updatedAt || 0).getTime(),
        )
        .slice(0, 12);
      setRecentlyUpdatedLocal(updated);
    } catch (e) {
      console.error("Home: Failed to load history", e);
    }
  };

  const loadStats = async () => {
    const totalSeries = series.length;
    const totalChapters = series.reduce(
      (acc, s) => acc + (s.books?.length || 0),
      0,
    );
    setStats({ totalSeries, totalChapters });
  };

  const loadActivity = async () => {
    try {
      const { getDb } = await import("../services/db");
      const db = getDb();
      const recent = await db.select<any[]>(`
                SELECT rp.*, s.title, s.coverPath as cover, s.id as seriesId, c.id as chapterId, c.filePath
                FROM ReadingProgress rp
                JOIN Series s ON rp.seriesId = s.id
                JOIN Chapters c ON rp.chapterId = c.id
                ORDER BY rp.lastReadAt DESC
                LIMIT 8
            `);
      setActivity(recent);
    } catch (e) {
      console.error("Home: Failed to load activity", e);
    }
  };

  const handleOpenItem = async (item: any) => {
    // If it's a history item (has seriesId)
    if ("seriesId" in item) {
      if (series.length === 0 && !isInitializing) {
          toast.warn("Library data is still manifesting. Please wait a moment.");
          return;
      }

      const fullSeries = series.find((s) => s.id === item.seriesId);
      
      // Fallback: If not in library store yet, try to load it or just open with limited data
      const sequence = fullSeries
        ? fullSeries.books.map((b) => ({
            id: b.id,
            path: b.path,
            title: b.title,
          }))
        : item.filePath ? [{ id: item.chapterId, path: item.filePath, title: item.title }] : [];

      try {
        await openFolder(
          item.filePath || item.path,
          item.seriesId,
          item.chapterId,
          sequence,
          item.currentPage,
        );
      } catch (err) {
        console.error("Home: Failed to open item", err);
        toast.error("Failed to resume your saga. The path may have changed.");
      }
    } else {
      setActiveView("library");
      useLibraryStore.getState().setSelectedSeriesId(item.id);
    }
  };

  const handleAction = async (
    action: "tag" | "rename" | "delete" | "refresh",
    item: any,
  ) => {
    setActiveMenu(null);
    if (action === "tag") {
      openTagManager(
        item.seriesId || item.id,
        item.seriesTags || item.tags || [],
      );
    } else if (action === "rename") {
      openInputModal({
        title: "Rename Series",
        placeholder: "New title...",
        description: `Renaming: ${item.seriesTitle || item.title}`,
        initialValue: item.seriesTitle || item.title,
        onSubmit: (newTitle) => {
          renameSeries(item.seriesId || item.id, newTitle);
        },
      });
    } else if (action === "refresh") {
      await refreshMangaMetadata(item.seriesId || item.id);
    } else if (action === "delete") {
      openDeleteModal({
        id: item.seriesId || item.id,
        path: item.filePath || item.path,
        title: item.seriesTitle || item.title,
        count: 1,
        isSeries: true,
      });
    }
  };

  const handleMenuClick = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 240;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 20);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 20);
    setActiveMenu({ x, y, item });
  };

  const handleExternalClick = (item: any) => {
    openQuickView(item);
  };

  // Automated Full Page Snapshot
  useEffect(() => {
    const handleScreenshotToggle = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();

        if (isScreenshotMode) return;
        toggleScreenshotMode();
        toast.info("Layout expanding for capture...");

        // Give the DOM time to fully unconstrain heights in Layout and HomeView
        setTimeout(async () => {
          const node = document.getElementById("flowmanga-layout-root");
          if (node) {
            try {
              const width = node.scrollWidth;
              const height = node.scrollHeight;

              // Inject transition-killer style to prevent crashes on animated covers
              const styleTag = document.createElement("style");
              styleTag.innerHTML = `* { transition: none !important; animation: none !important; pointer-events: none !important; }`;
              node.appendChild(styleTag);

              // Pre-convert all loaded images to inline base64 to prevent re-fetching
              const images = node.querySelectorAll("img");
              const originalSrcs: { img: HTMLImageElement; src: string }[] = [];

              images.forEach((img) => {
                if (img.naturalWidth > 0 && img.complete) {
                  try {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                      ctx.drawImage(img, 0, 0);
                      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                      originalSrcs.push({ img, src: img.src });
                      img.src = dataUrl;
                    }
                  } catch {
                    // CORS-tainted canvas, skip this image silently
                  }
                }
              });

              const dataUrl = await htmlToImage.toPng(node, {
                width,
                height,
                quality: 0.95,
                skipFonts: true,
                cacheBust: false,
                style: {
                  width: `${width}px`,
                  height: `${height}px`,
                  borderRadius: "0",
                  transform: "none",
                },
              });

              // Restore original image sources and remove style override
              originalSrcs.forEach(({ img, src }) => {
                img.src = src;
              });
              node.removeChild(styleTag);

              // Native Tauri Save Dialog
              const filePath = await save({
                filters: [{ name: "Image", extensions: ["png"] }],
                defaultPath: `flowmanga-snapshot-${Date.now()}.png`,
              });

              if (filePath) {
                const response = await fetch(dataUrl);
                const buffer = await response.arrayBuffer();
                await writeFile(filePath, new Uint8Array(buffer));
                toast.success("Cinematic screenshot saved!");
              }
            } catch (err) {
              console.error("Screenshot capture failed", err);
              toast.error("Screenshot capture failed.");
            } finally {
              toggleScreenshotMode();
            }
          } else {
            toggleScreenshotMode();
          }
        }, 1200);
      }
    };
    window.addEventListener("keydown", handleScreenshotToggle);
    return () => window.removeEventListener("keydown", handleScreenshotToggle);
  }, [isScreenshotMode, toggleScreenshotMode]);

  return (
    <>
      <div
        className={clsx(
          "flex bg-transparent relative h-full overflow-hidden",
          isScreenshotMode && "h-auto overflow-visible"
        )}
      >
        <div
          className={clsx(
            "flex-1 min-w-0 pb-32 h-full overflow-y-auto no-scrollbar",
            isScreenshotMode && "h-auto overflow-visible"
          )}
        >
          {/* 1. Hero Banner */}
          <div className="px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
            <FeaturedCarousel items={trending} />
          </div>

          <div className="w-full max-w-[2400px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 flex flex-col gap-12 sm:gap-16 md:gap-24 transition-all duration-300 relative">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none -z-10">
                <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-accent-soft blur-[120px] rounded-full" />
                <div className="absolute top-[40%] right-[10%] w-[35%] h-[35%] bg-accent-soft blur-[100px] rounded-full opacity-50" />
            </div>

            {/* 2. Continue Reading - Horizontal Rail */}
            {continueReading.length > 0 && (
              <div className="relative z-10">
                <HorizontalRail
                  title="Continue Reading"
                  editorialTitle="Resume your sagas."
                  icon={<Bookmark size={18} />}
                  items={continueReading}
                  layout="standard"
                  onItemClick={handleOpenItem}
                  onMenuClick={handleMenuClick}
                  onViewAll={() => setActiveView("history")}
                  accentColor="text-indigo-400"
                />
              </div>
            )}

            {/* 3. Trending This Week - Larger Cards */}
            {trending.length > 0 && (
              <div className="relative z-10">
                <HorizontalRail
                  title="Trending This Week"
                  editorialTitle="Rising in the shadows."
                  icon={<TrendingUp size={18} />}
                  items={trending}
                  layout="featured-first"
                  onItemClick={handleExternalClick}
                  onRefresh={fetchExternalData}
                  accentColor="text-purple-400"
                />
              </div>
            )}

            {/* 4. New Releases - Masonry Grid for variation */}
            <div className="relative z-10">
              <HorizontalRail
                title="New Releases"
                editorialTitle="Newly manifested tomes."
                icon={<Plus size={18} />}
                items={recentlyAdded}
                layout="masonry"
                onItemClick={handleOpenItem}
                onMenuClick={handleMenuClick}
                onViewAll={() => setActiveView("library")}
                accentColor="text-emerald-400"
              />
            </div>

            {/* 5. Recommended For You - Horizontal Rail */}
            {personalized.length > 0 && (
              <div className="relative z-10 pb-20">
                <HorizontalRail
                  title="Recommended For You"
                  editorialTitle="Chosen by the spirits."
                  icon={<Sparkles size={18} />}
                  items={personalized}
                  onItemClick={handleExternalClick}
                  onRefresh={fetchExternalData}
                  accentColor="text-indigo-400"
                />
              </div>
            )}
          </div>
        </div>

        <RightPanel
          continueReading={continueReading}
          stats={stats}
          activity={activity}
          trending={trending}
          onItemClick={handleOpenItem}
        />

        <ContextMenu
          activeMenu={activeMenu}
          onAction={handleAction}
          onClose={() => setActiveMenu(null)}
          mode="library"
        />
      </div>
    </>
  );
};

const RightPanel = ({
  continueReading,
  stats,
  activity,
  trending,
  onItemClick,
}: any) => {
  const { openQuickView } = useModalStore();
  const { isScreenshotMode } = useSettingsStore();

  return (
    <div
      className={clsx(
        "flex-col flex-shrink-0 bg-surface border-l border-border-subtle space-y-10 lg:space-y-12 overflow-y-auto no-scrollbar transition-all duration-500 backdrop-blur-2xl shadow-cinematic",
        "p-6 lg:p-8 w-64 lg:w-72 xl:w-80",
        isScreenshotMode ? "flex h-auto" : "hidden lg:flex h-full",
      )}
    >
      {/* 1. Quick Resume (Top priority if exists) */}
      {continueReading && continueReading.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-foreground-dim uppercase tracking-[0.25em]">
              Quick Resume
            </h3>
            <Bookmark size={12} className="text-accent" />
          </div>
          <div className="p-1">
            <MangaCard 
                item={continueReading[0]}
                variant="compact"
                onClick={() => onItemClick(continueReading[0])}
            />
          </div>
        </section>
      )}

      {/* 2. Rising Powers / Trending */}
      {trending.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-foreground-dim uppercase tracking-[0.25em]">
              Rising Powers
            </h3>
            <TrendingUp size={12} className="text-accent" />
          </div>
          <div className="space-y-1">
            {trending.slice(0, 5).map((item: any, idx: number) => (
              <div
                key={idx}
                onClick={() => openQuickView(item)}
                className="group flex items-center gap-4 p-3 rounded-2xl cursor-pointer bg-surface-elevated hover:bg-surface-raised transition-all border border-transparent hover:border-border-subtle hover:shadow-lg"
              >
                <div className="w-6 text-center">
                  <span className="text-foreground-dim font-black text-sm tabular-nums group-hover:text-accent transition-colors">
                    {idx + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-foreground-muted text-xs font-bold truncate block group-hover:text-foreground transition-colors tracking-tight">
                    {item.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Recently Read / Activity */}
      {activity.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black text-foreground-dim uppercase tracking-[0.25em]">
              Recently Read
            </h3>
            <ActivityIcon size={12} className="text-accent" />
          </div>
          <div className="space-y-2">
            {/* Filter activity to only unique series, skip the first one if it's the Quick Resume */}
            {(() => {
                const seen = new Set();
                let filtered = activity.filter(a => {
                    if (seen.has(a.seriesId)) return false;
                    seen.add(a.seriesId);
                    return true;
                });
                if (continueReading.length > 0 && filtered[0]?.seriesId === continueReading[0].seriesId) {
                    filtered = filtered.slice(1);
                }
                return filtered.slice(0, 4).map((item: any, idx: number) => (
                  <MangaCard 
                      key={idx}
                      item={item}
                      variant="compact"
                      onClick={() => onItemClick(item)}
                  />
                ));
            })()}
          </div>
        </section>
      )}

      {/* 4. Reading Stats */}
      <section className="pt-8 border-t border-border-subtle mt-auto">
        <div className="flex items-center justify-between px-1 mb-4">
            <h3 className="text-[10px] font-black text-foreground-dim uppercase tracking-[0.25em]">
              Archive Status
            </h3>
            <BarChart3 size={12} className="text-accent" />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-surface-elevated border border-border-subtle shadow-inner">
                <span className="text-[9px] font-black text-foreground-dim uppercase tracking-[0.2em]">Series</span>
                <span className="text-xl font-black text-foreground tracking-tighter">{stats.totalSeries || 0}</span>
            </div>
            <div className="flex flex-col gap-1 p-4 rounded-2xl bg-surface-elevated border border-border-subtle shadow-inner">
                <span className="text-[9px] font-black text-foreground-dim uppercase tracking-[0.2em]">Chapters</span>
                <span className="text-xl font-black text-foreground tracking-tighter">{stats.totalChapters || 0}</span>
            </div>
        </div>
      </section>
    </div>
  );
};


