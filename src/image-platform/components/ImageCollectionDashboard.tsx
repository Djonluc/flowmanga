import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useImageEngineStore } from '../useImageEngineStore';
import { useSlideshowStore } from '../useSlideshowStore';
import { useImageCollectionStore } from '../useImageCollectionStore';
import { MasonryGrid } from './MasonryGrid';
import { ImageDetailModal } from './ImageDetailModal';
import { EHentaiGalleryReader } from './EHentaiGalleryReader';
import { MyCollectionTab } from './MyCollectionTab';
import { PlaylistsTab } from './PlaylistsTab';
import { ForYouHeader } from './ForYouHeader';
import { TagDescription } from './TagDescription';
import { Search, Play, Pause, FastForward, Rewind, Shuffle, Repeat, Loader2, ChevronDown, X } from 'lucide-react';
import { getDb } from '../../services/db';
import { useMediaLoader } from '../../hooks/useMediaLoader';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { PlatformImage } from '../types';
import { getSankakuTagSuggestions, type SankakuTagSuggestion } from '../../services/Sankaku';
import { ContentFilter } from '../../services/ContentFilter';

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

  const isVideo = image.fullUrl?.match(/\.(mp4|webm)(?:\?|$)/i) || image.sampleUrl?.match(/\.(mp4|webm)(?:\?|$)/i) || image.localPath?.match(/\.(mp4|webm)(?:\?|$)/i);

  useEffect(() => {
    if (isVideo && src) {
      useSlideshowStore.getState().pauseTimer();
      return () => useSlideshowStore.getState().resumeTimer();
    }
  }, [isVideo, src]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[70vh] text-foreground-muted gap-3">
        <Loader2 className="animate-spin text-accent" size={40} />
        <span className="text-sm font-bold uppercase tracking-widest">Loading Media...</span>
      </div>
    );
  }

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
        >
          <track kind="captions" src="data:text/vtt;charset=utf-8,WEBVTT%0A%0A" srcLang="en" label="No captions available" />
        </video>
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
  const { globalMediaFilter, setGlobalMediaFilter, showAdultContent } = useSettingsStore();

  const filterImages = (feedImages: PlatformImage[]) => feedImages.filter(img => {
    if (!showAdultContent && ContentFilter.isAdultPlatformImage(img)) return false;
    if (globalMediaFilter === 'all') return true;
    if (globalMediaFilter === 'image') return !img.mediaType || img.mediaType === 'image';
    return img.mediaType === globalMediaFilter;
  });

  const latestImages = filterImages(store.feeds.latest.images);
  const curatedImages = filterImages(store.feeds.curated.images);
  const discoverImages = filterImages(store.feeds.discover.images);
  const searchImages = filterImages(store.feeds.search.images);
  const images = filterImages(activeFeed.images);

  const currentQuery = store.fetchMode === 'search' ? store.feeds.search.query : "";
  
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const searchInput = [...searchTags, searchDraft.trim()].filter(Boolean).join(' ');
  const [sankakuSuggestions, setSankakuSuggestions] = useState<SankakuTagSuggestion[]>([]);
  const [favoriteTags, setFavoriteTags] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [modalImages, setModalImages] = useState<any[] | null>(null);
  
  type DashboardTab = "new" | "foryou" | "collection" | "playlists" | "discover" | "search";
  const activeTab = store.activeTab;
  const setActiveTab = store.setActiveTab;
  const [refreshKey, setRefreshKey] = useState(0);
  const previousAdultSetting = useRef(showAdultContent);

  useEffect(() => {
    if (previousAdultSetting.current === showAdultContent) return;
    previousAdultSetting.current = showAdultContent;

    // Cached cards are hidden synchronously by filterImages above. Reset the
    // remote feeds as well so switching tabs cannot resurrect stale results.
    store.reset();
    setRefreshKey(key => key + 1);
    setModalImages(null);
    setSelectedImageIndex(null);

    if (activeTab === 'new') void useImageEngineStore.getState().fetchLatest(true);
    if (activeTab === 'foryou') void useImageEngineStore.getState().fetchCurated(true);
    if (activeTab === 'discover') void useImageEngineStore.getState().fetchDiscover(true);
    if (activeTab === 'search' && searchInput) void useImageEngineStore.getState().search(searchInput);
  }, [showAdultContent]);

  useEffect(() => {
    const lastTerm = searchDraft.trim();
    if (lastTerm.replace(/^-?(?:artist|studio|character|series|copyright|genre|meta):/i, '').length < 2 || !useSettingsStore.getState().isSourceEnabled('sankaku')) {
      setSankakuSuggestions([]);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      getSankakuTagSuggestions(lastTerm).then((suggestions) => {
        if (active) setSankakuSuggestions(suggestions);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchDraft]);

  const setSearchQuery = (query: string) => {
    setSearchTags(query.trim().split(/\s+/).filter(Boolean));
    setSearchDraft('');
    setSankakuSuggestions([]);
  };

  const commitSearchTag = (rawTag: string) => {
    const tag = rawTag.trim();
    if (!tag) return;
    setSearchTags(current => current.includes(tag) ? current : [...current, tag]);
    setSearchDraft('');
    setSankakuSuggestions([]);
  };

  const applySankakuSuggestion = (suggestion: SankakuTagSuggestion) => {
    const prefix = searchDraft.match(/^(-?)(?:(artist|studio|character|series|copyright|genre|meta):)?/i);
    commitSearchTag(`${prefix?.[1] || ''}${prefix?.[2] ? `${prefix[2]}:` : ''}${suggestion.tag}`);
  };

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
    setRefreshKey(prev => prev + 1);
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
    const query = [...searchTags, searchDraft.trim()].filter(Boolean).join(' ');
    if (!query) return;
    if (searchDraft.trim()) commitSearchTag(searchDraft);
    setRefreshKey(prev => prev + 1);
    setActiveTab("search");
    store.search(query);
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
            <div className="min-h-12 w-full pl-11 pr-3 py-2 rounded-xl bg-black/20 border border-white/5 focus-within:border-accent/50 focus-within:bg-black/40 text-foreground transition-all flex flex-wrap items-center gap-2">
              <Search className="absolute left-4 top-6 -translate-y-1/2 text-foreground-muted group-focus-within:text-accent transition-colors" size={20} />
              {searchTags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/15 px-2 py-1 text-xs font-semibold text-accent">
                  {tag}
                  <button type="button" onClick={() => setSearchTags(current => current.filter(item => item !== tag))} aria-label={`Remove ${tag}`} className="hover:text-white"><X size={12} /></button>
                </span>
              ))}
              <input
                type="text"
                value={searchDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/\s/.test(value)) {
                    const parts = value.split(/\s+/).filter(Boolean);
                    const endsWithSpace = /\s$/.test(value);
                    const completed = endsWithSpace ? parts : parts.slice(0, -1);
                    completed.forEach(commitSearchTag);
                    setSearchDraft(endsWithSpace ? '' : parts.at(-1) || '');
                  } else {
                    setSearchDraft(value);
                  }
                }}
                onKeyDown={(event) => {
                  if ((event.key === ',' || event.key === 'Tab') && searchDraft.trim()) {
                    event.preventDefault();
                    commitSearchTag(searchDraft);
                  } else if (event.key === 'Backspace' && !searchDraft && searchTags.length > 0) {
                    setSearchTags(current => current.slice(0, -1));
                  }
                }}
                onBlur={() => setSankakuSuggestions([])}
                placeholder={searchTags.length === 0 ? "Search images... type a tag and press Space" : "Add another tag..."}
                className="min-w-[180px] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-foreground-muted"
              />
            </div>
            {sankakuSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/15 bg-[#111318] shadow-2xl ring-1 ring-black/80 divide-y divide-white/5">
                {sankakuSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.tag}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applySankakuSuggestion(suggestion)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left bg-[#111318] hover:bg-[#20232b]"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{suggestion.tag}</span>
                    <span className="text-xs text-foreground-muted">{suggestion.type}</span>
                    <span className="text-xs tabular-nums text-foreground-muted">{suggestion.postCount.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </form>

          <select
            value={globalMediaFilter}
            onChange={(event) => {
              const filter = event.target.value as 'all' | 'image' | 'video' | 'gif';
              setGlobalMediaFilter(filter);
              // Media-only queries need a fresh provider request. Filtering the
              // already-loaded image feed would otherwise make Video/GIF look
              // empty even though the source has matching posts.
              if (activeTab === 'new') void store.fetchLatest(true);
              else if (activeTab === 'foryou') void store.fetchCurated(true);
              else if (activeTab === 'discover') void store.fetchDiscover(true);
              else if (activeTab === 'search') void store.search(searchInput);
            }}
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
                  setRefreshKey(prev => prev + 1);
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
            images={latestImages}
            columns={5}
            resetScrollKey={refreshKey}
            onImageClick={(_, index) => {
              setModalImages(latestImages);
              setSelectedImageIndex(index);
            }}
          />
        </div>

        <div className={clsx("flex-1 overflow-hidden", activeTab === "foryou" ? "block" : "hidden")}>
          <MasonryGrid 
            feedType="curated"
            images={curatedImages}
            columns={5}
            resetScrollKey={refreshKey}
            onImageClick={(_, index) => {
              setModalImages(curatedImages);
              setSelectedImageIndex(index);
            }}
          />
        </div>

        <div className={clsx("flex-1 overflow-hidden", activeTab === "discover" ? "block" : "hidden")}>
          <MasonryGrid 
            feedType="discover"
            images={discoverImages}
            columns={5}
            resetScrollKey={refreshKey}
            onImageClick={(_, index) => {
              setModalImages(discoverImages);
              setSelectedImageIndex(index);
            }}
          />
        </div>

        <div className={clsx("flex-1 overflow-hidden", activeTab === "search" ? "block" : "hidden")}>
          <MasonryGrid 
            feedType="search"
            header={currentQuery ? <TagDescription query={currentQuery} /> : undefined}
            emptyState={
              <div className="space-y-1">
                <p>No visible matches.</p>
                {!useSettingsStore.getState().showAdultContent && <p className="text-xs">Safe mode may be filtering valid Sankaku results.</p>}
              </div>
            }
            images={searchImages}
            columns={5}
            resetScrollKey={refreshKey}
            onImageClick={(_, index) => {
              setModalImages(searchImages);
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
              setSearchQuery(query);
              store.search(query);
            }} 
          />
        )}
      </div>

      {/* Image Detail Modal */}
      {selectedImageIndex !== null && (modalImages || images)[selectedImageIndex]?.providerId === 'e-hentai' && (
        <EHentaiGalleryReader
          gallery={(modalImages || images)[selectedImageIndex]}
          galleries={modalImages || images}
          galleryIndex={selectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
          onNavigateGallery={(newIndex) => setSelectedImageIndex(newIndex)}
          onSearchTag={(tag) => {
            setSearchQuery(tag);
            setActiveTab("search");
            store.search(tag);
            setSelectedImageIndex(null);
          }}
        />
      )}
      {selectedImageIndex !== null && (modalImages || images)[selectedImageIndex] && (modalImages || images)[selectedImageIndex].providerId !== 'e-hentai' && (
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
          onOpenRelated={(relatedImage) => {
            const currentImages = modalImages || images;
            const existingIndex = currentImages.findIndex(item => item.id === relatedImage.id);
            if (existingIndex >= 0) {
              setSelectedImageIndex(existingIndex);
              return;
            }
            setModalImages([...currentImages, relatedImage]);
            setSelectedImageIndex(currentImages.length);
          }}
          onSearchTag={(tag) => {
            setSearchQuery(tag);
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
