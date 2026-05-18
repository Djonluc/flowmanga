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

export class BlueLockProvider implements SourceProvider {
  readonly id = "bluelock";
  readonly name = "Blue Lock Official";
  readonly domains = ["blue-lock-manga.com"];
  readonly contentType: ContentType = "manga";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["vertical"];

  readonly capabilities: SourceCapabilities = {
    search: false,
    tagSearch: false,
    seriesBrowse: true,
    chapterFeed: true,
    pagination: false,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    return url.includes("blue-lock-manga.com");
  }

  async fetchContent(url: string): Promise<SourceContent> {
    // Heal old/legacy chapter URLs that now dead-redirect to the homepage
    let targetUrl = url;
    const oldChapMatch = url.match(/chapter-(\d+(?:-\d+)?)/);
    if (oldChapMatch && !url.includes("/manga/blue-lock-chapter-")) {
      const chNum = oldChapMatch[1];
      targetUrl = `https://w45.blue-lock-manga.com/manga/blue-lock-chapter-${chNum}/`;
    }

    const html = await invoke<string>("fetch_html", { url: targetUrl, headers: null });

    // BlueLock uses lazy-loading with data-src for real image URLs
    const dataSrcMatches = [
      ...html.matchAll(/data-src=["']([^"']+)["']/gi),
    ];
    const images = dataSrcMatches
      .map((m) => m[1])
      .filter(
        (u) =>
          !u.includes("svg+xml") &&
          !u.includes("logo") &&
          !u.includes("favicon") &&
          !u.includes("gravatar") &&
          (u.includes(".jpg") || u.includes(".png") || u.includes(".webp")),
      );

    // Deduplicate
    const uniqueImages = [...new Set(images)];

    return {
      images: uniqueImages.map((u, i) => ({ url: u, pageNumber: i + 1 })),
      metadata: { sourceUrl: url },
    };
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    const html = await invoke<string>("fetch_html", { url, headers: null });

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : "Blue Lock";

    // Extract cover image
    let coverUrl = "";
    const coverMatch =
      html.match(
        /<img[^>]*data-src=["']([^"']+)["'][^>]*alt=["'][^"']*blue\s*lock[^"']*["']/i,
      ) ||
      html.match(
        /<img[^>]*src=["']([^"']+)["'][^>]*alt=["'][^"']*blue\s*lock[^"']*["']/i,
      );
    if (coverMatch) {
      coverUrl = coverMatch[1];
    }

    // Extract chapter links — BlueLock uses /manga/blue-lock-chapter-{N}/ pattern
    const chapterMatches = [
      ...html.matchAll(
        /href=["']([^"']*\/manga\/blue-lock-chapter-[^"']*)["']/gi,
      ),
    ];

    const seen = new Set<string>();
    const chapters: SourceChapter[] = [];

    for (const match of chapterMatches) {
      const href = match[1];
      if (seen.has(href)) continue;
      seen.add(href);

      // Extract chapter number — handle patterns like chapter-346-3 (sub-chapters)
      const numMatch = href.match(/chapter-(\d+(?:-\d+)?)/);
      const rawNum = numMatch ? numMatch[1] : "0";
      // Normalize sub-chapter: "346-3" → "346.3"
      const chNum = rawNum.replace("-", ".");

      // Try to extract title text from the anchor
      const titleRegex = new RegExp(
        `href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>([^<]*)`,
        "i",
      );
      const titleParsed = html.match(titleRegex);
      const chTitle = titleParsed
        ? titleParsed[1].trim() || `Chapter ${chNum}`
        : `Chapter ${chNum}`;

      chapters.push({
        id: href,
        number: chNum,
        url: href,
        title: chTitle,
        source: "blue-lock-manga.com",
      });
    }

    // Sort descending (latest first)
    chapters.sort((a, b) => parseFloat(b.number) - parseFloat(a.number));

    return {
      title,
      description:
        "After a disastrous defeat at the 2018 World Cup, Japan's team struggles to regroup. But what's missing? An absolute Ace Striker. The Football Union is hell-bent on creating a striker who hungers for goals and thirsts for victory.",
      coverUrl,
      seriesUrl: url,
      source: "blue-lock-manga.com",
      chapters,
    };
  }

  async fetchChapterFeed(seriesUrl: string): Promise<SourceChapter[]> {
    const series = await this.fetchSeries(seriesUrl);
    return series.chapters;
  }
}
