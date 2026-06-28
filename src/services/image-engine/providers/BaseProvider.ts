import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import type { 
  ImageMedia, 
  StructuredQuery, 
  SourceCapabilities, 
  EngineSearchOptions,
  AutocompleteResult 
} from "../types";

export abstract class BaseProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly baseUrl: string;
  abstract readonly capabilities: SourceCapabilities;

  /**
   * Performs a search using a structured query.
   * If the provider does not support negative tags or exceeds its tag limit,
   * the Discovery Engine will handle post-filtering.
   */
  abstract search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]>;

  /**
   * Fetches latest/trending content for discovery.
   */
  abstract getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]>;

  /**
   * Fetches recommendations based on a reference image.
   * May return empty if not natively supported.
   */
  abstract getRecommendations(image: ImageMedia): Promise<ImageMedia[]>;

  /**
   * Optional autocomplete endpoint for live tag suggestions.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async autocomplete(_tag: string): Promise<AutocompleteResult[]> {
    return [];
  }

  /**
   * Helper utility to cleanly execute HTTP GET requests via Tauri proxy.
   * By using Rust, we bypass CORS and hotlinking restrictions.
   */
  protected async fetchJson<T>(endpoint: string, params: Record<string, string | number | boolean> = {}, customHeaders: Record<string, string> = {}): Promise<T> {
    const url = new URL(endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const headers = {
      "Accept": "application/json",
      "User-Agent": "FlowManga/3.0.0 (djonstnix; https://github.com/djonstnix/flowmanga)",
      ...customHeaders
    };

    const { networkProxy } = useSettingsStore.getState();

    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        const response = await invoke<T>("fetch_json", {
          url: url.toString(),
          method: "GET",
          headers,
          proxyUrl: networkProxy || null
        });
        return response;
      } catch (error: any) {
        const errMsg = typeof error === 'string' ? error : error.message || String(error);
        
        if (errMsg.includes('429') || errMsg.includes('403') || errMsg.includes('Too Many Requests') || errMsg.includes('Forbidden') || errMsg.includes('Cloudflare')) {
          console.warn(`[BaseProvider][${this.id}] Rate limited/Blocked (${errMsg}). Falling back to Headless Webview...`);
          try {
            const rawJson = await invoke<string>("fetch_json_headless", { url: url.toString() });
            return JSON.parse(rawJson) as T;
          } catch (headlessErr) {
            console.error(`[BaseProvider][${this.id}] Headless fallback failed:`, headlessErr);
            // If headless fails, let it fall through to the standard retry
          }
        }

        if (retries > 1) {
          console.warn(`[BaseProvider][${this.id}] Fetch error (${errMsg}). Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          retries--;
          continue;
        }
        console.error(`[BaseProvider][${this.id}] fetchJson error for ${url.toString()}:`, error);
        throw error;
      }
    }
    throw new Error(`[${this.id}] Max retries reached.`);
  }

  /**
   * Helper utility to cleanly execute HTTP GET requests via Tauri proxy that expect an HTML response.
   */
  protected async fetchHtml(endpoint: string, params: Record<string, string | number | boolean> = {}, customHeaders: Record<string, string> = {}): Promise<string> {
    const url = new URL(endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const headers = {
      "Accept": "text/html",
      "User-Agent": "FlowManga/3.0.0 (djonstnix; https://github.com/djonstnix/flowmanga)",
      ...customHeaders
    };

    const { networkProxy } = useSettingsStore.getState();

    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        const response = await invoke<string>("fetch_html", {
          url: url.toString(),
          headers,
          proxyUrl: networkProxy || null
        });
        return response;
      } catch (error: any) {
        if (retries > 1) {
          const errMsg = typeof error === 'string' ? error : error.message || String(error);
          console.warn(`[BaseProvider][${this.id}] Fetch error (${errMsg}). Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          retries--;
          continue;
        }
        console.error(`[BaseProvider][${this.id}] fetchHtml error for ${url.toString()}:`, error);
        throw error;
      }
    }
    throw new Error(`[${this.id}] Max retries reached.`);
  }

  protected ensureAbsoluteUrl(url: string | undefined): string {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("/")) {
      const base = new URL(this.baseUrl);
      return `${base.protocol}//${base.host}${url}`;
    }
    return url;
  }

  /**
   * Performs a bulk tag API lookup to resolve the actual types of tags.
   * Relies on the user's custom `Artist Tag API URL` configured in Settings.
   */
  protected async resolveTags(uniqueTags: string[]): Promise<Map<string, string>> {
    if (uniqueTags.length === 0) return new Map();

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

        // Perform a raw JSON fetch using our proxy wrapper
        const response = await this.fetchJson<any>(finalUrl);

        // Standardize response to an array
        const items = Array.isArray(response) ? response : (response?.tag || response?.tags || []);
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            // Resolve the nested JSON path (e.g. "type" or "tag.type")
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
