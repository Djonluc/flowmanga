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
  "manhwaread.com": {
    domain: "manhwaread.com",
    imageSelector: ".reading-content img",
    imageAttr: "src",
    isVerticalWebtoon: true,
  },
  "comix.to": {
    domain: "comix.to",
    imageSelector: "div.reader-image img, .reading-content img",
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

      if (domain.includes("manhwaread.com")) {
        return await this.scrapeManhwaRead(url);
      }

      if (domain.includes("comix.to")) {
        return await this.scrapeComixTo(url);
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

  private static decodeHtmlEntities(text: string): string {
    if (!text) return "";
    const textArea = document.createElement("textarea");
    textArea.innerHTML = text;
    return textArea.value;
  }

  private static async scrapeManhwaRead(url: string): Promise<ScrapeResult> {
    const domain = "manhwaread.com";
    const isChapter = url.includes("/chapter-");

    try {
      if (isChapter) {
        const html = await this.asyncFetchHtml(url, {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        });

        let images: ScrapedImage[] = [];
        let metadata: ScrapeResult["metadata"] = undefined;

        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          
          const ogTitle = (doc.querySelector("meta[property='og:title']") as HTMLMetaElement)?.content || "";
          
          let title = "Untitled";
          let chapterTitle = "Unknown Chapter";
          
          const titleMatch = ogTitle.match(/Reading\s+(.+?)\s+-\s+(Chapter\s+[\d\.]+)/i);
          if (titleMatch) {
              title = this.decodeHtmlEntities(titleMatch[1]);
              chapterTitle = this.decodeHtmlEntities(titleMatch[2]);
          } else {
              const rawTitle = ogTitle.split(" - ")[0];
              if (rawTitle.startsWith("Reading ")) title = this.decodeHtmlEntities(rawTitle.replace("Reading ", ""));
              else title = this.decodeHtmlEntities(rawTitle);
          }

          const description = this.decodeHtmlEntities((doc.querySelector("meta[property='og:description']") as HTMLMetaElement)?.content || "");

          metadata = {
              title,
              chapterTitle,
              description,
              mangaId: url.split('/manhwa/')[1]?.split('/')[0] || 'manhwaread-unknown',
          };
        } catch (e) {
          console.warn("[ManhwaRead] Failed to parse chapter metadata", e);
        }

        const match = html.match(/var chapterData = (\{.*?\});/);
        if (match) {
          try {
            const chapterData = JSON.parse(match[1]);
            if (chapterData.data && chapterData.base) {
              const decoded = atob(chapterData.data);
              const parsedData = JSON.parse(decoded);
              
              images = parsedData.map((item: any, i: number) => {
                const baseUrl = chapterData.base.endsWith("/") ? chapterData.base.slice(0, -1) : chapterData.base;
                const src = item.src.startsWith("/") ? item.src.slice(1) : item.src;
                return {
                  url: `${baseUrl}/${src}`,
                  pageNumber: i + 1
                };
              });
            }
          } catch (e) {
            console.warn("[ManhwaRead] Failed to parse chapterData", e);
          }
        }
        
        if (images.length > 0) return { images, metadata };
        
        const headlessResult = await this.scrapeViaWindow(url);
        return {
            images: headlessResult.images,
            metadata: metadata
        };
      } else {
        console.log(`[ManhwaRead] Fetching series HTML for: ${url}`);
        const html = await this.asyncFetchHtml(url, {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        });
        console.log(`[ManhwaRead] Series HTML fetched, length: ${html.length}`);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const ogTitle = (doc.querySelector("meta[property='og:title']") as HTMLMetaElement)?.content || "";
        let title = doc.querySelector(".post-title h1")?.textContent?.trim() 
                      || ogTitle.split(" - ")[0] 
                      || doc.title.split(" - ")[0] 
                      || "Untitled";
        
        let description = (doc.querySelector("meta[property='og:description']") as HTMLMetaElement)?.content
                          || doc.querySelector(".summary__content")?.textContent?.trim() 
                          || doc.querySelector(".manga-excerpt")?.textContent?.trim()
                          || "";

        let coverUrl = (doc.querySelector("meta[property='og:image']") as HTMLMetaElement)?.content
                       || doc.querySelector(".summary_image img")?.getAttribute("src") 
                       || "";

        if (coverUrl.startsWith("/")) coverUrl = `https://${domain}${coverUrl}`;

        const chapterLinks = Array.from(
          doc.querySelectorAll('a[href*="/chapter-"]')
        )
          .map((item) => (item as HTMLAnchorElement).getAttribute("href"))
          .filter(Boolean)
          .map((href) => href!.startsWith("/") ? `https://${domain}${href}` : href!);

        const uniqueLinks = Array.from(new Set(chapterLinks));
        console.log(`[ManhwaRead] Found ${uniqueLinks.length} unique chapter links`);

        if (uniqueLinks.length > 0) {
          uniqueLinks.reverse();
        } else {
          console.warn(`[ManhwaRead] No chapters found in HTML. Check selectors.`);
          throw new Error("No chapters found");
        }

        const tags = Array.from(doc.querySelectorAll('a[href*="/genre/"]'))
          .map(a => a.textContent?.trim())
          .filter(Boolean) as string[];

        return {
          series: {
            title: this.decodeHtmlEntities(title),
            description: this.decodeHtmlEntities(description),
            coverUrl,
            seriesUrl: url,
            source: domain,
            tags,
            chapters: uniqueLinks.map((link) => {
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
      console.warn("[ManhwaRead] Static fetch failed or empty, using headless:", err);
      if (isChapter) {
        return await this.scrapeViaWindow(url);
      } else {
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
              const num = numMatch ? numMatch[1] : (res.chapterLinks.length - i).toString();
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
        // MangaDex Search
        const tagMap = await this.getMangaDexTags();
        const tagIds = tags.map(t => tagMap[t.toLowerCase()]).filter(Boolean);
        let mdResults: any[] = [];
        
        if (tagIds.length > 0) {
          const tagParams = tagIds.map(id => `includedTags[]=${id}`).join('&');
          const res = await fetch(`https://api.mangadex.org/manga?${tagParams}&limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
          if (res.ok) {
            const json = await res.json();
            mdResults = this.mapMangaDexResults(json.data);
          }
        }

        // ManhwaRead Search (Top tag only)
        let mrResults: any[] = [];
        if (tags.length > 0) {
          const genre = tags[0].toLowerCase().replace(/\s+/g, '-');
          try {
            let html = await this.asyncFetchHtml(`https://manhwaread.com/manga-genre/${genre}/`).catch(() => null);
            if (!html) {
              html = await this.asyncFetchHtml(`https://manhwaread.com/genre/${genre}/`).catch(() => null);
            }
            
            if (html) {
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, "text/html");
              const items = Array.from(doc.querySelectorAll('.manga-item'));
              mrResults = items.slice(0, 10).map(item => {
                const linkEl = item.querySelector('.manga-item__link') as HTMLAnchorElement;
                const imgEl = item.querySelector('.manga-item__thumbnail img') as HTMLImageElement;
                return {
                  id: linkEl?.href || '',
                  title: linkEl?.textContent?.trim() || 'Untitled',
                  coverUrl: imgEl?.src || '',
                  source: 'manhwaread.com',
                  external: true
                };
              }).filter(r => r.id);
            }
          } catch (e) {
            // Silence 404s
            if (!String(e).includes('404')) {
              console.warn("[Scraper] ManhwaRead tag search error:", e);
            }
          }
        }

        return [...mdResults, ...mrResults];
    } catch (e) {
        console.error("[Scraper] Tag search failed:", e);
        return [];
    }
  }

  static async getTrending(limit: number = 20): Promise<any[]> {
    try {
        // MangaDex Trending
        const res = await fetch(`https://api.mangadex.org/manga?order[followedCount]=desc&limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
        let mdResults: any[] = [];
        if (res.ok) {
          const json = await res.json();
          mdResults = this.mapMangaDexResults(json.data);
        }

        // ManhwaRead Trending (Home page latest)
        let mrResults: any[] = [];
        try {
          const html = await this.asyncFetchHtml(`https://manhwaread.com/`);
          if (html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const items = Array.from(doc.querySelectorAll('.manga-item'));
            mrResults = items.slice(0, 10).map(item => {
              const linkEl = item.querySelector('.manga-item__link') as HTMLAnchorElement;
              const imgEl = item.querySelector('.manga-item__thumbnail img') as HTMLImageElement;
              return {
                id: linkEl?.href || '',
                title: linkEl?.textContent?.trim() || 'Untitled',
                coverUrl: imgEl?.src || '',
                source: 'manhwaread.com',
                external: true
              };
            }).filter(r => r.id);
          }
        } catch (e) {
          console.warn("[Scraper] ManhwaRead trending failed:", e);
        }

        return [...mdResults, ...mrResults];
    } catch (e) {
        console.error("[Scraper] Trending failed:", e);
        return [];
    }
  }

  static async getRecentlyUpdated(limit: number = 20): Promise<any[]> {
    try {
        // MangaDex Recent
        const res = await fetch(`https://api.mangadex.org/manga?order[latestUploadedChapter]=desc&limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`);
        let mdResults: any[] = [];
        if (res.ok) {
          const json = await res.json();
          mdResults = this.mapMangaDexResults(json.data);
        }

        return mdResults;
    } catch (e) {
        console.error("[Scraper] Recently updated failed:", e);
        return [];
    }
  }

  private static parseComixInitialData(html: string): any | null {
    const match = html.match(
      /<script[^>]+id=["']initial-data["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!match?.[1]) return null;

    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.warn("[Comix] Failed to parse initial-data", e);
      return null;
    }
  }

  private static extractComixImageUrls(value: any): string[] {
    const urls = new Set<string>();
    const visit = (node: any) => {
      if (!node) return;
      if (typeof node === "string") {
        let clean = node.replace(/\\\//g, "/").replace(/&amp;/g, "&");
        if (clean.startsWith("//")) clean = `https:${clean}`;
        if (
          /^https?:\/\//i.test(clean) &&
          /(static\.comix\.to|media\.luacomic\.org|uploads|chapter|pages?)/i.test(clean) &&
          /\.(jpe?g|png|webp)(\?|$)/i.test(clean)
        ) {
          urls.add(clean);
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node === "object") {
        Object.values(node).forEach(visit);
      }
    };

    visit(value);
    return Array.from(urls);
  }

  private static comixApiSignature(pathOrUrl: string): string {
    const atobFn = (value: string) => atob(value);
    const btoaFn = (value: string) => btoa(value);
    const bytes = (value: string) => value.split("").map((char) => char.charCodeAt(0));
    const chars = (value: number[]) => String.fromCharCode.apply(null, value);
    const urlSafe = (value: string) =>
      btoaFn(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const rc4 = (key: string, input: string) => {
      const state: number[] = [];
      let j = 0;
      let out = "";
      for (let i = 0; i < 256; i++) state[i] = i;
      for (let i = 0; i < 256; i++) {
        j = (j + state[i] + key.charCodeAt(i % key.length)) % 256;
        [state[i], state[j]] = [state[j], state[i]];
      }
      let i = 0;
      j = 0;
      for (let idx = 0; idx < input.length; idx++) {
        i = (i + 1) % 256;
        j = (j + state[i]) % 256;
        [state[i], state[j]] = [state[j], state[i]];
        out += String.fromCharCode(
          input.charCodeAt(idx) ^ state[(state[i] + state[j]) % 256],
        );
      }
      return out;
    };
    const keyD = () => bytes(atobFn("DTSTmUt6LpDUw9r1lSQqyb3YlFTzruT8tk8wUGkwehQ="));
    const keyB = () => bytes(atobFn("3PordjODbhqla382Cxapmo/1JiABJQcjiJj1+48gTJ4="));
    const keyZ = () => bytes(atobFn("8i0Cru/VJBSVB2Y1GcMDVpzx2WepOcfnWdd81yxICl4="));
    const keyTe = () => bytes(atobFn("bewtiTuV+HJk56xxkf2iCljLgruCpBmN9BgE8i6gc9M="));
    const keyIe = () => bytes(atobFn("yXayUVFrrcW56jQCEfZzuCidjpnWKjTDUNT7XeX9i7k="));

    const a = (v: number) => 81 ^ v;
    const c = (v: number) => 218 ^ v;
    const m = (v: number) => 147 ^ v;
    const w = (v: number) => 37 ^ v;
    const x = (v: number) => 180 ^ v;
    const q = (v: number) => 255 & ((v >>> 1) | (v << 7));
    const vrot = (v: number) => 255 & ((v << 1) | (v >>> 7));
    const ne = (v: number) => 255 & ((v << 2) | (v >>> 6));
    const s = (v: number) => 255 & ((v << 7) | (v >>> 1));
    const L = (v: number) => 255 & ((v >>> 4) | (v << 4));
    const y = (v: number) => 255 & ((v << 4) | (v >>> 4));
    const R = (v: number) => (v + 159) % 256;
    const u = (v: number) => (v - 159 + 256) % 256;
    const X = (v: number) => (v + 34) % 256;
    const O = (v: number) => (v - 34 + 256) % 256;

    const wrap = (key: string, input: number[]) => bytes(rc4(atobFn(key), chars(input)));
    const M = (input: number[]) => wrap("JxTcdyiA5GZxnbrmthXBQfU2IMTKcY1+3nNhbq98Sgo=", input);
    const ae = (input: number[]) => wrap("MHNBHYWA7lvy867fXgvGcJwWDk79KqUJUVFsh3RwnnI=", input);
    const g = (input: number[]) => wrap("B46L1x+UeWP+19cRpQ+OZvdLAK9EHID8g3mSgn57tew=", input);
    const p = (input: number[]) => wrap("7xWfIF5THL5LAnRgAARg+4mjWHPU9n3PQwvzbaMNi+Q=", input);
    const P = (input: number[]) => wrap("WgeCQ3T8R51uTwVSiVa7Zy0dN6JOg6Z5JleMS+HV8Aw=", input);

    const C = (input: number[]) => {
      const key = keyB();
      const prefix = atobFn("OaKvnI5ARA==");
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 7) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0: n = s(n); break;
          case 1: n = w(n); break;
          case 2: n = a(n); break;
          case 3: n = m(n); break;
          case 4: n = ne(n); break;
          case 5:
          case 8: n = y(n); break;
          case 6: n = c(n); break;
          case 7: n = u(n); break;
          case 9: n = x(n); break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const H = (input: number[]) => {
      const key = keyZ();
      const prefix = atobFn("Fyskubz8VvA=");
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 8) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0:
          case 9: n = x(n); break;
          case 1: n = vrot(n); break;
          case 2: n = m(n); break;
          case 3: n = s(n); break;
          case 4: n = ne(n); break;
          case 5: n = y(n); break;
          case 6:
          case 8: n = R(n); break;
          case 7: n = X(n); break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const I = (input: number[]) => {
      const key = keyD();
      const prefix = atobFn("vY/meeI=");
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 5) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0: n = a(n); break;
          case 1: n = y(n); break;
          case 2:
          case 9: n = L(n); break;
          case 3: n = w(n); break;
          case 4: n = u(n); break;
          case 5: n = q(n); break;
          case 6: n = x(n); break;
          case 7: n = O(n); break;
          case 8: n = ne(n); break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const T = (input: number[]) => {
      const key = keyTe();
      const prefix = atobFn("/Xcb2zAu8AU=");
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 8) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0:
          case 7: n = c(n); break;
          case 1:
          case 4: n = vrot(n); break;
          case 2: n = q(n); break;
          case 3: n = R(n); break;
          case 5:
          case 8: n = x(n); break;
          case 6: n = m(n); break;
          case 9: n = w(n); break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const oe = (input: number[]) => {
      const key = keyIe();
      const prefix = atobFn("tSLco2w=");
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 5) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0: n = L(n); break;
          case 1:
          case 3: n = m(n); break;
          case 2: n = X(n); break;
          case 4:
          case 9: n = c(n); break;
          case 5:
          case 7: n = vrot(n); break;
          case 6: n = x(n); break;
          case 8: n = ne(n); break;
        }
        out.push(255 & n);
      }
      return out;
    };

    const path = pathOrUrl
      .replace(/^https?:\/\/[^/]+/, "")
      .split("?")[0]
      .replace(/^\/api\/v1/, "");
    let out = bytes(encodeURIComponent(path));
    out = C(out);
    out = M(out);
    out = H(out);
    out = ae(out);
    out = I(out);
    out = g(out);
    out = T(out);
    out = p(out);
    out = oe(out);
    out = P(out);
    return urlSafe(chars(out));
  }

  private static async fetchComixJson(pathOrUrl: string, referer: string): Promise<any | null> {
    const rawUrl = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `https://www.comix.to${pathOrUrl}`;
    
    const urlObj = new URL(rawUrl);
    urlObj.searchParams.set("_", this.comixApiSignature(urlObj.pathname));
    const url = urlObj.href;

    try {
      const text = await this.asyncFetchHtml(url, {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        Referer: referer,
        Cookie: (import.meta.env.VITE_COMIX_COOKIE as string) || "",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      });
      const parsed = JSON.parse(text);
      return parsed?.result ?? parsed;
    } catch (e) {
      console.warn("[Comix] API fetch failed:", url, e);
      return null;
    }
  }

  private static normalizeComixChapter(item: any, seriesUrl: string): SeriesScrapedChapter | null {
    const source = "comix.to";
    const url = item?.url || item?.readUrl || item?.chapterUrl;
    const id = item?.id ?? item?.chapterId ?? item?.hid ?? url;
    const number = String(
      item?.number ?? item?.chapter ?? item?.chapterNumber ?? item?.chap ?? "unknown",
    );

    let finalUrl = typeof url === "string" ? url : "";
    if (!finalUrl && id && number !== "unknown") {
      finalUrl = `${seriesUrl.replace(/\/$/, "")}/${id}-chapter-${number}`;
    }
    if (finalUrl.startsWith("/")) finalUrl = `https://www.comix.to${finalUrl}`;

    if (!finalUrl) return null;
    return {
      id: String(id || finalUrl),
      number,
      url: finalUrl,
      title: item?.title,
      source,
    };
  }

  private static async fetchComixChapters(
    mangaKey: string | number,
    seriesUrl: string,
  ): Promise<SeriesScrapedChapter[]> {
    const chapters: SeriesScrapedChapter[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= 20; page++) {
      const data = await this.fetchComixJson(
        `/api/v1/manga/${mangaKey}/chapters?page=${page}`,
        seriesUrl,
      );
      if (!data) break;

      const candidates =
        data.items ||
        data.data ||
        data.chapters ||
        (Array.isArray(data) ? data : []);

      if (!Array.isArray(candidates) || candidates.length === 0) break;

      for (const item of candidates) {
        const chapter = this.normalizeComixChapter(item, seriesUrl);
        if (chapter && !seen.has(chapter.url)) {
          seen.add(chapter.url);
          chapters.push(chapter);
        }
      }

      const meta = data.meta || data.pagination || {};
      if (meta.hasNext === false || (meta.lastPage && page >= Number(meta.lastPage))) break;
    }

    return chapters.reverse();
  }

  private static async scrapeComixTo(url: string): Promise<ScrapeResult> {
    const domain = "comix.to";
    const isChapter = url.includes("/read/") || url.includes("-chapter-");

    if (isChapter) {
      const html = await this.asyncFetchHtml(url);
      const initialData = this.parseComixInitialData(html);
      const chapterId =
        initialData?.read?.chapterId ||
        url.match(/\/(\d+)-chapter-/)?.[1];
      let metadata: ScrapeResult["metadata"] = undefined;
      const detail = Object.values(initialData?.queries || {}).find(
        (entry: any) => entry?.title && entry?.poster,
      ) as any;
      if (detail) {
        metadata = {
          title: detail.title,
          coverUrl: detail.poster?.large || detail.poster?.medium,
          description: detail.synopsis,
          mangaId: detail.hid || String(detail.id || ""),
          author: detail.authors?.map((a: any) => a.title).filter(Boolean).join(", "),
          tags: [
            ...(detail.genres || []),
            ...(detail.tags || []),
            ...(detail.formats || []),
          ].map((tag: any) => tag.title).filter(Boolean),
          chapterTitle: initialData?.read?.chapterNumber
            ? `Chapter ${initialData.read.chapterNumber}`
            : undefined,
        };
      }

      if (chapterId) {
        const pageData = await this.fetchComixJson(`/api/v1/chapters/${chapterId}`, url);
        const pageUrls = this.extractComixImageUrls(pageData);
        if (pageUrls.length > 0) {
          return {
            images: pageUrls.map((src, i) => ({ url: src, pageNumber: i + 1 })),
            metadata,
          };
        }
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const images: ScrapedImage[] = [];

      // Look for data-src
      doc.querySelectorAll('img[data-src], img.chapter-img, .reader-area img, .reader-main img').forEach((img) => {
        const element = img as HTMLImageElement;
        const src = element.getAttribute("data-src") || element.getAttribute("src") || element.src;
        if (src && (src.includes("static.comix.to") || src.includes("media.luacomic.org"))) {
           images.push({ url: src, pageNumber: images.length + 1 });
        }
      });

      // Nuclear option: Scan raw HTML for static.comix.to links
      if (images.length === 0) {
        const imgRegex = /(https:\/\/static\.comix\.to\/[^\s\"'\\ ]+\.(?:jpg|png|webp|jpeg))/gi;
        const matches = html.match(imgRegex) || [];
        const uniqueImgs = Array.from(new Set(matches));
        uniqueImgs.forEach((src, i) => {
          images.push({ url: src, pageNumber: i + 1 });
        });
      }

      if (images.length === 0) {
        try {
          const headless = await this.scrapeViaWindow(url);
          if (headless.images && headless.images.length > 0) {
            return { ...headless, metadata };
          }
        } catch (e) {
          console.warn("[Scraper] comix.to final headless images fallback failed:", e);
        }
      }

      return { images, metadata };
    } else {
      let title = "Unknown Title";
      let description = "";
      let coverUrl = "";
      let chapters: SeriesScrapedChapter[] = [];
      let chapterLinks: string[] = [];

      // 1. Try Headless First (Cloudflare Bypass)
      try {
        console.log("[Comix] Attempting headless series scrape...");
        const res = await invoke<any>("scrape_series_headless", { url });
        if (res && res.chapterLinks && res.chapterLinks.length > 0) {
          title = res.title || title;
          description = res.description || description;
          coverUrl = res.cover_url || res.coverUrl || coverUrl;
          
          chapters = res.chapterLinks.map((link: string, i: number) => {
            const numMatch = link.match(/chapter-(\d+(\.\d+)?)/);
            const num = numMatch ? numMatch[1] : (res.chapterLinks.length - i).toString();
            return {
              id: link,
              number: num,
              url: link,
              source: domain,
            };
          });
          
          return {
            series: {
              title,
              description,
              coverUrl,
              seriesUrl: url,
              source: domain,
              chapters,
            },
          };
        }
      } catch (e) {
        console.warn("[Comix] Headless series scrape failed, falling back to static...", e);
      }

      // 2. Deep JSON Extraction (Static Fallback)
      if (chapters.length === 0) {
        const html = await this.asyncFetchHtml(url);
        const initialData = this.parseComixInitialData(html);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const detail = Object.values(initialData?.queries || {}).find(
          (entry: any) => entry?.title && entry?.poster,
        ) as any;
        if (detail) {
          title = detail.title || title;
          description = detail.synopsis || description;
          coverUrl = detail.poster?.large || detail.poster?.medium || coverUrl;

          const mangaKeys = [detail.hid, detail.id].filter(Boolean);
          for (const key of mangaKeys) {
            chapters = await this.fetchComixChapters(key, url);
            if (chapters.length > 0) break;
          }

          if (chapters.length === 0) {
            chapterLinks = [detail.firstChapterUrl, detail.latestChapterUrl].filter(Boolean);
          }
        }

        title = doc.querySelector('h1')?.textContent?.trim() ||
                doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || title;
        description = doc.querySelector('.description')?.textContent?.trim() ||
                      doc.querySelector('meta[name="description"]')?.getAttribute('content') || description;
        coverUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || coverUrl;

        // Extract from <a> tags
        doc.querySelectorAll('a[href*="/chapter-"], a[href*="/read/"]').forEach((a) => {
          chapterLinks.push((a as HTMLAnchorElement).href);
        });
        
        // Deep Script Analysis: Parse all JSON scripts
        doc.querySelectorAll('script').forEach(script => {
          const content = script.textContent || "";
          if (content.includes("chapter") || content.includes("hid") || content.includes("title")) {
            // Find anything that looks like a chapter URL or path
            const matches = content.match(/["'](\/title\/[^\s"']+?-chapter-[\d.]+)["']/g) || [];
            matches.forEach(m => {
              let clean = m.replace(/["']/g, "").replace(/\\/g, "");
              if (!clean.startsWith('http')) clean = `https://www.comix.to${clean}`;
              chapterLinks.push(clean);
            });
          }
        });

        chapterLinks = Array.from(new Set(chapterLinks)).filter(Boolean);
      }

      if (chapters.length === 0 && chapterLinks.length === 0) {
        try {
          console.log("[Comix] Final Headless fallback for series...");
          const res = await invoke<any>("scrape_series_headless", { url });
          if (res && res.chapterLinks && res.chapterLinks.length > 0) {
            title = res.title || title;
            description = res.description || description;
            coverUrl = res.cover_url || res.coverUrl || coverUrl;
            chapterLinks = res.chapterLinks;
          }
        } catch (e) {
          console.warn("[Scraper] comix.to final headless series fallback failed:", e);
        }
      }

      if (chapters.length === 0) {
        chapters = chapterLinks.map((link) => {
          const numMatch = link.match(/chapter-(\d+(\.\d+)?)/);
          const num = numMatch ? numMatch[1] : "unknown";
          return {
            id: link,
            number: num,
            url: link,
            source: domain,
          };
        });
      }

      return {
        series: {
          title,
          description,
          coverUrl,
          seriesUrl: url,
          source: domain,
          chapters,
        },
      };
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
