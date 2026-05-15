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

export interface ProviderMetrics {
  attempts: number;
  failures: number;
  timeouts: number;
  invalidAssets: number;
  totalDecodeTime: number;
  decodeCount: number;
  consecutiveFailures: number;
}

export class ReliabilityTracker {
  static metrics: Record<string, ProviderMetrics> = {};

  static init(source: string) {
    const s = source.toLowerCase();
    if (!this.metrics[s]) {
      this.metrics[s] = {
        attempts: 0,
        failures: 0,
        timeouts: 0,
        invalidAssets: 0,
        totalDecodeTime: 0,
        decodeCount: 0,
        consecutiveFailures: 0,
      };
    }
  }

  static report(
    source: string,
    event: "timeout" | "invalid" | "failure" | "success",
    decodeTime?: number,
  ) {
    const s = source.toLowerCase();
    this.init(s);
    const m = this.metrics[s];
    m.attempts++;
    if (event === "success") {
      m.consecutiveFailures = 0;
      if (decodeTime !== undefined) {
        m.totalDecodeTime += decodeTime;
        m.decodeCount++;
      }
    } else {
      m.failures++;
      m.consecutiveFailures++;
      if (event === "timeout") m.timeouts++;
      if (event === "invalid") m.invalidAssets++;
    }
  }

  static getWeight(source: string): number {
    const s = source.toLowerCase();
    this.init(s);
    const m = this.metrics[s];

    let weight = 1.0;
    // Base penalty for hard-coded zerochan over-representation
    if (s.includes("zerochan")) weight *= 0.5;

    if (m.attempts === 0) return weight;

    const failureRate = m.failures / m.attempts;
    weight -= failureRate * 0.5; // Up to 50% penalty for failures

    if (m.consecutiveFailures > 2) {
      weight *= Math.pow(0.5, m.consecutiveFailures - 2); // Exponential decay for consecutive failures
    }

    return Math.max(0.1, weight); // Never drop below 0.1
  }
}

export class DiscoveryService {
  private static cache = new Map<string, CacheEntry>();
  private static CACHE_TTL = 1000 * 60 * 60 * 2; // 2 hours
  private static SEARCH_CACHE_TTL = 1000 * 60 * 30; // 30 minutes for search results
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

  /**
   * Get trending updates from all active providers.
   */
  static async getTrending(
    limit: number = 20,
    coloredOnly: boolean = false,
    category?: ProviderCategory,
  ): Promise<SourceSearchResult[]> {
    const cacheKey = `trending_${limit}_${coloredOnly}_${category ?? "all"}`;

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
            "trending",
            limit,
            coloredOnly,
            category,
          );
        }

        return data;
      }
    } catch (err) {
      console.warn("[DiscoveryService] DB cache miss for trending:", err);
    }

    return this.refreshDiscovery(
      cacheKey,
      "trending",
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
    limit: number = 48,
    coloredOnly: boolean = false,
    page: number = 1,
    category?: ProviderCategory,
  ): Promise<SourceSearchResult[]> {
    const cacheKey = `search_${query}_${limit}_${coloredOnly}_${page}_${category ?? "all"}`;

    // Check memory cache with shorter TTL for search results
    const memCached = this.getCache(cacheKey, this.SEARCH_CACHE_TTL);
    if (memCached) return memCached;

    const providers = this.getProvidersByCategory(category);
    const tasks = providers.map((p) => {
      if (!p.search) return Promise.resolve([]);
      return this.withTimeout(
        p.search(query, page, Math.min(limit * 2, 100)), // Fetch more per provider for better aggregation
        this.DEFAULT_TIMEOUT,
        [],
      );
    });

    const results = await Promise.allSettled(tasks);
    const flattenedResults: SourceSearchResult[][] = results.map((r) =>
      r.status === "fulfilled" ? r.value : [],
    );

    const finalResults = this.filterRestrictedContent(
      this.interleave(flattenedResults, limit, coloredOnly),
      coloredOnly,
    ).filter((item) => this.matchesCategory(item, category));

    // Cache search results with shorter TTL
    this.setCache(cacheKey, finalResults, false, this.SEARCH_CACHE_TTL);

    // Preload thumbnails for better performance
    this.preloadThumbnails(finalResults);

    return finalResults;
  }

  /**
   * Global tag search across all providers.
   */
  static async searchGlobalByTags(
    tags: string[],
    limit: number = 48,
    coloredOnly: boolean = false,
    category?: ProviderCategory,
  ): Promise<SourceSearchResult[]> {
    const providers = this.getProvidersByCategory(category);
    let stats = { total: 0, failed: 0, providers: [] as string[] };

    const tasks = providers.map(async (p) => {
      if (!p.searchByTags) return [];
      try {
        // Search multiple pages for better results
        const pagePromises = [];
        for (let page = 1; page <= 3; page++) {
          // Search up to 3 pages per provider
          pagePromises.push(
            this.withTimeout(
              p.searchByTags(tags, page, Math.min(limit, 50)),
              this.DEFAULT_TIMEOUT,
              [],
            ),
          );
        }
        const pageResults = await Promise.allSettled(pagePromises);
        const combined = pageResults
          .map((r) => (r.status === "fulfilled" ? r.value : []))
          .flat();

        console.log(
          `[DiscoveryService] Provider '${p.name}' returned ${combined.length} results for tags: ${tags.join(", ")}`,
        );
        if (combined.length > 0) {
          stats.providers.push(`${p.name} (${combined.length})`);
          stats.total += combined.length;
        }
        return combined;
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

    const normalizeTitle = (t: string) =>
      t.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Flatten and filter each source first
    const processedSources = sourceResults.map((results) =>
      this.filterRestrictedContent(results, coloredOnly),
    );

    const pool = processedSources.flat().filter(Boolean);

    const groupedBySource: Record<string, SourceSearchResult[]> = {};
    for (const item of pool) {
      const src = item.source?.toLowerCase() || "unknown";
      if (!groupedBySource[src]) groupedBySource[src] = [];
      groupedBySource[src].push(item);
    }

    const sourceCounts: Record<string, number> = {};
    const sourceLimit = Math.max(
      1,
      Math.ceil(limit / Math.max(1, Object.keys(groupedBySource).length)) + 1,
    );
    let lastSource = "";

    while (interleaved.length < limit) {
      const availableSources = Object.keys(groupedBySource).filter(
        (source) =>
          groupedBySource[source].length > 0 &&
          (sourceCounts[source] || 0) < sourceLimit,
      );
      if (availableSources.length === 0) break;

      let totalWeight = 0;
      const weights = availableSources.map((source) => {
        const baseWeight = Math.max(
          0.1,
          Math.min(1, ReliabilityTracker.getWeight(source)),
        );
        const countPenalty = 1 / (1 + (sourceCounts[source] || 0));
        let weight = baseWeight * countPenalty;

        if (source === lastSource && availableSources.length > 1) {
          weight *= 0.25;
        }

        return { source, weight };
      });

      weights.forEach((item) => {
        totalWeight += item.weight;
      });

      if (totalWeight === 0) {
        availableSources.sort(
          (a, b) => (sourceCounts[a] || 0) - (sourceCounts[b] || 0),
        );
        const fallback = availableSources[0];
        const item = groupedBySource[fallback].shift()!;
        const normTitle = normalizeTitle(item.title);
        if (!seenTitles.has(normTitle)) {
          seenTitles.add(normTitle);
          interleaved.push(item);
          sourceCounts[fallback] = (sourceCounts[fallback] || 0) + 1;
        }
        lastSource = fallback;
        continue;
      }

      let randomObj = Math.random() * totalWeight;
      let selectedSource = availableSources[0];
      for (const data of weights) {
        randomObj -= data.weight;
        if (randomObj <= 0) {
          selectedSource = data.source;
          break;
        }
      }

      const item = groupedBySource[selectedSource].shift()!;
      const normTitle = normalizeTitle(item.title);
      if (!seenTitles.has(normTitle)) {
        seenTitles.add(normTitle);
        interleaved.push(item);
        sourceCounts[selectedSource] = (sourceCounts[selectedSource] || 0) + 1;
        lastSource = selectedSource;
      }
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

  private static getCache(
    key: string,
    ttl: number = this.CACHE_TTL,
  ): SourceSearchResult[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Preload thumbnails for better performance
   */
  static preloadThumbnails(
    results: SourceSearchResult[],
    priorityCount: number = 12,
  ): void {
    if (typeof window === "undefined") return; // Skip on server-side

    const preloadImage = (src: string) => {
      if (!src) return;
      const img = new Image();
      img.src = src;
      img.loading = "lazy";
    };

    // Preload high-priority thumbnails first
    const highPriority = results.slice(0, priorityCount);
    highPriority.forEach((item) => {
      if (item.thumbnail) {
        preloadImage(item.thumbnail);
      }
    });

    // Preload remaining thumbnails with delay to avoid overwhelming
    if (results.length > priorityCount) {
      setTimeout(() => {
        const remaining = results.slice(priorityCount);
        remaining.forEach((item) => {
          if (item.thumbnail) {
            preloadImage(item.thumbnail);
          }
        });
      }, 100);
    }
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
