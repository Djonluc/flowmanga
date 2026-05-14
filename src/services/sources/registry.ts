/**
 * FlowManga Source Provider Registry
 *
 * Central registry that maps URLs to their corresponding SourceProvider.
 * ScraperService delegates to this registry before falling back to
 * generic/headless scraping strategies.
 */

import type { SourceProvider, ContentType, ProviderCategory } from "./types";

class SourceRegistry {
  private providers: Map<string, SourceProvider> = new Map();

  /**
   * Register a provider. Overwrites any existing provider with the same id.
   */
  register(provider: SourceProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Unregister a provider by id.
   */
  unregister(id: string): void {
    this.providers.delete(id);
  }

  /**
   * Find the first provider whose `matchesUrl()` returns true for the given URL.
   * Returns null if no provider matches.
   */
  resolve(url: string): SourceProvider | null {
    for (const provider of this.providers.values()) {
      if (provider.matchesUrl(url)) return provider;
    }
    return null;
  }

  /**
   * Get a provider by its unique id.
   */
  get(id: string): SourceProvider | null {
    return this.providers.get(id) || null;
  }

  /**
   * List all registered providers.
   */
  list(): SourceProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * List providers filtered by content type.
   */
  listByType(type: ContentType): SourceProvider[] {
    return this.list().filter((p) => p.contentType === type);
  }

  listByCategory(category: ProviderCategory): SourceProvider[] {
    return this.list().filter(
      (provider) =>
        provider.category === category ||
        this.inferCategory(provider) === category,
    );
  }

  private inferCategory(provider: SourceProvider): ProviderCategory {
    if (provider.category) return provider.category;
    if (provider.contentType === "gallery" || provider.contentType === "album")
      return "image";
    if (provider.contentType === "doujin") return "doujin";
    return "manga";
  }

  /**
   * Check if any provider is registered for a given domain.
   */
  hasDomain(domain: string): boolean {
    for (const provider of this.providers.values()) {
      if (provider.domains.some((d) => domain.includes(d))) return true;
    }
    return false;
  }
}

/** Global singleton registry instance */
export const sourceRegistry = new SourceRegistry();
