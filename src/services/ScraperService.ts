import { invoke } from "@tauri-apps/api/core";

export interface ScrapedImage {
  url: string;
  pageNumber: number;
}

interface SiteConfig {
  domain: string;
  imageSelector: string;
  imageAttr: string;
  containerSelector?: string;
  isVerticalWebtoon: boolean;
}

const siteConfigs: Record<string, SiteConfig> = {
  default: {
    domain: "",
    imageSelector: "img",
    imageAttr: "src",
    isVerticalWebtoon: false,
  },
  "luacomic.org": {
    domain: "luacomic.org",
    imageSelector: "div.flex.flex-col img, img.w-full",
    imageAttr: "src",
    isVerticalWebtoon: true,
  },
};

export interface SeriesScrapedChapter {
  id: string;
  number: string;
  url: string;
  title?: string;
  source?: string;
}

export interface SeriesScrapeResult {
  title: string;
  description: string;
  coverUrl: string;
  chapters: SeriesScrapedChapter[];
  source: string;
  seriesUrl: string;
  tags?: string[];
}

export interface ScrapeResult {
  images?: ScrapedImage[];
  series?: SeriesScrapeResult;
  metadata?: {
    title?: string;
    coverUrl?: string;
    chapterTitle?: string;
    description?: string;
    mangaId?: string;
    author?: string;
    tags?: string[];
  };
}

export class ScraperService {
  static async asyncFetchHtml(
    url: string,
    headers: Record<string, string> | null = null,
  ): Promise<string> {
    return await invoke<string>("fetch_html", { url, headers });
  }

  static async scrapeChapter(url: string): Promise<ScrapeResult> {
    // console.log(`[Scraper] Fetching ${url}...`);
    
    // Robustness: Handle raw UUIDs (e.g. from broken metadata)
    let targetUrl = url;
    if (url.match(/^[a-f0-9-]{36}$/i)) {
      // console.log(`[Scraper] Raw UUID detected: ${url}. Assuming MangaDex.`);
      targetUrl = `https://mangadex.org/chapter/${url}`;
    }

    const domain = new URL(targetUrl).hostname.replace("www.", "");

    try {
      // Specialized Strategy: MangaDex API (Official Support)
      if (domain.includes("mangadex.org")) {
        return await this.scrapeMangaDex(targetUrl);
      }

      if (domain.includes("luacomic.org")) {
        return await this.scrapeLuaComic(url);
      }

      // 0. Auto-detect Series Pages for Headless sites
      if (
        url.includes("/series/") ||
        url.includes("/manga/") ||
        url.includes("/title/")
      ) {
        // If it's not obviously a chapter (no "/chapter-" or similar in some cases),
        // try series scraping first if we have no images
        // console.log(
        //   "[Scraper] Potential series page detected. Trying headless series scrape...",
        // );
        try {
          const seriesResult = await invoke<any>("scrape_series_headless", {
            url,
          });
          if (seriesResult && seriesResult.chapterLinks?.length > 0) {
            return {
              series: {
                title: seriesResult.title,
                description: seriesResult.description,
                coverUrl: seriesResult.cover_url,
                seriesUrl: url,
                source: domain,
                chapters: seriesResult.chapterLinks.map(
                  (link: string, i: number) => {
                    // Try to extract chapter number from URL
                    const numMatch = link.match(/chapter-(\d+(\.\d+)?)/);
                    const num = numMatch
                      ? numMatch[1]
                      : (seriesResult.chapterLinks.length - i).toString();
                    return {
                      id: link,
                      number: num,
                      url: link,
                      source: domain,
                    };
                  },
                ),
              },
            };
          }
        } catch (e) {
          console.warn(
            "[Scraper] Headless series scrape failed, falling back to chapter/generic:",
            e,
          );
        }
      }

      // 1. Fetch HTML via Rust Backend (Avoids CORS for generic sites)
      const html = await this.asyncFetchHtml(url);

      const config =
        siteConfigs[domain] ||
        siteConfigs[
          Object.keys(siteConfigs).find((k) => domain.includes(k)) || ""
        ];

      const images: ScrapedImage[] = [];

      // Helper: checks if url looks like a content image
      const isContentImage = (src: string) => {
        return (
          !src.includes("logo") &&
          !src.includes("icon") &&
          !src.includes("avatar") &&
          (src.includes("uploads") ||
            src.includes("chapter") ||
            src.match(/\.(jpg|jpeg|png|webp)/i))
        );
      };

      // Strategy A: Next.js Hydra Data (Often contains highest res)
      const nextDataRegex =
        /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/;
      const nextDataMatch = html.match(nextDataRegex);

      if (nextDataMatch && nextDataMatch[1]) {
        try {
          const jsonData = JSON.parse(nextDataMatch[1]);
          // console.log("[Scraper] Found Next.js Data");

          const findImagesInObject = (obj: any): string[] => {
            let results: string[] = [];
            if (!obj) return results;

            if (Array.isArray(obj)) {
              obj.forEach(
                (item) => (results = results.concat(findImagesInObject(item))),
              );
            } else if (typeof obj === "object") {
              if (
                obj.url &&
                typeof obj.url === "string" &&
                isContentImage(obj.url)
              ) {
                results.push(obj.url);
              }
              Object.keys(obj).forEach((key) => {
                results = results.concat(findImagesInObject(obj[key]));
              });
            }
            return results;
          };

          const foundUrls = findImagesInObject(jsonData);
          foundUrls.forEach((inputUrl, index) => {
            // Fix relative URLs from JSON
            let fullUrl = inputUrl;
            if (inputUrl.startsWith("/")) {
              const origin = new URL(url).origin;
              fullUrl = `${origin}${inputUrl}`;
            }
            images.push({ url: fullUrl, pageNumber: index + 1 });
          });
        } catch (e) {
          console.error("[Scraper] Failed to parse Next.js data", e);
        }
      }

      // Strategy B: DOM Parsing (More robust than Regex)
      if (images.length === 0) {
        // console.log(
        //   "[Scraper] Strategy A failed/empty. Using Site Config / DOM Strategy.",
        // );

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        let scope: Element | Document = doc;
        if (config?.containerSelector) {
          const container = doc.querySelector(config.containerSelector);
          if (container) scope = container;
        }

        const selector = config?.imageSelector || "img";
        const imgElements = Array.from(scope.querySelectorAll(selector));

        imgElements.forEach((img) => {
          const element = img as HTMLImageElement;
          // Logic: Check config attr -> src -> data-src
          let src = config?.imageAttr
            ? element.getAttribute(config.imageAttr)
            : null;
          if (!src || src.trim() === "") src = element.getAttribute("src");
          if (!src || src.trim() === "") src = element.getAttribute("data-src");
          if (!src || src.trim() === "")
            src = element.getAttribute("data-lazy-src");
          if (!src || src.trim() === "")
            src = element.getAttribute("data-original");
          if (!src || src.trim() === "")
            src = element.getAttribute("data-lazy");

          if (src && isContentImage(src)) {
            // Resolve relative URLs
            if (src.startsWith("/")) {
              const origin = new URL(url).origin;
              src = `${origin}${src}`;
            } else if (!src.startsWith("http")) {
              // Handle weird relative paths or protocol relative
              if (src.startsWith("//")) {
                src = `https:${src}`;
              }
            }

            images.push({ url: src, pageNumber: images.length + 1 });
          }
        });
      }

      // Remove duplicates
      const uniqueImages = Array.from(
        new Map(images.map((item) => [item.url, item])).values(),
      );

      if (uniqueImages.length === 0) {
        // console.log(
        //   "[Scraper] Strategies A & B failed. Attempting Strategy C: Hidden Window...",
        // );
        return await this.scrapeViaWindow(url);
      }

      return { images: uniqueImages };
    } catch (error) {
      console.error("[Scraper] Error:", error);
      throw error;
    }
  }

  static sanitizeFilename(name: string): string {
    return name
      .replace(/[/\?%*:|"<>]/g, "_")
      .trim()
      .slice(0, 100);
  }

  static async getMangaDetails(mangaId: string): Promise<{
    title: string;
    description: string;
    author?: string;
    tags: string[];
    coverUrl?: string;
  }> {
    const res = await fetch(
      `https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
    );
    if (!res.ok) throw new Error("Failed to fetch manga details");

    const json = await res.json();
    const attrs = json.data.attributes;

    // Prefer English, fallback to first available
    const titleObj = attrs.title;
    const title =
      titleObj.en || titleObj[Object.keys(titleObj)[0]] || "Untitled";

    const descObj = attrs.description;
    const description =
      descObj?.en ||
      descObj?.[Object.keys(descObj)[0]] ||
      "No description available";

    const authorRel = json.data.relationships.find(
      (r: any) => r.type === "author" || r.type === "artist",
    );
    const author = authorRel?.attributes?.name;

    const tags = attrs.tags
      .map((t: any) => t.attributes.name.en)
      .filter(Boolean);

    const coverRel = json.data.relationships.find(
      (r: any) => r.type === "cover_art",
    );
    const fileName = coverRel?.attributes?.fileName;
    const coverUrl = fileName
      ? `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`
      : undefined;

    return { title, description, author, tags, coverUrl };
  }

  static async getChapterFeed(mangaId: string): Promise<any[]> {
    const allChapters: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const feedUrl =
        `https://api.mangadex.org/manga/${mangaId}/feed?` +
        `translatedLanguage[]=en&limit=${limit}&offset=${offset}&` +
        `order[chapter]=asc&` +
        `includes[]=scanlation_group`;

      const res = await fetch(feedUrl);
      if (!res.ok) throw new Error("Failed to fetch chapter feed");

      const feed = await res.json();
      if (feed.result !== "ok" || !feed.data?.length) break;

      allChapters.push(...feed.data);
      offset += limit;

      if (offset >= feed.total) break;
    }

    // console.log(
    //   `[Scraper] Fetched ${allChapters.length} chapters total (Ascending)`,
    // );
    return allChapters;
  }

  private static async scrapeMangaDex(inputUrl: string): Promise<ScrapeResult> {
    // console.log("[Scraper] Handling MangaDex URL:", inputUrl);

    const mangaIdMatch = inputUrl.match(
      /mangadex\.org\/title\/([a-f0-9-]{36})/,
    );
    const chapterIdMatch = inputUrl.match(
      /mangadex\.org\/chapter\/([a-f0-9-]{36})/,
    );

    let chapterId: string | null = null;
    let resultMetadata: ScrapeResult["metadata"] = undefined;

    try {
      if (chapterIdMatch) {
        chapterId = chapterIdMatch[1];
        const chapRes = await fetch(
          `https://api.mangadex.org/chapter/${chapterId}?includes[]=manga`,
        );
        const chapData = await chapRes.json();

        if (chapData.result === "error" || !chapData.data) {
           // If we have a composite ID fallback, we should try searching the feed
           if (inputUrl.includes('-')) {
              // console.log("[Scraper] Chapter ID failed, trying composite search...");
              const lastPart = inputUrl.split('/').pop() || "";
              const match = lastPart.match(/^([a-f0-9-]{36})-(.+)$/);
              if (match) {
                  const mId = match[1];
                  const chNum = match[2];
                  const feed = await this.getChapterFeed(mId);
                  const found = feed.find(c => c.attributes.chapter === chNum);
                  if (found) {
                      chapterId = found.id;
                      // Recursively call or continue with new ID
                      return await this.scrapeMangaDex(`https://mangadex.org/chapter/${chapterId}`);
                  }
              }
           }
           throw new Error(chapData.errors?.[0]?.detail || "Chapter not found on MangaDex");
        }

        const mangaRel = chapData.data.relationships.find(
          (r: any) => r.type === "manga",
        );
        if (mangaRel) {
          const mId = mangaRel.id;
          const { title, description, coverUrl, author, tags } =
            await this.getMangaDetails(mId);

          const chapterAttribs = chapData.data.attributes;
          const chapterNum = chapterAttribs.chapter;
          const chapTitle = chapterAttribs.title
            ? `: ${chapterAttribs.title}`
            : "";

          resultMetadata = {
            title: title,
            coverUrl: coverUrl,
            description: description,
            mangaId: mId,
            author,
            tags,
            chapterTitle: `Chapter ${chapterNum}${chapTitle}`,
          };
        }
      } else if (mangaIdMatch) {
        const mId = mangaIdMatch[1];
        const { title, description, coverUrl, author, tags } =
          await this.getMangaDetails(mId);
        const feed = await this.getChapterFeed(mId);

        if (feed.length > 0) {
          // Default to latest chapter for the preview (last in ascending list)
          const latestChapter = feed[feed.length - 1];
          chapterId = latestChapter.id;
          const chapterAttribs = latestChapter.attributes;
          const chapterNum = chapterAttribs.chapter;
          const chapTitle = chapterAttribs.title
            ? `: ${chapterAttribs.title}`
            : "";

          resultMetadata = {
            title: title,
            coverUrl: coverUrl,
            description: description,
            mangaId: mId,
            author,
            tags,
            chapterTitle: `Chapter ${chapterNum}${chapTitle}`,
          };
        } else {
          throw new Error(
            "No English chapters found on MangaDex for this series.",
          );
        }
      } else {
        throw new Error("Invalid MangaDex URL format.");
      }

      // Fetch image server info
      const atHomeRes = await fetch(
        `https://api.mangadex.org/at-home/server/${chapterId}`,
      );
      const atHome = await atHomeRes.json();

      if (atHome.result !== "ok") {
        throw new Error("Failed to get chapter server: " + atHome.result);
      }

      const { baseUrl, chapter } = atHome;
      const imageUrls = chapter.data.map((file: string, index: number) => ({
        url: `${baseUrl}/data/${chapter.hash}/${file}`,
        pageNumber: index + 1,
      }));

      // console.log(`[MangaDex] Found ${imageUrls.length} pages`);
      return {
        images: imageUrls,
        metadata: resultMetadata,
      };
    } catch (error) {
      console.error("[MangaDex Scraper] Error:", error);
      throw error;
    }
  }

  private static async scrapeViaWindow(url: string): Promise<ScrapeResult> {
    // console.log("[Scraper] Using Rust Headless Scraper...");
    try {
      const imageUrls = await invoke<string[]>("scrape_images_headless", {
        url,
      });

      if (!imageUrls || imageUrls.length === 0) {
        throw new Error("Headless scraper found no images.");
      }

      // console.log(
      //   `[Scraper] Found ${imageUrls.length} images via Headless Chrome`,
      // );

      return {
        images: imageUrls.map((src, i) => ({
          url: src,
          pageNumber: i + 1,
        })),
      };
    } catch (e) {
      console.error("[Scraper] Headless scrape failed:", e);
      throw new Error(`Headless scrape failed: ${(e as any).toString()}`);
    }
  }

  private static async scrapeLuaComic(url: string): Promise<ScrapeResult> {
    // console.log("[LuaComic] Starting:", url);
    const domain = "luacomic.org";

    try {
      // 1. Try static fetch first
      const html = await this.asyncFetchHtml(url, {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Referer: "https://luacomic.org/",
      });

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const isChapter = url.includes("/chapter-");

      if (isChapter) {
        // Chapter Level
        const images: ScrapedImage[] = [];
        const imgEls = doc.querySelectorAll(
          'img[src*="media.luacomic.org"], img[src*="luacomic.org"]',
        );
        imgEls.forEach((img) => {
          const element = img as HTMLImageElement;
          const src = element.getAttribute("src") || element.src;
          if (src && /\.(jpg|png|webp|jpeg)$/i.test(src)) {
            images.push({ url: src, pageNumber: images.length + 1 });
          }
        });

        if (images.length === 0) throw new Error("No images found via static");

        return { images };
      } else {
        // Series Level
        const title =
          doc.querySelector("h1")?.textContent?.trim() ||
          doc.querySelector(".series-title")?.textContent?.trim() ||
          "Untitled";

        const description =
          doc.querySelector(".summary, .description, p")?.textContent?.trim() ||
          "";

        let coverUrl =
          (doc.querySelector('meta[property="og:image"]') as HTMLMetaElement)
            ?.content ||
          (doc.querySelector(".cover img, .poster img") as HTMLImageElement)
            ?.src ||
          "";

        if (coverUrl.startsWith("/")) coverUrl = `https://${domain}${coverUrl}`;

        const chapterLinks = Array.from(
          doc.querySelectorAll(
            'a[href*="/chapter-"], .chapter-list a, .episode-list a',
          ),
        )
          .map((item) => (item as HTMLAnchorElement).href)
          .filter((href) => href && href.includes("/chapter-"))
          .map((href) => new URL(href, `https://${domain}`).href);

        // Reverse to oldest first if site is newest first
        if (chapterLinks.length > 0) {
          chapterLinks.reverse();
        } else {
          throw new Error("No chapters found via static");
        }

        const tags = Array.from(doc.querySelectorAll('.genres a, .tags a, .series-genres a, a[href*="/genre/"]'))
          .map(a => a.textContent?.trim())
          .filter(Boolean) as string[];

        return {
          series: {
            title,
            description,
            coverUrl,
            seriesUrl: url,
            source: domain,
            tags,
            chapters: chapterLinks.map((link) => {
              const numMatch = link.match(/chapter-(\d+(\.\d+)?)/);
              const num = numMatch ? numMatch[1] : "unknown";
              return {
                id: link,
                number: num,
                url: link,
                source: domain,
              };
            }),
          },
        };
      }
    } catch (err) {
      console.warn(
        "[LuaComic] Static fetch failed or empty, using headless:",
        err,
      );
      // Fallback to robust headless
      return await this.scrapeLuaComicHeadless(url);
    }
  }

  private static async scrapeLuaComicHeadless(
    url: string,
  ): Promise<ScrapeResult> {
    const domain = "luacomic.org";
    const isChapter = url.includes("/chapter-");

    if (isChapter) {
      // Use generic headless images scraper
      return await this.scrapeViaWindow(url);
    } else {
      // Use generic headless series scraper
      const res = await invoke<any>("scrape_series_headless", { url });
      return {
        series: {
          title: res.title,
          description: res.description,
          coverUrl: res.cover_url,
          seriesUrl: url,
          source: domain,
          chapters: res.chapterLinks.map((link: string, i: number) => {
            const numMatch = link.match(/chapter-(\d+(\.\d+)?)/);
            const num = numMatch
              ? numMatch[1]
              : (res.chapterLinks.length - i).toString();
            return {
              id: link,
              number: num,
              url: link,
              source: domain,
            };
          }),
        },
      };
    }
  }

  private static tagCache: Record<string, string> | null = null;

  static async getMangaDexTags(): Promise<Record<string, string>> {
     if (this.tagCache) return this.tagCache;
     try {
         const res = await fetch('https://api.mangadex.org/manga/tag');
         if (!res.ok) return {};
         const json = await res.json();
         const mapping: Record<string, string> = {};
         json.data.forEach((t: any) => {
             const name = t.attributes.name.en.toLowerCase();
             mapping[name] = t.id;
         });
         this.tagCache = mapping;
         return mapping;
     } catch (e) {
         console.error("[Scraper] Failed to fetch tags:", e);
         return {};
     }
  }

  static async search(query: string, limit: number = 20): Promise<any[]> {
    try {
      const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=${limit}&includes[]=cover_art`);
      if (!res.ok) throw new Error("MangaDex search failed");
      const json = await res.json();
      return this.mapMangaDexResults(json.data);
    } catch (e) {
      console.error("[Scraper] Search failed:", e);
      return [];
    }
  }

  static async searchByTags(tags: string[], limit: number = 20): Promise<any[]> {
    try {
        const tagMap = await this.getMangaDexTags();
        const tagIds = tags.map(t => tagMap[t.toLowerCase()]).filter(Boolean);
        if (tagIds.length === 0) return [];

        const tagParams = tagIds.map(id => `includedTags[]=${id}`).join('&');
        const res = await fetch(`https://api.mangadex.org/manga?${tagParams}&limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
        if (!res.ok) throw new Error("MangaDex tag search failed");
        const json = await res.json();
        return this.mapMangaDexResults(json.data);
    } catch (e) {
        console.error("[Scraper] Tag search failed:", e);
        return [];
    }
  }

  static async getTrending(limit: number = 20): Promise<any[]> {
    try {
        const res = await fetch(`https://api.mangadex.org/manga?order[followedCount]=desc&limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
        if (!res.ok) throw new Error("MangaDex trending failed");
        const json = await res.json();
        return this.mapMangaDexResults(json.data);
    } catch (e) {
        console.error("[Scraper] Trending failed:", e);
        return [];
    }
  }

  static async getRecentlyUpdated(limit: number = 20): Promise<any[]> {
    try {
        const res = await fetch(`https://api.mangadex.org/manga?order[latestUploadedChapter]=desc&limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
        if (!res.ok) throw new Error("MangaDex recently updated failed");
        const json = await res.json();
        return this.mapMangaDexResults(json.data);
    } catch (e) {
        console.error("[Scraper] Recently updated failed:", e);
        return [];
    }
  }

  private static mapMangaDexResults(data: any[]): any[] {
    return data.map((m: any) => {
        const attrs = m.attributes;
        const title = attrs.title.en || attrs.title[Object.keys(attrs.title)[0]] || "Untitled";
        const coverRel = m.relationships.find((r: any) => r.type === "cover_art");
        const fileName = coverRel?.attributes?.fileName;
        
        return {
          id: m.id,
          title,
          tags: attrs.tags?.map((t: any) => t.attributes.name.en) || [],
          description: attrs.description?.en || "",
          coverUrl: fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}` : undefined,
          source: 'mangadex.org'
        };
      });
  }
}
