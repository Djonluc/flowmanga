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
  ReaderMode,
} from "../types";

export class MangaReadProvider implements SourceProvider {
  readonly id = "mangaread";
  readonly name = "MangaRead (Under Construction)";
  readonly domains = ["mangaread.org"];
  readonly contentType: ContentType = "manga";
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
    let attempts = 0;
    while (attempts < 3) {
      // Alternate between list style and normal (some sites prefer one or the other)
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
    _query: string,
    _page: number = 1,
    _limit: number = 20,
  ): Promise<SourceSearchResult[]> {
    return [];
  }

  async searchByTags(
    _tags: string[],
    _page: number = 1,
    _limit: number = 20,
  ): Promise<SourceSearchResult[]> {
    return [];
  }

  async fetchPopular(
    _page: number = 1,
    _limit: number = 20,
  ): Promise<SourceSearchResult[]> {
    return [];
  }

  async fetchLatest(
    _page: number = 1,
    _limit: number = 20,
  ): Promise<SourceSearchResult[]> {
    return [];
  }
}
