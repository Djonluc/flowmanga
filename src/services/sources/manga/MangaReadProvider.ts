import { invoke } from "@tauri-apps/api/core";
import { fetchMadaraChaptersAjax } from "../utils";
import type {
  SourceProvider,
  SourceContent,
  SourceSeries,
  SourceChapter,
  SourceSearchResult,
  SourceCapabilities,
  ContentType,
  MediaType,
  MediaDomain,
  ReaderMode,
} from "../types";

export class MangaReadProvider implements SourceProvider {
  readonly id = "mangaread";
  readonly name = "MangaRead";
  readonly domains = ["mangaread.org"];
  readonly contentType: ContentType = "manga";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["vertical", "single"];

  readonly capabilities: SourceCapabilities = {
    search: true,
    tagSearch: true,
    seriesBrowse: true,
    chapterFeed: true,
    pagination: false,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    return url.includes("mangaread.org");
  }

  async fetchContent(url: string): Promise<SourceContent> {
    try {
      console.log(`[MangaRead] Fetching static HTML for chapter: ${url}`);
      const targetUrl = url.includes("?") ? `${url}&style=list` : `${url}?style=list`;
      const html = await invoke<string>("fetch_html", { url: targetUrl, headers: null });

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const images: string[] = [];
      doc.querySelectorAll(".reading-content img, .page-break img.wp-manga-chapter-img, img[id^='image-']").forEach((img) => {
        const src = img.getAttribute("data-lazy-src") || img.getAttribute("data-src") || img.getAttribute("src");
        if (src && !src.includes("loading.gif")) {
          images.push(src.trim());
        }
      });

      if (images.length === 0) {
        throw new Error("No images parsed from static HTML");
      }

      console.log(`[MangaRead] Parsed ${images.length} images from static HTML`);
      return {
        images: images.map((u, i) => ({ url: u, pageNumber: i + 1 })),
        metadata: { sourceUrl: url },
      };
    } catch (err) {
      console.warn(`[MangaRead] Lightweight fetchContent failed, falling back to headless:`, err);
      let images: string[] = [];
      let attempts = 0;
      while (attempts < 2) {
        const targetUrl = attempts === 0 ? (url.includes("?") ? `${url}&style=list` : `${url}?style=list`) : url;
        images = await invoke<string[]>("scrape_images_headless", { url: targetUrl }).catch(() => []);
        if (images.length > 0) break;
        attempts++;
        if (attempts < 2) await new Promise((r) => setTimeout(r, 2000));
      }

      if (images.length === 0) throw new Error("No images found for chapter");

      return {
        images: images.map((u, i) => ({ url: u, pageNumber: i + 1 })),
        metadata: { sourceUrl: url },
      };
    }
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    try {
      const html = await invoke<string>("fetch_html", { url, headers: null });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const titleEl = doc.querySelector(".post-title h1, .post-title h3");
      const title = titleEl?.textContent?.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim() || "";

      const descEl = doc.querySelector(".summary__content p, .description-summary p");
      const description = descEl?.textContent?.trim() || "";

      const coverImg = doc.querySelector(".summary_image img");
      const coverUrl = coverImg?.getAttribute("data-src") || coverImg?.getAttribute("src") || "";

      let chapters: SourceChapter[] = [];
      const chapterNodes = Array.from(doc.querySelectorAll(".wp-manga-chapter"));

      if (chapterNodes.length > 0) {
        let num = chapterNodes.length;
        chapterNodes.forEach((node) => {
          const a = node.querySelector("a");
          if (a) {
            const href = a.getAttribute("href");
            if (href) {
              chapters.push({
                id: href,
                number: num.toString(),
                url: href,
                title: a.textContent?.trim() || "",
                source: "mangaread.org",
              });
              num--;
            }
          }
        });
      } else {
        // Try AJAX fallback
        const mangaIdInput = doc.querySelector(".rating-post-id, #manga-chapters-holder");
        let mangaId = mangaIdInput?.getAttribute("value") || mangaIdInput?.getAttribute("data-id") || "";
        
        if (!mangaId) {
          const idMatch = html.match(/"manga_id"\s*:\s*"(\d+)"/i) || html.match(/manga_id\s*=\s*(\d+)/i);
          if (idMatch) mangaId = idMatch[1];
        }

        if (mangaId) {
          chapters = await fetchMadaraChaptersAjax("https://mangaread.org", mangaId, url, "mangaread.org");
        }
      }

      if (chapters.length === 0) {
        throw new Error("Could not parse chapters from HTML or AJAX");
      }

      return {
        title,
        description,
        coverUrl,
        seriesUrl: url,
        source: "mangaread.org",
        chapters,
      };
    } catch (err) {
      console.warn(`[MangaRead] Lightweight fetchSeries failed, falling back to headless:`, err);
      const res = await invoke<any>("scrape_series_headless", { url });
      const links: string[] = res.chapter_links || res.chapterLinks || [];
      return {
        title: (res.title || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim(),
        description: (res.description || "").trim(),
        coverUrl: res.cover_url || res.coverUrl || "",
        seriesUrl: url,
        source: "mangaread.org",
        chapters: links.map((link: string, i: number) => ({
          id: link,
          number: (links.length - i).toString(),
          url: link,
          source: "mangaread.org",
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
          results.push({
            id: href,
            title: a.textContent?.trim() || "Manga",
            source: defaultSource,
            contentType: "manga",
            url: href,
            coverUrl,
            tags: ["Manga"],
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
              a.getAttribute("title") || img?.getAttribute("alt") || "Manga";
            let coverUrl = img
              ? img.getAttribute("data-src") ||
                img.getAttribute("src") ||
                undefined
              : undefined;
            if (coverUrl && coverUrl.startsWith("//"))
              coverUrl = "https:" + coverUrl;
            results.push({
              id: href,
              title: titleStr.trim(),
              source: defaultSource,
              contentType: "manga",
              url: href,
              coverUrl,
              tags: ["Manga"],
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
      const url = `https://mangaread.org/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
      const html = await invoke<string>("fetch_html", { url, headers: null });
      return this.parseMadaraList(html, limit, "mangaread.org");
    } catch (e) {
      console.warn("[MangaRead] search failed:", e);
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
      const url = `https://mangaread.org/manga/page/${page}/?m_orderby=views`;
      const html = await invoke<string>("fetch_html", { url, headers: null });
      return this.parseMadaraList(html, limit, "mangaread.org");
    } catch (e) {
      console.warn("[MangaRead] fetchPopular failed:", e);
      return [];
    }
  }

  async fetchLatest(
    page: number = 1,
    limit: number = 20,
  ): Promise<SourceSearchResult[]> {
    try {
      const url = `https://mangaread.org/manga/page/${page}/?m_orderby=latest`;
      const html = await invoke<string>("fetch_html", { url, headers: null });
      return this.parseMadaraList(html, limit, "mangaread.org");
    } catch (e) {
      console.warn("[MangaRead] fetchLatest failed:", e);
      return [];
    }
  }
}
