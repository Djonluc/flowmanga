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
} from "../types";

export class MangaDotProvider implements SourceProvider {
  readonly id = "mangadot";
  readonly name = "MangaDot";
  readonly domains = ["mangadot.net"];
  readonly contentType: ContentType = "manga";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["vertical", "single"];

  readonly capabilities: SourceCapabilities = {
    search: false,
    tagSearch: false,
    seriesBrowse: false,
    chapterFeed: false,
    pagination: false,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    return url.includes("mangadot.net");
  }

  async fetchContent(url: string): Promise<SourceContent> {
    try {
      console.log(`[MangaDot] Fetching chapter via headless Chrome: ${url}`);
      // Mangadot uses aggressive Cloudflare, so we rely on the Rust headless Chrome scraper
      const images = await invoke<string[]>("scrape_images_headless", { url });
      
      if (!images || images.length === 0) {
        throw new Error("No images found. Cloudflare might have blocked the request.");
      }

      return {
        images: images.map((u, i) => ({ url: u, pageNumber: i + 1 })),
        metadata: { sourceUrl: url },
      };
    } catch (error) {
      console.error("[MangaDot] Error fetching content:", error);
      throw error;
    }
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    try {
      console.log(`[MangaDot] Fetching series via headless Chrome: ${url}`);
      const res = await invoke<any>("scrape_series_headless", { url });

      if (!res || !res.title) {
        throw new Error("Invalid response from headless scraper. Cloudflare might have blocked the request.");
      }

      const chapters = (res.chapterLinks || []).map(
        (link: string, i: number) => ({
          id: link,
          // Guessing chapter number based on URL or index
          number: link.match(/chapter-(\d+(\.\d+)?)/)?.[1] || (res.chapterLinks.length - i).toString(),
          url: link,
          source: "mangadot.net",
        }),
      );

      return {
        title: res.title,
        description: res.description || "",
        coverUrl: res.cover_url || "",
        seriesUrl: url,
        source: "mangadot.net",
        chapters,
      };
    } catch (error) {
      console.error("[MangaDot] Error fetching series:", error);
      throw error;
    }
  }

  async search(
    query: string,
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    return [];
  }
}
