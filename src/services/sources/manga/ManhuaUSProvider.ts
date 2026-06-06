import { invoke } from "@tauri-apps/api/core";
import type {
  SourceProvider,
  SourceContent,
  SourceSeries,
  SourceChapter,
  SourceSearchResult,
  SourceSearchOptions,
  SourceCapabilities,
  ContentType,
  MediaType,
  MediaDomain,
  ReaderMode,
} from "../types";

export class ManhuaUSProvider implements SourceProvider {
  readonly id = "manhuaus";
  readonly name = "ManhuaUS";
  readonly domains = ["manhuaus.com", "manhuaus.org"];
  readonly contentType: ContentType = "manga";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["vertical", "single"];

  readonly capabilities: SourceCapabilities = {
    search: true,
    tagSearch: true,
    seriesBrowse: false,
    chapterFeed: false,
    pagination: false,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    return url.includes("manhuaus.com") || url.includes("manhuaus.org");
  }

  async fetchContent(url: string): Promise<SourceContent> {
    try {
      console.log(`[ManhuaUS] Fetching static HTML for chapter: ${url}`);
      const html = await invoke<string>("fetch_html", { 
        url, 
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Referer": "https://manhuaus.com/"
        } 
      });

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract coverUrl if possible
      let coverUrl = "";
      try {
        const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                             html.match(/<meta\s+name="twitter:image:src"\s+content="([^"]+)"/i);
        if (ogImageMatch && ogImageMatch[1]) {
          coverUrl = ogImageMatch[1];
        }
      } catch (e) {}

      // In ManhuaUS, images are typically in .reading-content
      const images: string[] = [];
      const imgElements = doc.querySelectorAll(".reading-content img, .page-break img");
      
      imgElements.forEach((img) => {
        const src = img.getAttribute("data-src") || img.getAttribute("src");
        if (src && !src.includes("loading") && !src.includes("logo")) {
          let finalSrc = src.trim();
          if (finalSrc.startsWith("//")) finalSrc = "https:" + finalSrc;
          images.push(finalSrc);
        }
      });

      if (images.length === 0) {
        throw new Error("No images parsed from HTML, possibly Cloudflare blocked.");
      }

      console.log(`[ManhuaUS] Successfully extracted ${images.length} images!`);
      return {
        images: images.map((u, i) => ({ url: u, pageNumber: i + 1 })),
        metadata: { sourceUrl: url, coverUrl },
      };
    } catch (err) {
      console.warn(`[ManhuaUS] Static fetch failed, falling back to legacy headless:`, err);

      let images: string[] = [];
      let attempts = 0;
      while (attempts < 2) {
        const targetUrl =
          attempts === 0
            ? url.includes("?")
              ? `${url}&style=list`
              : `${url}?style=list`
            : url;

        images = await invoke<string[]>("scrape_images_headless", {
          url: targetUrl,
          options: {
            scrollIterations: 20,
            waitAfterScroll: 2000,
            selectors: [
              ".reading-content img",
              ".chapter-content img",
              "img[data-src]",
              ".page-break img"
            ],
          },
        }).catch(() => []);
        if (images.length > 0) break;
        attempts++;
      }

      if (images.length === 0) {
        throw new Error(`Failed to scrape chapter: ${(err as any).toString()}`);
      }

      return {
        images: images.map((u, i) => ({ url: u, pageNumber: i + 1 })),
        metadata: { sourceUrl: url },
      };
    }
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    let html = "";
    try {
      html = await invoke<string>("fetch_html", { 
        url, 
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Referer": "https://manhuaus.com/"
        } 
      });
    } catch (e) {
      console.warn(`[ManhuaUS] fetchSeries fetch_html failed, trying headless`, e);
      html = await invoke<string>("fetch_html_headless", { url });
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Extract title
    const titleEl = doc.querySelector(".post-title h1, .post-title h3, h1");
    let title = titleEl?.textContent?.trim() || "Untitled";
    if (titleEl?.querySelector("span")) {
       title = titleEl.childNodes[0]?.textContent?.trim() || title;
    }

    // Extract description
    const descEl = doc.querySelector(".summary__content, .description-summary .summary__content p, .manga-excerpt");
    const description = descEl?.textContent?.trim() || "";

    // Extract cover image
    let coverUrl = "";
    const coverImg = doc.querySelector(
      ".summary_image img, .manga-info img, .manga-detail img, .thumb img, .cover img, main figure img, figure a img",
    ) as HTMLImageElement | null;

    if (coverImg) {
      coverUrl = coverImg.getAttribute("data-src") || coverImg.getAttribute("src") || "";
    }

    if (coverUrl && coverUrl.startsWith("//")) {
      coverUrl = `https:${coverUrl}`;
    }
    if (coverUrl && coverUrl.startsWith("/")) {
      coverUrl = `https://manhuaus.com${coverUrl}`;
    }

    // Extract tags/genres
    const tags: string[] = [];
    doc.querySelectorAll('.genres-content a, .manga-info a[href*="/genres/"], a[rel="tag"]').forEach((tagEl) => {
      if (tagEl.textContent) {
        const text = tagEl.textContent.trim();
        if (text && !tags.includes(text)) {
          tags.push(text);
        }
      }
    });

    // Extract chapter links — Madara uses #chapters ul.chlist li a or .wp-manga-chapter a
    const chapterLinks: { url: string; title: string; number: string }[] = [];
    const seen = new Set<string>();

    doc.querySelectorAll('.wp-manga-chapter a, #chapters ul.chlist li a, .chapter-list a').forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      if (seen.has(href)) return;
      seen.add(href);

      const chTitle = a.textContent?.trim() || "";
      const numMatch = href.match(/chapter-(\d+(\.\d+)?)/) || chTitle.match(/Chapter\s+(\d+(\.\d+)?)/i);
      const num = numMatch ? numMatch[1] : "0";

      chapterLinks.push({ url: href, title: chTitle, number: num });
    });

    // Sort by chapter number ascending
    chapterLinks.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

    if (chapterLinks.length === 0) {
      if (title.includes("Just a moment") || html.includes("challenge-error-text")) {
        throw new Error("Cloudflare challenge blocked the request. Please wait or try opening the site in a browser.");
      }
      throw new Error("No chapters found. The page might be protected by Cloudflare or the layout has changed.");
    }

    return {
      title,
      description,
      coverUrl,
      seriesUrl: url,
      source: "manhuaus.com",
      tags,
      chapters: chapterLinks.map((ch) => ({
        id: ch.url,
        number: ch.number,
        url: ch.url,
        title: ch.title,
        source: "manhuaus.com",
      })),
    };
  }

  async fetchChapterFeed(seriesUrl: string): Promise<SourceChapter[]> {
    const series = await this.fetchSeries(seriesUrl);
    return series.chapters;
  }

  private parseMadaraList(
    html: string,
    limit: number,
    defaultSource: string,
  ): SourceSearchResult[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const results: SourceSearchResult[] = [];
    const items = doc.querySelectorAll(
      ".c-tabs-item__content, .page-item-detail, .manga-item",
    );

    if (items.length > 0) {
      items.forEach((item) => {
        const a = item.querySelector(
          "h3 a, .post-title a",
        ) as HTMLAnchorElement;
        const img = item.querySelector("img") as HTMLImageElement;
        if (a && a.getAttribute("href")) {
          const href = a.getAttribute("href")!;
          let coverUrl = img
            ? img.getAttribute("data-src") ||
              img.getAttribute("src") ||
              undefined
            : undefined;
          if (coverUrl && coverUrl.startsWith("//"))
            coverUrl = "https:" + coverUrl;
          if (coverUrl && coverUrl.startsWith("/"))
            coverUrl = "https://manhuaus.com" + coverUrl;
          results.push({
            id: href,
            title: a.textContent?.trim() || "Manhua",
            source: defaultSource,
            provider: "manhuaus",
            contentType: "manga",
            url: href,
            coverUrl,
            tags: ["Manhua"],
          });
        }
      });
    } else {
      doc
        .querySelectorAll(".item-thumb a, .manga-poster a, .series-box a")
        .forEach((a) => {
          const href = a.getAttribute("href");
          if (href && (href.includes("/manga/") || href.includes("/comic/"))) {
            const img = a.querySelector("img");
            const titleStr =
              a.getAttribute("title") || img?.getAttribute("alt") || "Manhua";
            let coverUrl = img
              ? img.getAttribute("data-src") ||
                img.getAttribute("src") ||
                undefined
              : undefined;
            if (coverUrl && coverUrl.startsWith("//"))
              coverUrl = "https:" + coverUrl;
            if (coverUrl && coverUrl.startsWith("/"))
              coverUrl = "https://manhuaus.com" + coverUrl;
            results.push({
              id: href,
              title: titleStr.trim(),
              source: defaultSource,
              provider: "manhuaus",
              contentType: "manga",
              url: href,
              coverUrl,
              tags: ["Manhua"],
            });
          }
        });
    }

    const unique = Array.from(new Map(results.map((r) => [r.id, r])).values());
    return unique.slice(0, limit);
  }

  async search(
    query: string,
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const url = `https://manhuaus.com/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
      let html = "";
      try {
        html = await invoke<string>("fetch_html", { 
          url, 
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://manhuaus.com/"
          } 
        });
      } catch (e) {
        html = await invoke<string>("fetch_html_headless", { url });
      }
      return this.parseMadaraList(html, limit, "manhuaus.com");
    } catch (e) {
      console.warn("[ManhuaUS] search failed:", e);
      return [];
    }
  }

  async searchByTags(
    tags: string[],
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    if (tags.length === 0) return [];
    return this.search(tags[0], options);
  }

  async fetchPopular(
    page: number = 1,
    limit: number = 20,
  ): Promise<SourceSearchResult[]> {
    try {
      const url = `https://manhuaus.com/manga/page/${page}/?m_orderby=views`;
      let html = "";
      try {
        html = await invoke<string>("fetch_html", { 
          url, 
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://manhuaus.com/"
          } 
        });
      } catch (e) {
        html = await invoke<string>("fetch_html_headless", { url });
      }
      return this.parseMadaraList(html, limit, "manhuaus.com");
    } catch (e) {
      console.warn("[ManhuaUS] fetchPopular failed:", e);
      return [];
    }
  }

  async fetchLatest(
    page: number = 1,
    limit: number = 20,
  ): Promise<SourceSearchResult[]> {
    try {
      const url = `https://manhuaus.com/manga/page/${page}/?m_orderby=latest`;
      let html = "";
      try {
        html = await invoke<string>("fetch_html", { 
          url, 
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://manhuaus.com/"
          } 
        });
      } catch (e) {
        html = await invoke<string>("fetch_html_headless", { url });
      }
      return this.parseMadaraList(html, limit, "manhuaus.com");
    } catch (e) {
      console.warn("[ManhuaUS] fetchLatest failed:", e);
      return [];
    }
  }

  async getTrending(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    try {
      // Typically Madara homepage has trending
      const url = "https://manhuaus.com/";
      let html = "";
      try {
        html = await invoke<string>("fetch_html", { 
          url, 
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://manhuaus.com/"
          } 
        });
      } catch (e) {
        html = await invoke<string>("fetch_html_headless", { url });
      }
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const results: SourceSearchResult[] = [];

      // Look for slider or trending widget
      const items = doc.querySelectorAll(".slider__item, .popular-item, .item-thumb");
      items.forEach((item) => {
        const a = item.querySelector("a") as HTMLAnchorElement | null;
        const img = item.querySelector("img") as HTMLImageElement | null;
        if (a) {
          const href = a.getAttribute("href");
          if (href && href.includes("/manga/")) {
            let coverUrl = img
              ? img.getAttribute("data-src") ||
                img.getAttribute("src") ||
                undefined
              : undefined;
            if (coverUrl && coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl;
            if (coverUrl && coverUrl.startsWith("/")) coverUrl = "https://manhuaus.com" + coverUrl;

            results.push({
              id: href,
              title: a.getAttribute("title") || a.textContent?.trim() || "Manhua",
              source: "manhuaus.com",
              provider: "manhuaus",
              contentType: "manga",
              url: href,
              coverUrl,
              tags: ["Trending", "Manhua"],
            });
          }
        }
      });

      if (results.length > 0) {
        // remove duplicates
        const unique = Array.from(new Map(results.map((r) => [r.id, r])).values());
        return unique.slice(0, options.limit || 20);
      }

      return this.fetchPopular(options.page || 1, options.limit || 20);
    } catch (e) {
      console.warn("[ManhuaUS] Failed to fetch trending recommendations:", e);
      return this.fetchPopular(options.page || 1, options.limit || 20);
    }
  }
}
