import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Zap,
  Compass,
  Filter,
  Sparkles,
  Loader2,
  BrainCircuit,
  Clock
} from "lucide-react";
import { useDiscoveryStore } from "../stores/useDiscoveryStore";
import { useModalStore } from "../stores/useModalStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { MangaCard } from "./library/MangaCard";
import { toast } from "./Toast";
import { ContextMenu } from "./shared/ContextMenu";
import { ContentFilter } from "../services/ContentFilter";
import clsx from "clsx";

export const DiscoverView = () => {
  type DiscoveryItem = {
    id?: string;
    source?: string;
    tags?: string[];
    contentType?: string;
  } & Record<string, unknown>;

  const {
    results,
    latest,
    random,
    forYou,
    isSearching,
    isLoadingLatest,
    isLoadingRandom,
    isLoadingForYou,
    query,
    activeType,
    search,
    loadMoreSearchResults,
    loadMoreLatest,
    loadMoreRandom,
    hasMoreSearchResults,
    hasMoreLatest,
    hasMoreRandom,
    fetchLatest,
    fetchRandom,
    fetchForYou,
    setQuery,
    setActiveType,
    clearResults,
    activeTab,
    setActiveTab,
    scrollPositions,
    setScrollPosition,
  } = useDiscoveryStore();

  type DiscoveryContentType =
    | "all"
    | "manga"
    | "manhwa"
    | "manhua"
    | "comic"
    | "doujin"
    | "gallery";

  const { openQuickView, openTagManager } = useModalStore();
  const [activeMenu, setActiveMenu] = useState<{
    x: number;
    y: number;
    item: DiscoveryItem;
  } | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { coloredOnly } = useSettingsStore();

  // Restore scroll position when tab changes
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollPositions[activeTab] || 0;
    }
  }, [activeTab]);

  // Save scroll position on unmount or tab change
  const handleScroll = () => {
      if (scrollContainerRef.current) {
          setScrollPosition(activeTab, scrollContainerRef.current.scrollTop);
      }
  };

  useEffect(() => {
    if (activeTab === "latest" && latest.length === 0) fetchLatest();
    if (activeTab === "discover" && random.length === 0) fetchRandom();
    if (activeTab === "for-you" && forYou.length === 0) fetchForYou();
  }, [activeTab, fetchLatest, fetchRandom, fetchForYou, coloredOnly, activeType, latest.length, random.length, forYou.length]);

  useEffect(() => {
    const isFetching = isSearching || isLoadingLatest || isLoadingRandom || isLoadingForYou;
    const hasMore = 
      (activeTab === "search" && hasMoreSearchResults) ||
      (activeTab === "latest" && hasMoreLatest) ||
      (activeTab === "discover"); // Discover is random infinite

    if (isFetching || !hasMore || activeTab === "for-you") return; // For you is not paginated yet

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (activeTab === "search") loadMoreSearchResults();
          else if (activeTab === "latest") loadMoreLatest();
          else if (activeTab === "discover") loadMoreRandom();
        }
      },
      { threshold: 0.1, rootMargin: "600px" },
    );

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [activeTab, isSearching, isLoadingLatest, isLoadingRandom, hasMoreSearchResults, hasMoreLatest, loadMoreSearchResults, loadMoreLatest, loadMoreRandom]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setActiveTab("search");
      search(query);
    }
  };

  const contentTypes: { id: DiscoveryContentType; label: string }[] = [
    { id: "all", label: "All Content" },
    { id: "manga", label: "Manga" },
    { id: "manhwa", label: "Manhwa" },
    { id: "manhua", label: "Manhua" },
    { id: "comic", label: "Comics" },
    { id: "doujin", label: "Doujinshi" },
    { id: "gallery", label: "Gallery" },
  ];

  const getFilteredItems = (items: DiscoveryItem[]) => {
    if (!Array.isArray(items)) return [];
    
    const safeItems = ContentFilter.filterResults(items as any) as DiscoveryItem[];
    
    if (activeType === "all") return safeItems;
    return safeItems.filter((item) => {
      if (!item) return false;
      const src = item.source?.toLowerCase() || "";
      const tags = (item.tags || [])
        .map((t: string) => t?.toLowerCase())
        .filter(Boolean);
      const contentType = item.contentType || "manga";

      if (activeType === "gallery")
        return contentType === "gallery" || src.includes("zerochan");
      if (activeType === "doujin")
        return (
          contentType === "doujin" ||
          src.includes("nhentai") ||
          src.includes("hentaicomicsfree") ||
          src.includes("rule34")
        );

      const isComic =
        contentType === "comic" ||
        src.includes("dragonball") ||
        src.includes("dbm") ||
        src.includes("blue-lock") ||
        src.includes("bluelock") ||
        tags.includes("comic");
      if (activeType === "comic") return isComic;

      const isManhwa =
        contentType === "manhwa" ||
        src.includes("manhwaread") ||
        src.includes("webtoons") ||
        tags.includes("manhwa");
      if (activeType === "manhwa") return isManhwa;

      const isManhua =
        contentType === "manhua" ||
        src.includes("luacomic") ||
        src.includes("manhuaplus") ||
        tags.includes("manhua");
      if (activeType === "manhua") return isManhua;

      if (activeType === "manga")
        return (
          contentType === "manga" &&
          !isComic &&
          !isManhwa &&
          !isManhua &&
          contentType !== "doujin" &&
          contentType !== "gallery"
        );

      return true;
    });
  };

  const filteredResults = getFilteredItems(results);
  const filteredLatest = getFilteredItems(latest);
  const filteredRandom = getFilteredItems(random);
  const filteredForYou = getFilteredItems(forYou);

  const renderGrid = (items: any[], isLoading: boolean, loadingText: string) => (
      <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
            {items.map((item) => item && (
              <MangaCard
                key={item.id}
                item={item}
                onClick={() => openQuickView(item)}
                onMenuClick={(e: React.MouseEvent, item: DiscoveryItem) =>
                  setActiveMenu({ x: e.clientX, y: e.clientY, item })
                }
              />
            ))}
          </div>
          <div ref={observerTarget} className="h-24 flex items-center justify-center mt-6">
            {isLoading && (
              <div className="flex items-center gap-3 text-foreground-dim animate-pulse">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-foreground-dim">
                  {loadingText}
                </span>
              </div>
            )}
          </div>
      </>
  );

  return (
    <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 h-full overflow-y-auto custom-scrollbar relative bg-transparent"
    >
      {/* ─── Top Sticky Header (Search & Filters) ─── */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-3xl border-b border-border-subtle px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 flex flex-col gap-4">
        
        {/* Top Bar: Tabs & Search */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-surface-elevated border border-border-subtle p-1 rounded-2xl">
                <button
                    onClick={() => setActiveTab('latest')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        activeTab === 'latest' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-foreground-dim hover:text-foreground hover:bg-surface-raised"
                    )}
                >
                    <Clock size={14} /> Latest
                </button>
                <button
                    onClick={() => setActiveTab('discover')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        activeTab === 'discover' ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20" : "text-foreground-dim hover:text-foreground hover:bg-surface-raised"
                    )}
                >
                    <Compass size={14} /> Discover
                </button>
                <button
                    onClick={() => setActiveTab('for-you')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                        activeTab === 'for-you' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-foreground-dim hover:text-foreground hover:bg-surface-raised"
                    )}
                >
                    <BrainCircuit size={14} /> For You
                </button>
            </div>

            <form onSubmit={handleSearch} className="relative w-80">
                <input
                    type="text"
                    placeholder="Search the multiverse..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-surface-elevated border border-border-subtle rounded-full pl-12 pr-4 py-3 text-sm font-bold text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-foreground-muted"
                />
                <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground-muted" />
            </form>
        </div>

        {/* Content Types & Filters */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {contentTypes.map((type) => (
                <button
                key={type.id}
                onClick={() => setActiveType(type.id)}
                className={clsx(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                    activeType === type.id
                    ? "bg-foreground text-background border-foreground shadow-lg shadow-foreground/20"
                    : "bg-transparent text-foreground-dim border-transparent hover:bg-surface-raised hover:text-foreground",
                )}
                >
                {type.label}
                </button>
            ))}
            </div>
            <button
                onClick={() => openTagManager("discovery", [])}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-elevated border border-border-subtle text-foreground-dim hover:text-foreground hover:bg-surface-raised transition-all"
            >
                <Filter size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                Filter By Genre
                </span>
            </button>
        </div>
      </div>

      {/* ─── Main Content Area ─── */}
      <div className="px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-8 pb-32 min-h-screen">
        <AnimatePresence mode="wait">
            {activeTab === 'search' && (
                <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <Search size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Search Results</h2>
                                <p className="text-foreground-dim text-xs font-bold">Found matches for "{query}"</p>
                            </div>
                        </div>
                        <button onClick={() => { clearResults(); setActiveTab('discover'); }} className="text-[10px] font-black uppercase tracking-widest text-foreground-dim hover:text-foreground">
                            Clear Search
                        </button>
                    </div>
                    {renderGrid(filteredResults, isSearching, "Searching...")}
                </motion.div>
            )}

            {activeTab === 'latest' && (
                <motion.div key="latest" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                                <Clock size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Latest Updates</h2>
                                <p className="text-foreground-dim text-xs font-bold">Chronological releases from active sources. No personalization.</p>
                            </div>
                        </div>
                    </div>
                    {renderGrid(filteredLatest, isLoadingLatest, "Fetching latest releases...")}
                </motion.div>
            )}

            {activeTab === 'discover' && (
                <motion.div key="discover" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                <Compass size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Discover</h2>
                                <p className="text-foreground-dim text-xs font-bold">Randomized and trending explorations.</p>
                            </div>
                        </div>
                        <button onClick={() => fetchRandom(true)} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-[10px] font-black uppercase tracking-widest transition-all">
                            <Sparkles size={14} /> Shuffle
                        </button>
                    </div>
                    {renderGrid(filteredRandom, isLoadingRandom, "Summoning randomness...")}
                </motion.div>
            )}

            {activeTab === 'for-you' && (
                <motion.div key="for-you" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <BrainCircuit size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">For You</h2>
                                <p className="text-foreground-dim text-xs font-bold">Powered by Manga Intelligence. Based on your reading history.</p>
                            </div>
                        </div>
                    </div>
                    {renderGrid(filteredForYou, isLoadingForYou, "Analyzing your interests...")}
                </motion.div>
            )}
        </AnimatePresence>

        <ContextMenu
          activeMenu={activeMenu}
          onAction={(action, item) => {
            if (action === "view") openQuickView(item);
            if (action === "share") {
              navigator.clipboard.writeText(item.url);
              toast.success("Link copied to clipboard!");
            }
            if (action === "download") {
              useModalStore.getState().openImportModal(item.url);
            }
            setActiveMenu(null);
          }}
          onClose={() => setActiveMenu(null)}
        />
      </div>
    </div>
  );
};
