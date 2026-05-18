import { invoke } from "@tauri-apps/api/core";
import type {
  SourceProvider,
  SourceContent,
  SourceSeries,
  SourceChapter,
  SourceCapabilities,
  ContentType,
  MediaType,
  MediaDomain,
  ReaderMode,
} from "../types";

export class DBMProvider implements SourceProvider {
  readonly id = "dbm";
  readonly name = "Dragon Ball Multiverse";
  readonly domains = ["dragonball-multiverse.com"];
  readonly contentType: ContentType = "manga";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["single"];

  readonly capabilities: SourceCapabilities = {
    search: false,
    tagSearch: false,
    seriesBrowse: true,
    chapterFeed: true,
    pagination: false,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    return url.includes("dragonball-multiverse.com");
  }

  async fetchContent(url: string): Promise<SourceContent> {
    // Extract language code
    const langMatch = url.match(/\.com\/([a-z]{2}(_[a-z]{2})?)\//i);
    const lang = langMatch ? langMatch[1] : "en";

    // Extract comic parameter
    const comicMatch = url.match(/[?&]comic=([^&]+)/);
    const comic = comicMatch ? comicMatch[1] : "page";

    // Extract chapter parameter
    const chapterMatch = url.match(/[?&]chapter=(\d+)/);
    const chapterNum = chapterMatch ? chapterMatch[1] : null;

    if (chapterNum) {
      // It's a chapter URL: Fetch chapters page to get all page links in this chapter
      const chaptersPageUrl = `https://www.dragonball-multiverse.com/${lang}/chapters.html?comic=${comic}`;
      const html = await invoke<string>("fetch_html", { url: chaptersPageUrl, headers: null });

      // Use robust regex split to isolate the chapter blocks (DBM HTML is highly malformed)
      const blocks = html.split(/<div[^>]*class\s*=\s*["'][^"']*\b(?:chapter-block)\b[^"']*["'][^>]*>/i);
      let matchedBlock: string | null = null;

      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const chMatch = block.match(/chapter=(\d+)/i);
        if (chMatch && chMatch[1] === chapterNum) {
          matchedBlock = block;
          break;
        }
      }

      // Sibling fallback search in case class names differ
      if (!matchedBlock) {
        for (let i = 1; i < blocks.length; i++) {
          const block = blocks[i];
          const h4Match = block.match(/<h4>(?:Chapter|Chap\.)\s*(\d+)/i);
          if (h4Match && h4Match[1] === chapterNum) {
            matchedBlock = block;
            break;
          }
        }
      }

      if (!matchedBlock) {
        throw new Error(`Chapter ${chapterNum} not found in DBM listing`);
      }

      // Extract all hrefs matching page-X.html
      const pageMatches = [...matchedBlock.matchAll(/href\s*=\s*["']([^"']*page-[^"']*\.html)["']/gi)];
      const pageUrls = pageMatches
        .map((m) => {
          const href = m[1];
          const cleanHref = href.startsWith("/") ? href : `/${lang}/${href}`;
          return `https://www.dragonball-multiverse.com${cleanHref}`;
        })
        .filter((val, index, self) => self.indexOf(val) === index); // Deduplicate

      if (pageUrls.length === 0) {
        throw new Error(`No pages found in DBM Chapter ${chapterNum}`);
      }

      // Fetch each page HTML and parse its image in parallel
      const pagePromises = pageUrls.map(async (pageUrl, index) => {
        try {
          const pageHtml = await invoke<string>("fetch_html", { url: pageUrl, headers: null });

          // Extract image URL using robust regex fallback
          const imgMatch =
            pageHtml.match(/<img[^>]*src\s*=\s*["']([^"']*image\.php[^"']*)["']/i) ||
            pageHtml.match(/id\s*=\s*["']balloonsimg["'][^>]*src\s*=\s*["']([^"']+)["']/i) ||
            pageHtml.match(/id\s*=\s*["']manga_page["'][^>]*src\s*=\s*["']([^"']+)["']/i) ||
            pageHtml.match(/<img[^>]*src\s*=\s*["']([^"']*\/imgs\/[^"']*)["']/i);

          let src = imgMatch ? imgMatch[1] : "";

          if (src && !src.startsWith("http")) {
            src = src.startsWith("/")
              ? `https://www.dragonball-multiverse.com${src}`
              : `https://www.dragonball-multiverse.com/${lang}/${src}`;
          }

          return { url: src, pageNumber: index + 1 };
        } catch (err) {
          console.error(`Failed to parse DBM page image at ${pageUrl}:`, err);
          return { url: "", pageNumber: index + 1 };
        }
      });

      const pages = await Promise.all(pagePromises);
      const validPages = pages.filter((p) => p.url !== "");

      return {
        images: validPages,
        metadata: { sourceUrl: url, chapterNum },
      };
    } else {
      // It's a single page URL (fallback or direct read)
      const pageHtml = await invoke<string>("fetch_html", { url, headers: null });
      const imgMatch =
        pageHtml.match(/<img[^>]*src\s*=\s*["']([^"']*image\.php[^"']*)["']/i) ||
        pageHtml.match(/id\s*=\s*["']balloonsimg["'][^>]*src\s*=\s*["']([^"']+)["']/i) ||
        pageHtml.match(/id\s*=\s*["']manga_page["'][^>]*src\s*=\s*["']([^"']+)["']/i);

      let src = imgMatch ? imgMatch[1] : "";

      if (src && !src.startsWith("http")) {
        src = src.startsWith("/")
          ? `https://www.dragonball-multiverse.com${src}`
          : `https://www.dragonball-multiverse.com/${lang}/${src}`;
      }

      return {
        images: src ? [{ url: src, pageNumber: 1 }] : [],
        metadata: { sourceUrl: url },
      };
    }
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    // Map read.html to chapters.html
    let targetUrl = url;
    if (url.includes("read.html")) {
      targetUrl = url.replace("read.html", "chapters.html?comic=page");
    }

    // Extract language code
    const langMatch = targetUrl.match(/\.com\/([a-z]{2}(_[a-z]{2})?)\//i);
    const lang = langMatch ? langMatch[1] : "en";

    // Extract comic parameter
    const comicMatch = targetUrl.match(/[?&]comic=([^&]+)/);
    const comic = comicMatch ? comicMatch[1] : "page";

    const chaptersPageUrl = targetUrl.includes("chapters.html")
      ? targetUrl
      : `https://www.dragonball-multiverse.com/${lang}/chapters.html?comic=${comic}`;

    const html = await invoke<string>("fetch_html", { url: chaptersPageUrl, headers: null });

    let title = "Dragon Ball Multiverse";
    if (comic !== "page") {
      title = `${title} - ${comic.charAt(0).toUpperCase() + comic.slice(1)}`;
    }

    // Extract title from HTML dynamically
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const parsedTitle = titleMatch[1].replace("DB Multiverse -", "").trim();
      if (parsedTitle && parsedTitle !== "DBMultiverse" && comic === "page") {
        title = parsedTitle;
      }
    }

    let coverUrl = "";
    const coverMatch = html.match(/<img[^>]*src\s*=\s*["']([^"']*image\.php[^"']*)["']/i);
    if (coverMatch) {
      const src = coverMatch[1].replace(/&amp;/g, "&");
      coverUrl = src.startsWith("http") ? src : `https://www.dragonball-multiverse.com${src}`;
    }

    const chapters: SourceChapter[] = [];

    // Parse chapters using ultra-robust regex split
    const blocks = html.split(/<div[^>]*class\s*=\s*["'][^"']*\b(?:chapter-block)\b[^"']*["'][^>]*>/i);

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];

      // Extract h4 (title)
      const h4Match = block.match(/<h4>([^<]+)<\/h4>/i);
      const rawTitle = h4Match ? h4Match[1].trim() : "";
      if (!rawTitle) continue;

      // Extract chapter number from href or h4
      const chMatch = block.match(/chapter=(\d+)/i) || rawTitle.match(/(?:Chapter|Chap\.)\s*(\d+)/i);
      if (!chMatch) continue;

      const chNum = chMatch[1];
      const chTitle = rawTitle
        .replace(/&amp;/g, "&")
        .replace(/&#039;/g, "'")
        .trim();

      const chapterUrl = `https://www.dragonball-multiverse.com/${lang}/chapters.html?comic=${comic}&chapter=${chNum}`;

      chapters.push({
        id: chapterUrl,
        number: chNum,
        url: chapterUrl,
        title: chTitle,
        source: "dragonball-multiverse.com",
      });
    }

    // Sort chapters descending (latest first)
    chapters.sort((a, b) => parseFloat(b.number) - parseFloat(a.number));

    return {
      title,
      description: "The sequel to Dragon Ball Z created by fans, featuring 20 different timelines meeting in a multiverse tournament.",
      coverUrl,
      seriesUrl: targetUrl,
      source: "dragonball-multiverse.com",
      chapters,
    };
  }
}
