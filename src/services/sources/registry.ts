/**
 * FlowManga Source Provider Registry
 *
 * Central registry that maps URLs to their corresponding SourceProvider.
 * ScraperService delegates to this registry before falling back to
 * generic/headless scraping strategies.
 */

import type { SourceProvider, ContentType, MediaDomain } from "./types";

class SourceRegistry {
  private providers: Map<string, SourceProvider> = new Map();

  private isEnabled(provider: SourceProvider): boolean {
    // Check provider-level flag first
    if (provider.isEnabled === false) return false;
    // Check user settings for manga-domain source toggles
    if (provider.mediaDomain === "manga") {
      try {
        const { useSettingsStore } = require("../../stores/useSettingsStore");
        const disabled = useSettingsStore.getState().disabledMangaSources || [];
        if (disabled.includes(provider.id)) return false;
      } catch (_) {}
    }
    return true;
  }

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
      if (!this.isEnabled(provider)) continue;
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
   * List all registered and enabled providers.
   */
  list(): SourceProvider[] {
    return Array.from(this.providers.values()).filter((provider) =>
      this.isEnabled(provider),
    );
  }

  /**
   * List ALL registered providers (including disabled ones).
   * Used by the Sources Settings UI to show toggles.
   */
  listAll(): SourceProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Check if a specific provider is currently enabled.
   */
  isProviderEnabled(id: string): boolean {
    const provider = this.providers.get(id);
    if (!provider) return false;
    return this.isEnabled(provider);
  }

  /**
   * List providers filtered by content type.
   */
  listByType(type: ContentType): SourceProvider[] {
    return this.list().filter((p) => p.contentType === type);
  }

  listByMediaDomain(mediaDomain: MediaDomain): SourceProvider[] {
    return this.list().filter(
      (provider) =>
        provider.mediaDomain === mediaDomain ||
        this.inferMediaDomain(provider) === mediaDomain,
    );
  }

  private inferMediaDomain(provider: SourceProvider): MediaDomain {
    if (provider.mediaDomain) return provider.mediaDomain;
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
