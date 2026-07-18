import type { ImageProvider, PlatformImage, SearchQuery } from "../types";
import { fetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";

export abstract class BaseProvider implements ImageProvider {
  abstract id: string;
  abstract name: string;
  abstract capabilities: {
    maxTags: number;
    supportsNegative: boolean;
    supportsScore: boolean;
    authentication?: boolean;
    requiresCookies?: boolean;
    authUrl?: string;
    status?: string;
    search?: boolean;
    tagSearch?: boolean;
  };
  domains: string[] = [];
  isEnabled = true;

  /**
   * Helper function to fetch JSON via Tauri's HTTP plugin.
   * This bypasses CORS issues since the request is made from the Rust backend.
   */
  protected async fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
    let retries = 3;
    let delay = 1000;
    let headlessAttempted = false;
    
    while (retries > 0) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "FlowManga/3.0",
            ...headers
          }
        });

        if (response.status === 401 || response.status === 403 || response.status === 429) {
          console.warn(`[${this.id}] Rate limited/Blocked (${response.status}). Falling back to Headless Webview...`);
          if (!headlessAttempted) {
            headlessAttempted = true;
            try {
              const rawJson = await invoke<string>("fetch_json_headless", { url: url.toString(), headers });
              try {
                return JSON.parse(rawJson.trim()) as T;
              } catch {
                const preview = rawJson.trim().replace(/\s+/g, " ").slice(0, 160);
                throw new Error(`Headless response was not JSON${preview ? `: ${preview}` : ""}`);
              }
            } catch (headlessErr) {
              console.warn(`[${this.id}] Headless fallback unavailable:`, headlessErr);
            }
          }

          // Authentication failures and hard blocks will not recover by
          // repeating the same request. Let the federator move on to other
          // sources immediately after the one headless attempt.
          if (response.status === 401 || response.status === 403) {
            throw new Error(`[${this.id}] HTTP error! status: ${response.status}`);
          }

          if (retries > 1) {
            console.warn(`[${this.id}] Retrying standard fetch in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            retries--;
            continue;
          }
        }

        if (!response.ok) {
          throw new Error(`[${this.id}] HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (error: any) {
        if (retries > 1) {
          console.warn(`[${this.id}] Fetch/Parse error: ${error.message}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          retries--;
          continue;
        }
        throw error;
      }
    }
    
    throw new Error(`[${this.id}] Max retries reached.`);
  }

  /**
   * Helper function to fetch HTML via Tauri's HTTP plugin.
   */
  protected async fetchHtml(url: string, headers: Record<string, string> = {}): Promise<string> {
    let retries = 3;
    let delay = 1000;
    
    while (retries > 0) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "FlowManga/3.0",
            "Accept": "text/html",
            ...headers
          }
        });

        if (response.status === 429 && retries > 1) {
          console.warn(`[${this.id}] Rate limited (429). Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          retries--;
          continue;
        }

        if (!response.ok) {
          throw new Error(`[${this.id}] HTTP error! status: ${response.status}`);
        }

        return await response.text();
      } catch (error: any) {
        if (retries > 1) {
          console.warn(`[${this.id}] Fetch/Parse error: ${error.message}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          retries--;
          continue;
        }
        throw error;
      }
    }
    
    throw new Error(`[${this.id}] Max retries reached.`);
  }

  abstract search(query: SearchQuery, page: number): Promise<PlatformImage[]>;
  
  /** Autocomplete a tag prefix returning up to 10 suggestions */
  abstract autocompleteTags(query: string): Promise<string[]>;

  async getLatest(page: number): Promise<PlatformImage[]> {
    return this.search({ raw: "", positiveTags: [], negativeTags: [], predicates: {} }, page);
  }

  abstract getDiscovery(page: number): Promise<PlatformImage[]>;
  
  async getById(id: string): Promise<PlatformImage | null> {
    // Default implementation falls back to returning null
    // Providers should override this if they support explicit ID fetching
    return null;
  }
  
  /**
   * Deduce the media type from a URL string to allow instant caching and filtering
   */
  protected getMediaType(url: string): 'image' | 'video' | 'gif' {
    if (!url) return 'image';
    const match = url.match(/\.(png|jpg|jpeg|gif|webm|mp4|avif|webp|mov)(?:\?|$)/i);
    if (match && match[1]) {
      const ext = match[1].toLowerCase();
      if (ext === 'mp4' || ext === 'webm' || ext === 'mov') return 'video';
      if (ext === 'gif') return 'gif';
    }
    // Fallback default
    return 'image';
  }

  /**
   * Performs a bulk tag API lookup to resolve the actual types of tags.
   * Relies on the user's custom `Artist Tag API URL` configured in Settings.
   * Returns a Map of lowercased tag name → type string (e.g. "0", "1", "3", "4", "5").
   */
  protected async resolveTags(uniqueTags: string[]): Promise<Map<string, string>> {
    if (uniqueTags.length === 0) return new Map();

    const { useSettingsStore } = await import("../../stores/useSettingsStore");
    const authConfig = useSettingsStore.getState().booruAuth?.[this.id];
    if (!authConfig?.artistTagApiUrl || !authConfig?.artistTagKeyPath) {
      return new Map(); // Not configured
    }

    const apiUrlPattern = authConfig.artistTagApiUrl;
    const keyPath = authConfig.artistTagKeyPath;

    try {
      const chunkSize = 50;
      const tagTypes = new Map<string, string>();

      for (let i = 0; i < uniqueTags.length; i += chunkSize) {
        const chunk = uniqueTags.slice(i, i + chunkSize);
        const tagsString = encodeURIComponent(chunk.join(","));
        const finalUrl = apiUrlPattern.replace("{tags}", tagsString);

        const response = await this.fetchJson<any>(finalUrl);

        const items = Array.isArray(response) ? response : (response?.tag || response?.tags || []);
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const keys = keyPath.split(".");
            let val = item;
            for (const k of keys) {
              if (val === undefined || val === null) break;
              val = val[k];
            }

            const name = item.name || item.tag;
            if (name && val !== undefined) {
              tagTypes.set(name.toLowerCase(), String(val));
            }
          });
        }
      }

      return tagTypes;
    } catch (e) {
      console.warn(`[BaseProvider][${this.id}] resolveTags failed:`, e);
      return new Map();
    }
  }
}
