import { invoke } from "@tauri-apps/api/core";
import type {
  SourceProvider,
  SourceContent,
  SourceSeries,
  SourceSearchResult,
  SourceCapabilities,
  ContentType,
  MediaType,
  MediaDomain,
  ReaderMode,
  SourceSearchOptions,
  SourceChapter,
} from "../types";

export class HentaiComicsFreeProvider implements SourceProvider {
  readonly id = "hentaicomicsfree";
  readonly name = "Hentai Comics Free";
  readonly domains = ["hentaicomicsfree.com"];
  readonly contentType: ContentType = "doujin";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "ask" as const;
  readonly readerModes: ReaderMode[] = ["vertical", "gallery"];

  readonly capabilities: SourceCapabilities = {
    search: true,
    tagSearch: true,
    seriesBrowse: false,
    chapterFeed: false,
    pagination: true,
    authentication: false,
  };

  // ─── URL Matching ─────────────────────────────────────────────────

  matchesUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace("www.", "");
      return this.domains.some((d) => hostname.includes(d));
    } catch {
      return false;
    }
  }

  // ─── Content Fetching ─────────────────────────────────────────────

  async fetchContent(url: string): Promise<SourceContent> {
    const html = await invoke<string>("fetch_html", {
      url,
      headers: null,
    });
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Extract metadata
    const title =
      doc.querySelector("h1.wp-block-heading")?.textContent?.trim() ||
      doc.querySelector("h1")?.textContent?.trim() ||
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      "Untitled Hentai Comic";

    const tags: string[] = [];
    doc.querySelectorAll(".post-tags a").forEach((el) => {
      const name = el.textContent?.trim();
      if (name && !tags.includes(name)) tags.push(name);
    });

    let coverUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
    if (!coverUrl) {
      const firstImg = doc.querySelector(".fotos img");
      coverUrl = firstImg?.getAttribute("src") || firstImg?.getAttribute("data-lazy-src") || "";
    }

    // Extract page images
    const images: SourceContent["images"] = [];
    const fotoElements = doc.querySelectorAll(".fotos .foto");

    if (fotoElements.length > 0) {
      fotoElements.forEach((el, i) => {
        const a = el.querySelector("a.fancybox");
        let src = a?.getAttribute("href") || "";
        if (!src) {
          const img = el.querySelector("img");
          src = img?.getAttribute("src") || img?.getAttribute("data-lazy-src") || img?.getAttribute("data-src") || "";
        }
        if (src) {
          if (src.startsWith("//")) src = "https:" + src;
          images.push({
            url: src,
            pageNumber: i + 1,
          });
        }
      });
    } else {
      // Fallback
      doc.querySelectorAll(".fotos img").forEach((img, i) => {
        let src = img.getAttribute("src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-src") || "";
        if (src) {
          if (src.startsWith("//")) src = "https:" + src;
          images.push({
            url: src,
            pageNumber: i + 1,
          });
        }
      });
    }

    if (images.length === 0) {
      throw new Error("Could not extract images from Hentai Comics Free page");
    }

    return {
      images,
      metadata: {
        title,
        tags,
        coverUrl,
        sourceId: url,
        sourceUrl: url,
        mediaCount: images.length,
      },
    };
  }

  // ─── Series (Single album modeled as series with 1 chapter) ──

  async fetchSeries(url: string): Promise<SourceSeries> {
    const content = await this.fetchContent(url);

    return {
      title: content.metadata?.title || "Hentai Comic",
      description: content.metadata?.description || content.metadata?.tags?.join(", ") || "",
      coverUrl: content.metadata?.coverUrl || "",
      seriesUrl: url,
      source: "hentaicomicsfree.com",
      tags: content.metadata?.tags,
      chapters: [
        {
          id: url,
          number: "1",
          url: url,
          title: "Gallery",
          source: "hentaicomicsfree.com",
        },
      ],
    };
  }

  async fetchChapterFeed?(seriesId: string): Promise<SourceChapter[]> {
    return [
      {
        id: seriesId,
        number: "1",
        url: seriesId,
        title: "Gallery",
        source: "hentaicomicsfree.com",
      },
    ];
  }

  // ─── Search ───────────────────────────────────────────────────────

  async search(
    query: string,
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const page = options.page || 1;
    const searchUrl =
      page > 1
        ? `https://hentaicomicsfree.com/page/${page}/?s=${encodeURIComponent(query)}`
        : `https://hentaicomicsfree.com/?s=${encodeURIComponent(query)}`;

    return this.scrapeListing(searchUrl);
  }

  async searchByTags(
    tags: string[],
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const query = tags.map(t => t.replace(/_/g, " ")).join(" ");
    return this.search(query, options);
  }

  async fetchPopular(
    page?: number,
    _limit?: number,
  ): Promise<SourceSearchResult[]> {
    const actualPage = page || 1;
    const url =
      actualPage > 1
        ? `https://hentaicomicsfree.com/category/hentai/page/${actualPage}/`
        : `https://hentaicomicsfree.com/category/hentai/`;
    return this.scrapeListing(url);
  }

  async fetchLatest(
    page?: number,
    _limit?: number,
  ): Promise<SourceSearchResult[]> {
    const actualPage = page || 1;
    const url =
      actualPage > 1
        ? `https://hentaicomicsfree.com/category/hentai/page/${actualPage}/`
        : `https://hentaicomicsfree.com/category/hentai/`;
    return this.scrapeListing(url);
  }

  // ─── Internal ─────────────────────────────────────────────────────

  private async scrapeListing(url: string): Promise<SourceSearchResult[]> {
    try {
      const html = await invoke<string>("fetch_html", { url, headers: null });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const results: SourceSearchResult[] = [];

      doc.querySelectorAll(".video-conteudo").forEach((item) => {
        const a = item.querySelector("a.titulo") || item.querySelector(".thumb-conteudo a");
        const href = a?.getAttribute("href") || "";
        if (!href) return;

        const title =
          item.querySelector("h2")?.textContent?.trim() ||
          a.getAttribute("title")?.trim() ||
          "Untitled";

        const img = item.querySelector("img");
        let coverUrl =
          img?.getAttribute("data-lazy-src") || img?.getAttribute("src") || "";
        if (coverUrl.startsWith("//")) coverUrl = "https:" + coverUrl;

        const urlObj = new URL(href);
        const id = urlObj.pathname.replace(/^\/|\/$/g, "");

        // Avoid duplicates
        if (results.find((r) => r.id === id)) return;

        results.push({
          id,
          title,
          tags: ["hentai"],
          coverUrl,
          source: "hentaicomicsfree.com",
          contentType: "doujin",
          url: href,
        });
      });

      return results;
    } catch (e) {
      console.error(`[hentaicomicsfree] Failed to scrape listing ${url}:`, e);
      return [];
    }
  }
}
