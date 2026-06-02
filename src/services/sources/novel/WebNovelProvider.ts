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
} from "../types";

export class WebNovelProvider implements SourceProvider {
  readonly id = "webnovel";
  readonly name = "WebNovel";
  readonly domains = ["webnovel.com"];
  readonly contentType: ContentType = "manga"; // Explicitly manga/comic only
  readonly mediaDomain: MediaDomain = "image";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["paged", "continuous"];

  readonly capabilities: SourceCapabilities = {
    search: false,
    tagSearch: false,
    seriesBrowse: true,
    chapterFeed: false,
    pagination: false,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    return url.includes("webnovel.com/comic");
  }

  private namemodifier(str: string): string {
    return str.replace(/[\\/:*?"<>|?]/g, "").trim();
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
      catalogHtml = await invoke<string>("fetch_html", { url: catalogUrl, headers: { "User-Agent": "Mozilla/5.0" } });
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
        mainHtml = await invoke<string>("fetch_html", { url, headers: { "User-Agent": "Mozilla/5.0" } });
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

    let chapters: SourceChapter[] = [];
    
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
        htmlText = await invoke<string>("fetch_html", { url, headers: { "User-Agent": "Mozilla/5.0" } });
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
            if (src.includes("comicpage") || src.includes("comic-image")) {
                if (!imgUrls.includes(src)) {
                    imgUrls.push(src);
                }
            }
        });
    }

    if (imgUrls.length === 0) {
        throw new Error("No images found for chapter. Could be blocked or premium.");
    }

    return {
        images: imgUrls.map((url, i) => ({ url, pageNumber: i + 1 })),
        metadata: { 
            sourceUrl: url,
            headers: {
                "Referer": "https://www.webnovel.com/"
            }
        }
    };
  }
}
