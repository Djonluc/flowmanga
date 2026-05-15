/**
 * nhentai Source Provider
 *
 * Doujin/gallery source. Each gallery is a self-contained album
 * with N pages — no chapters, no series hierarchy.
 *
 * URL Patterns:
 *   Gallery: https://nhentai.net/g/{id}/
 *   Page:    https://nhentai.net/g/{id}/{page}/
 *   Search:  https://nhentai.net/search?q={query}
 *
 * Image Patterns:
 *   Thumbnail: https://t.nhentai.net/galleries/{media_id}/{page}t.{ext}
 *   Full:      https://i.nhentai.net/galleries/{media_id}/{page}.{ext}
 *
 * Content is modeled as a doujin (single album, opt-in Library save).
 */

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

// nhentai uses single-letter media type codes
const MEDIA_EXT_MAP: Record<string, string> = {
  j: "jpg",
  p: "png",
  g: "gif",
  w: "webp",
};

export class NhentaiProvider implements SourceProvider {
  readonly id = "nhentai";
  readonly name = "NHentai";
  readonly domains = ["nhentai.net"];
  readonly contentType: ContentType = "doujin";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly category: ProviderCategory = "doujin";
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
    const galleryId = this.extractGalleryId(url);
    if (!galleryId)
      throw new Error("Could not extract gallery ID from nhentai URL");

    // Fetch the gallery page HTML
    const galleryUrl = `https://nhentai.net/g/${galleryId}/`;
    const html = await invoke<string>("fetch_html", {
      url: galleryUrl,
      headers: null,
    });
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Extract metadata
    const title =
      doc.querySelector("h1.title span.pretty")?.textContent?.trim() ||
      doc.querySelector("h1")?.textContent?.trim() ||
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      `Gallery ${galleryId}`;

    // Extract tags
    const tags: string[] = [];
    doc.querySelectorAll("a.tag span.name").forEach((el) => {
      const name = el.textContent?.trim();
      if (name) tags.push(name);
    });

    // Extract cover
    const coverEl = doc.querySelector("#cover img");
    const coverUrl =
      coverEl?.getAttribute("data-src") || coverEl?.getAttribute("src") || "";

    // Extract image URLs from thumbnail container
    const images: SourceContent["images"] = [];
    const thumbContainer = doc.querySelectorAll(
      "#thumbnail-container img, .gallerythumb img, .thumb-container img",
    );

    if (thumbContainer.length > 0) {
      thumbContainer.forEach((img, i) => {
        const thumbSrc =
          img.getAttribute("data-src") || img.getAttribute("src") || "";
        if (!thumbSrc) return;

        // Convert thumbnail URL to full-size URL
        // Thumb: https://t.nhentai.net/galleries/{media_id}/{page}t.{ext}
        // Full:  https://i.nhentai.net/galleries/{media_id}/{page}.{ext}
        const fullUrl = thumbSrc
          .replace("//t.nhentai", "//i.nhentai")
          .replace("//t2.nhentai", "//i2.nhentai")
          .replace("//t3.nhentai", "//i3.nhentai")
          .replace(/(\d+)t\.(jpg|jpeg|png|gif|webp)$/i, "$1.$2");

        images.push({
          url: fullUrl,
          pageNumber: i + 1,
        });
      });
    }

    // Fallback: try to extract from script tags (JSON gallery data)
    if (images.length === 0) {
      const scriptData = this.extractGalleryJson(doc);
      if (scriptData) {
        const mediaId = scriptData.media_id;
        const pages = scriptData.images?.pages || [];
        pages.forEach((page: any, i: number) => {
          const ext = MEDIA_EXT_MAP[page.t] || "jpg";
          images.push({
            url: `https://i.nhentai.net/galleries/${mediaId}/${i + 1}.${ext}`,
            pageNumber: i + 1,
          });
        });
      }
    }

    if (images.length === 0) {
      throw new Error("Could not extract images from nhentai gallery");
    }

    return {
      images,
      metadata: {
        title,
        tags,
        coverUrl,
        sourceId: galleryId,
        sourceUrl: galleryUrl,
        mediaCount: images.length,
      },
    };
  }

  // ─── Series (Doujin = single album modeled as series with 1 chapter) ──

  async fetchSeries(url: string): Promise<SourceSeries> {
    const content = await this.fetchContent(url);
    const galleryId = this.extractGalleryId(url) || "unknown";

    return {
      title: content.metadata?.title || `Gallery ${galleryId}`,
      description: content.metadata?.tags?.join(", ") || "",
      coverUrl: content.metadata?.coverUrl || "",
      seriesUrl: url,
      source: "nhentai.net",
      tags: content.metadata?.tags,
      chapters: [
        {
          id: url,
          number: "1",
          url: url,
          title: "Gallery",
          source: "nhentai.net",
        },
      ],
    };
  }

  // ─── Search ───────────────────────────────────────────────────────

  async search(
    query: string,
    page: number = 1,
    _limit?: number,
  ): Promise<SourceSearchResult[]> {
    const searchUrl = `https://nhentai.net/search?q=${encodeURIComponent(query)}&page=${page}`;

    try {
      const html = await invoke<string>("fetch_html", {
        url: searchUrl,
        headers: null,
      });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const results: SourceSearchResult[] = [];

      doc.querySelectorAll('a[href*="/g/"]').forEach((a) => {
        const href = a.getAttribute("href") || "";
        const idMatch = href.match(/\/g\/(\d+)/);
        if (!idMatch) return;

        const title =
          a.querySelector(".caption")?.textContent?.trim() ||
          a.textContent?.trim() ||
          "";
        if (!title || title.length < 3) return;

        const coverImg = a.querySelector("img");
        const coverUrl =
          coverImg?.getAttribute("data-src") ||
          coverImg?.getAttribute("src") ||
          "";

        // Extract tags from the gallery element
        const tags: string[] = [];
        a.querySelectorAll(".tag").forEach((tagEl) => {
          const tagName = tagEl.textContent?.trim();
          if (tagName) tags.push(tagName);
        });

        // Also check for tags in the parent container
        const container = a.closest(".gallery");
        if (container) {
          container.querySelectorAll(".tag").forEach((tagEl) => {
            const tagName = tagEl.textContent?.trim();
            if (tagName && !tags.includes(tagName)) tags.push(tagName);
          });
        }

        // Fallback: check title for common indicators
        if (
          title.toLowerCase().includes("color") ||
          title.toLowerCase().includes("colored")
        ) {
          if (!tags.some((t) => t.toLowerCase().includes("color")))
            tags.push("full color");
        }

        // Avoid duplicates
        if (results.find((r) => r.id === idMatch[1])) return;

        results.push({
          id: idMatch[1],
          title,
          tags,
          coverUrl,
          source: "nhentai.net",
          contentType: "doujin",
          url: `https://nhentai.net/g/${idMatch[1]}/`,
        });
      });

      return results;
    } catch (e) {
      console.error("[nhentai] Search failed:", e);
      return [];
    }
  }

  async searchByTags(
    tags: string[],
    page: number = 1,
    _limit?: number,
  ): Promise<SourceSearchResult[]> {
    // nhentai tag search is just a regular search with tags as query terms
    const query = tags.join(" ");
    return this.search(query, page);
  }

  async fetchPopular(
    _page?: number,
    _limit?: number,
    coloredOnly: boolean = false,
  ): Promise<SourceSearchResult[]> {
    const results = await this.scrapeListing("https://nhentai.net/popular");
    if (coloredOnly) {
      return results.filter((r) =>
        (r.tags || []).some((t) => t.toLowerCase().includes("color")),
      );
    }
    return results;
  }

  async fetchLatest(
    _page?: number,
    _limit?: number,
    coloredOnly: boolean = false,
  ): Promise<SourceSearchResult[]> {
    const results = await this.scrapeListing("https://nhentai.net/go");
    if (coloredOnly) {
      return results.filter((r) =>
        (r.tags || []).some((t) => t.toLowerCase().includes("color")),
      );
    }
    return results;
  }

  private async scrapeListing(url: string): Promise<SourceSearchResult[]> {
    try {
      const html = await invoke<string>("fetch_html", { url, headers: null });
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const results: SourceSearchResult[] = [];

      doc.querySelectorAll('a[href*="/g/"]').forEach((a) => {
        const href = a.getAttribute("href") || "";
        const idMatch = href.match(/\/g\/(\d+)/);
        if (!idMatch) return;

        const title =
          a.querySelector(".caption")?.textContent?.trim() ||
          a.textContent?.trim() ||
          "";
        if (!title || title.length < 3) return;

        const coverImg = a.querySelector("img");
        const coverUrl =
          coverImg?.getAttribute("data-src") ||
          coverImg?.getAttribute("src") ||
          "";

        // Extract tags from the gallery link element
        const tags: string[] = [];
        a.querySelectorAll(".tag").forEach((tagEl) => {
          const tagName = tagEl.textContent?.trim();
          if (tagName) tags.push(tagName);
        });

        // Fallback: check title for common indicators
        if (
          title.toLowerCase().includes("color") ||
          title.toLowerCase().includes("colored")
        ) {
          if (!tags.includes("full color")) tags.push("full color");
        }

        // Avoid duplicates
        if (results.find((r) => r.id === idMatch[1])) return;

        results.push({
          id: idMatch[1],
          title,
          tags,
          coverUrl,
          source: "nhentai.net",
          contentType: "doujin",
          url: `https://nhentai.net/g/${idMatch[1]}/`,
        });
      });

      return results;
    } catch (e) {
      console.error(`[nhentai] Failed to scrape listing ${url}:`, e);
      return [];
    }
  }

  // ─── Internal ─────────────────────────────────────────────────────

  private extractGalleryId(url: string): string | null {
    const match = url.match(/\/g\/(\d+)/);
    return match ? match[1] : null;
  }

  private extractGalleryJson(doc: Document): any | null {
    // nhentai embeds gallery data in a script tag as JSON
    const scripts = doc.querySelectorAll("script");
    for (const script of Array.from(scripts)) {
      const content = script.textContent || "";
      // Look for the gallery JSON object
      const match = content.match(
        /window\._gallery\s*=\s*JSON\.parse\("(.+?)"\)/,
      );
      if (match) {
        try {
          const decoded = match[1]
            .replace(/\\u0022/g, '"')
            .replace(/\\\\/g, "\\");
          return JSON.parse(decoded);
        } catch {
          /* continue */
        }
      }
      // Alternative pattern
      const match2 = content.match(/gallery\s*:\s*(\{.+?\})\s*[,;]/);
      if (match2) {
        try {
          return JSON.parse(match2[1]);
        } catch {
          /* continue */
        }
      }
    }
    return null;
  }
}
