/**
 * DiscoverFeed
 * 
 * Mixed feed of latest + random images with curated aesthetic sections.
 * Dynamically populates multiple discovery channels.
 */

import React, { useEffect } from 'react';
import { Loader2, Compass, Shuffle, Sparkles, Image as ImageIcon, Flame, History, Heart, Ghost } from 'lucide-react';
import { useGalleryStore } from '../../stores/useGalleryStore';
import { GalleryImageCard } from './GalleryImageCard';

interface DiscoverySectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColor: string;
  images: any[];
  isLoading: boolean;
  onRefresh?: () => void;
  onPlaySlideshow?: () => void;
  savedIds: Set<string>;
  openViewer: any;
  saveImage: any;
}

const DiscoverySection: React.FC<DiscoverySectionProps> = ({
  title, subtitle, icon, iconColor, images, isLoading, onRefresh, onPlaySlideshow, savedIds, openViewer, saveImage
}) => {
  if (!isLoading && images.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl ${iconColor} bg-opacity-10 flex items-center justify-center ${iconColor.replace('bg-', 'text-')}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">{title}</h3>
            <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onPlaySlideshow && images.length > 0 && (
            <button
              onClick={onPlaySlideshow}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest transition-all border border-white/10`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              Play Section
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-foreground-dim hover:text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {isLoading && images.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-foreground-dim/20" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {images.slice(0, 12).map((item, index) => (
            <GalleryImageCard
              key={`${title}-${item.id}`}
              id={item.id}
              imageUrl={item.coverUrl || item.imageUrl || ''}
              previewUrl={item.coverUrl || item.previewUrl}
              title={item.title}
              tags={item.tags}
              saved={savedIds.has(item.id)}
              onView={() => openViewer(item, images, index)}
              onSave={() => saveImage(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export const DiscoverFeed: React.FC = () => {
  const {
    latestImages, randomVisions, popularImages, recommendedAesthetics,
    recentPopular, likedDiscovery, continueExploring, wallpaperImages,
    isLoadingLatest, isLoadingRandom, isLoadingPopular, isLoadingRecommended, 
    isLoadingRecentPopular, isLoadingLikedDiscovery, isLoadingContinueExploring, isLoadingWallpapers,
    fetchLatest, fetchRandomVisions, fetchPopular, fetchRecommendedAesthetics,
    fetchRecentPopular, fetchLikedDiscovery, fetchContinueExploring, fetchWallpapers,
    savedImages, saveImage, openViewer, startSlideshowFromContext
  } = useGalleryStore();

  useEffect(() => {
    const loadAll = async () => {
      if (latestImages.length === 0) fetchLatest();
      if (randomVisions.length === 0) fetchRandomVisions();
      if (popularImages.length === 0) fetchPopular();
      if (recommendedAesthetics.length === 0) fetchRecommendedAesthetics();
      if (recentPopular.length === 0) fetchRecentPopular();
      if (likedDiscovery.length === 0) fetchLikedDiscovery();
      if (continueExploring.length === 0) fetchContinueExploring();
      if (wallpaperImages.length === 0) fetchWallpapers();
    };
    loadAll();
  }, []);

  const savedIds = new Set(savedImages.map(i => i.id));

  return (
    <div className="space-y-16 pb-12">
      <DiscoverySection
        title="Fresh Arrivals"
        subtitle="Newly indexed artwork"
        icon={<Compass size={20} />}
        iconColor="bg-emerald-500"
        images={latestImages}
        isLoading={isLoadingLatest}
        onRefresh={() => fetchLatest()}
        onPlaySlideshow={() => startSlideshowFromContext(latestImages)}
        savedIds={savedIds}
        openViewer={openViewer}
        saveImage={saveImage}
      />

      <DiscoverySection
        title="Random Visions"
        subtitle="Aesthetic serendipity"
        icon={<Shuffle size={20} />}
        iconColor="bg-violet-500"
        images={randomVisions}
        isLoading={isLoadingRandom}
        onRefresh={() => fetchRandomVisions()}
        onPlaySlideshow={() => startSlideshowFromContext(randomVisions)}
        savedIds={savedIds}
        openViewer={openViewer}
        saveImage={saveImage}
      />

      <DiscoverySection
        title="Evergreen Popular"
        subtitle="Consistently high engagement"
        icon={<Sparkles size={20} />}
        iconColor="bg-amber-500"
        images={popularImages}
        isLoading={isLoadingPopular}
        onRefresh={() => fetchPopular()}
        onPlaySlideshow={() => startSlideshowFromContext(popularImages)}
        savedIds={savedIds}
        openViewer={openViewer}
        saveImage={saveImage}
      />

      <DiscoverySection
        title="Aesthetic Spotlight"
        subtitle="Curated themes for you"
        icon={<Ghost size={20} />}
        iconColor="bg-blue-500"
        images={recommendedAesthetics}
        isLoading={isLoadingRecommended}
        onRefresh={() => fetchRecommendedAesthetics()}
        onPlaySlideshow={() => startSlideshowFromContext(recommendedAesthetics)}
        savedIds={savedIds}
        openViewer={openViewer}
        saveImage={saveImage}
      />

      <DiscoverySection
        title="Recent Engagement"
        subtitle="Spiking activity now"
        icon={<Flame size={20} />}
        iconColor="bg-orange-500"
        images={recentPopular}
        isLoading={isLoadingRecentPopular}
        onRefresh={() => fetchRecentPopular()}
        onPlaySlideshow={() => startSlideshowFromContext(recentPopular)}
        savedIds={savedIds}
        openViewer={openViewer}
        saveImage={saveImage}
      />

      <DiscoverySection
        title="Continue Exploring"
        subtitle="Based on your recent history"
        icon={<History size={20} />}
        iconColor="bg-indigo-500"
        images={continueExploring}
        isLoading={isLoadingContinueExploring}
        onRefresh={() => fetchContinueExploring()}
        onPlaySlideshow={() => startSlideshowFromContext(continueExploring)}
        savedIds={savedIds}
        openViewer={openViewer}
        saveImage={saveImage}
      />

      <DiscoverySection
        title="Because You Liked"
        subtitle="Expanding your favorites"
        icon={<Heart size={20} />}
        iconColor="bg-rose-500"
        images={likedDiscovery}
        isLoading={isLoadingLikedDiscovery}
        onRefresh={() => fetchLikedDiscovery()}
        onPlaySlideshow={() => startSlideshowFromContext(likedDiscovery)}
        savedIds={savedIds}
        openViewer={openViewer}
        saveImage={saveImage}
      />

      <DiscoverySection
        title="Visions for Desktop"
        subtitle="High-resolution wallpapers"
        icon={<ImageIcon size={20} />}
        iconColor="bg-cyan-500"
        images={wallpaperImages}
        isLoading={isLoadingWallpapers}
        onRefresh={() => fetchWallpapers()}
        onPlaySlideshow={() => startSlideshowFromContext(wallpaperImages)}
        savedIds={savedIds}
        openViewer={openViewer}
        saveImage={saveImage}
      />
    </div>
  );
};
