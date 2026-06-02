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

export class ManhwaReadProvider implements SourceProvider {
  readonly id = "manhwaread";
  readonly name = "ManhwaRead (Under Construction)";
  readonly domains = ["manhwaread.com"];
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
    return url.includes("manhwaread.com");
  }

  async fetchContent(url: string): Promise<SourceContent> {
    let images: string[] = [];
    let attempts = 0;
    while (attempts < 3) {
      // Alternate between list style and normal
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

    if (images.length === 0) throw new Error("No images found for chapter");

    return {
      images: images.map((u, i) => ({ url: u, pageNumber: i + 1 })),
      metadata: { sourceUrl: url },
    };
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    const res = await invoke<any>("scrape_series_headless", { url });
    const links: string[] = res.chapter_links || res.chapterLinks || [];
    
    let tags: string[] = [];
    try {
      const htmlText = await invoke<string>("fetch_html", { url, headers: null });
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");

      // Parse genres
      doc.querySelectorAll("a[href^='/genre/']").forEach(a => {
        const text = a.textContent?.trim();
        if (text && !tags.includes(text)) tags.push(text);
      });

      // Parse tags
      doc.querySelectorAll("a[href^='/tag/']").forEach(a => {
        const spans = a.querySelectorAll("span");
        if (spans.length >= 2) {
            const text = spans[1].textContent?.trim();
            if (text && !tags.includes(text)) tags.push(text);
        } else {
            const text = a.textContent?.trim();
            if (text && !tags.includes(text)) tags.push(text);
        }
      });
    } catch(e) {
      console.warn("[ManhwaRead] Failed to fetch tags for series", e);
    }

    return {
      title: (res.title || "")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      description: (res.description || "").trim(),
      coverUrl: res.cover_url || res.coverUrl || "",
      seriesUrl: url,
      source: "manhwaread.com",
      tags,
      chapters: links.map((link: string, i: number) => ({
        id: link,
        number: (links.length - i).toString(),
        url: link,
        source: "manhwaread.com",
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
      ".page-item-detail, .manga-item, .c-tabs-item__content, .manga-poster, .series-box, .item-thumb",
    );

    if (items.length > 0) {
      items.forEach((item) => {
        const a = item.querySelector(
          "h3 a, .post-title a, a[title]",
        ) as HTMLAnchorElement;
        
        // If we didn't find 'a' inside the item, maybe the item itself is an anchor (like .manga-poster a)
        const targetA = a || (item.tagName.toLowerCase() === 'a' ? item as HTMLAnchorElement : null) || item.querySelector("a");
        const img = item.querySelector("img") as HTMLImageElement;
        
        if (targetA && targetA.getAttribute("href")) {
          const href = targetA.getAttribute("href")!;
          if (!href.includes("/manga/") && !href.includes("/comic/")) return;
          
          const titleStr = targetA.getAttribute("title") || targetA.textContent?.trim() || img?.getAttribute("alt") || "Manhwa";
          
          let coverUrl = img
            ? img.getAttribute("data-src") ||
              img.getAttribute("src") ||
              undefined
            : undefined;
          if (coverUrl && coverUrl.startsWith("//"))
            coverUrl = "https:" + coverUrl;

          const itemTags = ["Full Color", "Manhwa"];
          item.querySelectorAll("a[href*='/genre/'], a[href*='/tag/']").forEach(tagEl => {
            const t = tagEl.textContent?.trim();
            if (t && !itemTags.includes(t)) itemTags.push(t);
          });

          results.push({
            id: href,
            title: titleStr.trim(),
            source: defaultSource,
            contentType: "manga",
            url: href,
            coverUrl,
            tags: itemTags,
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
      const url = `https://manhwaread.com/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
      const html = await invoke<string>("fetch_html", { url, headers: null });
      return this.parseMadaraList(html, limit, "manhwaread.com");
    } catch (e) {
      console.warn("[ManhwaRead] search failed:", e);
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
      const url = page === 1
        ? `https://manhwaread.com/manhwa/?m_orderby=views`
        : `https://manhwaread.com/manhwa/page/${page}/?m_orderby=views`;
      const html = await invoke<string>("fetch_html", { url, headers: null });
      return this.parseMadaraList(html, limit, "manhwaread.com");
    } catch (e) {
      console.warn("[ManhwaRead] fetchPopular failed:", e);
      return [];
    }
  }

  async fetchLatest(
    page: number = 1,
    limit: number = 20,
  ): Promise<SourceSearchResult[]> {
    try {
      const url = page === 1
        ? `https://manhwaread.com/manhwa/?m_orderby=latest`
        : `https://manhwaread.com/manhwa/page/${page}/?m_orderby=latest`;
      const html = await invoke<string>("fetch_html", { url, headers: null });
      return this.parseMadaraList(html, limit, "manhwaread.com");
    } catch (e) {
      console.warn("[ManhwaRead] fetchLatest failed:", e);
      return [];
    }
  }
}
