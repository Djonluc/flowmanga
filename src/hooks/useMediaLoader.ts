import { useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ReliabilityTracker } from '../services/DiscoveryService';
import { getSankakuRequestHeaders } from '../services/Sankaku';
import { useSettingsStore } from '../stores/useSettingsStore';

const MAX_CACHE_SIZE = 50;

/** Domains that commonly block direct browser requests and need Rust proxy fallback */
const PROXY_DOMAINS = [
  'sankakucomplex.com',
  'sankakuapi.com',
  'hentai.org',
  'ehgt.org',
  'hath.network',
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

function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;

  // Tauri v2 exposes its bridge on the window only inside the desktop app.
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

/** Stream protected media through the desktop protocol with byte-range support. */
export function streamViaTauri(url: string): string {
  if (!url || !isTauriRuntime()) return url;
  return `flowmanga://localhost/image-proxy?stream=1&url=${encodeURIComponent(url)}`;
}

function mediaMimeType(url: string): string {
  const extension = url.match(/\.(mp4|webm|gif|png|jpg|jpeg|avif|webp)(?:\?|$)/i)?.[1]?.toLowerCase();
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'webm') return 'video/webm';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'png') return 'image/png';
  if (extension === 'avif') return 'image/avif';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function mediaReferer(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('donmai.us')) return 'https://danbooru.donmai.us/';
    if (hostname.includes('rule34')) return 'https://rule34.xxx/';
    if (hostname.includes('gelbooru')) return 'https://gelbooru.com/';
    if (hostname.includes('pixiv') || hostname.includes('pximg')) return 'https://www.pixiv.net/';
    if (hostname.includes('ehgt.org') || hostname.includes('hath.network')) return 'https://e-hentai.org/';
    return `https://${hostname}/`;
  } catch {
    return undefined;
  }
}

/**
 * Load protected media through Rust when running in Tauri. Returning a blob
 * avoids relying on a custom URL scheme, which is not accepted by every
 * WebView/dev environment. Plain browser mode uses the original CDN URL.
 */
async function proxyViaTauri(url: string): Promise<string | null> {
  if (!url) return null;

  if (url.includes('sankaku')) {
    if (proxyCache.has(url)) {
      return proxyCache.get(url)!;
    }
    const sankakuHeaders = {
      ...getSankakuRequestHeaders(),
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    try {
      // Protected Sankaku media needs the same session as the metadata request.
      // Use the Rust binary command so Cookie/Authorization headers are retained.
      if (sankakuHeaders.Cookie || sankakuHeaders.Authorization) {
        try {
          let bytes: number[] | null = null;
          let binaryError: unknown;
          for (let attempt = 0; attempt < 3 && !bytes; attempt += 1) {
            try {
              bytes = await invoke<number[]>('fetch_binary', {
                url,
                headers: {
                  ...sankakuHeaders,
                },
                proxyUrl: useSettingsStore.getState().networkProxy || null,
              });
            } catch (error) {
              binaryError = error;
              if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
          }
          if (!bytes) throw binaryError || new Error('Sankaku media request failed');
          const extension = url.match(/\.(mp4|webm|gif|png|jpg|jpeg)(?:\?|$)/i)?.[1]?.toLowerCase();
          const mime = extension === 'mp4' ? 'video/mp4' : extension === 'webm' ? 'video/webm' : extension === 'gif' ? 'image/gif' : 'image/*';
          const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
          return cacheProxyBlob(url, blobUrl);
        } catch (binaryError) {
          // Some CDN edges reject the Rust binary client while allowing the
          // Tauri HTTP client with the same session headers.
          console.warn('[useMediaLoader] Sankaku binary fetch failed; trying HTTP fallback:', binaryError);
        }
      }

      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      let response = await tauriFetch(url, {
        method: 'GET',
        headers: sankakuHeaders,
      });
      if (response.status === 503) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        response = await tauriFetch(url, {
          method: 'GET',
          headers: sankakuHeaders,
        });
      }
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
    if (!isTauriRuntime()) return url;

    const hostname = new URL(url).hostname.toLowerCase();
    const ehentaiCookies = (hostname.includes('e-hentai.org') || hostname.includes('ehgt.org') || hostname.includes('hath.network'))
      ? useSettingsStore.getState().booruAuth?.['e-hentai']?.sessionCookies?.trim()
      : undefined;
    const mediaHeaders = {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      ...(mediaReferer(url) ? { Referer: mediaReferer(url)! } : {}),
      ...(ehentaiCookies ? { Cookie: ehentaiCookies } : {}),
    };

    try {
      const bytes = await invoke<number[]>('fetch_binary', {
        url,
        headers: mediaHeaders,
        proxyUrl: useSettingsStore.getState().networkProxy || null,
      });
      const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mediaMimeType(url) }));
      return cacheProxyBlob(url, blobUrl);
    } catch (error) {
      try {
        // Some CDN edges reject the Rust request when a configured network
        // proxy or its request fingerprint is present. Retry through the
        // Tauri HTTP plugin before exposing a direct, possibly hotlink-blocked URL.
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        const response = await tauriFetch(url, { method: 'GET', headers: mediaHeaders });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blobUrl = URL.createObjectURL(await response.blob());
        return cacheProxyBlob(url, blobUrl);
      } catch (fallbackError) {
        // A direct URL is still useful as a final fallback for CDNs that allow
        // image embedding even when both desktop proxy paths are unavailable.
        console.warn('[useMediaLoader] Protected media fetch failed; using direct URL:', {
          binaryError: error,
          fallbackError,
        });
        return url;
      }
    }
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
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
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

  return { preloadHighResImage, proxyViaTauri, needsProxy };
};
