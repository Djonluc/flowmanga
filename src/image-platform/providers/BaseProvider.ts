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
  domains: string[] = [];
  isEnabled = true;

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
}
