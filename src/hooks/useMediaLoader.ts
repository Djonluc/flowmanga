import { useRef, useCallback } from 'react';
import { ReliabilityTracker } from '../services/DiscoveryService';

export const useMediaLoader = () => {
  const highResCache = useRef<Map<string, HTMLImageElement>>(new Map());

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
            // Cache successful loads
            highResCache.current.set(url, img);
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
    []
  );

  return { preloadHighResImage, highResCache: highResCache.current };
};
