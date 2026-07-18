import { useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ReliabilityTracker } from '../services/DiscoveryService';
import { getSankakuAuthHeaders } from '../services/Sankaku';

const MAX_CACHE_SIZE = 50;

/** Domains that commonly block direct browser requests and need Rust proxy fallback */
const PROXY_DOMAINS = [
  'sankakucomplex.com',
  'sankakuapi.com',
  'hentai.org',
  'ehgt.org',
  'donmai.us',
  'pixiv.net',
  'pximg.net',
  'gelbooru.com',
  'rule34.xxx'
];

const proxyCache = new Map<string, string>();
const MAX_PROXY_CACHE = 100;

function cacheProxyBlob(url: string, blobUrl: string): string {
  proxyCache.set(url, blobUrl);
  if (proxyCache.size > MAX_PROXY_CACHE) {
    const oldestKey = proxyCache.keys().next().value;
    const oldestUrl = oldestKey ? proxyCache.get(oldestKey) : undefined;
    if (oldestUrl?.startsWith('blob:')) URL.revokeObjectURL(oldestUrl);
    if (oldestKey) proxyCache.delete(oldestKey);
  }
  return blobUrl;
}

export function needsProxy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return PROXY_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

/**
 * Translate a media URL to the custom Tauri flowmanga:// scheme to bypass CORS/CBR/hotlinking.
 */
async function proxyViaTauri(url: string): Promise<string | null> {
  if (!url) return null;

  if (url.includes('sankaku')) {
    if (proxyCache.has(url)) {
      return proxyCache.get(url)!;
    }
    const sankakuHeaders = {
      ...getSankakuAuthHeaders(),
      Referer: 'https://chan.sankakucomplex.com/',
    };

    try {
      // Protected Sankaku media needs the same session as the metadata request.
      // Use the Rust binary command so Cookie/Authorization headers are retained.
      if (sankakuHeaders.Cookie || sankakuHeaders.Authorization) {
        const bytes = await invoke<number[]>('fetch_binary', {
          url,
          headers: sankakuHeaders,
        });
        const extension = url.match(/\.(mp4|webm|gif|png|jpg|jpeg)(?:\?|$)/i)?.[1]?.toLowerCase();
        const mime = extension === 'mp4' ? 'video/mp4' : extension === 'webm' ? 'video/webm' : extension === 'gif' ? 'image/gif' : 'image/*';
        const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
        return cacheProxyBlob(url, blobUrl);
      }

      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      const response = await tauriFetch(url, {
        method: 'GET',
        headers: sankakuHeaders,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      return cacheProxyBlob(url, blobUrl);
    } catch (e) {
      console.warn('[useMediaLoader] tauriFetch fallback failed for sankaku:', e);
      return null;
    }
  }

  if (needsProxy(url)) {
    return `http://flowmanga.localhost/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
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

  return { preloadHighResImage, proxyViaTauri, highResCache: highResCache.current, needsProxy };
};
