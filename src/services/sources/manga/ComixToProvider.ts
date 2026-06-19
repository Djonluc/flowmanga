import { invoke } from "@tauri-apps/api/core";
import type {
  SourceProvider,
  SourceContent,
  SourceSeries,
  SourceSearchResult,
  SourceCapabilities,
  ContentType,
  MediaType,
  MediaDomain,
  ReaderMode,
  SourceSearchOptions,
  SourceChapter,
} from "../types";

type ComixDetail = {
  id?: number;
  hid?: string;
  title?: string;
  synopsis?: string;
  poster?: {
    medium?: string;
    large?: string;
  };
  latestChapter?: number;
  firstChapterUrl?: string;
  latestChapterUrl?: string;
  contentRating?: string;
  authors?: Array<{ title?: string }>;
  artists?: Array<{ title?: string }>;
  genres?: Array<{ title?: string }>;
  tags?: Array<{ title?: string }>;
  formats?: Array<{ title?: string }>;
};

export class ComixToProvider implements SourceProvider {
  readonly id = "comix_to";
  readonly name = "Comix.to";
  readonly domains = ["comix.to"];
  readonly contentType: ContentType = "manga";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["vertical", "single"];

  readonly capabilities: SourceCapabilities = {
    search: false,
    tagSearch: false,
    seriesBrowse: false,
    chapterFeed: true,
    pagination: false,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    try {
      return new URL(url).hostname.replace(/^www\./, "") === "comix.to";
    } catch {
      return url.includes("comix.to");
    }
  }

  async fetchContent(url: string): Promise<SourceContent> {
    const html = await this.fetchHtml(url);
    const initialData = this.parseInitialData(html);
    const detail = this.findDetail(initialData);
    const chapterId =
      initialData?.read?.chapterId ?? url.match(/\/(\d+|0)-chapter-/)?.[1];
    const chapterNumber = initialData?.read?.chapterNumber;

    if (chapterId) {
      try {
        const imageUrls = await invoke<string[]>("scrape_comix_chapter_headless", {
          url,
        });

        if (imageUrls.length > 0) {
          return {
            images: imageUrls.map((imageUrl, i) => ({
              url: imageUrl,
              pageNumber: i + 1,
            })),
            metadata: this.toMetadata(detail, url, chapterNumber),
          };
        }
      } catch (error) {
        console.warn("[ComixTo] Page-context scrape failed:", error);
      }
    }

    try {
      console.log(`[ComixTo] Falling back to generic headless Chrome: ${url}`);
      const images = await invoke<string[]>("scrape_images_headless", { url });

      if (images?.length) {
        return {
          images: images.map((imageUrl, i) => ({
            url: imageUrl,
            pageNumber: i + 1,
          })),
          metadata: this.toMetadata(detail, url, chapterNumber),
        };
      }
    } catch (error) {
      console.warn("[ComixTo] Headless fallback failed:", error);
    }

    throw new Error(
      "No Comix.to pages found. The chapter API may have changed or the request was blocked.",
    );
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    try {
      let html = await this.fetchHtml(url).catch(() => "");
      let initialData = this.parseInitialData(html);
      let detail = this.findDetail(initialData);

      if (!detail?.title) {
        console.log("[ComixTo] reqwest fetch failed or blocked, trying headless...");
        html = await invoke<string>("fetch_html_headless", { url });
        initialData = this.parseInitialData(html);
        detail = this.findDetail(initialData);
      }

      if (detail?.title) {
        const latestChapter = Number(detail.latestChapter || 0);
        const chapters =
          latestChapter > 0
            ? Array.from({ length: latestChapter }, (_, index) =>
                this.buildChapter(detail!, url, index + 1),
              )
            : [detail.firstChapterUrl, detail.latestChapterUrl]
                .filter((chapterUrl): chapterUrl is string => Boolean(chapterUrl))
                .map((chapterUrl) => this.chapterFromUrl(chapterUrl, url));

        return {
          title: detail.title,
          description: detail.synopsis || "",
          coverUrl: detail.poster?.large || detail.poster?.medium || "",
          seriesUrl: this.seriesUrl(url),
          source: "comix.to",
          tags: this.extractTags(detail),
          chapters,
        };
      }
    } catch (error) {
      console.warn("[ComixTo] Static series scrape failed:", error);
    }

    const res = await invoke<any>("scrape_series_headless", { url });
    const links = res?.chapterLinks || res?.chapter_links || [];

    if (!res || links.length === 0) {
      throw new Error(
        "No Comix.to chapters found. The page might be blocked or the layout changed.",
      );
    }

    return {
      title: res.title || "Untitled",
      description: res.description || "",
      coverUrl: res.coverUrl || res.cover_url || "",
      seriesUrl: this.seriesUrl(url),
      source: "comix.to",
      tags: res.tags || [],
      chapters: links.map((link: string, i: number) => {
        const chapterUrl = this.absoluteUrl(link, url);
        const number =
          chapterUrl.match(/chapter-(\d+(?:\.\d+)?)/i)?.[1] ||
          String(links.length - i);

        return {
          id: chapterUrl,
          number,
          url: chapterUrl,
          source: "comix.to",
        };
      }),
    };
  }

  async search(
    _query: string,
    _options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    return [];
  }

  private async fetchHtml(
    url: string,
    headers: Record<string, string> | null = null,
  ): Promise<string> {
    return await invoke<string>("fetch_html", { url, headers });
  }

  private async fetchComixJson(
    pathOrUrl: string,
    referer: string,
  ): Promise<any | null> {
    const rawUrl = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `https://www.comix.to${pathOrUrl}`;
    const url = new URL(rawUrl);
    url.searchParams.set("_", this.comixApiSignature(url.pathname));

    try {
      const text = await this.fetchHtml(url.href, {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        Referer: referer,
      });
      const parsed = JSON.parse(text);
      return parsed?.result ?? parsed;
    } catch (error) {
      console.warn("[ComixTo] API fetch failed:", error);
      return null;
    }
  }

  private parseInitialData(html: string): any | null {
    const match = html.match(
      /<script[^>]+id=["']initial-data["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!match?.[1]) return null;

    try {
      return JSON.parse(match[1]);
    } catch (error) {
      console.warn("[ComixTo] Failed to parse initial-data:", error);
      return null;
    }
  }

  private findDetail(initialData: any): ComixDetail | null {
    return (
      (Object.values(initialData?.queries || {}).find(
        (entry: any) => entry?.title && entry?.poster,
      ) as ComixDetail | undefined) || null
    );
  }

  private toMetadata(
    detail: ComixDetail | null,
    sourceUrl: string,
    chapterNumber?: number,
  ): SourceContent["metadata"] {
    if (!detail) return { sourceUrl };

    const author = [...(detail.authors || []), ...(detail.artists || [])]
      .map((person) => person.title)
      .filter(Boolean)
      .join(", ");

    return {
      title: detail.title,
      coverUrl: detail.poster?.large || detail.poster?.medium,
      description: detail.synopsis,
      sourceId: detail.hid || String(detail.id || ""),
      sourceUrl,
      rating: detail.contentRating,
      author,
      tags: this.extractTags(detail),
      mediaCount: chapterNumber,
    };
  }

  private extractTags(detail: ComixDetail): string[] {
    const allTags = [
      ...(detail.genres || []),
      ...(detail.tags || []),
      ...(detail.formats || []),
    ]
      .map((tag) => tag.title)
      .filter((tag): tag is string => Boolean(tag));
    
    return Array.from(new Set(allTags));
  }

  private buildChapter(
    detail: ComixDetail,
    seriesUrl: string,
    number: number,
  ): SourceChapter {
    const knownUrl =
      number === 1
        ? detail.firstChapterUrl
        : number === Number(detail.latestChapter)
          ? detail.latestChapterUrl
          : undefined;
    const url =
      knownUrl != null
        ? this.absoluteUrl(knownUrl, seriesUrl)
        : `${this.seriesUrl(seriesUrl)}/0-chapter-${number}`;

    return {
      id: url,
      number: String(number),
      url,
      title: `Chapter ${number}`,
      source: "comix.to",
    };
  }

  private chapterFromUrl(chapterUrl: string, baseUrl: string): SourceChapter {
    const url = this.absoluteUrl(chapterUrl, baseUrl);
    const number = url.match(/chapter-(\d+(?:\.\d+)?)/i)?.[1] || "unknown";

    return {
      id: url,
      number,
      url,
      title: number === "unknown" ? undefined : `Chapter ${number}`,
      source: "comix.to",
    };
  }

  private seriesUrl(url: string): string {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname
      .replace(/\/(?:\d+|0)-chapter-[^/]+\/?$/i, "")
      .replace(/\/$/, "");
    return parsed.href;
  }

  private absoluteUrl(pathOrUrl: string, baseUrl: string): string {
    return new URL(pathOrUrl, baseUrl).href;
  }

  private extractImageUrls(value: any): string[] {
    const urls = new Set<string>();
    const visit = (node: any) => {
      if (!node) return;
      if (typeof node === "string") {
        let clean = node.replace(/\\\//g, "/").replace(/&amp;/g, "&");
        if (clean.startsWith("//")) clean = `https:${clean}`;

        if (
          /^https?:\/\//i.test(clean) &&
          /(static\.comix\.to|media\.luacomic\.org|uploads|chapter|pages?)/i.test(
            clean,
          ) &&
          /\.(jpe?g|png|webp)(\?|$)/i.test(clean)
        ) {
          urls.add(clean);
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node === "object") {
        Object.values(node).forEach(visit);
      }
    };

    visit(value);
    return Array.from(urls);
  }

  private comixApiSignature(pathOrUrl: string): string {
    const bytes = (value: string) =>
      value.split("").map((char) => char.charCodeAt(0));
    const chars = (value: number[]) => String.fromCharCode.apply(null, value);
    const urlSafe = (value: string) =>
      btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const rc4 = (key: string, input: string) => {
      const state: number[] = [];
      let j = 0;
      let out = "";
      for (let i = 0; i < 256; i++) state[i] = i;
      for (let i = 0; i < 256; i++) {
        j = (j + state[i] + key.charCodeAt(i % key.length)) % 256;
        [state[i], state[j]] = [state[j], state[i]];
      }
      let i = 0;
      j = 0;
      for (let idx = 0; idx < input.length; idx++) {
        i = (i + 1) % 256;
        j = (j + state[i]) % 256;
        [state[i], state[j]] = [state[j], state[i]];
        out += String.fromCharCode(
          input.charCodeAt(idx) ^ state[(state[i] + state[j]) % 256],
        );
      }
      return out;
    };
    const keyD = () =>
      bytes(atob("DTSTmUt6LpDUw9r1lSQqyb3YlFTzruT8tk8wUGkwehQ="));
    const keyB = () =>
      bytes(atob("3PordjODbhqla382Cxapmo/1JiABJQcjiJj1+48gTJ4="));
    const keyZ = () =>
      bytes(atob("8i0Cru/VJBSVB2Y1GcMDVpzx2WepOcfnWdd81yxICl4="));
    const keyTe = () =>
      bytes(atob("bewtiTuV+HJk56xxkf2iCljLgruCpBmN9BgE8i6gc9M="));
    const keyIe = () =>
      bytes(atob("yXayUVFrrcW56jQCEfZzuCidjpnWKjTDUNT7XeX9i7k="));

    const a = (v: number) => 81 ^ v;
    const c = (v: number) => 218 ^ v;
    const m = (v: number) => 147 ^ v;
    const w = (v: number) => 37 ^ v;
    const x = (v: number) => 180 ^ v;
    const q = (v: number) => 255 & ((v >>> 1) | (v << 7));
    const vrot = (v: number) => 255 & ((v << 1) | (v >>> 7));
    const ne = (v: number) => 255 & ((v << 2) | (v >>> 6));
    const s = (v: number) => 255 & ((v << 7) | (v >>> 1));
    const L = (v: number) => 255 & ((v >>> 4) | (v << 4));
    const y = (v: number) => 255 & ((v << 4) | (v >>> 4));
    const R = (v: number) => (v + 159) % 256;
    const u = (v: number) => (v - 159 + 256) % 256;
    const X = (v: number) => (v + 34) % 256;
    const O = (v: number) => (v - 34 + 256) % 256;

    const wrap = (key: string, input: number[]) =>
      bytes(rc4(atob(key), chars(input)));
    const M = (input: number[]) =>
      wrap("JxTcdyiA5GZxnbrmthXBQfU2IMTKcY1+3nNhbq98Sgo=", input);
    const ae = (input: number[]) =>
      wrap("MHNBHYWA7lvy867fXgvGcJwWDk79KqUJUVFsh3RwnnI=", input);
    const g = (input: number[]) =>
      wrap("B46L1x+UeWP+19cRpQ+OZvdLAK9EHID8g3mSgn57tew=", input);
    const p = (input: number[]) =>
      wrap("7xWfIF5THL5LAnRgAARg+4mjWHPU9n3PQwvzbaMNi+Q=", input);
    const P = (input: number[]) =>
      wrap("WgeCQ3T8R51uTwVSiVa7Zy0dN6JOg6Z5JleMS+HV8Aw=", input);

    const C = (input: number[]) => {
      const key = keyB();
      const prefix = atob("OaKvnI5ARA==");
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 7) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0:
            n = s(n);
            break;
          case 1:
            n = w(n);
            break;
          case 2:
            n = a(n);
            break;
          case 3:
            n = m(n);
            break;
          case 4:
            n = ne(n);
            break;
          case 5:
          case 8:
            n = y(n);
            break;
          case 6:
            n = c(n);
            break;
          case 7:
            n = u(n);
            break;
          case 9:
            n = x(n);
            break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const H = (input: number[]) => {
      const key = keyZ();
      const prefix = atob("Fyskubz8VvA=");
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 8) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0:
          case 9:
            n = x(n);
            break;
          case 1:
            n = vrot(n);
            break;
          case 2:
            n = m(n);
            break;
          case 3:
            n = s(n);
            break;
          case 4:
            n = ne(n);
            break;
          case 5:
            n = y(n);
            break;
          case 6:
          case 8:
            n = R(n);
            break;
          case 7:
            n = X(n);
            break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const I = (input: number[]) => {
      const key = keyD();
      const prefix = atob("vY/meeI=");
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 5) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0:
            n = a(n);
            break;
          case 1:
            n = y(n);
            break;
          case 2:
          case 9:
            n = L(n);
            break;
          case 3:
            n = w(n);
            break;
          case 4:
            n = u(n);
            break;
          case 5:
            n = q(n);
            break;
          case 6:
            n = x(n);
            break;
          case 7:
            n = O(n);
            break;
          case 8:
            n = ne(n);
            break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const T = (input: number[]) => {
      const key = keyTe();
      const prefix = atob("/Xcb2zAu8AU=");
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 8) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0:
          case 7:
            n = c(n);
            break;
          case 1:
          case 4:
            n = vrot(n);
            break;
          case 2:
            n = q(n);
            break;
          case 3:
            n = R(n);
            break;
          case 5:
          case 8:
            n = x(n);
            break;
          case 6:
            n = m(n);
            break;
          case 9:
            n = w(n);
            break;
        }
        out.push(255 & n);
      }
      return out;
    };
    const oe = (input: number[]) => {
      const key = keyIe();
      const prefix = atob("tSLco2w=");
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        if (i < 5) out.push(prefix.charCodeAt(i));
        let n = input[i] ^ key[i % 32];
        switch (i % 10) {
          case 0:
            n = L(n);
            break;
          case 1:
          case 3:
            n = m(n);
            break;
          case 2:
            n = X(n);
            break;
          case 4:
          case 9:
            n = c(n);
            break;
          case 5:
          case 7:
            n = vrot(n);
            break;
          case 6:
            n = x(n);
            break;
          case 8:
            n = ne(n);
            break;
        }
        out.push(255 & n);
      }
      return out;
    };

    const path = pathOrUrl
      .replace(/^https?:\/\/[^/]+/, "")
      .split("?")[0]
      .replace(/^\/api\/v1/, "");
    let out = bytes(encodeURIComponent(path));
    out = C(out);
    out = M(out);
    out = H(out);
    out = ae(out);
    out = I(out);
    out = g(out);
    out = T(out);
    out = p(out);
    out = oe(out);
    out = P(out);
    return urlSafe(chars(out));
  }
}
