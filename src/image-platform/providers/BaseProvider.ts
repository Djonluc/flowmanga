import type { ImageProvider, PlatformImage, SearchQuery } from "../types";
import { fetch } from "@tauri-apps/plugin-http";

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
  domains: string[];
  isEnabled?: boolean;

  /**
   * Helper function to fetch JSON via Tauri's HTTP plugin.
   * This bypasses CORS issues since the request is made from the Rust backend.
   */
  protected async fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "FlowManga/3.0",
        ...headers
      }
    });

    if (!response.ok) {
      throw new Error(`[${this.id}] HTTP error! status: ${response.status}`);
      // return [] as any;
    }

    return await response.json();
  }

  /**
   * Helper function to fetch HTML via Tauri's HTTP plugin.
   */
  protected async fetchHtml(url: string, headers: Record<string, string> = {}): Promise<string> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "FlowManga/3.0",
        "Accept": "text/html",
        ...headers
      }
    });

    if (!response.ok) {
      throw new Error(`[${this.id}] HTTP error! status: ${response.status}`);
      // return "" as any;
    }

    return await response.text();
  }

  abstract search(query: SearchQuery, page: number): Promise<PlatformImage[]>;
  async getLatest(page: number): Promise<PlatformImage[]> {
    return this.search({ raw: "", positiveTags: [], negativeTags: [], predicates: {} }, page);
  }

  abstract getDiscovery(page: number): Promise<PlatformImage[]>;
  
  domains: string[] = [];
  isEnabled = true;
}
