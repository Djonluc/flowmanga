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
  FolderOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FeaturedCarousel } from "./home/FeaturedCarousel";
import { HorizontalRail } from "./home/HorizontalRail";
import { MangaCard } from "./library/MangaCard";
import { Sparkles, Zap } from "lucide-react";
import * as htmlToImage from "html-to-image";
import { ScraperService } from "../services/ScraperService";
import { DiscoveryService } from "../services/DiscoveryService";
import { ContentFilter } from "../services/ContentFilter";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useProxiedImage } from '../hooks/useProxiedImage';

const ProxiedHomeImage = ({ src, className, alt }: { src: string, className?: string, alt?: string }) => {
  const { src: proxiedSrc, handleError } = useProxiedImage(src);
  return <img src={proxiedSrc} className={className} alt={alt} onError={() => handleError()} />;
};
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
  const [trending, setTrending] = useState<any[]>(() => {
    try {
      const cache = localStorage.getItem("home-trending-cache");
      return cache ? JSON.parse(cache) : [];
    } catch {
      return [];
    }
  });
  const [personalized, setPersonalized] = useState<any[]>(() => {
    try {
      const cache = localStorage.getItem("home-personalized-cache");
      return cache ? JSON.parse(cache) : [];
    } catch {
      return [];
    }
  });
  const [stats, setStats] = useState<any>({});
  const [activity, setActivity] = useState<any[]>([]);
  const [activeMenu, setActiveMenu] = useState<{
    x: number;
    y: number;
    item: any;
  } | null>(null);
  const [favoriteTags, setFavoriteTags] = useState<string[]>([]);

  const { coloredOnly, showAdultContent } = useSettingsStore();

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
  }, [isInitializing, coloredOnly, showAdultContent]);

  const fetchExternalData = async () => {
    try {
      const { coloredOnly } = useSettingsStore.getState();
      const existingIds = new Set(series.map((s) => s.mangaId || s.id));

      // Get tags from favorites
      const favTags = Array.from(
        new Set(
          series
            .filter((s) => s.tags.includes("favorite"))
            .flatMap((s) => s.tags)
            .filter((t) => t !== "favorite"),
        ),
      ).slice(0, 5); // Use top 5 tags
      setFavoriteTags(favTags);

      const [trendRaw, personRaw] = await Promise.all([
        DiscoveryService.getRandom(60, coloredOnly, "manga"), // Home banner should surface manga content only
        favTags.length > 0
          ? ScraperService.getRecommendationsByTags(
              favTags,
              48, // Increased for better recommendations
              coloredOnly,
              "manga"
            )
          : ScraperService.getPersonalizedRecommendations(
              48, 
              coloredOnly, 
              "manga"
            ), // Increased for better recommendations
      ]);

      // Filter out existing manga and shuffle for variety
      const trend = trendRaw.filter((m) => !existingIds.has(m.id)).slice(0, 24); // Increased display limit
      const person = personRaw
        .filter((m) => !existingIds.has(m.id))
        .sort(() => Math.random() - 0.5) // Randomize for variety as requested
        .slice(0, 24); // Increased display limit

      setTrending(trend);
      setPersonalized(person);
      try {
        localStorage.setItem("home-trending-cache", JSON.stringify(trend));
        localStorage.setItem("home-personalized-cache", JSON.stringify(person));
      } catch (e) {
        console.error("Home: Failed to cache external data", e);
      }
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

      // Helper to filter adult content from local queries
      const filterAdultLocal = (items: any[]) => {
        return items.filter(item => {
          let parsedTags = [];
          if (Array.isArray(item.tags)) {
            parsedTags = item.tags;
          } else if (typeof item.seriesTags === 'string') {
            try { parsedTags = JSON.parse(item.seriesTags); } catch(e) { parsedTags = [item.seriesTags]; }
          } else if (Array.isArray(item.seriesTags)) {
            parsedTags = item.seriesTags;
          }
          return !ContentFilter.isAdult({
            title: item.seriesTitle || item.title,
            source: item.source || item.providerId,
            tags: parsedTags
          });
        });
      };

      // Group by series to remove duplicates, keeping only the most recently read chapter per series
      const uniqueSeries = new Set();
      const groupedHistory = filterAdultLocal(history)
        .filter((item) => {
          if (uniqueSeries.has(item.seriesId)) return false;
          uniqueSeries.add(item.seriesId);
          return true;
        })
        .slice(0, 12);

      setContinueReading(groupedHistory);

      const added = filterAdultLocal([...series])
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        )
        .slice(0, 12);
      setRecentlyAdded(added);

      const updated = filterAdultLocal([...series])
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
                SELECT rp.*, s.title, s.coverPath as cover, s.id as seriesId, c.id as chapterId, c.filePath, s.tags as seriesTags, s.source
                FROM ReadingProgress rp
                JOIN Series s ON rp.seriesId = s.id
                JOIN Chapters c ON rp.chapterId = c.id
                ORDER BY rp.lastReadAt DESC
                LIMIT 20
            `);
      
      const filteredRecent = recent.filter(item => {
        let parsedTags = [];
        if (typeof item.seriesTags === 'string') {
          try { parsedTags = JSON.parse(item.seriesTags); } catch(e) { parsedTags = [item.seriesTags]; }
        }
        return !ContentFilter.isAdult({
          title: item.title,
          source: item.source,
          tags: parsedTags
        });
      }).slice(0, 8);

      setActivity(filteredRecent);
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
        : item.filePath
          ? [{ id: item.chapterId, path: item.filePath, title: item.title }]
          : [];

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
          isScreenshotMode && "h-auto overflow-visible",
        )}
      >
        <div
          className={clsx(
            "flex-1 min-w-0 pb-32 h-full overflow-y-auto custom-scrollbar",
            isScreenshotMode && "h-auto overflow-visible",
          )}
        >
          {/* 1. Hero Banner */}
          <div className="px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
            <FeaturedCarousel items={trending} />
          </div>

          <div className="w-full max-w-[3000px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 flex flex-col gap-8 sm:gap-10 md:gap-16 transition-all duration-300 relative">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none -z-10">
              <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-accent-soft blur-[120px] rounded-full" />
              <div className="absolute top-[40%] right-[10%] w-[35%] h-[35%] bg-accent-soft blur-[100px] rounded-full opacity-50" />
            </div>

            {/* 2. Continue Reading - Hero Banner */}
            {continueReading.length > 0 && (
              <div className="relative z-10 w-full mt-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-foreground tracking-tight">Continue Reading</h2>
                    <p className="text-xs font-bold text-foreground-dim uppercase tracking-widest mt-1">Pick up where you left off</p>
                  </div>
                  <Bookmark size={24} className="text-accent opacity-50" />
                </div>
                <button 
                  onClick={() => handleOpenItem(continueReading[0])}
                  className="w-full text-left group relative rounded-[24px] overflow-hidden bg-surface-elevated/40 border border-border-subtle p-6 flex flex-col sm:flex-row gap-6 items-center shadow-lg hover:bg-surface-raised transition-all active:scale-[0.98]"
                >
                  <div className="w-24 h-36 sm:w-32 sm:h-48 flex-shrink-0 rounded-xl overflow-hidden shadow-md relative">
                    <ProxiedHomeImage src={continueReading[0].cover ? (continueReading[0].cover.startsWith('http') ? continueReading[0].cover : convertFileSrc(continueReading[0].cover)) : ""} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-3">
                    <h3 className="text-2xl sm:text-3xl font-black text-foreground truncate">{continueReading[0].seriesTitle || continueReading[0].title}</h3>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-accent/20 text-accent rounded-full text-xs font-black uppercase tracking-widest">
                        Ch. {continueReading[0].chapterNumber}
                      </span>
                      <span className="text-sm font-bold text-foreground-muted">
                        Page {continueReading[0].currentPage} {continueReading[0].totalPages ? `of ${continueReading[0].totalPages}` : ''}
                      </span>
                    </div>
                    {continueReading[0].totalPages > 0 && (
                      <div className="w-full max-w-md h-2 bg-black/40 rounded-full overflow-hidden mt-2 border border-white/5">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${(continueReading[0].currentPage / continueReading[0].totalPages) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex w-14 h-14 rounded-full bg-accent text-white items-center justify-center shadow-lg shadow-accent/20 group-hover:scale-110 transition-transform">
                    <ChevronRight size={24} className="ml-1" />
                  </div>
                </button>
              </div>
            )}

            {/* 3. Recommended For You - Horizontal Rail */}
            {personalized.length > 0 && (
              <div className="relative z-10">
                <HorizontalRail
                  title="Recommended For You"
                  editorialTitle={favoriteTags.length > 0 ? `Chosen by the spirits. Based on your interest in: ${favoriteTags.join(', ')}.` : "Chosen by the spirits. Curated for your tastes."}
                  icon={<Sparkles size={18} />}
                  items={personalized}
                  layout="masonry"
                  onItemClick={handleExternalClick}
                  onRefresh={fetchExternalData}
                  accentColor="text-indigo-400"
                />
              </div>
            )}

            {/* 4. Trending — hero + grid */}
            {trending.length > 0 && (
              <div className="relative z-10">
                <HorizontalRail
                  title="Trending This Week"
                  editorialTitle="Rising in the shadows. The most active tomes across the realm."
                  icon={<TrendingUp size={18} />}
                  items={trending}
                  layout="masonry"
                  onItemClick={handleExternalClick}
                  onRefresh={fetchExternalData}
                  accentColor="text-accent"
                />
              </div>
            )}

            {/* 5. New Releases — same hero + grid layout as other rails */}
            <div className="relative z-10 pb-20">
              <HorizontalRail
                title="New Releases"
                editorialTitle="Newly manifested tomes in your local library."
                icon={<Plus size={18} />}
                items={recentlyAdded}
                layout="masonry"
                onItemClick={handleOpenItem}
                onMenuClick={handleMenuClick}
                onViewAll={() => setActiveView("library")}
                accentColor="text-emerald-400"
              />
            </div>
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
        "flex flex-col flex-shrink-0 bg-surface border-l border-border-subtle overflow-y-auto custom-scrollbar transition-all duration-500 backdrop-blur-2xl shadow-cinematic",
        "flex gap-6 p-4 lg:p-5 w-56 lg:w-64 xl:w-72",
        isScreenshotMode ? "h-auto" : "hidden lg:flex h-full",
      )}
    >
      <div className="flex flex-1 flex-col gap-6">


        {activity.length > 0 && (
          <section className="space-y-3 rounded-2xl border border-border-subtle bg-surface-elevated/25 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-foreground-dim uppercase tracking-[0.25em]">
                Recently Read
              </h3>
              <ActivityIcon size={12} className="shrink-0 text-accent" />
            </div>
            <div className="flex flex-col gap-2">
              {(() => {
                const seen = new Set<string>();
                let filtered = activity.filter((a: { seriesId: string }) => {
                  if (seen.has(a.seriesId)) return false;
                  seen.add(a.seriesId);
                  return true;
                });
                if (
                  continueReading.length > 0 &&
                  filtered[0]?.seriesId === continueReading[0].seriesId
                ) {
                  filtered = filtered.slice(1);
                }
                return filtered.slice(0, 4).map((item: any, idx: number) => (
                  <div
                    key={`${item.seriesId}-${idx}`}
                    className="rounded-xl border border-transparent transition-colors hover:border-border-subtle"
                  >
                    <MangaCard
                      item={item}
                      variant="compact"
                      onClick={() => onItemClick(item)}
                    />
                  </div>
                ));
              })()}
            </div>
          </section>
        )}

        {trending.length > 0 && (
          <section className="space-y-3 rounded-2xl border border-border-subtle bg-surface-elevated/25 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-foreground-dim uppercase tracking-[0.25em]">
                Rising Powers
              </h3>
              <TrendingUp size={12} className="shrink-0 text-accent" />
            </div>
            <div className="flex flex-col gap-1.5">
              {trending.slice(0, 5).map((item: any, idx: number) => {
                const raw = item.coverUrl as string | undefined;
                return (
                  <button
                    type="button"
                    key={item.id ?? idx}
                    onClick={() => openQuickView(item)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-transparent p-2.5 text-left transition-all hover:border-border-subtle hover:bg-surface-raised"
                  >
                    <span className="w-6 shrink-0 text-center text-xs font-black tabular-nums text-foreground-dim group-hover:text-accent">
                      {idx + 1}
                    </span>
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-sm">
                      {raw ? (
                        <ProxiedHomeImage
                          src={item.coverUrl ? (item.coverUrl.startsWith('http') ? item.coverUrl : convertFileSrc(item.coverUrl)) : ""}
                          alt=""
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-foreground-dim">
                          <FolderOpen size={14} />
                        </div>
                      )}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold tracking-tight text-foreground-muted group-hover:text-foreground">
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>


    </div>
  );
};
