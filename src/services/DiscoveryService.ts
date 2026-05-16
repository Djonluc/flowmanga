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
  ContentType,
  SourceProvider,
  SourceSearchResult,
  SourceSearchOptions,
  MediaDomain,
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
  private static readonly DEFAULT_TIMEOUT = 12000;
  private static readonly SEARCH_CACHE_TTL = 1000 * 60 * 15; // 15 minutes
  private static readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour
  private static readonly MAX_CACHE_ENTRIES = 50;
  private static readonly MAX_CONCURRENT_REQUESTS = 4; // Phase 5.3: Limit concurrent provider requests

  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static searchOffsets = new Map<string, Record<string, number>>();

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
    mediaDomain?: MediaDomain,
    signal?: AbortSignal,
  ): Promise<SourceSearchResult[]> {
    const cacheKey = `latest_${limit}_${coloredOnly}_${mediaDomain ?? "all"}`;

    const memCached = this.getCache(cacheKey);
    if (memCached) return memCached;

    try {
      type DbCacheRow = { results: string; updatedAt: string };
      const { getDb } = await import("./db");
      const db = getDb();
      const dbResult = await db.select<DbCacheRow[]>(
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
            mediaDomain,
            signal,
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
      mediaDomain,
      signal,
    );
  }

  /**
   * Get trending updates from all active providers.
   */
  static async getTrending(
    limit: number = 20,
    coloredOnly: boolean = false,
    mediaDomain?: MediaDomain,
    signal?: AbortSignal,
  ): Promise<SourceSearchResult[]> {
    const cacheKey = `trending_${limit}_${coloredOnly}_${mediaDomain ?? "all"}`;

    const memCached = this.getCache(cacheKey);
    if (memCached) return memCached;

    try {
      type DbCacheRow = { results: string; updatedAt: string };
      const { getDb } = await import("./db");
      const db = getDb();
      const dbResult = await db.select<DbCacheRow[]>(
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
            mediaDomain,
            signal,
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
      mediaDomain,
      signal,
    );
  }

  private static async refreshDiscovery(
    cacheKey: string,
    type: "trending" | "latest",
    limit: number,
    coloredOnly: boolean,
    mediaDomain?: MediaDomain,
    signal?: AbortSignal,
  ): Promise<SourceSearchResult[]> {
    // Local Provider Scraping
    type DiscoveryFallbackProvider = {
      fetchPopular?: (
        page: number,
        limit: number,
        coloredOnly: boolean,
      ) => Promise<SourceSearchResult[]>;
      fetchLatest?: (
        page: number,
        limit: number,
        coloredOnly: boolean,
      ) => Promise<SourceSearchResult[]>;
      search?: (
        query: string,
        options: SourceSearchOptions,
      ) => Promise<SourceSearchResult[]>;
    };

    const providers = this.getProvidersByMediaDomain(mediaDomain).filter(
      (p) => {
        const providerAny = p as DiscoveryFallbackProvider;

        return type === "trending"
          ? !!p.getTrending ||
              !!providerAny.fetchPopular ||
              !!providerAny.fetchLatest ||
              !!p.search
          : !!p.getLatest ||
              !!providerAny.fetchLatest ||
              !!providerAny.fetchPopular ||
              !!p.search;
      },
    );
    const { booruAuth } = useSettingsStore.getState();
    const tasks = providers.map((p) => async () => {
      if (signal?.aborted) return [];
      try {
        if (type === "latest" && p.getLatest) {
          return await this.withTimeout(
            p.getLatest({
              page: 1,
              limit,
              auth: booruAuth[p.id],
              signal,
            }),
            this.DEFAULT_TIMEOUT,
            [],
            signal,
          );
        }
        if (type === "trending" && p.getTrending) {
          return await this.withTimeout(
            p.getTrending({
              page: 1,
              limit,
              auth: booruAuth[p.id],
              signal,
            }),
            this.DEFAULT_TIMEOUT,
            [],
            signal,
          );
        }

        const anyProvider = p as {
          fetchPopular?: (
            page: number,
            limit: number,
            coloredOnly: boolean,
          ) => Promise<SourceSearchResult[]>;
          fetchLatest?: (
            page: number,
            limit: number,
            coloredOnly: boolean,
          ) => Promise<SourceSearchResult[]>;
          search?: (
            query: string,
            options: SourceSearchOptions,
          ) => Promise<SourceSearchResult[]>;
        };

        if (
          type === "trending" &&
          typeof anyProvider.fetchPopular === "function"
        ) {
          return await this.withTimeout(
            anyProvider.fetchPopular(1, limit, coloredOnly),
            this.DEFAULT_TIMEOUT,
            [],
            signal,
          );
        }

        if (typeof anyProvider.fetchLatest === "function") {
          return await this.withTimeout(
            anyProvider.fetchLatest(1, limit, coloredOnly),
            this.DEFAULT_TIMEOUT,
            [],
            signal,
          );
        }

        if (p.search) {
          return await this.withTimeout(
            p.search("a", {
              page: 1,
              limit,
              auth: booruAuth[p.id],
              signal,
            }),
            this.DEFAULT_TIMEOUT,
            [],
            signal,
          );
        }
      } catch {
        return [];
      }

      return [];
    });

    const results = await this.pool(tasks, this.MAX_CONCURRENT_REQUESTS);
    const interleaved = this.interleave(results, limit, coloredOnly);
    this.setCache(cacheKey, interleaved);
    return interleaved;
  }

  /**
   * Get random content from all active providers.
   */
  static async getRandom(
    limit: number = 20,
    coloredOnly: boolean = false,
    mediaDomain?: MediaDomain,
    signal?: AbortSignal,
  ): Promise<SourceSearchResult[]> {
    const providers = this.getProvidersByMediaDomain(mediaDomain).filter(
      (p) => {
        const providerAny = p as {
          getRandom?: (
            page?: number,
            limit?: number,
          ) => Promise<SourceSearchResult[]>;
          fetchRandom?: (
            page?: number,
            limit?: number,
          ) => Promise<SourceSearchResult[]>;
          fetchLatest?: (
            page: number,
            limit: number,
            coloredOnly: boolean,
          ) => Promise<SourceSearchResult[]>;
          fetchPopular?: (
            page: number,
            limit: number,
            coloredOnly: boolean,
          ) => Promise<SourceSearchResult[]>;
          search?: (
            query: string,
            options: SourceSearchOptions,
          ) => Promise<SourceSearchResult[]>;
        };

        return (
          !!p.getTrending ||
          !!p.getLatest ||
          !!p.getRandom ||
          !!providerAny.fetchRandom ||
          !!providerAny.fetchLatest ||
          !!providerAny.fetchPopular ||
          !!p.search
        );
      },
    );
    if (providers.length === 0) return [];

    const { booruAuth } = useSettingsStore.getState();
    const tasks = providers.map((p) => async () => {
      const page = Math.floor(Math.random() * 5) + 1;
      const methods: Array<() => Promise<SourceSearchResult[]>> = [];
      if (p.getRandom) {
        methods.push(() => p.getRandom!());
      }
      if (p.getTrending) {
        methods.push(() =>
          p.getTrending!({
            page,
            limit,
            auth: booruAuth[p.id],
            signal,
          }),
        );
      }
      if (p.getLatest) {
        methods.push(() =>
          p.getLatest!({
            page,
            limit,
            auth: booruAuth[p.id],
            signal,
          }),
        );
      }

      type RandomFallbackProvider = {
        fetchRandom?: (
          page?: number,
          limit?: number,
        ) => Promise<SourceSearchResult[]>;
        fetchLatest?: (
          page: number,
          limit: number,
          coloredOnly: boolean,
        ) => Promise<SourceSearchResult[]>;
        fetchPopular?: (
          page: number,
          limit: number,
          coloredOnly: boolean,
        ) => Promise<SourceSearchResult[]>;
        search?: (
          query: string,
          options: SourceSearchOptions,
        ) => Promise<SourceSearchResult[]>;
      };

      const providerAny = p as RandomFallbackProvider;
      if (typeof providerAny.fetchRandom === "function") {
        methods.push(() => providerAny.fetchRandom!(page, limit));
      }
      if (typeof providerAny.fetchLatest === "function") {
        methods.push(() => providerAny.fetchLatest!(page, limit, coloredOnly));
      }
      if (typeof providerAny.fetchPopular === "function") {
        methods.push(() => providerAny.fetchPopular!(page, limit, coloredOnly));
      }
      if (p.search) {
        const search = p.search;
        methods.push(() =>
          search("a", {
            page,
            limit,
            auth: booruAuth[p.id],
            signal,
          }),
        );
      }

      if (methods.length === 0) {
        return [];
      }

      const randomMethod = methods[Math.floor(Math.random() * methods.length)];
      return await this.withTimeout(randomMethod(), this.DEFAULT_TIMEOUT, [], signal);
    });

    const results = await this.pool(tasks, this.MAX_CONCURRENT_REQUESTS);

    const seen = new Set<string>();
    const unique = results.flat().filter((item) => {
      if (!item || !item.id) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    return this.filterRestrictedContent(unique, coloredOnly)
      .filter((item) => this.matchesMediaDomain(item, mediaDomain))
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
    mediaDomain?: MediaDomain,
    signal?: AbortSignal,
  ): Promise<SourceSearchResult[]> {
    const cacheKey = `search_${query}_${limit}_${coloredOnly}_${page}_${mediaDomain ?? "all"}`;

    // Check memory cache with shorter TTL for search results
    const memCached = this.getCache(cacheKey, this.SEARCH_CACHE_TTL);
    if (memCached) return memCached;

    const { booruAuth } = useSettingsStore.getState();
    const providers = this.getProvidersByMediaDomain(mediaDomain);
    
    // Manage search entropy offsets
    const queryKey = `global_${query}_${mediaDomain ?? "all"}`;
    if (page === 1) {
      const offsets: Record<string, number> = {};
      providers.forEach(p => {
        // Random offset 0-3 pages for broader discovery
        offsets[p.id] = Math.floor(Math.random() * 4);
      });
      this.searchOffsets.set(queryKey, offsets);
    }
    const offsets = this.searchOffsets.get(queryKey) || {};

    const tasks = [...providers].sort(() => Math.random() - 0.5).map((p) => async () => {
      if (!p.search) return [];
      const actualPage = page + (offsets[p.id] || 0);
      return await this.withTimeout(
        p.search(query, {
          page: actualPage,
          limit: Math.min(limit * 2, 100),
          auth: booruAuth[p.id],
          signal,
        }), // Fetch more per provider for better aggregation
        this.DEFAULT_TIMEOUT,
        [],
        signal,
      );
    });

    const results = await this.pool(tasks, this.MAX_CONCURRENT_REQUESTS);
    const flattenedResults: SourceSearchResult[][] = results;

    const finalResults = this.filterRestrictedContent(
      this.interleave(flattenedResults, limit, coloredOnly),
      coloredOnly,
    ).filter((item) => this.matchesMediaDomain(item, mediaDomain));

    // Cache search results with shorter TTL
    this.setCache(cacheKey, finalResults, false);

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
    page: number = 1,
    mediaDomain?: MediaDomain,
    signal?: AbortSignal,
  ): Promise<SourceSearchResult[]> {
    const providers = this.getProvidersByMediaDomain(mediaDomain);
    const stats = { total: 0, failed: 0, providers: [] as string[] };

    const queryKey = `tags_${tags.join(",")}_${mediaDomain ?? "all"}`;
    if (page === 1) {
      const offsets: Record<string, number> = {};
      providers.forEach(p => {
        // Random offset 0-4 pages for broader discovery
        offsets[p.id] = Math.floor(Math.random() * 5);
      });
      this.searchOffsets.set(queryKey, offsets);
    }
    const offsets = this.searchOffsets.get(queryKey) || {};

    const tasks = [...providers]
      .filter((p) => p.capabilities.tagSearch)
      .sort(() => Math.random() - 0.5)
      .map((p) => async () => {
        const { booruAuth } = useSettingsStore.getState();
        try {
          const actualPage = page + (offsets[p.id] || 0);

          const result = await this.withTimeout(
            p.searchByTags!(tags, {
              page: actualPage,
              limit: Math.max(limit * 2, 100), // Fetch more for tags to ensure enough unique matches after interleaving/filtering
              auth: booruAuth[p.id],
              signal,
            }),
            this.DEFAULT_TIMEOUT,
            [],
            signal,
          );
          const combined = result;

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

    const results = await this.pool(tasks, this.MAX_CONCURRENT_REQUESTS);



    const normalizedQueryTags = tags
      .map((tag) =>
        tag
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^\w\-:@~.()]/g, "")
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, ""),
      )
      .filter(Boolean);

    const finalResults = this.filterRestrictedContent(
      this.interleave(results, limit * results.length, coloredOnly),
      coloredOnly,
    ).filter((item) => this.matchesMediaDomain(item, mediaDomain));

    // Import toast dynamically to avoid circular dependencies
    import("../components/Toast")
      .then(({ toast }) => {
        if (finalResults.length > 0) {
          toast.info(
            `Found ${finalResults.length} matching items from: ${stats.providers.join(", ")}`,
          );
        } else if (stats.failed > 0) {
          toast.error(
            `${stats.failed} providers failed to respond to tag search.`,
          );
        } else if (tags.length > 0) {
          toast.info(`No matches found for tags across active providers.`);
        }
      })
      .catch(() => {});

    if (finalResults.length === 0 && tags.length === 1) {
      console.info(
        `[DiscoveryService] Tag search returned no results for '${tags[0]}'; falling back to global search.`,
      );
      return this.searchGlobal(tags[0], limit, coloredOnly, page, mediaDomain);
    }

    return finalResults;
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
    const categorized: SourceSearchResult[] = validItems.map((item) => {
      if (item.contentType) return item;

      const source = item.source?.toLowerCase() || "";
      const tags = (item.tags || []).map((t) => t.toLowerCase());

      let type: ContentType = "manga";

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

      return { ...item, contentType: type } as SourceSearchResult;
    });

    let filtered = ContentFilter.filterResults(categorized);

    // 1. Full Color Filter — delegates to ContentFilter's unified tag normalization
    if (coloredOnly) {
      filtered = ContentFilter.filterColoredContent(filtered);
    }

    return filtered;
  }

  private static matchesMediaDomain(
    item: SourceSearchResult,
    mediaDomain?: MediaDomain,
  ): boolean {
    if (!mediaDomain) return true;
    if (mediaDomain === "image")
      return (
        item.mediaDomain === "image" ||
        item.contentType === "gallery" ||
        item.contentType === "album"
      );
    return (
      item.mediaDomain === "manga" ||
      item.contentType === "manga" ||
      item.contentType === "comic" ||
      item.contentType === "manhwa" ||
      item.contentType === "manhua" ||
      item.contentType === "doujin"
    );
  }

  private static getProvidersByMediaDomain(
    mediaDomain?: MediaDomain,
  ): SourceProvider[] {
    return mediaDomain
      ? sourceRegistry.listByMediaDomain(mediaDomain)
      : sourceRegistry.list();
  }

  private static interleave(
    sourceResults: SourceSearchResult[][],
    limit: number,
    coloredOnly: boolean = false,
  ): SourceSearchResult[] {
    const interleaved: SourceSearchResult[] = [];
    const seenIds = new Set<string>();

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
    const sourceLimit = limit; // Allow any source to fill the entire limit if others are empty/failed
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
        const dedupeKey = item.id;
        if (!seenIds.has(dedupeKey)) {
          seenIds.add(dedupeKey);
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
      const dedupeKey = item.id;
      if (!seenIds.has(dedupeKey)) {
        seenIds.add(dedupeKey);
        interleaved.push(item);
        sourceCounts[selectedSource] =
          (sourceCounts[selectedSource] || 0) + 1;
        lastSource = selectedSource;
      }
    }

    return interleaved;
  }

  private static async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    defaultValue: T,
    signal?: AbortSignal,
  ): Promise<T> {
    if (signal?.aborted) return defaultValue;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => resolve(defaultValue), ms);
    });

    const abortPromise = new Promise<T>((resolve) => {
      if (signal) {
        signal.addEventListener("abort", () => resolve(defaultValue), {
          once: true,
        });
      }
    });

    try {
      // Race against actual work, timeout, and explicit abort signal
      return await Promise.race([promise, timeoutPromise, abortPromise]);
    } catch (e) {
      return defaultValue;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private static async pool<T>(
    tasks: (() => Promise<T>)[],
    limit: number,
  ): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let index = 0;

    const workers = Array.from(
      { length: Math.min(limit, tasks.length) },
      async () => {
        while (index < tasks.length) {
          const i = index++;
          try {
            results[i] = await tasks[i]();
          } catch (e) {
            console.error("[DiscoveryService] Pool task failed:", e);
            results[i] = [] as any;
          }
        }
      },
    );

    await Promise.all(workers);
    return results;
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
   * Preload thumbnails for better performance — capped to priorityCount only
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

    // Preload high-priority thumbnails only — browser lazy-loading handles the rest
    const getThumbnailSrc = (item: SourceSearchResult) =>
      item.previewUrl ||
      item.coverUrl ||
      item.imageUrl ||
      item.fullResUrl ||
      item.sample_url ||
      item.file_url ||
      "";

    const highPriority = results.slice(0, priorityCount);
    highPriority.forEach((item) => {
      const thumbnail = getThumbnailSrc(item);
      if (thumbnail) {
        preloadImage(thumbnail);
      }
    });
  }

  private static async setCache(
    key: string,
    data: SourceSearchResult[],
    persist: boolean = true,
  ) {
    this.cache.set(key, { data, timestamp: Date.now() });

    // Evict oldest entries if cache exceeds size cap
    if (this.cache.size > this.MAX_CACHE_ENTRIES) {
      const excess = this.cache.size - this.MAX_CACHE_ENTRIES;
      const keys = this.cache.keys();
      for (let i = 0; i < excess; i++) {
        const oldest = keys.next().value;
        if (oldest) this.cache.delete(oldest);
      }
    }

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
