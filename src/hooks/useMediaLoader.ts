import { useRef, useCallback } from 'react';
import { ReliabilityTracker } from '../services/DiscoveryService';

const MAX_CACHE_SIZE = 50;

export const useMediaLoader = () => {
  const highResCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const evictOldest = useCallback(() => {
    const cache = highResCache.current;
    if (cache.size <= MAX_CACHE_SIZE) return;
    const excess = cache.size - MAX_CACHE_SIZE;
    const keys = cache.keys();
    for (let i = 0; i < excess; i++) {
      const oldest = keys.next().value;
      if (oldest) {
        const img = cache.get(oldest);
        if (img) img.src = ""; // Release decoded image memory
        cache.delete(oldest);
      }
    }
  }, []);

  const preloadHighResImage = useCallback(
    async (urls: string[], sourceName: string): Promise<HTMLImageElement | null> => {
      // Check cache first
      for (const url of urls) {
        if (highResCache.current.has(url)) {
          return highResCache.current.get(url)!;
        }
      }

      return new Promise((resolve) => {
        let timeoutId: any;
        let hasResolved = false;

        const attemptLoad = (index: number) => {
          if (index >= urls.length) {
            ReliabilityTracker.report(sourceName, 'failure');
            resolve(null);
            return;
          }

          const url = urls[index];
          const img = new Image();
          img.referrerPolicy = "no-referrer";

          const cleanup = () => {
            img.onload = null;
            img.onerror = null;
            img.onabort = null;
            clearTimeout(timeoutId);
          };

          const resolveOnce = (result: HTMLImageElement | null) => {
            if (hasResolved) return;
            hasResolved = true;
            cleanup();
            resolve(result);
          };

          img.onload = () => {
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
              ReliabilityTracker.report(sourceName, 'invalid');
              cleanup();
              attemptLoad(index + 1);
              return;
            }
            // Cache successful loads with LRU eviction
            highResCache.current.set(url, img);
            evictOldest();
            ReliabilityTracker.report(sourceName, 'success');
            resolveOnce(img);
          };

          img.onerror = () => {
            cleanup();
            setTimeout(() => attemptLoad(index + 1), 500); // Backoff
          };

          img.onabort = () => {
            cleanup();
            attemptLoad(index + 1);
          };

          // Set timeout for slow-loading images
          timeoutId = setTimeout(() => {
            if (!hasResolved) {
              ReliabilityTracker.report(sourceName, 'timeout');
              img.src = ""; // Abort stalled transfer
              cleanup();
              attemptLoad(index + 1);
            }
          }, 45000); // 45 second timeout for large PNGs

          img.src = url;
        };

        attemptLoad(0);
      });
    },
    [evictOldest]
  );

  return { preloadHighResImage, highResCache: highResCache.current };
};
