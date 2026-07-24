import type { ImageProvider, PlatformImage, SearchQuery } from "../types";
import { fetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";
import { diagnostics } from "../../services/DiagnosticsService";

interface ProviderRequestGate {
  tail: Promise<void>;
  nextRequestAt: number;
  cooldownUntil: number;
}

const providerRequestGates = new Map<string, ProviderRequestGate>();

function redactNetworkError(value: string): string {
  return value.replace(/([?&](?:api_key|access_token|token|password|user_id)=)[^&\s)]+/gi, '$1***');
}

function isTerminalRequestError(message: string): boolean {
  return /HTTP error!? status: (?:400|401|403|404)|missing authentication|unauthorized|forbidden/i.test(message);
}

async function runWithProviderGate<T>(providerId: string, request: () => Promise<T>): Promise<T> {
  const { useSettingsStore } = await import('../../stores/useSettingsStore');
  const configuredInterval = useSettingsStore.getState().providerPolicies?.[providerId]?.minRequestIntervalMs || 0;
  const gate = providerRequestGates.get(providerId) ?? {
    tail: Promise.resolve(),
    nextRequestAt: 0,
    cooldownUntil: 0,
  };
  providerRequestGates.set(providerId, gate);

  let release!: () => void;
  const turn = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = gate.tail;
  gate.tail = previous.then(() => turn);
  await previous;

  try {
    const waitUntil = Math.max(gate.nextRequestAt, gate.cooldownUntil);
    const waitMs = waitUntil - Date.now();
    if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));

    // Rule34 needs conservative spacing between requests; other providers retain their
    // existing throughput while still getting serialized request ownership.
    gate.nextRequestAt = Date.now() + Math.max(configuredInterval, providerId === 'rule34' ? 1_000 : 0);
    return await request();
  } catch (error) {
    const message = typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : String(error);
    if (providerId === 'rule34' && /429|too many requests|rate.?limit/i.test(message)) {
      gate.cooldownUntil = Date.now() + 15_000;
    } else if (providerId === 'rule34' && /EOF|empty response|unexpected end/i.test(message)) {
      // Rule34 sometimes closes a throttled response without a status code.
      gate.cooldownUntil = Date.now() + 8_000;
    }
    throw error;
  } finally {
    release();
  }
}

export interface ProviderFetchOptions {
  retries?: number;
  timeoutMs?: number;
  headlessFallback?: boolean;
  transport?: 'plugin' | 'rust';
}

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
  protected async fetchJson<T>(url: string, headers: Record<string, string> = {}, options: ProviderFetchOptions = {}): Promise<T> {
    const requestStartedAt = Date.now();
    diagnostics.providerAttempt(this.id);
    const { useSettingsStore } = await import("../../stores/useSettingsStore");
    const configuredRetries = useSettingsStore.getState().providerPolicies?.[this.id]?.maxRetries;
    let retries = options.retries ?? configuredRetries ?? 3;
    let delay = 1000;
    let headlessAttempted = false;
    
    while (retries > 0) {
      try {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
          const requestHeaders = {
            "User-Agent": "FlowManga/3.0",
            ...headers,
          };

          if (options.transport === 'rust') {
            const { useSettingsStore } = await import("../../stores/useSettingsStore");
            const response = await runWithProviderGate(this.id, () => Promise.race([
              invoke<T>("fetch_json", {
                url: url.toString(),
                method: "GET",
                body: null,
                headers: requestHeaders,
                proxyUrl: useSettingsStore.getState().networkProxy || null,
              }),
              new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(`Request timed out after ${options.timeoutMs ?? 30000}ms`)), options.timeoutMs ?? 30000);
              }),
            ]));
            diagnostics.providerSuccess(this.id, Date.now() - requestStartedAt, Object.keys(headers).length > 0);
            return response;
          }

          const response = await runWithProviderGate(this.id, () => Promise.race([
            fetch(url, { method: "GET", headers: requestHeaders }),
            new Promise<Response>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error(`Request timed out after ${options.timeoutMs ?? 30000}ms`)), options.timeoutMs ?? 30000);
            }),
          ]));

        if (response.status === 401 || response.status === 403 || response.status === 429) {
          const fallbackDisabled = options.headlessFallback === false;
          console.warn(`[${this.id}] Rate limited/Blocked (${response.status}). ${fallbackDisabled ? 'Headless fallback is disabled for this provider.' : 'Trying Headless Webview fallback.'}`);
          if (!headlessAttempted && options.headlessFallback !== false) {
            headlessAttempted = true;
            try {
              const rawJson = await invoke<string>("fetch_json_headless", { url: url.toString(), headers });
              try {
                const parsed = JSON.parse(rawJson.trim()) as T;
                diagnostics.providerSuccess(this.id, Date.now() - requestStartedAt, Object.keys(headers).length > 0);
                return parsed;
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

        const result = await response.json() as T;
        diagnostics.providerSuccess(this.id, Date.now() - requestStartedAt, Object.keys(headers).length > 0);
        return result;
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      } catch (error: any) {
        const errorMessage = redactNetworkError(typeof error === 'string'
          ? error
          : error instanceof Error
            ? error.message
            : String(error));
        if (retries > 1 && !isTerminalRequestError(errorMessage)) {
          console.warn(`[${this.id}] Fetch/Parse error: ${errorMessage}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          retries--;
          continue;
        }
        diagnostics.providerFailure(this.id, error);
        throw error;
      }
    }
    
    throw new Error(`[${this.id}] Max retries reached.`);
  }

  /**
   * Helper function to fetch HTML via Tauri's HTTP plugin.
   */
  protected async fetchHtml(url: string, headers: Record<string, string> = {}): Promise<string> {
    const requestStartedAt = Date.now();
    diagnostics.providerAttempt(this.id);
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

        const result = await response.text();
        diagnostics.providerSuccess(this.id, Date.now() - requestStartedAt, Object.keys(headers).length > 0);
        return result;
      } catch (error: any) {
        if (retries > 1) {
          console.warn(`[${this.id}] Fetch/Parse error: ${error.message}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          retries--;
          continue;
        }
        diagnostics.providerFailure(this.id, error);
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
    void id;
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

        const response = await this.fetchJson<any>(
          finalUrl,
          {},
          this.id === 'rule34' ? { transport: 'rust' } : {},
        );

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
