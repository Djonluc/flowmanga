/**
 * TagSearch
 *
 * Tag-based search with multi-tag support and result grid.
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, X, Tag, ChevronDown, ChevronUp, Heart, Film } from "lucide-react";

import { useGalleryStore } from "../../stores/useGalleryStore";
import { GalleryImageCard } from "./GalleryImageCard";

const POPULAR_TAGS = [
  // Major Anime / Manga Franchises
  "Solo Leveling",
  "Jujutsu Kaisen",
  "Chainsaw Man",
  "Blue Lock",
  "Demon Slayer",
  "One Piece",
  "Naruto",
  "Bleach",
  "Attack on Titan",
  "Frieren",
  "Oshi no Ko",
  "Nier Automata",
  "Fate Series",
  "Genshin Impact",
  "Honkai Star Rail",

  // Popular Character / Art Culture
  "waifu",
  "solo_female",
  "anime_boy",
  "anime_girl",
  "white_hair",
  "silver_hair",
  "purple_eyes",
  "red_eyes",
  "school_uniform",

  // Aesthetic / Atmosphere
  "cyberpunk",
  "night_city",
  "neon",
  "rain",
  "dark_fantasy",
  "gothic",
  "futuristic",
  "city_lights",
  "glowing",
  "sunset",
  "moonlight",
  "cherry_blossoms",

  // Anime Art Themes
  "samurai",
  "katana",
  "mecha",
  "magic",
  "isekai",
  "fantasy",
  "vampire",
  "shrine_maiden",
  "fox_girl",
  "maid",

  // Wallpaper / Visual Energy
  "4k",
  "cinematic",
  "anime_wallpaper",
  "highres",
  "masterpiece",
  "beautiful_lighting",
];

export const TagSearch: React.FC = () => {
  const {
    searchResults,
    isSearching,
    searchQuery,
    searchByTags,
    fetchSuggestions,
    searchSuggestions,
    savedImages,
    saveImage,
    openViewer,
    favoriteTag,
    unfavoriteTag,
    favoriteTags,
    currentSearchPage,
    hasMoreSearchResults,
    startSlideshowFromContext,
  } = useGalleryStore();

  const [inputValue, setInputValue] = useState("");
  const parseTagTokens = useCallback((value: string) => {
    return value
      .split(/[ ,+]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }, []);

  const activeTags = useMemo(() => {
    if (!searchQuery) return [];
    return parseTagTokens(searchQuery);
  }, [searchQuery, parseTagTokens]);
  const observerTarget = React.useRef<HTMLDivElement>(null);
  const savedIds = new Set(savedImages.map((i) => i.id));

  const addTags = useCallback(
    (value: string | string[]) => {
      const tokens = Array.isArray(value) ? value : parseTagTokens(value);
      if (tokens.length === 0) return;

      const next = [...activeTags];
      for (const token of tokens) {
        if (!next.includes(token)) next.push(token);
      }

      if (next.length > 0) {
        setInputValue("");
        searchByTags(next.join(" "));
      }
    },
    [activeTags, parseTagTokens, searchByTags],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const next = activeTags.filter((t) => t !== tag);
      if (next.length > 0) {
        searchByTags(next.join(" "));
      } else {
        // Clear search when no tags are left
        useGalleryStore.getState().setSearchQuery("");
        useGalleryStore.setState({ searchResults: [], currentSearchPage: 1 });
      }
    },
    [activeTags, searchByTags],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) addTags(inputValue);
    else if (activeTags.length > 0) searchByTags(activeTags.join(" "), 1);
  };

  // Compact Scroll State
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [forceExpand, setForceExpand] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollRef.current?.closest(".overflow-y-auto");
    if (!scrollContainer) return;

    const handleScroll = () => {
      const isScrolled = scrollContainer.scrollTop > 40;
      setIsCompact(isScrolled);
      if (!isScrolled) {
        setForceExpand(false);
      }
    };

    // Initial check
    handleScroll();

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const showCompact = isCompact && !forceExpand;

  // Infinite Scroll Observer
  useEffect(() => {
    if (isSearching || activeTags.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !isSearching &&
          hasMoreSearchResults &&
          searchResults.length > 0
        ) {
          searchByTags(activeTags.join(" "), currentSearchPage + 1);
        }
      },
      { threshold: 0.1, rootMargin: "1200px" },
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [
    isSearching,
    searchResults.length,
    activeTags,
    currentSearchPage,
    searchByTags,
    hasMoreSearchResults,
  ]);

  return (
    <div className="space-y-8 relative">
      <div
        ref={scrollRef}
        className="absolute -top-6 left-0 right-0 h-1 pointer-events-none"
      />
      <div
        className={`space-y-4 sticky top-0 z-40 bg-black/80 backdrop-blur-3xl ${showCompact ? "pb-3 pt-3" : "pb-6 pt-6"} -mt-6 -mx-6 px-6 border-b border-white/5 shadow-2xl transition-all duration-300`}
      >
        <AnimatePresence initial={false}>
          {!showCompact && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                  <Search size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">
                    Tag Explorer
                  </h3>
                  <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-0.5">
                    Combine tags for precision
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center gap-2 flex-1"
          >
            <div className="flex-1 flex items-center gap-2 bg-white/3 border border-white/6 rounded-2xl px-4 py-2 focus-within:border-purple-500/30 transition-colors">
            {activeTags.map((tag) => (
              <span
                key={tag}
                className={`flex items-center gap-1 ${showCompact ? "px-2 py-0.5" : "px-3 py-1"} rounded-lg bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider shrink-0`}
              >
                {tag}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeTag(tag);
                  }}
                  className="hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                fetchSuggestions(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "," || e.key === "Enter") {
                  e.preventDefault();
                  if (inputValue.trim()) addTags(inputValue);
                }
                if (
                  e.key === "Backspace" &&
                  !inputValue &&
                  activeTags.length > 0
                )
                  removeTag(activeTags[activeTags.length - 1]);
              }}
              placeholder={
                activeTags.length > 0
                  ? "Add another tag (comma or space separated)..."
                  : "Type tags separated by comma or space..."
              }
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-foreground-dim/40 text-sm font-medium min-w-30"
            />
            {isSearching && (
              <Loader2
                size={16}
                className="text-purple-500 animate-spin shrink-0"
              />
            )}

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {searchSuggestions.length > 0 && inputValue.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 z-50 shadow-2xl max-h-60 overflow-y-auto no-scrollbar"
                >
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => addTags(suggestion)}
                      className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-white/5 text-foreground/80 hover:text-white text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                      <Tag size={12} className="text-purple-500" />
                      {suggestion}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {isCompact && (
            <button
              type="button"
              onClick={() => setForceExpand(!forceExpand)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-foreground-dim hover:text-white transition-colors"
            >
              {forceExpand ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
          )}
          </form>
          <button
            type="button"
            onClick={() => {
              if (activeTags.includes("video")) {
                removeTag("video");
              } else {
                addTags("video");
              }
            }}
            className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
              activeTags.includes("video")
                ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                : "bg-white/5 border-white/10 text-foreground-dim hover:bg-white/10 hover:text-white"
            }`}
            title={activeTags.includes("video") ? "Remove Video Filter" : "Videos Only"}
          >
            <Film size={16} />
            {!showCompact && (
              <span className="text-[10px] font-black uppercase tracking-widest">
                Videos
              </span>
            )}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {!showCompact && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-4 pt-2">
                {/* User's Favorite Tags */}
                {favoriteTags && favoriteTags.length > 0 && (
                  <div>
                    <span className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-pink-400/60 mb-2 flex items-center gap-2">
                       <Heart size={10} fill="currentColor" /> Your Tags
                    </span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {favoriteTags.map((tag) => (
                        <div key={`fav-${tag}`} className="flex items-center rounded-xl overflow-hidden border border-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.05)]">
                           <button
                             type="button"
                             onClick={() => addTags(tag)}
                             className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                               activeTags.includes(tag)
                                 ? "bg-pink-500/30 text-pink-300"
                                 : "bg-pink-500/10 text-pink-400 hover:bg-pink-500/20"
                             }`}
                           >
                             {tag}
                           </button>
                           <button 
                             type="button"
                             onClick={() => unfavoriteTag(tag)}
                             className="bg-pink-500/10 hover:bg-red-500/20 text-pink-400/50 hover:text-red-400 px-2 py-1.5 h-full transition-colors flex items-center justify-center border-l border-pink-500/20"
                             title="Remove from favorites"
                           >
                             <X size={10} />
                           </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Tags */}
                <div>
                  <span className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-foreground-dim/40 mb-2 flex items-center gap-2">
                     <Tag size={10} /> Popular Tags
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {POPULAR_TAGS.filter((tag) => !favoriteTags?.includes(tag)).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          addTags(tag);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                          activeTags.includes(tag)
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/20"
                            : "bg-white/3 text-foreground-dim hover:bg-white/6 border border-white/4"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest">
                {searchResults.length} Results
              </p>
              <button
                onClick={() =>
                  startSlideshowFromContext(searchResults, 0, "search")
                }
                className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all active:scale-95 border border-purple-500/10"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400/40 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
                Play Slideshow
              </button>
            </div>
            {activeTags.length > 0 && (
              <button
                onClick={() => activeTags.forEach((t) => favoriteTag(t))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400/80 hover:text-pink-400 text-[10px] font-bold uppercase tracking-wider transition-all border border-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.1)] active:scale-95"
              >
                <Heart size={10} fill="currentColor" /> Favorite Active Tags
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {searchResults.map((item, index) => (
              <GalleryImageCard
                key={`${item.id}-${index}`}
                id={item.id}
                imageUrl={item.coverUrl || ""}
                previewUrl={item.coverUrl}
                title={item.title}
                tags={item.tags}
                saved={savedIds.has(item.id)}
                onView={() => openViewer(item, searchResults, index)}
                onPlay={() =>
                  startSlideshowFromContext(searchResults, index, "search")
                }
                onSave={() => saveImage(item)}
              />
            ))}
          </div>

          {/* Infinite Scroll Target */}
          <div
            ref={observerTarget}
            className="h-20 flex items-center justify-center"
          >
            {isSearching && (
              <div className="flex items-center gap-3 text-purple-400/60 animate-pulse">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Resolving More Visions
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {!isSearching && searchResults.length === 0 && activeTags.length > 0 && (
        <div className="py-16 border-2 border-dashed border-white/5 rounded-4xl flex flex-col items-center justify-center text-center gap-4 bg-white/1">
          <Search size={32} className="text-foreground-dim/20" />
          <p className="text-foreground-dim text-xs font-bold uppercase tracking-widest opacity-40">
            No results found
          </p>
        </div>
      )}
    </div>
  );
};
