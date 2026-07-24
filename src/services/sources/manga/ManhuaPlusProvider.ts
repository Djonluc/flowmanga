import { invoke } from "@tauri-apps/api/core";
import { filterDownloadablePageUrls } from "../../PageImageFilter";
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

export class ManhuaPlusProvider implements SourceProvider {
  readonly id = "manhuaplus";
  readonly name = "ManhuaPlus";
  readonly domains = ["manhuaplus.org"];
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
    return url.includes("manhuaplus.org");
  }

  async fetchContent(url: string): Promise<SourceContent> {
    try {
      console.log(`[ManhuaPlus] Fetching static HTML for chapter: ${url}`);
      const html = await invoke<string>("fetch_html", { url, headers: null });

      const chapterIdMatch =
        html.match(/const\s+CHAPTER_ID\s*=\s*(\d+)/i) ||
        html.match(/CHAPTER_ID\s*:\s*(\d+)/i) ||
        html.match(/\/ajax\/image\/list\/chap\/(\d+)/i);
      if (!chapterIdMatch) {
        throw new Error("Could not find CHAPTER_ID in static HTML");
      }

      // Try to extract coverUrl from the chapter HTML meta tags
      let coverUrl = "";
      try {
        const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || 
                             html.match(/<meta\s+name="twitter:image:src"\s+content="([^"]+)"/i);
        if (ogImageMatch && ogImageMatch[1]) {
          coverUrl = ogImageMatch[1];
        }
      } catch (e) {}

      const chapterId = chapterIdMatch[1];
      console.log(`[ManhuaPlus] Found CHAPTER_ID: ${chapterId}. Fetching AJAX images...`);

      const res = await invoke<any>("fetch_json", {
        url: `https://manhuaplus.org/ajax/image/list/chap/${chapterId}`,
        method: "POST",
        body: null,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!res || !res.status || !res.html) {
        throw new Error("AJAX endpoint returned invalid/empty response");
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(res.html, "text/html");
      const separators = Array.from(doc.querySelectorAll(".separator"));

      // Sort separators by data-index ascending (ManhuaPlus page order)
      separators.sort((a, b) => {
        const idxA = parseInt(a.getAttribute("data-index") || "0");
        const idxB = parseInt(b.getAttribute("data-index") || "0");
        return idxA - idxB;
      });

      const images: string[] = [];
      separators.forEach((sep) => {
        const a = sep.querySelector(".readImg");
        const href = a?.getAttribute("href");
        if (href && href !== "#") {
          images.push(href);
        } else {
          // Fallback to img src or data-src
          const img = sep.querySelector("img");
          const src = img?.getAttribute("src") || img?.getAttribute("data-src");
          if (src && !src.includes("loading.gif")) {
            images.push(src);
          }
        }
      });

      const pageImages = filterDownloadablePageUrls(images);
      if (pageImages.length === 0) {
        throw new Error("No images parsed from AJAX HTML");
      }

      console.log(`[ManhuaPlus] Successfully extracted ${pageImages.length} sorted images!`);
      return {
        images: pageImages.map((u, i) => ({ url: u, pageNumber: i + 1 })),
        metadata: { sourceUrl: url, coverUrl },
      };
    } catch (err) {
      console.warn(`[ManhuaPlus] AJAX fetch failed, falling back to legacy headless:`, err);

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
            ],
          },
        }).catch(() => []);
        images = filterDownloadablePageUrls(images);
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
    try {
      // ManhuaPlus serves chapter listings in static HTML — no headless browser needed
      const html = await invoke<string>("fetch_html", { url, headers: null });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract title
      const titleEl = doc.querySelector(".manga-info h1, .manga-detail h1, h1, .post-title h1");
      const title = titleEl?.textContent?.trim() || "Untitled";

      // Extract description
      const descEl = doc.querySelector(".manga-info .summary, .manga-summary, .description, .manga-excerpt, .summary__content");
      const description = descEl?.textContent?.trim() || "";

      // Extract cover image
      let coverUrl = "";
      const coverImg = doc.querySelector(
        ".manga-info img, .manga-detail img, .summary_image img, .thumb img, .cover img, main figure img, figure a img",
      ) as HTMLImageElement | null;

      if (coverImg) {
        coverUrl = coverImg.getAttribute("data-src") || coverImg.getAttribute("src") || "";
      }

      if (coverUrl && coverUrl.startsWith("/")) {
        coverUrl = `https://manhuaplus.org${coverUrl}`;
      } else if (coverUrl && coverUrl.startsWith("//")) {
        coverUrl = "https:" + coverUrl;
      }

      // Extract tags/genres
      const tags: string[] = [];
      doc.querySelectorAll('a[href*="/genres/"], a[rel="tag"]').forEach((tagEl) => {
        if (tagEl.textContent) {
          const text = tagEl.textContent.trim();
          if (text && !tags.includes(text)) {
            tags.push(text);
          }
        }
      });

      // Extract chapter links — ManhuaPlus uses /manga/{slug}/chapter-{N} pattern
      const chapterLinks: { url: string; title: string; number: string }[] = [];
      const seen = new Set<string>();

      doc.querySelectorAll('a[href*="/chapter-"]').forEach((a) => {
        const href = a.getAttribute("href");
        if (!href || (!href.includes("manhuaplus.org/manga/") && !href.startsWith("/manga/"))) return;
        
        let fullHref = href;
        if (fullHref.startsWith("/")) {
            fullHref = "https://manhuaplus.org" + fullHref;
        }

        if (seen.has(fullHref)) return;
        seen.add(fullHref);

        const chTitle = a.textContent?.trim() || "";
        const numMatch = fullHref.match(/chapter-(\d+(\.\d+)?)/);
        const num = numMatch ? numMatch[1] : "0";

        chapterLinks.push({ url: fullHref, title: chTitle, number: num });
      });

      // Regex fallback if DOM fails
      if (chapterLinks.length === 0) {
        const matches = Array.from(html.matchAll(/href=["']([^"']*chapter-\d+[^"']*)["']/gi));
        matches.forEach(m => {
            let fullHref = m[1];
            if (fullHref.startsWith("/")) fullHref = "https://manhuaplus.org" + fullHref;
            if (seen.has(fullHref)) return;
            seen.add(fullHref);
            
            const numMatch = fullHref.match(/chapter-(\d+(\.\d+)?)/);
            const num = numMatch ? numMatch[1] : "0";
            chapterLinks.push({ url: fullHref, title: `Chapter ${num}`, number: num });
        });
      }

      if (chapterLinks.length === 0) {
          throw new Error("No chapters found in static HTML, falling back to headless.");
      }

      // Sort by chapter number ascending
      chapterLinks.sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

      return {
        title,
        description,
        coverUrl,
        seriesUrl: url,
        source: "manhuaplus.org",
        tags,
        chapters: chapterLinks.map((ch) => ({
          id: ch.url,
          number: ch.number,
          url: ch.url,
          title: ch.title,
          source: "manhuaplus.org",
        })),
      };
    } catch (e) {
      console.warn("[ManhuaPlus] fetchSeries direct HTTP failed, falling back to headless:", e);
      const res = await invoke<any>("scrape_series_headless", { url });
      const links: string[] = res.chapter_links || res.chapterLinks || [];
      return {
        title: (res.title || "")
          .replace(/[\r\n\t]+/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        description: (res.description || "").trim(),
        coverUrl: res.cover_url || res.coverUrl || "",
        seriesUrl: url,
        source: "manhuaplus.org",
        chapters: links.map((link: string, i: number) => ({
          id: link,
          number: (links.length - i).toString(),
          url: link,
          source: "manhuaplus.org",
        })),
      };
    }
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
      ".page-item-detail, .manga-item, .c-tabs-item__content",
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
            coverUrl = "https://manhuaplus.org" + coverUrl;
          results.push({
            id: href,
            title: a.textContent?.trim() || "Manhua",
            source: defaultSource,
            provider: "manhuaplus",
            contentType: "manga",
            url: href,
            coverUrl,
            tags: ["Full Color", "Manhua"],
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
              coverUrl = "https://manhuaplus.org" + coverUrl;
            results.push({
              id: href,
              title: titleStr.trim(),
              source: defaultSource,
              provider: "manhuaplus",
              contentType: "manga",
              url: href,
              coverUrl,
              tags: ["Full Color", "Manhua"],
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
      const url = `https://manhuaplus.org/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
      const html = await invoke<string>("fetch_html", { url, headers: null });
      return this.parseMadaraList(html, limit, "manhuaplus.org");
    } catch (e) {
      console.warn("[ManhuaPlus] search failed:", e);
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
      const url = `https://manhuaplus.org/manga/page/${page}/?m_orderby=views`;
      const html = await invoke<string>("fetch_html", { url, headers: null });
      return this.parseMadaraList(html, limit, "manhuaplus.org");
    } catch (e) {
      console.warn("[ManhuaPlus] fetchPopular failed:", e);
      return [];
    }
  }

  async fetchLatest(
    page: number = 1,
    limit: number = 20,
  ): Promise<SourceSearchResult[]> {
    try {
      const url = `https://manhuaplus.org/manga/page/${page}/?m_orderby=latest`;
      const html = await invoke<string>("fetch_html", { url, headers: null });
      return this.parseMadaraList(html, limit, "manhuaplus.org");
    } catch (e) {
      console.warn("[ManhuaPlus] fetchLatest failed:", e);
      return [];
    }
  }

  async getTrending(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    try {
      const url = "https://manhuaplus.org/home";
      console.log(`[ManhuaPlus] Fetching trending recommendations from ${url}`);
      const html = await invoke<string>("fetch_html", { url, headers: null });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const results: SourceSearchResult[] = [];

      // Parse Trending/Recommended list
      const figures = doc.querySelectorAll("#recommend figure.sac");
      figures.forEach((fig) => {
        const a = fig.querySelector("figcaption a, a.clamp") as HTMLAnchorElement | null;
        const img = fig.querySelector("img.lazy, img") as HTMLImageElement | null;
        if (a) {
          const href = a.getAttribute("href");
          if (href && href.includes("/manga/")) {
            let coverUrl = img
              ? img.getAttribute("data-src") ||
                img.getAttribute("src") ||
                undefined
              : undefined;
            if (coverUrl && coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl;
            if (coverUrl && coverUrl.startsWith("/")) coverUrl = "https://manhuaplus.org" + coverUrl;

            if (coverUrl && coverUrl.includes("loading.gif")) {
              coverUrl = undefined;
            }

            results.push({
              id: href,
              title: a.textContent?.trim() || "Manhua",
              source: "manhuaplus.org",
              provider: "manhuaplus",
              contentType: "manga",
              url: href,
              coverUrl,
              tags: ["Trending", "Full Color", "Manhua"],
            });
          }
        }
      });

      if (results.length > 0) {
        console.log(`[ManhuaPlus] Successfully extracted ${results.length} recommended manhua from home page!`);
        return results.slice(0, options.limit || 20);
      }

      console.warn("[ManhuaPlus] No recommended items parsed from #recommend, falling back to page/1/?m_orderby=views");
      return this.fetchPopular(options.page || 1, options.limit || 20);
    } catch (e) {
      console.warn("[ManhuaPlus] Failed to fetch trending recommendations:", e);
      return this.fetchPopular(options.page || 1, options.limit || 20);
    }
  }
}
