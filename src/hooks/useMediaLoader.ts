import { useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ReliabilityTracker } from '../services/DiscoveryService';

const MAX_CACHE_SIZE = 50;

/** Domains that commonly block direct browser requests and need Rust proxy fallback */
const PROXY_DOMAINS = ['sankakucomplex.com', 'sankakuapi.com', 'hentai.org', 'ehgt.org'];

function needsProxy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return PROXY_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

/**
 * Fetch a media URL through the Rust backend (bypasses CORS/CDN restrictions)
 * and return a blob: URL the browser can display natively.
 */
async function proxyViaTauri(url: string): Promise<string | null> {
  try {
    const { fetch } = await import('@tauri-apps/plugin-http');
    const response = await fetch(url, {
      method: 'GET',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn('[useMediaLoader] Rust proxy fallback failed:', e);
    return null;
  }
}

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
            // All browser-native loads failed — try Rust proxy as final fallback
            const proxyUrl = urls.find(u => needsProxy(u)) || urls[0];
            if (proxyUrl) {
              proxyViaTauri(proxyUrl).then((blobUrl) => {
                if (blobUrl && !hasResolved) {
                  const proxyImg = new Image();
                  proxyImg.onload = () => {
                    hasResolved = true;
                    highResCache.current.set(proxyUrl, proxyImg);
                    evictOldest();
                    ReliabilityTracker.report(sourceName, 'success');
                    resolve(proxyImg);
                  };
                  proxyImg.onerror = () => {
                    URL.revokeObjectURL(blobUrl);
                    ReliabilityTracker.report(sourceName, 'failure');
                    resolve(null);
                  };
                  proxyImg.src = blobUrl;
                } else {
                  ReliabilityTracker.report(sourceName, 'failure');
                  resolve(null);
                }
              });
            } else {
              ReliabilityTracker.report(sourceName, 'failure');
              resolve(null);
            }
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
            // Try next URL immediately. A 500ms backoff here causes 1.5s+ artificial delay
            // for domains like Danbooru that block native requests and require the Rust proxy.
            setTimeout(() => attemptLoad(index + 1), 0);
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

  return { preloadHighResImage, proxyViaTauri, highResCache: highResCache.current };
};
