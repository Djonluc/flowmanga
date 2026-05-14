import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  TrendingUp, 
  Zap, 
  Compass, 
  Filter, 
  ChevronRight,
  Globe,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useDiscoveryStore } from '../stores/useDiscoveryStore';
import { useModalStore } from '../stores/useModalStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { MangaCard } from './library/MangaCard';
import { toast } from './Toast';
import { ContextMenu } from './shared/ContextMenu';
import { sourceRegistry } from '../services/sources/registry';
import clsx from 'clsx';

export const DiscoverView = () => {
  const { 
    results,
    trending,
    latest, 
    random,
    isSearching, 
    isLoadingTrending, 
    isLoadingLatest, 
    isLoadingRandom,
    query,
    activeType,
    search, 
    fetchTrending, 
    fetchLatest,
    fetchRandom,
    setQuery,
    setActiveType,
    clearResults,
    forceRefresh
  } = useDiscoveryStore();

  const { openQuickView, openTagManager } = useModalStore();
  const [activeTab, setActiveTab] = useState<'featured' | 'search' | 'trending-grid' | 'latest-grid' | 'random-grid'>('featured');
  const [activeMenu, setActiveMenu] = useState<{ x: number, y: number, item: any } | null>(null);

  const { coloredOnly } = useSettingsStore();

  useEffect(() => {
    fetchTrending();
    fetchLatest();
    fetchRandom();
  }, [fetchTrending, fetchLatest, fetchRandom, coloredOnly]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setActiveTab('search');
      search(query);
    }
  };

  const handleClear = () => {
    clearResults();
    setActiveTab('featured');
  };

  const contentTypes = [
    { id: 'all', label: 'All Content' },
    { id: 'manga', label: 'Manga' },
    { id: 'manhwa', label: 'Manhwa' },
    { id: 'manhua', label: 'Manhua' },
    { id: 'comic', label: 'Comics' },
    { id: 'doujin', label: 'Doujinshi' },
    { id: 'gallery', label: 'Gallery' },
  ];

  const getFilteredItems = (items: any[]) => {
    if (!Array.isArray(items)) return [];
    if (activeType === 'all') return items.filter(Boolean);
    return items.filter(item => {
      if (!item) return false;
      const src = item.source?.toLowerCase() || '';
      const tags = (item.tags || []).map((t: string) => t?.toLowerCase()).filter(Boolean);
      const contentType = item.contentType || 'manga';
      
      if (activeType === 'gallery') return contentType === 'gallery' || src.includes('zerochan');
      if (activeType === 'doujin') return contentType === 'doujin' || src.includes('nhentai') || src.includes('rule34');
      
      const isComic = contentType === 'comic' || src.includes('dragonball') || src.includes('blue-lock') || tags.includes('comic');
      if (activeType === 'comic') return isComic;

      const isManhwa = src.includes('manhwaread') || tags.includes('manhwa');
      if (activeType === 'manhwa') return isManhwa;

      const isManhua = src.includes('luacomic') || tags.includes('manhua');
      if (activeType === 'manhua') return isManhua;
      
      if (activeType === 'manga') return (contentType === 'manga' && !isComic && !isManhwa && !isManhua && contentType !== 'doujin' && contentType !== 'gallery');
      
      return true;
    });
  };

  const filteredResults = getFilteredItems(results);
  const filteredTrending = getFilteredItems(trending);
  const filteredLatest = getFilteredItems(latest);
  const filteredRandom = getFilteredItems(random);

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar relative bg-transparent">
      {/* ─── Top Sticky Header (Search & Filters) ─── */}
      <div className="sticky top-0 z-40 bg-background/40 backdrop-blur-3xl border-b border-border-subtle px-8 lg:px-12 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative group w-full md:max-w-md">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={16} className="text-foreground-dim group-focus-within:text-accent transition-colors" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cast vision across all realms..."
            className="w-full bg-surface-elevated hover:bg-surface-raised focus:bg-surface-elevated border border-border-subtle focus:border-accent/50 rounded-2xl py-3 pl-12 pr-4 text-foreground placeholder:text-foreground-dim/50 focus:outline-none transition-all duration-300 text-sm font-medium"
          />
          <button 
            type="submit"
            className="absolute right-2 top-2 bottom-2 px-4 rounded-xl bg-accent hover:opacity-90 text-foreground font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center"
          >
            Seek
          </button>
        </form>

        {/* Content Types & Filters */}
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            {contentTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveType(type.id as any)}
                className={clsx(
                  "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                  activeType === type.id 
                    ? "bg-foreground text-background border-foreground shadow-lg shadow-foreground/20" 
                    : "bg-surface-elevated text-foreground-dim border-border-subtle hover:bg-surface-raised hover:text-foreground"
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-border-subtle mx-2" />
          <button 
            onClick={() => openTagManager('discovery', [])}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-elevated border border-border-subtle text-foreground-dim hover:text-foreground hover:bg-surface-raised transition-all"
          >
            <Filter size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Filter By Genre</span>
          </button>
        </div>
      </div>

      {/* ─── Main Content Area ─── */}
      <div className="px-8 lg:px-12 py-8 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'search' ? (
            <motion.div
              key="search-results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-3xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Compass size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
                      Visions Found
                    </h2>
                    <p className="text-foreground-dim text-sm font-medium">Found {filteredResults.length} matches across active sources</p>
                  </div>
                </div>
                <button 
                  onClick={handleClear}
                  className="px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[10px] font-black text-foreground/60 hover:text-foreground uppercase tracking-widest transition-colors border border-white/5"
                >
                  Dispel Visions
                </button>
              </div>

              {isSearching ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} className="aspect-[2/3] rounded-[24px] bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : filteredResults.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
                  {filteredResults.map((item) => (
                    item && (
                      <MangaCard
                        key={item.id}
                        item={item}
                        onClick={() => openQuickView(item)}
                      />
                    )
                  ))}
                </div>
              ) : (
                <div className="py-32 flex flex-col items-center justify-center text-center">
                  <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                    <Search size={32} className="text-foreground/20" />
                  </div>
                  <h3 className="text-2xl font-black text-foreground uppercase tracking-tight mb-3">The void is empty</h3>
                  <p className="text-foreground/40 text-base max-w-md">
                    We couldn't manifest any content matching "{query}" across active sources. Try using different incantations or checking your source seals.
                  </p>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'featured' ? (
            <motion.div
              key="featured-discovery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-16"
            >
              {/* Header */}
              <div className="flex flex-col gap-6 mb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-lg text-indigo-500">
                        <Sparkles size={20} />
                      </div>
                      <h2 className="text-3xl font-bold tracking-tight text-foreground leading-none">
                        Scout
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                        <p className="text-foreground-dim font-medium text-xs tracking-wide">
                            Peer into unknown dimensions and ascending powers.
                        </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Random Discovery Rail */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                      <Sparkles size={16} />
                    </div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Divine Intervention</h2>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => fetchRandom(true)}
                      className="flex items-center gap-2 text-[10px] font-black text-purple-400 hover:text-purple-300 uppercase tracking-widest transition-all"
                    >
                      Re-cast <ChevronRight size={14} />
                    </button>
                    <button 
                      onClick={() => setActiveTab('random-grid')}
                      className="flex items-center gap-2 text-[10px] font-black text-foreground/40 hover:text-foreground uppercase tracking-widest transition-all"
                    >
                      See More <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {isLoadingRandom ? (
                  <div className="flex gap-6 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="w-[260px] h-[390px] flex-shrink-0 rounded-[32px] bg-surface-elevated animate-pulse border border-border-subtle" />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-6 overflow-x-auto custom-scrollbar pb-6 -mx-8 px-8 lg:-mx-12 lg:px-12 scroll-smooth">
                    {filteredRandom.map((item) => (
                      item && (
                        <div key={item.id} className="w-[260px] flex-shrink-0">
                          <MangaCard
                            item={item}
                            onClick={() => openQuickView(item)}
                            onMenuClick={(e, item) => setActiveMenu({ x: e.clientX, y: e.clientY, item })}
                          />
                        </div>
                      )
                    ))}
                  </div>
                )}
              </section>

              {/* Trending Rail */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <TrendingUp size={16} />
                    </div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Ascending Powers</h2>
                  </div>
                  <button 
                    onClick={() => setActiveTab('trending-grid')}
                    className="flex items-center gap-2 text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-all"
                  >
                    View All <ChevronRight size={14} />
                  </button>
                </div>

                {isLoadingTrending ? (
                  <div className="flex gap-6 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="w-[260px] h-[390px] flex-shrink-0 rounded-[32px] bg-surface-elevated animate-pulse border border-border-subtle" />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-6 overflow-x-auto custom-scrollbar pb-6 -mx-8 px-8 lg:-mx-12 lg:px-12 scroll-smooth">
                    {filteredTrending.map((item) => (
                      item && (
                        <div key={item.id} className="w-[260px] flex-shrink-0">
                          <MangaCard
                            item={item}
                            onClick={() => openQuickView(item)}
                            onMenuClick={(e, item) => setActiveMenu({ x: e.clientX, y: e.clientY, item })}
                          />
                        </div>
                      )
                    ))}
                  </div>
                )}
              </section>

              {/* Latest Updates Rail */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                      <Zap size={16} />
                    </div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">New Spirits</h2>
                  </div>
                  <button 
                    onClick={() => setActiveTab('latest-grid')}
                    className="flex items-center gap-2 text-[10px] font-black text-amber-400 hover:text-amber-300 uppercase tracking-widest transition-all"
                  >
                    View All <ChevronRight size={14} />
                  </button>
                </div>

                {isLoadingLatest ? (
                  <div className="flex gap-6 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="w-[260px] h-[390px] flex-shrink-0 rounded-[32px] bg-surface-elevated animate-pulse border border-border-subtle" />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-6 overflow-x-auto custom-scrollbar pb-6 -mx-8 px-8 lg:-mx-12 lg:px-12 scroll-smooth">
                    {filteredLatest.map((item) => (
                      <div key={item.id} className="w-[260px] flex-shrink-0">
                        <MangaCard
                          item={item}
                          onClick={() => openQuickView(item)}
                          onMenuClick={(e, item) => setActiveMenu({ x: e.clientX, y: e.clientY, item })}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          ) : activeTab === 'trending-grid' ? (
            <motion.div
              key="trending-grid"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-3xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Global Pulse</h2>
                    <p className="text-foreground-dim text-sm font-medium">The most potent sagas across the world tonight.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('featured')}
                  className="px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[10px] font-black text-foreground/60 hover:text-foreground uppercase tracking-widest transition-colors border border-white/5"
                >
                  Back to Featured
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
                {filteredTrending.map((item) => (
                  <MangaCard
                    key={item.id}
                    item={item}
                    onClick={() => openQuickView(item)}
                    onMenuClick={(e, item) => setActiveMenu({ x: e.clientX, y: e.clientY, item })}
                  />
                ))}
              </div>
            </motion.div>
          ) : activeTab === 'random-grid' ? (
            <motion.div
              key="random-grid"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-3xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Infinite Chaos</h2>
                    <p className="text-foreground-dim text-sm font-medium">A randomized journey through every active realm.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => fetchRandom(true)}
                    className="px-6 py-2 rounded-full bg-indigo-500 hover:bg-indigo-400 text-[10px] font-black text-foreground uppercase tracking-widest transition-all active:scale-95"
                  >
                    Shuffle New
                  </button>
                  <button 
                    onClick={() => setActiveTab('featured')}
                    className="px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[10px] font-black text-foreground/60 hover:text-foreground uppercase tracking-widest transition-colors border border-white/5"
                  >
                    Back to Featured
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
                {filteredRandom.map((item) => (
                  <MangaCard
                    key={item.id}
                    item={item}
                    onClick={() => openQuickView(item)}
                    onMenuClick={(e, item) => setActiveMenu({ x: e.clientX, y: e.clientY, item })}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="latest-grid"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-3xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Freshly Updated</h2>
                    <p className="text-foreground-dim text-sm font-medium">The latest chapters from your favorite universes.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('featured')}
                  className="px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 text-[10px] font-black text-foreground/60 hover:text-foreground uppercase tracking-widest transition-colors border border-white/5"
                >
                  Back to Featured
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
                {filteredLatest.map((item) => (
                  <MangaCard
                    key={item.id}
                    item={item}
                    onClick={() => openQuickView(item)}
                    onMenuClick={(e, item) => setActiveMenu({ x: e.clientX, y: e.clientY, item })}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ContextMenu
          activeMenu={activeMenu}
          onAction={(action, item) => {
            if (action === 'view') openQuickView(item);
            if (action === 'share') {
                navigator.clipboard.writeText(item.url);
                toast.success('Link copied to clipboard!');
            }
            if (action === 'download') {
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
