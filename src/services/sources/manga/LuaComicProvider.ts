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
  SourceSearchOptions,
} from "../types";

export class LuaComicProvider implements SourceProvider {
  readonly id = "luacomic";
  readonly name = "LuaComic";
  readonly domains = ["luacomic.org"];
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
    return url.includes("luacomic.org");
  }

  private getCleanCoverUrl(encoded: string): string {
    if (!encoded) return "";
    let clean = encoded;
    const start = encoded.indexOf("url=");
    if (start !== -1) {
      const rest = encoded.substring(start + 4);
      const end = rest.indexOf("&");
      const urlPart = end !== -1 ? rest.substring(0, end) : rest;
      try {
        clean = decodeURIComponent(urlPart);
      } catch (e) {
        clean = urlPart;
      }
    }
    if (clean.startsWith("//")) {
      clean = "https:" + clean;
    } else if (clean.startsWith("/")) {
      clean = "https://media.luacomic.org" + clean;
    }
    return clean;
  }

  async fetchContent(url: string): Promise<SourceContent> {
    try {
      const headers = {
        Referer: "https://luacomic.org/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      };
      const htmlText = await invoke<string>("fetch_html", { url, headers });

      // 1. Match standard chapter_data JSON
      const regexEscaped =
        /\\?"chapter_data\\?":\s*\{\s*\\?"images\\?":\s*\[\s*([\s\S]*?)\s*\]\s*\}/;
      const match = htmlText.match(regexEscaped);

      if (match && match[1]) {
        const arrayContent = match[1];
        const urls = arrayContent
          .split(",")
          .map((s) =>
            s
              .trim()
              .replace(/^\\?["']|\\?["']$/g, "")
              .replace(/\\/g, ""),
          )
          .filter(Boolean);
        if (urls.length > 0) {
          const cleanUrls = urls.map((u) => this.getCleanCoverUrl(u));
          console.log(
            `[LuaComic] Parsed ${cleanUrls.length} pages from HTML JSON block`,
          );
          return {
            images: cleanUrls.map((u, i) => ({ url: u, pageNumber: i + 1 })),
            metadata: { sourceUrl: url },
          };
        }
      }

      // 2. Match React Flight data arrays (Next.js 13+)
      const flightRegex =
        /(https:\/\/(media\.)?luacomic\.org\/file\/[^\/]+\/uploads\/series\/[^\"]+\.(webp|png|jpg|jpeg))/gi;
      const flightMatches = htmlText.match(flightRegex);
      if (flightMatches && flightMatches.length > 0) {
        // Remove duplicates and clean
        const uniqueUrls = Array.from(new Set(flightMatches)).map((u) =>
          this.getCleanCoverUrl(u),
        );
        console.log(
          `[LuaComic] Parsed ${uniqueUrls.length} pages from Flight payload`,
        );
        return {
          images: uniqueUrls.map((u, i) => ({ url: u, pageNumber: i + 1 })),
          metadata: { sourceUrl: url },
        };
      }

      // DOM preload fallback
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");
      const preloadUrls: string[] = [];
      doc.querySelectorAll("link[rel='preload'][as='image']").forEach((el) => {
        const href = el.getAttribute("href");
        if (
          href &&
          (href.includes("/uploads/series/") ||
            href.includes("media.luacomic.org"))
        ) {
          preloadUrls.push(this.getCleanCoverUrl(href));
        }
      });
      if (preloadUrls.length > 0) {
        console.log(
          `[LuaComic] Parsed ${preloadUrls.length} pages from preload tags`,
        );
        return {
          images: preloadUrls.map((u, i) => ({ url: u, pageNumber: i + 1 })),
          metadata: { sourceUrl: url },
        };
      }

      // DOM image fallback
      const imgUrls: string[] = [];
      doc
        .querySelectorAll("div.flex.flex-col.justify-center.items-center img")
        .forEach((el) => {
          const src = el.getAttribute("src") || "";
          const dataSrc = el.getAttribute("data-src") || "";
          const finalUrl = src.startsWith("data:") || !src ? dataSrc : src;
          if (finalUrl) {
            imgUrls.push(this.getCleanCoverUrl(finalUrl));
          }
        });
      if (imgUrls.length > 0) {
        console.log(
          `[LuaComic] Parsed ${imgUrls.length} pages from DOM images`,
        );
        return {
          images: imgUrls.map((u, i) => ({ url: u, pageNumber: i + 1 })),
          metadata: { sourceUrl: url },
        };
      }

      throw new Error("No images found in parsed HTML");
    } catch (apiError) {
      console.warn(
        `[LuaComic] Lightweight fetchContent failed, falling back to headless:`,
        apiError,
      );
      const images = await invoke<string[]>("scrape_images_headless", { url });
      const cleanImages = images.map((u) => this.getCleanCoverUrl(u));
      return {
        images: cleanImages.map((u, i) => ({ url: u, pageNumber: i + 1 })),
        metadata: { sourceUrl: url },
      };
    }
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    try {
      const slug = url.split("/series/").pop()?.split("?")[0] || "";
      if (!slug) throw new Error("Could not parse series slug from URL");

      const headers = { Referer: "https://luacomic.org/" };
      const htmlText = await invoke<string>("fetch_html", { url, headers });
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");

      const title = doc
        .querySelector("h1.text-foreground")
        ?.textContent?.trim();
      if (!title) throw new Error("Could not extract series title from page");

      const rawCover =
        doc
          .querySelector("div.rounded.overflow-hidden img")
          ?.getAttribute("src") || "";
      const coverUrl = this.getCleanCoverUrl(rawCover);
      const description =
        doc
          .querySelector("meta[name='description']")
          ?.getAttribute("content") || "";

      const chaptersUrl = `https://api.luacomic.org/chapter/all/${slug}`;
      const chText = await invoke<string>("fetch_html", {
        url: chaptersUrl,
        headers,
      });
      const chData = JSON.parse(chText) as any[];

      if (!Array.isArray(chData))
        throw new Error("Invalid chapter list response");

      const chapters = chData.map((ch: any, i: number) => {
        const chapterUrl = `https://luacomic.org/series/${slug}/${ch.chapter_slug}`;
        return {
          id: chapterUrl,
          number: (chData.length - i).toString(),
          url: chapterUrl,
          source: "luacomic.org",
        };
      });

      console.log(
        `[LuaComic] Lightweight series fetch succeeded, found ${chapters.length} chapters`,
      );
      return {
        title,
        description,
        coverUrl,
        seriesUrl: url,
        source: "luacomic.org",
        chapters,
      };
    } catch (apiError) {
      console.warn(
        `[LuaComic] Lightweight fetchSeries failed, falling back to headless:`,
        apiError,
      );
      console.log(`[LuaComic] Fetching series: ${url}`);
      const res = await invoke<any>("scrape_series_headless", { url });

      if (!res || !res.title) {
        throw new Error("Invalid response from scraper engine");
      }

      const chapters = (res.chapterLinks || []).map(
        (link: string, i: number) => ({
          id: link,
          number: (res.chapterLinks.length - i).toString(),
          url: link,
          source: "luacomic.org",
        }),
      );

      console.log(`[LuaComic] Found ${chapters.length} chapters via headless`);

      return {
        title: res.title,
        description: res.description,
        coverUrl: this.getCleanCoverUrl(res.cover_url),
        seriesUrl: url,
        source: "luacomic.org",
        chapters,
      };
    }
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
          coverUrl = coverUrl ? this.getCleanCoverUrl(coverUrl) : undefined;
          results.push({
            id: href,
            title: a.textContent?.trim() || "Manhua",
            source: defaultSource,
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
            coverUrl = coverUrl ? this.getCleanCoverUrl(coverUrl) : undefined;
            results.push({
              id: href,
              title: titleStr.trim(),
              source: defaultSource,
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

  private async queryApi(
    params: Record<string, string>,
  ): Promise<SourceSearchResult[]> {
    try {
      const url = `https://api.luacomic.org/query?${new URLSearchParams(params).toString()}`;
      const headers = {
        Referer: "https://luacomic.org/",
        Origin: "https://luacomic.org/",
      };
      const resText = await invoke<string>("fetch_html", { url, headers });
      const data = JSON.parse(resText);
      const items = data.data || [];
      return items.map((item: any) => {
        const coverUrl = this.getCleanCoverUrl(item.thumbnail);
        const seriesUrl = `https://luacomic.org/series/${item.series_slug}`;
        return {
          id: seriesUrl,
          title: item.title,
          source: "luacomic.org",
          contentType: "manga",
          url: seriesUrl,
          coverUrl,
          tags: ["Full Color", "Manhua"],
        };
      });
    } catch (e) {
      console.warn("[LuaComic] API query failed:", e);
      return [];
    }
  }

  async search(
    query: string,
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    return this.queryApi({
      page: page.toString(),
      perPage: limit.toString(),
      query_string: query,
      adult: "true",
    });
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
    return this.queryApi({
      page: page.toString(),
      perPage: limit.toString(),
      orderBy: "total_views",
      adult: "true",
    });
  }

  async fetchLatest(
    page: number = 1,
    limit: number = 20,
  ): Promise<SourceSearchResult[]> {
    return this.queryApi({
      page: page.toString(),
      perPage: limit.toString(),
      orderBy: "latest",
      adult: "true",
    });
  }
}
