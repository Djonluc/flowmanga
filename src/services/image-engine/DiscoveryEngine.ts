import { HealthMonitor } from "./HealthMonitor";
import { TagParser } from "./parser/TagParser";
import type { BaseProvider } from "./providers/BaseProvider";
import type { ImageMedia, EngineSearchOptions } from "./types";
import { useSettingsStore } from "../../stores/useSettingsStore";

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

      // 4. Does it require authentication?
      if (p.capabilities.authentication || p.capabilities.status === "auth_required") {
        const auth = booruAuth?.[p.id];
        if (p.capabilities.requiresCookies) {
          if (!auth?.sessionCookies) return false; // Missing cookies = disabled
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
          return !auth?.sessionCookies;
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
            interleaved.push(results[ptr]);
            pointers[pIdx]++;
          }
        }
      }
    }

    return interleaved;
  }
}
