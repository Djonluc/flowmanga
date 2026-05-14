/**
 * DiscoveryService
 *
 * Implements the Stage 1C Recommendation System Architecture:
 * - Parallel source fetching with timeouts
 * - In-memory LRU caching
 * - Source interleaving
 * - Persistent DB caching
 */

import { sourceRegistry } from "./sources/registry";
import type {
  SourceProvider,
  SourceSearchResult,
  ProviderCategory,
} from "./sources/types";
import { useSettingsStore } from "../stores/useSettingsStore";
import { ContentFilter } from "./ContentFilter";

interface CacheEntry {
  data: SourceSearchResult[];
  timestamp: number;
}

export class DiscoveryService {
  private static cache = new Map<string, CacheEntry>();
  private static CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours
  private static DEFAULT_TIMEOUT = 15000; // 15 seconds

  static async clearAllCache() {
    this.cache.clear();
    try {
      const { getDb } = await import("./db");
      const db = getDb();
      await db.execute("DELETE FROM DiscoveryCache");
    } catch (err) {
      console.error("[DiscoveryService] Failed to clear DB cache:", err);
    }
  }

  /**
   * Get trending/popular content from all active providers.
   */
  static async getTrending(
    limit: number = 20,
    coloredOnly: boolean = false,
    category?: ProviderCategory,
  ): Promise<SourceSearchResult[]> {
    const cacheKey = `trending_${limit}_${coloredOnly}_${category ?? "all"}`;

    // 1. Memory Cache
    const memCached = this.getCache(cacheKey);
    if (memCached) return memCached;

    // 2. DB Cache
    try {
      const { getDb } = await import("./db");
      const db = getDb();
      const dbResult = await db.select<any[]>(
        "SELECT results, updatedAt FROM DiscoveryCache WHERE id = ?",
        [cacheKey],
      );
      if (Array.isArray(dbResult) && dbResult.length > 0) {
        const row = dbResult[0];
        const data = JSON.parse(row.results);
        this.setCache(cacheKey, data, false);

        // Background refresh if older than 1 hour
        const updatedAt = new Date(row.updatedAt).getTime();
        if (Date.now() - updatedAt > 1000 * 60 * 60) {
          this.refreshDiscovery(
            cacheKey,
            "trending",
            limit,
            coloredOnly,
            category,
          );
        }

        return data;
      }
    } catch (err) {
      console.warn("[DiscoveryService] DB cache miss/error for trending:", err);
    }

    return this.refreshDiscovery(
      cacheKey,
      "trending",
      limit,
      coloredOnly,
      category,
    );
  }

  /**
   * Get latest updates from all active providers.
   */
  static async getLatest(
    limit: number = 20,
    coloredOnly: boolean = false,
    category?: ProviderCategory,
  ): Promise<SourceSearchResult[]> {
    const cacheKey = `latest_${limit}_${coloredOnly}_${category ?? "all"}`;

    const memCached = this.getCache(cacheKey);
    if (memCached) return memCached;

    try {
      const { getDb } = await import("./db");
      const db = getDb();
      const dbResult = await db.select<any[]>(
        "SELECT results, updatedAt FROM DiscoveryCache WHERE id = ?",
        [cacheKey],
      );
      if (Array.isArray(dbResult) && dbResult.length > 0) {
        const row = dbResult[0];
        const data = JSON.parse(row.results);
        this.setCache(cacheKey, data, false);

        const updatedAt = new Date(row.updatedAt).getTime();
        if (Date.now() - updatedAt > 1000 * 60 * 60) {
          this.refreshDiscovery(
            cacheKey,
            "latest",
            limit,
            coloredOnly,
            category,
          );
        }

        return data;
      }
    } catch (err) {
      console.warn("[DiscoveryService] DB cache miss for latest:", err);
    }

    return this.refreshDiscovery(
      cacheKey,
      "latest",
      limit,
      coloredOnly,
      category,
    );
  }

  private static async refreshDiscovery(
    cacheKey: string,
    type: "trending" | "latest",
    limit: number,
    coloredOnly: boolean,
    category?: ProviderCategory,
  ): Promise<SourceSearchResult[]> {
    // Local Provider Scraping
    const providers = this.getProvidersByCategory(category).filter((p) =>
      type === "trending" ? !!p.fetchPopular : !!p.fetchLatest,
    );
    const tasks = providers.map((p) => {
      const method = type === "trending" ? p.fetchPopular! : p.fetchLatest!;
      return this.withTimeout(
        method.call(p, 1, limit, coloredOnly),
        this.DEFAULT_TIMEOUT,
        [],
      );
    });

    const results = await Promise.allSettled(tasks);
    const flattenedResults: SourceSearchResult[][] = results.map((r) =>
      r.status === "fulfilled" ? r.value : [],
    );

    const interleaved = this.interleave(flattenedResults, limit, coloredOnly);
    this.setCache(cacheKey, interleaved);
    return interleaved;
  }

  /**
   * Get random content from all active providers.
   */
  static async getRandom(
    limit: number = 20,
    coloredOnly: boolean = false,
    category?: ProviderCategory,
  ): Promise<SourceSearchResult[]> {
    const providers = this.getProvidersByCategory(category).filter(
      (p) => !!p.fetchPopular || !!p.fetchLatest,
    );
    if (providers.length === 0) return [];

    const tasks = providers.map((p) => {
      const page = Math.floor(Math.random() * 5) + 1;
      const methods = [];
      if (p.fetchPopular) methods.push(p.fetchPopular.bind(p));
      if (p.fetchLatest) methods.push(p.fetchLatest.bind(p));

      const randomMethod = methods[Math.floor(Math.random() * methods.length)];
      return this.withTimeout(
        randomMethod(page, limit, coloredOnly),
        this.DEFAULT_TIMEOUT,
        [],
      );
    });

    const results = await Promise.allSettled(tasks);
    const flattened = results
      .map((r) => (r.status === "fulfilled" ? r.value : []))
      .flat();

    const seen = new Set<string>();
    const unique = flattened.filter((item) => {
      if (!item || !item.id) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    return this.filterRestrictedContent(unique, coloredOnly)
      .filter((item) => this.matchesCategory(item, category))
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);
  }

  /**
   * Global search across all registered providers.
   */
  static async searchGlobal(
    query: string,
    limit: number = 20,
    coloredOnly: boolean = false,
    page: number = 1,
    category?: ProviderCategory,
  ): Promise<SourceSearchResult[]> {
    const providers = this.getProvidersByCategory(category);
    const tasks = providers.map((p) => {
      if (!p.search) return Promise.resolve([]);
      return this.withTimeout(
        p.search(query, page, limit),
        this.DEFAULT_TIMEOUT,
        [],
      );
    });

    const results = await Promise.allSettled(tasks);
    const flattenedResults: SourceSearchResult[][] = results.map((r) =>
      r.status === "fulfilled" ? r.value : [],
    );

    return this.filterRestrictedContent(
      this.interleave(flattenedResults, limit, coloredOnly),
      coloredOnly,
    ).filter((item) => this.matchesCategory(item, category));
  }

  /**
   * Global tag search across all providers.
   */
  static async searchGlobalByTags(
    tags: string[],
    limit: number = 20,
    coloredOnly: boolean = false,
    category?: ProviderCategory,
  ): Promise<SourceSearchResult[]> {
    const providers = this.getProvidersByCategory(category);
    let stats = { total: 0, failed: 0, providers: [] as string[] };

    const tasks = providers.map(async (p) => {
      if (!p.searchByTags) return [];
      try {
        const res = await this.withTimeout(
          p.searchByTags(tags, 1, limit),
          this.DEFAULT_TIMEOUT,
          [],
        );
        console.log(
          `[DiscoveryService] Provider '${p.name}' returned ${res.length} results for tags: ${tags.join(", ")}`,
        );
        if (res.length > 0) {
          stats.providers.push(`${p.name} (${res.length})`);
          stats.total += res.length;
        }
        return res;
      } catch (e) {
        console.warn(
          `[DiscoveryService] Provider '${p.name}' failed tag search:`,
          e,
        );
        stats.failed++;
        return [];
      }
    });

    const results = await Promise.all(tasks);

    // Import toast dynamically to avoid circular dependencies
    import("../components/Toast")
      .then(({ toast }) => {
        if (stats.total > 0) {
          toast.info(
            `Found ${stats.total} matching series from: ${stats.providers.join(", ")}`,
          );
        } else if (stats.failed > 0) {
          toast.error(
            `${stats.failed} providers failed to respond to tag search.`,
          );
        } else {
          toast.info(`No matches found for tags across active providers.`);
        }
      })
      .catch(() => {});

    return this.filterRestrictedContent(
      this.interleave(results, limit, coloredOnly),
      coloredOnly,
    ).filter((item) => this.matchesCategory(item, category));
  }

  // ─── Utilities ────────────────────────────────────────────────────

  private static filterRestrictedContent(
    items: SourceSearchResult[],
    coloredOnly: boolean = false,
  ): SourceSearchResult[] {
    const { showAdultContent } = useSettingsStore.getState();
    const validItems = items.filter(
      (item) => item && item.id && item.title && item.url,
    );

    // 0. Auto-Categorize items based on source/title if missing
    let categorized = validItems.map((item) => {
      if (item.contentType) return item;

      const source = item.source?.toLowerCase() || "";
      const title = item.title?.toLowerCase() || "";
      const tags = (item.tags || []).map((t) => t.toLowerCase());

      let type: "manga" | "manhwa" | "manhua" | "comic" | "doujin" = "manga";

      if (
        source.includes("manhwa") ||
        tags.includes("manhwa") ||
        source.includes("webtoon")
      )
        type = "manhwa";
      else if (source.includes("manhua") || tags.includes("manhua"))
        type = "manhua";
      else if (
        source.includes("comic") ||
        source.includes("arven") ||
        source.includes("webtoon")
      )
        type = "comic";
      else if (source.includes("nhentai") || tags.includes("doujinshi"))
        type = "doujin";

      return { ...item, contentType: type };
    });

    let filtered = ContentFilter.filterResults(categorized);

    // 1. Adult Content Filter
    if (!showAdultContent) {
      filtered = filtered.filter(
        (item) =>
          item.contentType !== "doujin" &&
          !item.source?.toLowerCase().includes("nhentai"),
      );
    }

    // 2. Full Color Filter — delegates to ContentFilter's unified tag normalization
    if (coloredOnly) {
      filtered = ContentFilter.filterColoredContent(filtered);
    }

    return filtered;
  }

  private static matchesCategory(
    item: SourceSearchResult,
    category?: ProviderCategory,
  ): boolean {
    if (!category) return true;
    if (category === "image")
      return item.contentType === "gallery" || item.contentType === "album";
    if (category === "doujin") return item.contentType === "doujin";
    return item.contentType === "manga" || item.contentType === "comic";
  }

  private static getProvidersByCategory(
    category?: ProviderCategory,
  ): SourceProvider[] {
    return category
      ? sourceRegistry.listByCategory(category)
      : sourceRegistry.list();
  }

  private static interleave(
    sourceResults: SourceSearchResult[][],
    limit: number,
    coloredOnly: boolean = false,
  ): SourceSearchResult[] {
    const interleaved: SourceSearchResult[] = [];
    const seenTitles = new Set<string>();

    let hasMore = true;
    let index = 0;

    const normalizeTitle = (t: string) =>
      t.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Flatten and filter each source first to ensure we interleave valid items
    const processedSources = sourceResults.map((results) =>
      this.filterRestrictedContent(results, coloredOnly),
    );

    // Shuffle the source order to avoid bias
    const shuffledSources = [...processedSources].sort(
      () => Math.random() - 0.5,
    );

    while (interleaved.length < limit && hasMore) {
      hasMore = false;
      for (const results of shuffledSources) {
        if (index < results.length) {
          const item = results[index];
          const normTitle = normalizeTitle(item.title);

          if (!seenTitles.has(normTitle)) {
            seenTitles.add(normTitle);
            interleaved.push(item);
          }

          hasMore = true;
          if (interleaved.length >= limit) break;
        }
      }
      index++;
    }

    return interleaved;
  }

  private static async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    defaultValue: T,
  ): Promise<T> {
    let timeoutId: any;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => resolve(defaultValue), ms);
    });

    return Promise.race([
      promise.then((val) => {
        clearTimeout(timeoutId);
        return val;
      }),
      timeoutPromise,
    ]);
  }

  private static getCache(key: string): SourceSearchResult[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private static async setCache(
    key: string,
    data: SourceSearchResult[],
    persist: boolean = true,
  ) {
    this.cache.set(key, { data, timestamp: Date.now() });

    if (persist) {
      try {
        const { getDb } = await import("./db");
        const db = getDb();
        const type = key.startsWith("trending")
          ? "trending"
          : key.startsWith("latest")
            ? "latest"
            : "search";
        await db.execute(
          "INSERT OR REPLACE INTO DiscoveryCache (id, type, results, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
          [key, type, JSON.stringify(data)],
        );
      } catch (err) {
        console.error("[DiscoveryService] Failed to persist cache:", err);
      }
    }
  }
}
