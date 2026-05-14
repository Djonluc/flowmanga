/**
 * GalleryHub
 * 
 * Top-level shell for the Gallery Ecosystem.
 * Renders a tabbed navigation with a glassmorphism pill-style bar
 * and mounts the appropriate sub-view per active tab.
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Compass, Sparkles, FolderOpen, Film, Search, Tag, Image as ImageIcon } from 'lucide-react';
import { useGalleryStore, type GalleryTab } from '../../stores/useGalleryStore';
import { TrendingGrid } from './TrendingGrid';
import { DiscoverFeed } from './DiscoverFeed';
import { PicksForYou } from './PicksForYou';
import { SavedCollections } from './SavedCollections';
import { SlideshowManager } from './SlideshowManager';
import { TagSearch } from './TagSearch';
import { WallpaperGrid } from './WallpaperGrid';
import { FollowingTags } from './FollowingTags';

const TABS: { id: GalleryTab; label: string; icon: React.ReactNode }[] = [
  { id: 'trending', label: 'Trending', icon: <Flame size={16} /> },
  { id: 'discover', label: 'Discover', icon: <Compass size={16} /> },
  { id: 'picks', label: 'For You', icon: <Sparkles size={16} /> },
  { id: 'wallpapers', label: 'Wallpapers', icon: <ImageIcon size={16} /> },
  { id: 'collections', label: 'Collections', icon: <FolderOpen size={16} /> },
  { id: 'slideshows', label: 'Slideshows', icon: <Film size={16} /> },
  { id: 'following', label: 'Following', icon: <Tag size={16} /> },
  { id: 'search', label: 'Search', icon: <Search size={16} /> },
];

export const GalleryHub: React.FC = () => {
  const { activeTab, setActiveTab, loadFromDb } = useGalleryStore();

  useEffect(() => {
    loadFromDb();
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'trending': return <TrendingGrid />;
      case 'discover': return <DiscoverFeed />;
      case 'picks': return <PicksForYou />;
      case 'wallpapers': return <WallpaperGrid />;
      case 'collections': return <SavedCollections />;
      case 'slideshows': return <SlideshowManager />;
      case 'following': return <FollowingTags />;
      case 'search': return <TagSearch />;
      default: return <TrendingGrid />;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="shrink-0 px-6 pt-6 pb-2">
        <div className="flex items-center gap-1 p-1.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl w-fit backdrop-blur-xl">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  isActive
                    ? 'text-white'
                    : 'text-foreground-dim hover:text-foreground hover:bg-white/[0.03]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="gallery-tab-active"
                    className="absolute inset-0 bg-purple-600/80 rounded-xl shadow-lg shadow-purple-500/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
