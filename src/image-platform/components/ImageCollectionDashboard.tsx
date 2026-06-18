import React, { useEffect, useState } from 'react';
import { useImageEngineStore } from '../useImageEngineStore';
import { useSlideshowStore } from '../useSlideshowStore';
import { MasonryGrid } from './MasonryGrid';
import { ImageDetailModal } from './ImageDetailModal';
import { MyCollectionTab } from './MyCollectionTab';
import { PlaylistsTab } from './PlaylistsTab';
import { Search, Play, Pause, FastForward, Rewind, Shuffle, Repeat } from 'lucide-react';
import { getDb } from '../../services/db';

export const ImageCollectionDashboard = () => {
  const store = useImageEngineStore();
  const slideshow = useSlideshowStore();
  
  // Derive active feed state
  const activeFeed = store.feeds[store.fetchMode];
  const images = activeFeed.images;
  const currentQuery = store.fetchMode === 'search' ? store.feeds.search.query : "";
  
  const [searchInput, setSearchInput] = useState("");
  const [favoriteTags, setFavoriteTags] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  
  type DashboardTab = "new" | "foryou" | "collection" | "playlists" | "discover";
  const [activeTab, setActiveTab] = useState<DashboardTab>("new");

  const loadFavorites = async () => {
    try {
      const db = getDb();
      const favs = await db.select<{tag: string}[]>("SELECT tag FROM FavoriteTags ORDER BY usageCount DESC");
      setFavoriteTags(favs.map(f => f.tag));
    } catch (e) {
      console.warn("Failed to load favorite tags", e);
    }
  };

  // Handle Tab changes
  useEffect(() => {
    loadFavorites();
    if (activeTab === "new") store.fetchLatest();
    if (activeTab === "foryou") store.fetchCurated();
    if (activeTab === "discover") store.fetchDiscover();
    // collections and playlists will be handled by their respective components
  }, [activeTab]);

  const toggleFavoriteTag = async (tag: string) => {
    try {
      const db = getDb();
      if (favoriteTags.includes(tag)) {
        await db.execute("DELETE FROM FavoriteTags WHERE tag = ?", [tag]);
      } else {
        await db.execute("INSERT OR REPLACE INTO FavoriteTags (tag, usageCount) VALUES (?, 1)", [tag]);
      }
      await loadFavorites();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    store.search(searchInput);
  };

  const handleSavePlaylist = async () => {
    if (!currentQuery.trim()) return;
    try {
      const db = getDb();
      await db.execute(
        "INSERT INTO FlowPlaylists (id, name, query) VALUES (?, ?, ?)",
        [crypto.randomUUID(), `Playlist: ${currentQuery}`, currentQuery]
      );
      alert("Saved Smart Playlist!");
    } catch (e) {
      console.error(e);
      alert("Failed to save playlist");
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-background relative">
      {/* Top Header / Search Bar */}
      <div className="flex-none p-6 flex flex-col gap-4 border-b border-border-subtle bg-surface-elevated/50 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted group-focus-within:text-accent transition-colors" size={20} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search images... try: boy castle -gun source:danbooru"
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-black/20 border border-white/5 focus:border-accent/50 focus:bg-black/40 text-foreground transition-all outline-none"
            />
          </form>
          
          <button 
            onClick={() => slideshow.start(0, images, () => store.loadNextPage())}
            className="h-12 px-6 bg-accent hover:bg-accent-hover text-white font-black uppercase tracking-widest rounded-xl flex items-center gap-3 shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all"
          >
            <Play size={18} fill="currentColor" />
            Slideshow
          </button>
          
          {currentQuery && (
            <button 
              onClick={handleSavePlaylist}
              className="h-12 px-6 bg-surface hover:bg-surface-raised border border-border-subtle text-foreground-muted hover:text-foreground font-black uppercase tracking-widest rounded-xl transition-all"
            >
              Save Playlist
            </button>
          )}
          {searchInput && (
            <button 
              onClick={(e) => { e.preventDefault(); toggleFavoriteTag(searchInput.trim()); }}
              className="h-12 px-6 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 font-black uppercase tracking-widest rounded-xl transition-all"
            >
              {favoriteTags.includes(searchInput.trim()) ? "Unstar Tag" : "Star Tag"}
            </button>
          )}
        </div>

        {/* Tabs Row */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pt-2">
          {[
            { id: "new", label: "New Images" },
            { id: "foryou", label: "For You" },
            { id: "collection", label: "My Collection" },
            { id: "playlists", label: "Playlists" },
            { id: "discover", label: "Discover" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (activeTab === tab.id) {
                  // Force refresh if clicking the active tab again
                  if (tab.id === "new") store.fetchLatest(true);
                  if (tab.id === "foryou") store.fetchCurated(true);
                  if (tab.id === "discover") store.fetchDiscover(true);
                } else {
                  setActiveTab(tab.id as DashboardTab);
                }
              }}
              className={`pb-2 px-1 border-b-2 font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-foreground-muted hover:text-foreground hover:border-white/20'}`}
              title={activeTab === tab.id ? "Click again to refresh" : ""}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="text-[10px] bg-accent/20 px-1.5 py-0.5 rounded-md">↻</span>
              )}
            </button>
          ))}
        </div>

        {/* Favorite Tags Row (Only visible in For You or Search modes) */}
        {favoriteTags.length > 0 && (activeTab === "foryou" || searchInput) && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            <span className="text-xs font-black uppercase tracking-widest text-foreground-muted mr-2 shrink-0">For You:</span>
            {favoriteTags.map(tag => (
              <button
                key={tag}
                onClick={() => {
                  setSearchInput(tag);
                  store.search(tag);
                }}
                className="shrink-0 px-4 py-1.5 rounded-full bg-surface border border-border-subtle hover:border-accent text-sm text-foreground transition-all flex items-center gap-2 group"
              >
                #{tag}
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleFavoriteTag(tag); }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all p-0.5 rounded-full hover:bg-red-500/20"
                >
                  ✕
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "new" || activeTab === "foryou" || activeTab === "discover" || searchInput ? (
          <MasonryGrid 
            images={images} 
            columns={5}
            onImageClick={(_, index) => setSelectedImageIndex(index)}
          />
        ) : activeTab === "collection" ? (
          <MyCollectionTab />
        ) : activeTab === "playlists" ? (
          <PlaylistsTab 
            onPlay={(query) => {
              setActiveTab("new");
              setSearchInput(query);
              store.search(query);
            }} 
          />
        ) : null}
      </div>

      {/* Image Detail Modal */}
      {selectedImageIndex !== null && images[selectedImageIndex] && (
        <ImageDetailModal 
          image={images[selectedImageIndex]} 
          images={images}
          index={selectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
          onSearchTag={(tag) => {
            setActiveTab("new");
            setSearchInput(tag);
            store.search(tag);
          }}
        />
      )}

      {/* Fullscreen Slideshow Overlay */}
      {slideshow.isActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <div className="absolute top-6 right-6 z-50">
            <button onClick={slideshow.stop} className="px-6 py-2 bg-red-500/20 text-red-400 font-black uppercase tracking-widest rounded-full hover:bg-red-500/40 transition-all">Close</button>
          </div>
          
          {slideshow.isActive && slideshow.images[slideshow.currentIndex] && (
            (slideshow.images[slideshow.currentIndex].fullUrl?.match(/\.(mp4|webm)$/i) || slideshow.images[slideshow.currentIndex].sampleUrl?.match(/\.(mp4|webm)$/i)) ? (
              <video 
                src={slideshow.images[slideshow.currentIndex].fullUrl || slideshow.images[slideshow.currentIndex].sampleUrl}
                autoPlay
                loop
                muted={!slideshow.isPaused} // Allow sound if they pause? Or just keep muted
                controls={slideshow.isPaused} // Show controls if paused
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <img 
                src={slideshow.images[slideshow.currentIndex].fullUrl || slideshow.images[slideshow.currentIndex].sampleUrl}
                className="max-w-full max-h-full object-contain"
                alt="Slideshow slide"
              />
            )
          )}

          <div className="absolute bottom-10 flex items-center gap-6 px-8 py-4 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 z-50">
            <button onClick={slideshow.prev} className="p-3 hover:bg-white/10 rounded-full text-foreground transition-all"><Rewind size={24} /></button>
            <button onClick={slideshow.togglePause} className="p-4 bg-accent hover:bg-accent-hover text-white rounded-full shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all">
              {slideshow.isPaused ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}
            </button>
            <button onClick={slideshow.next} className="p-3 hover:bg-white/10 rounded-full text-foreground transition-all"><FastForward size={24} /></button>
            
            <div className="w-px h-8 bg-white/20 mx-2" />
            
            <button onClick={() => useSlideshowStore.setState({ shuffle: !slideshow.shuffle })} className={`p-3 rounded-full transition-all ${slideshow.shuffle ? 'text-accent bg-accent/20' : 'text-foreground hover:bg-white/10'}`}><Shuffle size={20} /></button>
            <button onClick={() => useSlideshowStore.setState({ loop: !slideshow.loop })} className={`p-3 rounded-full transition-all ${slideshow.loop ? 'text-accent bg-accent/20' : 'text-foreground hover:bg-white/10'}`}><Repeat size={20} /></button>
            
            <div className="w-px h-8 bg-white/20 mx-2" />
            
            {/* Info Toggle */}
            <button 
              onClick={() => {
                const el = document.getElementById('slideshow-info-overlay');
                if (el) el.classList.toggle('hidden');
              }}
              className="p-3 rounded-full transition-all text-foreground hover:bg-white/10 border border-transparent"
              title="Toggle Info Overlay"
            >
              Info
            </button>

            <select 
              value={slideshow.intervalMs} 
              onChange={(e) => slideshow.setInterval(Number(e.target.value))}
              className="bg-transparent text-foreground-muted hover:text-foreground font-black text-sm uppercase tracking-widest outline-none cursor-pointer ml-4"
            >
              <option value={3000} className="bg-black">3s</option>
              <option value={5000} className="bg-black">5s</option>
              <option value={10000} className="bg-black">10s</option>
              <option value={30000} className="bg-black">30s</option>
            </select>
          </div>
          
          {/* Info Overlay */}
          {slideshow.images[slideshow.currentIndex] && (
            <div id="slideshow-info-overlay" className="hidden absolute top-6 left-6 max-w-sm p-4 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl pointer-events-none text-white shadow-2xl z-40">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-black uppercase tracking-widest text-accent mb-1">{slideshow.images[slideshow.currentIndex].providerId}</span>
                <span className="font-bold">{slideshow.images[slideshow.currentIndex].width} × {slideshow.images[slideshow.currentIndex].height}</span>
                <span className="text-sm text-gray-300 line-clamp-3 leading-relaxed mt-2">{slideshow.images[slideshow.currentIndex].tags.slice(0, 15).join(", ")}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
