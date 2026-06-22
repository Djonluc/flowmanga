import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useImageEngineStore } from '../useImageEngineStore';
import { useSlideshowStore } from '../useSlideshowStore';
import { useImageCollectionStore } from '../useImageCollectionStore';
import { MasonryGrid } from './MasonryGrid';
import { ImageDetailModal } from './ImageDetailModal';
import { MyCollectionTab } from './MyCollectionTab';
import { PlaylistsTab } from './PlaylistsTab';
import { ForYouHeader } from './ForYouHeader';
import { TagDescription } from './TagDescription';
import { Search, Play, Pause, FastForward, Rewind, Shuffle, Repeat, Loader2, ChevronDown } from 'lucide-react';
import { getDb } from '../../services/db';
import { useMediaLoader } from '../../hooks/useMediaLoader';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { PlatformImage } from '../types';

const SlideshowMedia = ({ image, isPaused }: { image: PlatformImage; isPaused: boolean }) => {
  const { proxyViaTauri, needsProxy } = useMediaLoader();
  const [src, setSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setSrc(null);
    setIsLoading(true);
    
    if (image.localPath) {
      setSrc(convertFileSrc(image.localPath));
      setIsLoading(false);
      return;
    }

    const targetUrl = image.fullUrl || image.sampleUrl || image.thumbnailUrl || "";
    if (needsProxy(targetUrl)) {
      proxyViaTauri(targetUrl).then(url => {
        if (active) {
          setSrc(url);
          setIsLoading(false);
        }
      }).catch(err => {
        console.error("Proxy failed for url:", targetUrl, err);
        if (active) {
          setSrc(targetUrl); // Fallback to raw URL
          setIsLoading(false);
        }
      });
    } else {
      setSrc(targetUrl);
      setIsLoading(false);
    }

    return () => {
      active = false;
    };
  }, [image.fullUrl, image.sampleUrl, image.thumbnailUrl, needsProxy, proxyViaTauri]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[70vh] text-foreground-muted gap-3">
        <Loader2 className="animate-spin text-accent" size={40} />
        <span className="text-sm font-bold uppercase tracking-widest">Loading Media...</span>
      </div>
    );
  }

  const isVideo = image.fullUrl?.match(/\.(mp4|webm)(?:\?|$)/i) || image.sampleUrl?.match(/\.(mp4|webm)(?:\?|$)/i) || image.localPath?.match(/\.(mp4|webm)(?:\?|$)/i);

  useEffect(() => {
    if (isVideo && src) {
      useSlideshowStore.getState().pauseTimer();
      return () => useSlideshowStore.getState().resumeTimer();
    }
  }, [isVideo, src]);

  if (isVideo) {
    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {src && <img src={image.thumbnailUrl || image.sampleUrl || ""} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-125 pointer-events-none saturate-150" alt="" />}
        <video 
          src={src || ""}
          autoPlay
          muted={!isPaused}
          controls={isPaused}
          onEnded={() => useSlideshowStore.getState().next()}
          className="w-full h-full object-contain select-none animate-fade-in relative z-10"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {src && <img src={src} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-125 pointer-events-none saturate-150" alt="" />}
      <img 
        src={src || ""}
        className="w-full h-full object-contain select-none animate-fade-in relative z-10"
        alt="Slideshow slide"
      />
    </div>
  );
};

export const ImageCollectionDashboard = () => {
  const store = useImageEngineStore();
  const slideshow = useSlideshowStore();
  
  // Derive active feed state
  const activeFeed = store.feeds[store.fetchMode];
  const { globalMediaFilter, setGlobalMediaFilter } = useSettingsStore();

  const images = activeFeed.images.filter(img => {
    if (globalMediaFilter === 'all') return true;
    return img.mediaType === globalMediaFilter;
  });

  const currentQuery = store.fetchMode === 'search' ? store.feeds.search.query : "";
  
  const [searchInput, setSearchInput] = useState("");
  const [favoriteTags, setFavoriteTags] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [modalImages, setModalImages] = useState<any[] | null>(null);
  
  type DashboardTab = "new" | "foryou" | "collection" | "playlists" | "discover" | "search";
  const [activeTab, setActiveTab] = useState<DashboardTab>("discover");
  const [refreshKey, setRefreshKey] = useState(0);

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
    if (activeTab === "search") useImageEngineStore.setState({ fetchMode: 'search' });
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
    setActiveTab("search");
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
  // Handle slideshow keyboard controls
  useEffect(() => {
    if (!slideshow.isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.code === 'KeyA' || e.key.toLowerCase() === 'a') {
        slideshow.prev();
      } else if (e.key === 'ArrowRight' || e.code === 'KeyD' || e.key.toLowerCase() === 'd') {
        slideshow.next();
      } else if (e.key === ' ') {
        e.preventDefault();
        slideshow.togglePause();
      } else if (e.key === 'Escape') {
        slideshow.stop();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(err => console.log(err));
        }
      } else if (e.code === 'KeyW' || e.key.toLowerCase() === 'w') {
        useSlideshowStore.getState().setInterval(Math.max(1000, useSlideshowStore.getState().intervalMs - 1000));
      } else if (e.code === 'KeyS' || e.key.toLowerCase() === 's') {
        useSlideshowStore.getState().setInterval(Math.min(60000, useSlideshowStore.getState().intervalMs + 1000));
      } else if (e.code === 'KeyF' || e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) {
          document.getElementById('slideshow-container')?.requestFullscreen().catch(err => console.log(err));
        } else {
          document.exitFullscreen().catch(err => console.log(err));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slideshow.isActive, slideshow.next, slideshow.prev, slideshow.togglePause, slideshow.stop]);

  const [showSlideshowControls, setShowSlideshowControls] = useState(true);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const handleMouseMove = () => {
      setShowSlideshowControls(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setShowSlideshowControls(false);
      }, 1500);
    };

    if (slideshow.isActive) {
      window.addEventListener('mousemove', handleMouseMove);
      timeoutId = setTimeout(() => setShowSlideshowControls(false), 1500);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeoutId);
    };
  }, [slideshow.isActive]);

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

          <select
            value={globalMediaFilter}
            onChange={(e) => setGlobalMediaFilter(e.target.value as any)}
            className="h-12 px-4 bg-surface hover:bg-surface-raised border border-border-subtle text-foreground-muted hover:text-foreground font-black uppercase tracking-widest rounded-xl transition-all outline-none"
          >
            <option value="all">All Media</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="gif">GIFs</option>
          </select>
          
          <button 
            onClick={() => {
              if (activeTab === 'collection' || activeTab === 'playlists') {
                alert('Use the slideshow button inside the Collection or Playlist tab.');
                return;
              }
              if (images.length === 0) {
                alert('No images loaded yet. Wait for images to load first.');
                return;
              }
              slideshow.start(0, images, () => store.loadNextPage());
            }}
            disabled={activeTab === 'collection' || activeTab === 'playlists'}
            className="h-12 px-6 bg-accent hover:bg-accent-hover text-white font-black uppercase tracking-widest rounded-xl flex items-center gap-3 shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={18} fill="currentColor" />
            Slideshow
          </button>
          
          <div className="relative group/actions z-[100]">
            <button className="h-12 px-6 bg-surface hover:bg-surface-raised border border-border-subtle text-foreground-muted hover:text-foreground font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2">
              Actions <ChevronDown size={14} />
            </button>
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface-elevated border border-border-subtle rounded-xl shadow-xl flex flex-col overflow-hidden opacity-0 invisible group-hover/actions:opacity-100 group-hover/actions:visible transition-all scale-95 origin-top-right group-hover/actions:scale-100">
              {currentQuery && (
                <button 
                  onClick={handleSavePlaylist}
                  className="px-4 py-3 text-left hover:bg-surface-raised text-foreground-muted hover:text-foreground font-black text-xs uppercase tracking-widest transition-all border-b border-white/5"
                >
                  Save Playlist
                </button>
              )}
              {searchInput && (
                <button 
                  onClick={(e) => { e.preventDefault(); toggleFavoriteTag(searchInput.trim()); }}
                  className="px-4 py-3 text-left hover:bg-yellow-500/10 text-yellow-500 font-black text-xs uppercase tracking-widest transition-all border-b border-white/5"
                >
                  {favoriteTags.includes(searchInput.trim()) ? "Unstar Tag" : "Star Tag"}
                </button>
              )}
              <button 
                onClick={async () => {
                  const { found, totalChecked } = await useImageCollectionStore.getState().recheckLocalFiles();
                  alert(`Checked ${totalChecked} files. Found and linked ${found} local downloads!`);
                }}
                className="px-4 py-3 text-left hover:bg-surface-raised text-foreground-muted hover:text-foreground font-black text-xs uppercase tracking-widest transition-all"
              >
                Recheck Local Files
              </button>
            </div>
          </div>
        </div>

        {/* Tabs Row */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pt-2">
          {[
            { id: "new", label: "Latest Content" },
            { id: "foryou", label: "For You" },
            { id: "discover", label: "Discover" },
            { id: "search", label: "Search Results" },
            { id: "collection", label: "My Collection" },
            { id: "playlists", label: "Playlists" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (activeTab === tab.id) {
                  // Force refresh if clicking the active tab again
                  if (tab.id === "new") store.fetchLatest(true);
                  if (tab.id === "foryou") store.fetchCurated(true);
                  if (tab.id === "discover") store.fetchDiscover(true);
                  if (tab.id === "search") store.search(searchInput);
                  if (tab.id === "collection" || tab.id === "playlists") setRefreshKey(prev => prev + 1);
                } else {
                  setActiveTab(tab.id as DashboardTab);
                  if (tab.id !== "collection" && tab.id !== "playlists") {
                    const mappedMode = tab.id === "new" ? "latest" : tab.id === "foryou" ? "curated" : tab.id;
                    useImageEngineStore.setState({ fetchMode: mappedMode as any });
                  }
                }
              }}
              className={`pb-2 px-1 border-b-2 font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-foreground-muted hover:text-foreground hover:border-white/20'}`}
              title={activeTab === tab.id ? "Click again to force refresh" : ""}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="text-[10px] bg-accent/20 px-1.5 py-0.5 rounded-md">↻</span>
              )}
            </button>
          ))}
        </div>

      </div>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === "foryou" && <ForYouHeader />}
        
        <div className={clsx("flex-1 overflow-hidden", activeTab === "new" ? "block" : "hidden")}>
          <MasonryGrid 
            feedType="latest"
            images={store.feeds.latest.images} 
            columns={5}
            onImageClick={(_, index) => {
              setModalImages(store.feeds.latest.images);
              setSelectedImageIndex(index);
            }}
          />
        </div>

        <div className={clsx("flex-1 overflow-hidden", activeTab === "foryou" ? "block" : "hidden")}>
          <MasonryGrid 
            feedType="curated"
            images={store.feeds.curated.images} 
            columns={5}
            onImageClick={(_, index) => {
              setModalImages(store.feeds.curated.images);
              setSelectedImageIndex(index);
            }}
          />
        </div>

        <div className={clsx("flex-1 overflow-hidden", activeTab === "discover" ? "block" : "hidden")}>
          <MasonryGrid 
            feedType="discover"
            images={store.feeds.discover.images} 
            columns={5}
            onImageClick={(_, index) => {
              setModalImages(store.feeds.discover.images);
              setSelectedImageIndex(index);
            }}
          />
        </div>

        <div className={clsx("flex-1 overflow-hidden", activeTab === "search" ? "block" : "hidden")}>
          <MasonryGrid 
            feedType="search"
            header={currentQuery ? <TagDescription query={currentQuery} /> : undefined}
            images={store.feeds.search.images} 
            columns={5}
            onImageClick={(_, index) => {
              setModalImages(store.feeds.search.images);
              setSelectedImageIndex(index);
            }}
          />
        </div>

        {activeTab === "collection" && (
          <MyCollectionTab 
            key={refreshKey}
            onImageClick={(_, index, contextImages) => {
              setModalImages(contextImages);
              setSelectedImageIndex(index);
            }}
          />
        )}

        {activeTab === "playlists" && (
          <PlaylistsTab 
            key={refreshKey}
            onPlay={(query) => {
              setActiveTab("search");
              setSearchInput(query);
              store.search(query);
            }} 
          />
        )}
      </div>

      {/* Image Detail Modal */}
      {selectedImageIndex !== null && (modalImages || images)[selectedImageIndex] && (
        <ImageDetailModal 
          image={(modalImages || images)[selectedImageIndex]} 
          images={modalImages || images}
          index={selectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
          onNavigate={(newIndex) => {
            const arr = modalImages || images;
            if (newIndex >= 0 && newIndex < arr.length) {
              setSelectedImageIndex(newIndex);
            }
          }}
          onSearchTag={(tag) => {
            setSearchInput(tag);
            setActiveTab("search");
            store.search(tag);
            setSelectedImageIndex(null);
          }}
          favoriteTags={favoriteTags}
          onToggleFavorite={(tag) => toggleFavoriteTag(tag)}
        />
      )}

      {/* Fullscreen Slideshow Overlay */}
      {slideshow.isActive && (
        <div id="slideshow-container" className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center ${showSlideshowControls ? 'cursor-default' : 'cursor-none'}`}>
          <div className={`absolute top-6 right-6 z-[110] flex items-center gap-2 transition-opacity duration-500 ${showSlideshowControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            <button 
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.getElementById('slideshow-container')?.requestFullscreen().catch(err => console.log(err));
                } else {
                  document.exitFullscreen().catch(err => console.log(err));
                }
              }} 
              className="px-4 py-1.5 bg-black/40 hover:bg-black/60 border border-white/10 text-foreground font-black text-xs uppercase tracking-widest rounded-full transition-all backdrop-blur-md"
            >
              Fullscreen (F)
            </button>
            <button 
              onClick={() => {
                slideshow.stop();
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(err => console.log(err));
                }
              }} 
              className="px-4 py-1.5 bg-red-500/20 text-red-400 font-black text-xs uppercase tracking-widest rounded-full hover:bg-red-500/40 transition-all backdrop-blur-md"
            >
              Close
            </button>
          </div>
          
          {slideshow.isActive && slideshow.images[slideshow.currentIndex] && (
            <SlideshowMedia 
              image={slideshow.images[slideshow.currentIndex]} 
              isPaused={slideshow.isPaused}
            />
          )}

          <div className={`absolute bottom-10 flex items-center gap-4 px-6 py-2 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 z-[110] transition-opacity duration-500 ${showSlideshowControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            <button onClick={slideshow.prev} className="p-2 hover:bg-white/10 rounded-full text-foreground transition-all"><Rewind size={20} /></button>
            <button onClick={slideshow.togglePause} className="p-3 bg-accent hover:bg-accent-hover text-white rounded-full shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all">
              {slideshow.isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
            </button>
            <button onClick={slideshow.next} className="p-2 hover:bg-white/10 rounded-full text-foreground transition-all"><FastForward size={20} /></button>
            
            <div className="w-px h-6 bg-white/20 mx-1" />
            
            <button onClick={() => useSlideshowStore.setState({ shuffle: !slideshow.shuffle })} className={`p-2 rounded-full transition-all ${slideshow.shuffle ? 'text-accent bg-accent/20' : 'text-foreground hover:bg-white/10'}`}><Shuffle size={16} /></button>
            <button onClick={() => useSlideshowStore.setState({ loop: !slideshow.loop })} className={`p-2 rounded-full transition-all ${slideshow.loop ? 'text-accent bg-accent/20' : 'text-foreground hover:bg-white/10'}`}><Repeat size={16} /></button>
            
            <div className="w-px h-6 bg-white/20 mx-1" />
            
            {/* Info Toggle */}
            <button 
              onClick={() => {
                const el = document.getElementById('slideshow-info-overlay');
                if (el) el.classList.toggle('hidden');
              }}
              className="p-2 text-xs rounded-full transition-all text-foreground hover:bg-white/10 border border-transparent"
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
            <div id="slideshow-info-overlay" className={`hidden absolute top-6 left-6 max-w-sm p-4 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl pointer-events-none text-white shadow-2xl z-[110] transition-opacity duration-500 ${showSlideshowControls ? 'opacity-100' : 'opacity-0'}`}>
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
