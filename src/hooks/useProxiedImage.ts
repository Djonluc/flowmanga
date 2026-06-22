import { useState, useEffect, useRef } from "react";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export function useProxiedImage(originalSrc: string) {
  const PROACTIVE_PROXY_DOMAINS = ["manhuaus.com", "manhuaus.org"];
  const isStrictDomain = (url: string) => typeof url === 'string' && url && PROACTIVE_PROXY_DOMAINS.some(d => url.includes(d));

  const getWsrvUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const cleanUrl = urlObj.hostname + urlObj.pathname + urlObj.search;
      return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}`;
    } catch {
      return url;
    }
  };

  const [src, setSrc] = useState(() => {
    if (isStrictDomain(originalSrc)) {
      return getWsrvUrl(originalSrc);
    }
    return originalSrc;
  });

  const [hasError, setHasError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (isStrictDomain(originalSrc)) {
      setSrc(getWsrvUrl(originalSrc));
      setHasError(false);
    } else {
      setSrc(originalSrc);
      setHasError(false);
    }

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [originalSrc]);

  const handleError = async (overrideSrc?: string) => {
    const targetSrc = overrideSrc || originalSrc;
    if (isStrictDomain(targetSrc)) {
      // If wsrv.nl failed, we just accept the error
      setHasError(true);
      return;
    }

    if (targetSrc && targetSrc.startsWith("http")) {
      try {
        const urlObj = new URL(targetSrc);
        const res = await tauriFetch(targetSrc, {
          method: "GET",
          headers: { 
            "Referer": urlObj.origin + "/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5"
          },
        });
        if (res.ok) {
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          objectUrlRef.current = objectUrl;
          setSrc(objectUrl);
          return;
        } else {
          console.error(`[useProxiedImage] Proxy failed with status: ${res.status} ${res.statusText} for URL: ${targetSrc}`);
        }
      } catch (e) {
        console.warn("[useProxiedImage] Proxy fallback failed:", e);
      }
    }
    setHasError(true);
  };

  return { src, hasError, handleError };
}
