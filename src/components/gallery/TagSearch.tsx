/**
 * TagSearch
 *
 * Tag-based search with multi-tag support and result grid.
 */

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, X, Tag } from "lucide-react";

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
  } = useGalleryStore();

  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const savedIds = new Set(savedImages.map((i) => i.id));

  // Sync with global search query (e.g. from tag clicks in viewer)
  useEffect(() => {
    if (searchQuery) {
      const tags = searchQuery
        .split(/[,+]/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (JSON.stringify(tags) !== JSON.stringify(activeTags)) {
        setActiveTags(tags);
      }
    }
  }, [searchQuery]);

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (trimmed && !activeTags.includes(trimmed)) {
        const next = [...activeTags, trimmed];
        setActiveTags(next);
        setInputValue("");
        searchByTags(next.join(","));
      }
    },
    [activeTags, searchByTags],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const next = activeTags.filter((t) => t !== tag);
      setActiveTags(next);
      if (next.length > 0) searchByTags(next.join(","));
    },
    [activeTags, searchByTags],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) addTag(inputValue);
    else if (activeTags.length > 0) searchByTags(activeTags.join(","));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
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

        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-2 focus-within:border-purple-500/30 transition-colors">
            {activeTags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider shrink-0"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
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
                  if (inputValue.trim()) addTag(inputValue);
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
                  ? "Add another tag..."
                  : "Type a tag and press Enter..."
              }
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-foreground-dim/40 text-sm font-medium min-w-[120px]"
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
                      onClick={() => addTag(suggestion)}
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
        </form>

        <div className="flex flex-wrap gap-2">
          {POPULAR_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setActiveTags([tag]);
                searchByTags(tag);
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                activeTags.includes(tag)
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/20"
                  : "bg-white/[0.03] text-foreground-dim hover:bg-white/[0.06] border border-white/[0.04]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest">
              {searchResults.length} Results
            </p>
            {activeTags.length > 0 && (
              <button
                onClick={() => activeTags.forEach((t) => favoriteTag(t))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-purple-500/10 text-foreground-dim hover:text-purple-400 text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                <Tag size={10} /> Save Tags
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {searchResults.map((item, index) => (
              <GalleryImageCard
                key={item.id}
                id={item.id}
                imageUrl={item.coverUrl || ""}
                previewUrl={item.coverUrl}
                title={item.title}
                tags={item.tags}
                saved={savedIds.has(item.id)}
                onView={() =>
                  openViewer(item as any, searchResults as any[], index)
                }
                onSave={() => saveImage(item)}
              />
            ))}
          </div>
        </div>
      )}

      {!isSearching && searchResults.length === 0 && activeTags.length > 0 && (
        <div className="py-16 border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-center gap-4 bg-white/[0.01]">
          <Search size={32} className="text-foreground-dim/20" />
          <p className="text-foreground-dim text-xs font-bold uppercase tracking-widest opacity-40">
            No results found
          </p>
        </div>
      )}
    </div>
  );
};
