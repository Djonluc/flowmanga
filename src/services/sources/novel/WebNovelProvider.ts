import { invoke } from "@tauri-apps/api/core";
import type {
  SourceProvider,
  SourceContent,
  SourceSeries,
  SourceChapter,
  SourceCapabilities,
  ContentType,
  MediaType,
  MediaDomain,
  ReaderMode,
  SourceSearchResult,
} from "../types";
import { useSettingsStore } from "../../../stores/useSettingsStore";

export class WebNovelProvider implements SourceProvider {
  readonly id = "webnovel";
  readonly name = "WebNovel";
  readonly domains = ["webnovel.com"];
  readonly contentType: ContentType = "novel";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image", "text"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["vertical", "single"];

  readonly capabilities: SourceCapabilities = {
    search: true,
    tagSearch: false,
    seriesBrowse: true,
    chapterFeed: false,
    pagination: false,
    authentication: true,
    requiresCookies: true,
    authUrl: "https://www.webnovel.com/",
  };

  matchesUrl(url: string): boolean {
    return url.includes("webnovel.com/comic");
  }

  private namemodifier(str: string): string {
    return str.replace(/[\\/:*?"<>|?]/g, "").trim();
  }

  private getAuthHeaders(): Record<string, string> {
    const auth = useSettingsStore.getState().booruAuth?.[this.id];
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Referer": "https://www.webnovel.com/"
    };
    if (auth?.sessionCookies) {
      headers["Cookie"] = auth.sessionCookies.replace(/[^\x20-\x7E]/g, "").trim();
    }
    return headers;
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    const isComic = url.includes("webnovel.com/comic");
    if (!isComic) {
      throw new Error("This provider only supports WebNovel comics.");
    }

    const comicIdMatch = url.match(/_(\d+)/);
    let catalogUrl = "";
    if (comicIdMatch) {
      catalogUrl = `https://www.webnovel.com/comic/${comicIdMatch[1]}/catalog`;
    } else {
      catalogUrl = url.endsWith("/catalog") ? url : `${url}/catalog`;
    }

    let slug = "";
    const slugMatch = url.match(/\/comic\/([^/]+)/);
    if (slugMatch) {
      slug = slugMatch[1].split('?')[0].split('#')[0];
    }

    // 1. Fetch catalog HTML
    let catalogHtml = "";
    try {
      catalogHtml = await invoke<string>("fetch_html", { 
        url: catalogUrl, 
        headers: this.getAuthHeaders()
      });
    } catch (e) {
      console.warn("[WebNovel] Failed to fetch catalog HTML via fetch_html, trying headless", e);
      try {
        catalogHtml = await invoke<string>("fetch_html_headless", { url: catalogUrl });
      } catch (e2) {
        console.error("[WebNovel] Headless catalog fetch failed", e2);
      }
    }

    // 2. Fetch main page for metadata
    let mainHtml = "";
    try {
        mainHtml = await invoke<string>("fetch_html", { 
          url, 
          headers: this.getAuthHeaders()
        });
    } catch (e) {
        console.warn("[WebNovel] Failed to fetch main HTML, trying headless", e);
        try {
            mainHtml = await invoke<string>("fetch_html_headless", { url });
        } catch (e2) {
            console.error("[WebNovel] Headless main fetch failed", e2);
        }
    }

    let title = "Unknown Comic";
    let coverUrl = "";
    let description = "";

    if (mainHtml && (mainHtml.includes("Just a moment...") || mainHtml.includes("challenge-error-text"))) {
        console.warn("[WebNovel] Cloudflare detected in main HTML, switching to headless");
        try {
            mainHtml = await invoke<string>("fetch_html_headless", { url });
        } catch (e2) {
            console.error("[WebNovel] Headless main fetch failed after cloudflare detection", e2);
        }
    }

    if (mainHtml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(mainHtml, "text/html");
        
        const titleEl = doc.querySelector("title");
        if (titleEl) {
            const parsedTitle = titleEl.textContent?.split(' - ')[0] || "Unknown Comic";
            if (parsedTitle !== "Just a moment...") {
                title = this.namemodifier(parsedTitle);
            }
        }
        
        // Use predictable webnovel CDN pattern for cover
        const cidMatch = url.match(/_(\d+)/);
        if (cidMatch) {
            coverUrl = `https://book-pic.webnovel.com/bookcover/${cidMatch[1]}`;
        } else {
            const imgEl = doc.querySelector("img.g_thumb");
            if (imgEl) coverUrl = imgEl.getAttribute("src") || "";
        }

        const descEl = doc.querySelector(".j_synopsis");
        if (descEl) description = descEl.textContent?.trim() || "";
    }

    const chapters: SourceChapter[] = [];
    
    // 3. Extract chapters from catalog
    if (catalogHtml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(catalogHtml, "text/html");
        const aElements = doc.querySelectorAll("a[href]");
        const seen = new Set<string>();
        let chNum = 1;
        
        aElements.forEach(a => {
            const href = a.getAttribute("href") || "";
            const text = a.textContent?.trim().replace(/\n/g, ' ') || "";
            
            if (slug && href.includes(`/comic/${slug}/`)) {
                const parts = href.split(`/comic/${slug}/`);
                if (parts.length > 1) {
                    const chapId = parts[1].split('?')[0].split('#')[0];
                    if (chapId && /^\d/.test(chapId)) {
                        const fullHref = href.startsWith("http") ? href : `https://www.webnovel.com${href}`;
                        if (!seen.has(fullHref)) {
                            seen.add(fullHref);
                            chapters.push({
                                id: fullHref,
                                number: chNum.toString(),
                                url: fullHref,
                                title: text || `Chapter ${chNum}`,
                                source: "webnovel.com"
                            });
                            chNum++;
                        }
                    }
                }
            }
        });
    }

    if (chapters.length === 0) {
        console.warn("[WebNovel] Chapters list is still empty after extraction. Cloudflare might have completely blocked the headless browser.");
    }

    return {
        title,
        description,
        coverUrl,
        seriesUrl: url,
        source: "webnovel.com",
        chapters: chapters.reverse() // latest first
    };
  }

  async fetchContent(url: string): Promise<SourceContent> {
    const isComic = url.includes("webnovel.com/comic");
    if (!isComic) {
      throw new Error("This provider only supports WebNovel comics.");
    }

    let imgUrls: string[] = [];

    let htmlText = "";
    try {
        htmlText = await invoke<string>("fetch_html", { 
          url, 
          headers: this.getAuthHeaders()
        });
    } catch (e) {
        console.warn("[WebNovel] fetch_html failed, falling back to headless", e);
    }

    if (!htmlText || htmlText.includes("Just a moment...") || htmlText.includes("challenge-error-text")) {
        try {
            htmlText = await invoke<string>("fetch_html_headless", { url });
        } catch (e) {
            console.warn("[WebNovel] fetch_html_headless failed", e);
        }
    }

    if (htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");
        const imgs = doc.querySelectorAll("img");
        
        imgs.forEach(img => {
            const src = img.getAttribute("data-original") || img.getAttribute("data-src") || img.getAttribute("src") || "";
            // Broadened image matching for WebNovel comics
            if (src.includes("comicpage") || src.includes("comic-image") || src.includes("comic") || src.includes("/comic/")) {
                // Ensure it's not a generic UI icon
                if (src.length > 30 && !src.includes("avatar") && !src.includes("logo") && !src.includes("icon")) {
                    if (!imgUrls.includes(src)) {
                        imgUrls.push(src);
                    }
                }
            }
        });
    }

    // Advanced Fallback: use robust headless scraper if DOM parsing yields nothing
    if (imgUrls.length === 0) {
        console.warn("[WebNovel] Fallback to robust scrape_images_headless for:", url);
        try {
            const headlessImages = await invoke<string[]>("scrape_images_headless", { 
                url,
                options: {
                    scroll_iterations: 15,
                    wait_after_scroll: 2000,
                    selectors: ["img.pt-img", "img[class*='comic']", ".comic-page img", ".reader-page img"]
                }
            });
            
            if (headlessImages && headlessImages.length > 0) {
                imgUrls = headlessImages;
            }
        } catch (e) {
            console.error("[WebNovel] scrape_images_headless failed:", e);
        }
    }

    if (imgUrls.length === 0) {
        throw new Error("No images found for chapter. Could be blocked or premium.");
    }

    return {
        images: imgUrls.map((url, i) => ({ url, pageNumber: i + 1 })),
        metadata: { 
            sourceUrl: url
        }
    };
  }

  async getTrending(): Promise<SourceSearchResult[]> {
    return this.fetchDiscovery("https://www.webnovel.com/ranking/comic/all_time/comic_power_rank");
  }

  async getLatest(): Promise<SourceSearchResult[]> {
    return this.fetchDiscovery("https://www.webnovel.com/stories/comic");
  }

  async search(query: string): Promise<SourceSearchResult[]> {
    return this.fetchDiscovery("https://www.webnovel.com/search?keywords=" + encodeURIComponent(query) + "&type=2");
  }

  private async fetchDiscovery(url: string): Promise<SourceSearchResult[]> {
      let htmlText = "";
      try {
          htmlText = await invoke<string>("fetch_html", { 
            url, 
            headers: this.getAuthHeaders()
          });
      } catch (e) {
          console.warn("[WebNovel] Discovery fetch_html failed, falling back to headless", e);
      }

      if (!htmlText || htmlText.includes("Just a moment...") || htmlText.includes("challenge-error-text")) {
          try {
              htmlText = await invoke<string>("fetch_html_headless", { url });
          } catch (e) {
              console.error("[WebNovel] Discovery headless fetch failed", e);
              return [];
          }
      }

      if (!htmlText) return [];

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");
      const items = Array.from(doc.querySelectorAll('a.g_thumb, a.c_l, .j_category_wrapper ul li a[title], .j_search_result ul li a[title]'));
      
      const results: SourceSearchResult[] = [];
      const seen = new Set<string>();

      items.forEach(item => {
          const href = item.getAttribute("href") || "";
          if (!href.includes("webnovel.com/comic") && !href.startsWith("/comic/")) return;

          let absoluteUrl = href;
          if (href.startsWith("//")) absoluteUrl = "https:" + href;
          else if (href.startsWith("/")) absoluteUrl = "https://www.webnovel.com" + href;
          
          if (seen.has(absoluteUrl)) return;

          const title = item.getAttribute("title") || item.textContent?.trim() || "Unknown";
          
          let coverUrl = "";
          const img = item.querySelector("img");
          if (img) {
              coverUrl = img.getAttribute("src") || img.getAttribute("data-original") || "";
              if (coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl;
          } else {
              // Try to reconstruct cover from ID if possible
              const idMatch = absoluteUrl.match(/_(\d+)/);
              if (idMatch) {
                  coverUrl = `https://book-pic.webnovel.com/bookcover/${idMatch[1]}`;
              }
          }

          if (absoluteUrl && coverUrl && title && title !== "Unknown") {
              seen.add(absoluteUrl);
              results.push({
                  id: absoluteUrl,
                  title: title,
                  coverUrl: coverUrl,
                  source: "webnovel.com",
                  provider: this.id,
                  contentType: this.contentType,
                  url: absoluteUrl
              });
          }
      });

      return results;
  }
}
