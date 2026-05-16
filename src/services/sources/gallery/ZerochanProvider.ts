/**
 * ZerochanProvider
 *
 * Source provider for Zerochan.net using its official read-only JSON API.
 * Implements tag-based search, trending, and direct image resolution.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  MediaDomain,
  SourceProvider,
  SourceContent,
  SourceSearchResult,
  SourceCapabilities,
  ContentType,
  MediaType,
  ReaderMode,
  SourceSearchOptions,
} from "../types";

// ─── Rate Limiter (Token Bucket) ────────────────────────────────────
const RATE_LIMIT_RPM = 60;
const REQUEST_INTERVAL_MS = Math.ceil((60 / RATE_LIMIT_RPM) * 1000);

class RateLimiter {
  private queue: (() => void)[] = [];
  private processing = false;

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      if (!this.processing) this.processQueue();
    });
  }

  private processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    this.processing = true;
    const next = this.queue.shift();
    if (next) next();
    setTimeout(() => this.processQueue(), REQUEST_INTERVAL_MS);
  }
}

const zerochanRateLimiter = new RateLimiter();

// ─── API Helpers ─────────────────────────────────────────────────────

const ZEROCHAN_UA = "FlowManga - FlowUser";
const ZEROCHAN_BASE = "https://www.zerochan.net";

/**
 * Makes a rate-limited request to the Zerochan API via the Tauri backend
 * to avoid CORS and Scope issues.
 */
async function zerochanGet(
  path: string,
  params: Record<string, any> = {},
): Promise<any> {
  await zerochanRateLimiter.acquire();

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const urlObj = new URL(`${ZEROCHAN_BASE}${cleanPath}`);

  urlObj.searchParams.set("json", "");
  Object.entries(params).forEach(([key, val]) => {
    urlObj.searchParams.set(key, String(val));
  });

  const url = urlObj.toString();

  try {
    const response: any = await invoke("fetch_json", {
      url,
      method: "GET",
      headers: {
        "User-Agent": ZEROCHAN_UA,
        Accept: "application/json",
      },
    });

    return response || {};
  } catch (e) {
    console.error(`[ZerochanProvider] Fetch failed for ${url}:`, e);
    return {};
  }
}

function constructFullUrl(
  tag: string,
  id: number,
  ext: string = "jpg",
): string {
  const formattedTag = tag.replace(/ /g, ".");
  return `https://static.zerochan.net/${formattedTag}.full.${id}.${ext}`;
}

/**
 * Normalizes Zerochan URLs to avoid low-quality or undesired formats like .avif
 * if they are not the intended high-res version.
 */
function normalizeZerochanUrl(url: string, tag: string, id: number): string {
  if (!url) return constructFullUrl(tag, id);

  // If the asset format is an optimized/preview type that isn't the native full version
  if (url.includes(".avif") || url.includes(".webp")) {
    return constructFullUrl(tag, id, "jpg");
  }

  return url;
}

// ─── Provider ────────────────────────────────────────────────────────

export class ZerochanProvider implements SourceProvider {
  readonly id = "zerochan";
  readonly name = "Zerochan";
  readonly domains = ["zerochan.net", "static.zerochan.net"];
  readonly contentType: ContentType = "gallery";
  readonly mediaDomain: MediaDomain = "image";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "discovery" as const;
  readonly readerModes: ReaderMode[] = ["gallery", "slideshow", "single"];

  readonly capabilities: SourceCapabilities = {
    search: true,
    tagSearch: true,
    seriesBrowse: false,
    chapterFeed: false,
    pagination: true,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace("www.", "");
      return this.domains.some((d) => hostname.toLowerCase().includes(d));
    } catch {
      return false;
    }
  }

  async fetchContent(url: string): Promise<SourceContent> {
    const parsed = new URL(url);
    const path = parsed.pathname.slice(1);

    if (/^\d+$/.test(path)) {
      const id = parseInt(path);
      const data = await zerochanGet(`/${id}`);

      const tag = data.tag || "Untitled";
      const fullUrl = normalizeZerochanUrl(data.full, tag, id);

      return {
        images: [
          {
            url: fullUrl,
            pageNumber: 1,
            mediaType: "image" as MediaType,
          },
        ],
        metadata: {
          title: `Zerochan #${id} - ${tag}`,
          description: data.tag,
          coverUrl: data.thumbnail,
          sourceId: String(id),
          sourceUrl: url,
          tags: data.tag ? [data.tag] : [],
        },
      };
    }

    const pageParam = parsed.searchParams.get("p") || "1";
    const data = await zerochanGet(`/${path}`, { p: pageParam, l: 48 });
    const items: any[] = data.items || [];

    const images = items.map((item: any, index: number) => ({
      url: normalizeZerochanUrl(item.full, item.tag, item.id),
      pageNumber: index + 1,
      mediaType: "image" as MediaType,
    }));

    return {
      images,
      metadata: {
        title: decodeURIComponent(path.replace(/\+/g, " ")),
        sourceUrl: url,
      },
    };
  }

  async search(
    query: string,
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const page = options.page || 1;
    const limit = options.limit || 24;
    const tag = query.trim();

    if (!tag) return [];

    const safeLimit = Math.min(limit, 100);

    // If query has spaces, it's a search, not a single tag
    if (tag.includes(" ")) {
      try {
        const data = await zerochanGet("/", { q: tag, p: page, l: safeLimit });
        const items = data.items || (Array.isArray(data) ? data : []);
        return this.mapItems(items, query);
      } catch (e) {
        console.error(`[ZerochanProvider] Global search error for ${tag}:`, e);
        return [];
      }
    }

    // Single word: try as a tag first (better quality/relevance)
    try {
      const data = await zerochanGet(`/${tag}`, { p: page, l: safeLimit });
      const items = data.items || (Array.isArray(data) ? data : []);
      if (items.length > 0) return this.mapItems(items, query);

      // If no items in tag path, try global search
      const globalData = await zerochanGet("/", {
        q: tag,
        p: page,
        l: safeLimit,
      });
      const globalItems =
        globalData.items || (Array.isArray(globalData) ? globalData : []);
      return this.mapItems(globalItems, query);
    } catch (e) {
      // Fallback to global search if tag-specific failed
      try {
        const data = await zerochanGet("/", { q: tag, p: page, l: safeLimit });
        const items = data.items || (Array.isArray(data) ? data : []);
        return this.mapItems(items, query);
      } catch (innerE) {
        console.error(
          `[ZerochanProvider] Both tag and global search failed for ${tag}:`,
          innerE,
        );
        return [];
      }
    }
  }

  async searchByTags(
    tags: string[],
    pageOrOptions?: number | SourceSearchOptions,
    limit?: number,
  ): Promise<SourceSearchResult[]> {
    if (tags.length === 0) return [];

    let options: SourceSearchOptions = {};
    if (typeof pageOrOptions === "number") {
      options.page = pageOrOptions;
      options.limit = limit;
    } else if (pageOrOptions) {
      options = pageOrOptions;
    }

    const page = options.page || 1;
    const currentLimit = options.limit || 24;
    const tagPath = tags.map((t) => encodeURIComponent(t)).join(",");
    const safeLimit = Math.min(currentLimit, 250);

    try {
      const data = await zerochanGet(`/${tagPath}`, { p: page, l: safeLimit });
      return this.mapItems(data.items || [], tags.join(", "));
    } catch {
      return [];
    }
  }

  async getTrending(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const page = options.page || 1;
    const limit = options.limit || 24;
    try {
      const data = await zerochanGet("/", { p: page, l: limit, s: "fav" });
      return this.mapItems(data.items || [], "Popular");
    } catch {
      return [];
    }
  }

  async getLatest(
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const page = options.page || 1;
    const limit = options.limit || 24;
    try {
      const data = await zerochanGet("/", { p: page, l: limit, s: "id" });
      return this.mapItems(data.items || [], "Latest");
    } catch {
      return [];
    }
  }

  async getRandom(): Promise<SourceSearchResult[]> {
    const randomPage = Math.floor(Math.random() * 100) + 1;
    return this.getTrending({ page: randomPage, limit: 12 });
  }

  async getAutocomplete(query: string): Promise<string[]> {
    return [];
  }

  async getRelatedTags(tag: string): Promise<string[]> {
    return [];
  }

  private mapItems(items: any[], contextLabel: string): SourceSearchResult[] {
    return items
      .filter((item) => item && item.id)
      .map((item: any) => {
        const id = String(item.id);
        const primaryTag = item.tag || contextLabel;
        const fullUrl = normalizeZerochanUrl(item.full, primaryTag, item.id);
        const thumbUrl =
          item.thumbnail || constructFullUrl(primaryTag, item.id);

        return {
          id,
          title: primaryTag,
          coverUrl: thumbUrl,
          previewUrl: thumbUrl,
          imageUrl: fullUrl,
          tags: item.tags || (item.tag ? [item.tag] : []),
          description: `Zerochan image #${id}`,
          source: "zerochan",
          contentType: "gallery" as ContentType,
          url: `${ZEROCHAN_BASE}/${id}`,
          dominantColor: "#a855f7",
        };
      });
  }
}
