import { HealthMonitor } from "./HealthMonitor";
import { TagParser } from "./parser/TagParser";
import type { BaseProvider } from "./providers/BaseProvider";
import type { ImageMedia, EngineSearchOptions, StructuredQuery } from "./types";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { isSankakuCoolingDown } from "../Sankaku";

export class DiscoveryEngine {
  private providers = new Map<string, BaseProvider>();
  private monitor = HealthMonitor.getInstance();

  registerProvider(provider: BaseProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): BaseProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): BaseProvider[] {
    return Array.from(this.providers.values());
  }

  getActiveProviders(): BaseProvider[] {
    const booruAuth = useSettingsStore.getState().booruAuth;
    const disabledSources = useSettingsStore.getState().disabledSources || [];

    return this.getAllProviders().filter(p => {
      // 1. Is it disabled by the user?
      if (disabledSources.includes(p.id)) return false;
      
      // 2. Is it marked as permanently disabled by the system?
      if (p.capabilities.status === "disabled") return false;

      // 3. Is it circuit-broken / unhealthy?
      if (!this.monitor.isAvailable(p.id)) return false;

      // 4. Does it require authentication? Sankaku exposes public feeds; a
      // session improves coverage but is not required to list the source.
      if (p.capabilities.authentication || p.capabilities.status === "auth_required") {
        if (p.id === 'sankaku') return true;
        const auth = booruAuth?.[p.id];
        if (p.capabilities.requiresCookies) {
          if (!auth?.sessionCookies) return false;
        } else {
          if (!auth?.userId || !auth?.apiKey) return false; // Missing API keys = disabled
        }
      }

      return true;
    });
  }

  // Helper to check what providers need authentication but don't have it
  getProvidersMissingAuth(): BaseProvider[] {
    const booruAuth = useSettingsStore.getState().booruAuth;
    const disabledSources = useSettingsStore.getState().disabledSources || [];

    return this.getAllProviders().filter(p => {
      // Don't prompt for sources the user explicitly disabled
      if (disabledSources.includes(p.id)) return false;
      if (p.capabilities.status === "disabled") return false;

      if (p.capabilities.authentication || p.capabilities.status === "auth_required") {
        const auth = booruAuth?.[p.id];
        if (p.capabilities.requiresCookies) {
          return p.id !== 'sankaku' && !auth?.sessionCookies;
        } else {
          return !auth?.userId || !auth?.apiKey;
        }
      }
      return false;
    });
  }

  async search(queryStr: string, options: EngineSearchOptions): Promise<ImageMedia[]> {
    const query = TagParser.parse(queryStr, options.ratingFilter);

    // If source is targeted, bypass routing
    if (query.targetSource && this.providers.has(query.targetSource)) {
      const p = this.providers.get(query.targetSource)!;
      if (!this.monitor.isAvailable(p.id)) {
        console.warn(`[DiscoveryEngine] Targeted source ${p.id} is circuit-broken.`);
        return [];
      }
      return this.fetchWithFallback(p, "search", query, options);
    }

    // Parallel aggregation
    const activeProviders = this.getActiveProviders();
    if (activeProviders.length === 0) return [];

    const promises = activeProviders.map(p => 
      this.fetchWithFallback(p, "search", query, options).catch(() => [] as ImageMedia[])
    );

    const resultsArray = await Promise.all(promises);
    return this.interleaveResults(resultsArray, activeProviders);
  }

  async getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]> {
    const activeProviders = this.getActiveProviders();
    if (activeProviders.length === 0) return [];

    const promises = activeProviders.map(p => 
      this.fetchWithFallback(p, "discovery", null, options).catch(() => [] as ImageMedia[])
    );

    const resultsArray = await Promise.all(promises);
    return this.interleaveResults(resultsArray, activeProviders);
  }

  /** Fetch newest content from every active provider and merge it fairly. */
  async getLatest(options: EngineSearchOptions): Promise<ImageMedia[]> {
    const activeProviders = this.getActiveProviders();
    if (activeProviders.length === 0) return [];

    const resultsArray = await Promise.all(
      activeProviders.map((provider) =>
        Promise.race([
          provider.getLatest(options),
          new Promise<ImageMedia[]>((resolve) => setTimeout(() => resolve([]), 15000)),
        ]).catch((error) => {
          console.warn(`[DiscoveryEngine] Latest provider ${provider.id} failed:`, error);
          return [] as ImageMedia[];
        }),
      ),
    );

    return this.interleaveResults(resultsArray, activeProviders)
      .sort((a, b) => this.toTimestamp(b.createdAt) - this.toTimestamp(a.createdAt));
  }

  /** Fetch a broad, shuffled page from every active provider. */
  async getRandom(options: EngineSearchOptions): Promise<ImageMedia[]> {
    const page = Math.max(1, (options.page || 1) + Math.floor(Math.random() * 5));
    const results = await this.getDiscovery({ ...options, page });

    for (let i = results.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
    return results;
  }

  private async fetchWithFallback(
    provider: BaseProvider,
    method: "search" | "discovery",
    query: StructuredQuery | null,
    options: EngineSearchOptions,
    maxDepth: number = 3
  ): Promise<ImageMedia[]> {
    let currentPage = options.page || 1;
    let accumulated: ImageMedia[] = [];
    let attempts = 0;

    // We want to return at least some items. If a provider returns 0 items (fully filtered or empty page),
    // we fetch the next page up to maxDepth times.
    while (attempts < maxDepth) {
      attempts++;
      const currentOptions = { ...options, page: currentPage };
      const start = Date.now();

      try {
        const timeoutPromise = new Promise<ImageMedia[]>((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 15000)
        );

        let results: ImageMedia[];
        if (method === "search" && query) {
          results = await Promise.race([provider.search(query, currentOptions), timeoutPromise]);
        } else {
          results = await Promise.race([provider.getDiscovery(currentOptions), timeoutPromise]);
        }

        this.monitor.recordSuccess(provider.id, Date.now() - start);
        accumulated = accumulated.concat(results);

        console.log(`[DiscoveryEngine] [${provider.id}] Attempt ${attempts} (Page ${currentPage}): Fetched ${results.length} valid items.`);

        // If we found at least 15 valid items, we consider this provider "successful" for this turn.
        if (accumulated.length >= 15) {
          break;
        }

        if (results.length === 0) {
          console.log(`[DiscoveryEngine] [${provider.id}] Returned 0 items. Falling back to page ${currentPage + 1}...`);
        }

        if (provider.id === "sankaku" && isSankakuCoolingDown()) {
          console.info("[DiscoveryEngine] [sankaku] Cooldown active; stopping page fallback attempts.");
          break;
        }

        currentPage++;
      } catch (e) {
        this.monitor.recordFailure(provider.id);
        console.warn(`[DiscoveryEngine] [${provider.id}] Failed on page ${currentPage}:`, e);
        // Break out of the loop on hard network error, no point trying next page if server is dead
        break;
      }
    }

    console.log(`[DiscoveryEngine] [${provider.id}] Finished with ${accumulated.length} total items.`);
    return accumulated;
  }

  private interleaveResults(resultsArray: ImageMedia[][], providers: BaseProvider[]): ImageMedia[] {
    const interleaved: ImageMedia[] = [];
    const pointers = new Array(resultsArray.length).fill(0);
    const seen = new Set<string>();
    
    // Create a weighted pool
    const weights = providers.map(p => this.monitor.getWeight(p.id));
    const maxItems = Math.max(...resultsArray.map(r => r.length));

    for (let i = 0; i < maxItems; i++) {
      for (let pIdx = 0; pIdx < resultsArray.length; pIdx++) {
        const weight = weights[pIdx];
        const results = resultsArray[pIdx];
        
        // Items to pull this round based on weight (e.g., 1 or 2)
        const pullCount = Math.max(1, Math.round(weight));
        
        for (let c = 0; c < pullCount; c++) {
          const ptr = pointers[pIdx];
          if (ptr < results.length) {
            const item = results[ptr];
            if (!seen.has(item.id)) {
              interleaved.push(item);
              seen.add(item.id);
            }
            pointers[pIdx]++;
          }
        }
      }
    }

    return this.groupRelatedResults(interleaved);
  }

  private groupRelatedResults(items: ImageMedia[]): ImageMedia[] {
    const groups = new Map<string, ImageMedia[]>();
    for (const item of items) {
      if (!item.relatedGroupId) continue;
      const group = groups.get(item.relatedGroupId) || [];
      group.push(item);
      groups.set(item.relatedGroupId, group);
    }

    for (const group of groups.values()) {
      group.sort((a, b) => (a.relatedIndex ?? 0) - (b.relatedIndex ?? 0));
    }

    const emitted = new Set<string>();
    const output: ImageMedia[] = [];
    for (const item of items) {
      if (emitted.has(item.id)) continue;
      const group = item.relatedGroupId ? groups.get(item.relatedGroupId) : undefined;
      for (const member of group || [item]) {
        if (!emitted.has(member.id)) {
          output.push(member);
          emitted.add(member.id);
        }
      }
    }
    return output;
  }

  private toTimestamp(value: string): number {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
}
