import type { ImageProvider, PlatformImage, SearchQuery } from "./types";
import { useSettingsStore } from "../stores/useSettingsStore";

export class SearchFederator {
  private providers: Map<string, ImageProvider> = new Map();

  registerProvider(provider: ImageProvider) {
    this.providers.set(provider.id, provider);
  }

  getProviders(): ImageProvider[] {
    return Array.from(this.providers.values());
  }

  /** Filters out adult images when the user has adult content disabled. */
  private filterAdult(images: PlatformImage[]): PlatformImage[] {
    const { showAdultContent } = useSettingsStore.getState();
    if (showAdultContent) return images;
    return images.filter(img => img.rating === 'safe' || !img.rating);
  }

  async getActiveProviders(): Promise<ImageProvider[]> {
    const { useSettingsStore } = await import("../stores/useSettingsStore");
    const { isSourceEnabled } = useSettingsStore.getState();
    return this.getProviders().filter(p => isSourceEnabled(p.id));
  }

  async getById(providerId: string, sourceId: string): Promise<PlatformImage | null> {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.getById) return null;
    return provider.getById(sourceId);
  }

  /**
   * Executes a search query. 
   * If the query has a `source` predicate (e.g., `source:danbooru`), it routes only to that provider.
   * Otherwise, it queries all registered providers in parallel and interleaves the results.
   */
  async search(query: SearchQuery, page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const targetSource = query.predicates["source"];
    let activeProviders: ImageProvider[] = [];

    if (targetSource) {
      const provider = this.providers.get(targetSource);
      if (provider) {
        const { useSettingsStore } = await import("../stores/useSettingsStore");
        if (useSettingsStore.getState().isSourceEnabled(provider.id)) {
          activeProviders.push(provider);
        }
      }
    } else {
      activeProviders = await this.getActiveProviders();
    }

    if (activeProviders.length === 0) return [];

    // Fetch from all active providers concurrently
    const promises = activeProviders.map(p => 
      p.search(query, page)
        .then(res => {
          const filtered = this.filterAdult(res);
          if (onChunk && filtered.length > 0) onChunk(filtered);
          return filtered;
        })
        .catch((e: any) => {
          console.warn(`[SearchFederator] Provider ${p.id} timed out or failed gracefully: ${e.message}`);
          return []; // Fail gracefully for individual providers
        })
    );

    const resultsArray = await Promise.all(promises);
    return onChunk ? resultsArray.flat() : this.interleaveResults(resultsArray);
  }

  async getLatest(page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const activeProviders = await this.getActiveProviders();
    if (activeProviders.length === 0) return [];
    
    const promises = activeProviders.map(p => 
      p.getLatest(page)
        .then(res => {
          const filtered = this.filterAdult(res);
          if (onChunk && filtered.length > 0) onChunk(filtered);
          return filtered;
        })
        .catch((e: any) => {
          console.warn(`[SearchFederator] Latest provider ${p.id} timed out or failed gracefully: ${e.message}`);
          return [];
        })
    );

    const resultsArray = await Promise.all(promises);
    return onChunk ? resultsArray.flat() : this.interleaveResults(resultsArray);
  }

  async getCurated(page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const activeProviders = await this.getActiveProviders();
    if (activeProviders.length === 0) return [];

    let discoveryTags = [];
    try {
      const { getDb } = await import("../services/db");
      const db = getDb();
      const favs = await db.select<{tag: string}>("SELECT tag FROM FavoriteTags ORDER BY RANDOM() LIMIT 3");
      discoveryTags = favs.map(f => f.tag);
    } catch (e) {
      console.warn("Failed to load favorite tags for curation", e);
    }

    if (discoveryTags.length === 0) {
      return this.getLatest(page, onChunk);
    }

    // Try finding images with ALL the selected favorite tags (e.g. 3 tags)
    // If it fails or returns 0 results, gradually reduce the tags.
    for (let numTags = discoveryTags.length; numTags > 0; numTags--) {
      const currentTags = discoveryTags.slice(0, numTags);
      
      const promises = activeProviders.map(p => 
        p.search({ raw: currentTags.join(" "), positiveTags: currentTags, negativeTags: [], predicates: {} }, page)
          .then(res => {
            if (onChunk && res.length > 0) onChunk(res);
            return res;
          })
          .catch((e: any) => {
            console.warn(`[SearchFederator] Curated provider ${p.id} timed out or failed gracefully: ${e.message}`);
            return [];
          })
      );

      const resultsArray = await Promise.all(promises);
      const interleaved = onChunk ? resultsArray.flat() : this.interleaveResults(resultsArray);
      
      // If we found results, return them immediately
      if (interleaved.length > 0) {
        return interleaved;
      }
    }

    // If even 1 tag returns 0 results across all providers, just return latest
    return this.getLatest(page, onChunk);
  }

  async getDiscovery(page: number, onChunk?: (images: PlatformImage[]) => void): Promise<PlatformImage[]> {
    const activeProviders = await this.getActiveProviders();
    if (activeProviders.length === 0) return [];

    const promises = activeProviders.map(p => 
      p.getDiscovery(page)
        .then(res => {
          const filtered = this.filterAdult(res);
          if (onChunk && filtered.length > 0) onChunk(filtered);
          return filtered;
        })
        .catch(e => {
          console.warn(`[SearchFederator] Discovery provider ${p.id} timed out or failed gracefully:`, e);
          return [];
        })
    );

    const resultsArray = await Promise.all(promises);
    return onChunk ? resultsArray.flat() : this.interleaveResults(resultsArray);
  }

  /**
   * Interleaves results from multiple providers so the feed feels heterogeneous.
   * (e.g., [Danbooru1, Gelbooru1, Danbooru2, Gelbooru2, ...])
   */
  private interleaveResults(resultsArray: PlatformImage[][]): PlatformImage[] {
    const interleaved: PlatformImage[] = [];
    const maxLen = Math.max(...resultsArray.map(arr => arr.length));

    for (let i = 0; i < maxLen; i++) {
      for (const arr of resultsArray) {
        if (i < arr.length) {
          interleaved.push(arr[i]);
        }
      }
    }

    return interleaved;
  }
}

import { DanbooruProvider } from "./providers/DanbooruProvider";
import { GelbooruProvider } from "./providers/GelbooruProvider";
import { Rule34Provider } from "./providers/Rule34Provider";
import { SankakuProvider } from "./providers/SankakuProvider";
import { NekosProvider } from "./providers/NekosProvider";

// Singleton instance for easy application-wide access
export const federator = new SearchFederator();
federator.registerProvider(new DanbooruProvider());
federator.registerProvider(new GelbooruProvider());
federator.registerProvider(new Rule34Provider());
federator.registerProvider(new SankakuProvider());
federator.registerProvider(new NekosProvider());
