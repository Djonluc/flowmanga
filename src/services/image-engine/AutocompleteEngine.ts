import type { AutocompleteResult } from "./types";
import type { LegacyImageProvider } from "./types";

export class AutocompleteEngine {
  private providers = new Map<string, LegacyImageProvider>();
  
  // Local alias map (e.g. blond -> blonde_hair)
  private localAliases: Record<string, string> = {
    "blond": "blonde_hair",
    "brunette": "brown_hair",
    "redhead": "red_hair",
    "sfw": "rating:safe",
    "nsfw": "rating:explicit",
  };

  registerProvider(provider: LegacyImageProvider) {
    this.providers.set(provider.id, provider);
  }

  /**
   * Resolves a single tag string through the alias map.
   */
  resolveAlias(tag: string): string {
    const lower = tag.toLowerCase();
    return this.localAliases[lower] || tag;
  }

  /**
   * Autocompletes a query using the primary active provider (or the first registered).
   */
  async getSuggestions(query: string, targetSource?: string): Promise<AutocompleteResult[]> {
    if (!query) return [];
    
    // Check if it's a known alias directly
    if (this.localAliases[query.toLowerCase()]) {
      return [{
        tag: this.localAliases[query.toLowerCase()],
        postCount: 0,
        category: "general",
        source: "local_alias"
      }];
    }

    let provider: LegacyImageProvider | undefined;
    
    if (targetSource && this.providers.has(targetSource)) {
      provider = this.providers.get(targetSource);
    } else {
      // Default to the first available provider (usually Danbooru since it has the best tagging)
      provider = Array.from(this.providers.values())[0];
    }

    if (!provider) return [];

    try {
      return await provider.autocomplete(query);
    } catch (e) {
      console.warn(`[AutocompleteEngine] Failed to get suggestions from ${provider.id}`, e);
      return [];
    }
  }
}
