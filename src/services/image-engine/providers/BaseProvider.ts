import { invoke } from "@tauri-apps/api/core";
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

    try {
      // Use Tauri Rust proxy to bypass CORS
      const response = await invoke<T>("fetch_json", {
        url: url.toString(),
        method: "GET",
        headers,
      });
      return response;
    } catch (error) {
      console.error(`[BaseProvider][${this.id}] fetchJson error for ${url.toString()}:`, error);
      throw error;
    }
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

    try {
      const response = await invoke<string>("fetch_html", {
        url: url.toString(),
        headers,
      });
      return response;
    } catch (error) {
      console.error(`[BaseProvider][${this.id}] fetchHtml error for ${url.toString()}:`, error);
      throw error;
    }
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
}
