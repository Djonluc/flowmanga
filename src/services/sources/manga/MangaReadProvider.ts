import { invoke } from "@tauri-apps/api/core";
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
    let images: string[] = [];
    try {
      const targetUrl = url.includes("?") ? `${url}&style=list` : `${url}?style=list`;
      const html = await invoke<string>("fetch_html", { url: targetUrl, headers: null });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract images from common Madara reading containers
      const imgNodes = doc.querySelectorAll(".reading-content img, .wp-manga-chapter-img, .page-break img");
      imgNodes.forEach((img) => {
        let src = img.getAttribute("data-src") || img.getAttribute("src") || img.getAttribute("data-lazy-src");
        if (src) {
          src = src.trim();
          if (src.startsWith("//")) src = "https:" + src;
          // Ignore logos, icons, avatars
          if (!src.toLowerCase().includes("logo") && !src.toLowerCase().includes("avatar") && src.length > 20) {
             if (!images.includes(src)) images.push(src);
          }
        }
      });

      // Regex fallback if DOMParser misses
      if (images.length === 0) {
        const matches = Array.from(html.matchAll(/img[^>]*src=["']([^"']+(?:jpg|png|jpeg|webp))["']/gi));
        matches.forEach(m => {
            let src = m[1].trim();
            if (src.startsWith("//")) src = "https:" + src;
            if (!src.toLowerCase().includes("logo") && !src.toLowerCase().includes("avatar") && src.length > 20) {
                if (!images.includes(src)) images.push(src);
            }
        });
      }
    } catch (e) {
      console.warn("[MangaRead] fetchContent HTML fetch failed, falling back to headless:", e);
    }

    if (images.length === 0) {
      let attempts = 0;
      while (attempts < 3) {
        const targetUrl =
          attempts === 0
            ? url.includes("?")
              ? `${url}&style=list`
              : `${url}?style=list`
            : url;

        images = await invoke<string[]>("scrape_images_headless", {
          url: targetUrl,
        });
        if (images.length > 0) break;
        attempts++;
        if (attempts < 3) await new Promise((r) => setTimeout(r, 3000));
      }
    }

    if (images.length === 0) throw new Error("No images found for chapter");

    return {
      images: images.map((u, i) => ({ url: u, pageNumber: i + 1 })),
      metadata: { sourceUrl: url },
    };
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    try {
      const html = await invoke<string>("fetch_html", { url, headers: null });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const titleNode = doc.querySelector(".post-title h1, .post-title, .manga-title h1");
      const title = titleNode?.textContent?.trim() || "Unknown Title";

      const descNode = doc.querySelector(".summary__content, .description-summary, .manga-about");
      const description = descNode?.textContent?.trim() || "";

      let coverUrl = "";
      const imgNode = doc.querySelector(".summary_image img, .manga-cover img, .c-image-hover img") as HTMLImageElement;
      if (imgNode) {
        coverUrl = imgNode.getAttribute("data-src") || imgNode.getAttribute("src") || "";
        if (coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl;
      }

      const links: string[] = [];
      const chapterNodes = doc.querySelectorAll("li.wp-manga-chapter a, .chapter-link a, li[class*='chapter'] a");
      chapterNodes.forEach((node) => {
        const href = node.getAttribute("href");
        if (href && href.length > 5 && !links.includes(href)) {
          links.push(href);
        }
      });

      // If no chapters found, fallback to regex search
      if (links.length === 0) {
        const matches = Array.from(html.matchAll(/href=["']([^"']*chapter[^"']*)["']/gi));
        matches.forEach(m => {
            const href = m[1];
            if (href.length > 5 && !links.includes(href)) {
                links.push(href);
            }
        });
      }

      return {
        title,
        description,
        coverUrl,
        seriesUrl: url,
        source: "mangaread.org",
        chapters: links.map((link: string, i: number) => ({
          id: link,
          number: (links.length - i).toString(),
          url: link,
          source: "mangaread.org",
        })),
      };
    } catch (e) {
      console.warn("[MangaRead] fetchSeries failed, falling back to headless:", e);
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
