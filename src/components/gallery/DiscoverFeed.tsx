/**
 * DiscoverFeed
 *
 * Mixed feed of latest + random images with curated aesthetic sections.
 * Dynamically populates multiple discovery channels.
 */

import React, { useEffect } from "react";
import {
  Loader2,
  Compass,
  Shuffle,
  Sparkles,
  Image as ImageIcon,
  Flame,
  History,
  Heart,
  Ghost,
} from "lucide-react";
import { useGalleryStore } from "../../stores/useGalleryStore";
import { GalleryImageCard } from "./GalleryImageCard";

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
  title,
  subtitle,
  icon,
  iconColor,
  images,
  isLoading,
  onRefresh,
  onPlaySlideshow,
  savedIds,
  openViewer,
  saveImage,
}) => {
  if (!isLoading && (!images || images.length === 0)) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl ${iconColor} bg-opacity-10 flex items-center justify-center ${iconColor.replace("bg-", "text-")}`}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tighter italic">
              {title}
            </h3>
            <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onPlaySlideshow && images && images.length > 0 && (
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
              {isLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                "Refresh"
              )}
            </button>
          )}
        </div>
      </div>

      {isLoading && (!images || images.length === 0) ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-foreground-dim/20" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {(images || []).map((item, index) => {
            if (!item) return null;
            return (
              <GalleryImageCard
                key={`${title}-${item.id}-${index}`}
                id={item.id}
                imageUrl={item.sampleUrl || item.fullUrl || ""}
                previewUrl={item.previewUrl || item.thumbnailUrl}
                title={item.title}
                tags={item.tags}
                saved={savedIds.has(item.id)}
                onView={() => openViewer(item, images, index)}
                onSave={() => saveImage(item)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};

const LazySection: React.FC<DiscoverySectionProps & { onInView: () => void }> = (props) => {
  const [hasTriggered, setHasTriggered] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered) {
          setHasTriggered(true);
          props.onInView();
        }
      },
      { rootMargin: "600px" } // Load well before it hits the viewport
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasTriggered, props.onInView]);

  return (
    <div ref={ref} className="min-h-[200px]">
      <DiscoverySection {...props} />
    </div>
  );
};

export const DiscoverFeed: React.FC = () => {
  const {
    latestImages,
    randomVisions,
    popularImages,
    recommendedAesthetics,
    recentPopular,
    likedDiscovery,
    continueExploring,
    picksForYou,
    isLoadingLatest,
    isLoadingRandom,
    isLoadingPopular,
    isLoadingRecommended,
    isLoadingRecentPopular,
    isLoadingLikedDiscovery,
    isLoadingContinueExploring,
    isLoadingPicks,
    fetchLatest,
    fetchRandomVisions,
    fetchPopular,
    fetchRecommendedAesthetics,
    fetchRecentPopular,
    fetchLikedDiscovery,
    fetchContinueExploring,
    generatePicksForYou,
    savedImages,
    saveImage,
    openViewer,
    startSlideshowFromContext,
    preloadMoreContent,
    cancelDiscovery,
  } = useGalleryStore();

  const observerTarget = React.useRef<HTMLDivElement>(null);
  const preloadCooldownRef = React.useRef<number>(0);

  // Phase 3.3: Cancel all in-flight discovery fetches when leaving this view
  useEffect(() => {
    return () => {
      cancelDiscovery();
    };
  }, [cancelDiscovery]);

  // Phase 5.1: Lazy loading logic. Only load top sections eagerly.
  useEffect(() => {
    const loadTopSections = async () => {
      fetchPopular();
      fetchLatest();
    };
    loadTopSections();
  }, []); // Only first-time mount for top sections

  // Infinite Scroll Observer for Discovery — debounced with 10s cooldown
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const now = Date.now();
          if (now - preloadCooldownRef.current < 10000) return; // 10s cooldown
          preloadCooldownRef.current = now;
          preloadMoreContent();
        }
      },
      { threshold: 0.1, rootMargin: "400px" }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [preloadMoreContent]);

  const savedIds = new Set(savedImages.map((i) => i.id));

  return (
    <div className="space-y-16 pb-12">
      <DiscoverySection
        title="Evergreen Popular"
        subtitle="Consistently high engagement across sources"
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

      <LazySection
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
        onInView={() => {
          fetchRandomVisions();
        }}
      />


      <LazySection
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
        onInView={() => {
          fetchRecommendedAesthetics();
        }}
      />

      <LazySection
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
        onInView={() => {
          fetchRecentPopular();
        }}
      />

      <LazySection
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
        onInView={() => {
          fetchContinueExploring();
        }}
      />

      <LazySection
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
        onInView={() => {
          fetchLikedDiscovery();
        }}
      />

      {/* Infinite Scroll Signal */}
      <div ref={observerTarget} className="h-32 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 opacity-20 group">
          <Loader2 size={32} className="animate-spin text-purple-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Synthesizing Endless Feed</p>
        </div>
      </div>
    </div>
  );
};
