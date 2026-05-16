import { invoke } from "@tauri-apps/api/core";
import type {
  SourceProvider,
  SourceContent,
  SourceSeries,
  SourceChapter,
  SourceCapabilities,
  ContentType,
  MediaType,
  ReaderMode,
} from "../types";

const ORIGIN = "https://www.webtoons.com";

function webtoonsHost(hostname: string): boolean {
  const h = hostname.replace(/^www\./, "").toLowerCase();
  return (
    h === "webtoons.com" ||
    h === "global.webtoons.com" ||
    h === "m.webtoons.com"
  );
}

function documentHeaders(referer?: string): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1",
  };
  if (referer) h.Referer = referer;
  return h;
}

async function fetchHtml(url: string, referer?: string): Promise<string> {
  return invoke<string>("fetch_html", {
    url,
    headers: documentHeaders(referer),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function absUrl(href: string): string {
  const t = href.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return new URL(t, ORIGIN).href;
}

function listBaseWithTrailingAmp(seriesUrl: string): string {
  let base = seriesUrl.split("&page=")[0];
  if (!base.includes("?")) base += "?";
  if (!base.endsWith("?") && !base.endsWith("&")) base += "&";
  return base;
}

function normalizeImageUrl(u: string): string {
  const t = u.trim();
  if (!t) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return t;
}

function episodeNumberFromChapterUrl(u: string): string | null {
  try {
    const sp = new URL(u).searchParams.get("episode_no");
    if (sp) return sp;
  } catch {
    /* ignore */
  }
  const m = u.match(/episode_no=(\d+)/i);
  if (m) return m[1];
  const ep = u.match(/episode-(\d+)/i);
  if (ep) return ep[1];
  return null;
}

function parseLastListPage(html: string): number | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const paginate = doc.querySelector("div.paginate");
  if (!paginate) return null;
  const onSpans = paginate.querySelectorAll("span.on");
  const nums: number[] = [];
  onSpans.forEach((span) => {
    const n = parseInt(span.textContent?.trim() || "", 10);
    if (!Number.isNaN(n)) nums.push(n);
  });
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

function parseSeriesTitle(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const h1 = doc.querySelector("h1.subj");
  if (h1?.textContent?.trim()) return h1.textContent.trim();
  const og = doc
    .querySelector('meta[property="og:title"]')
    ?.getAttribute("content");
  if (og?.trim()) return og.trim();
  return "Webtoon";
}

function parseDescription(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const og = doc
    .querySelector('meta[property="og:description"]')
    ?.getAttribute("content");
  if (og?.trim()) return og.trim();
  const summary = doc.querySelector(".summary, .detail_body")?.textContent;
  return (summary || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Genres / thematic labels from the series list page (used as library tags). */
function parseGenreTags(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const t = (raw || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 48) return;
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  doc
    .querySelectorAll(
      'div.detail_genre a, .detail_genre a, a[href*="genreNo="]',
    )
    .forEach((a) => add(a.textContent));
  doc
    .querySelectorAll(".genre, h2.genre, span.genre")
    .forEach((el) => add(el.textContent));
  return out;
}

function parseCoverUrl(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const og = doc
    .querySelector('meta[property="og:image"]')
    ?.getAttribute("content");
  if (og?.trim()) return absUrl(og.trim());
  const link = doc.querySelector('link[rel="image_src"]')?.getAttribute("href");
  if (link?.trim()) return absUrl(link.trim());
  return "";
}

function parseChapterRows(html: string): { url: string; title: string }[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const list = doc.querySelector("ul#_listUl");
  if (!list) return [];
  const out: { url: string; title: string }[] = [];
  list.querySelectorAll("li").forEach((li) => {
    const a = li.querySelector("a[href]") as HTMLAnchorElement | null;
    const subj = li.querySelector("span.subj");
    if (!a || !subj?.textContent?.trim()) return;
    let href = a.getAttribute("href") || "";
    if (!href) return;
    out.push({
      url: absUrl(href),
      title: subj.textContent.trim(),
    });
  });
  return out;
}

function extractImageUrlsFromChapterHtml(html: string): string[] {
  const urls: string[] = [];
  const doc = new DOMParser().parseFromString(html, "text/html");

  const imageList = doc.querySelector("div#_imageList");
  if (imageList) {
    imageList.querySelectorAll("img._images").forEach((img) => {
      const dataUrl = img.getAttribute("data-url");
      if (dataUrl) urls.push(normalizeImageUrl(dataUrl));
    });
  }

  if (urls.length === 0) {
    const scripts = doc.querySelectorAll("script");
    for (const script of scripts) {
      const text = script.textContent || "";
      if (!text.includes("imageData")) continue;
      const m = text.match(/var\s+imageData\s*=\s*(\[[\s\S]*?\]);/);
      if (!m) continue;
      try {
        const imageData = JSON.parse(m[1]) as { url?: string }[];
        for (const item of imageData) {
          if (item?.url) urls.push(normalizeImageUrl(item.url));
        }
        if (urls.length > 0) break;
      } catch {
        continue;
      }
    }
  }

  if (urls.length === 0) {
    const viewer = doc.querySelector("div#_viewerBox");
    if (viewer) {
      viewer.querySelectorAll("img").forEach((img) => {
        const src =
          img.getAttribute("data-url") ||
          img.getAttribute("data-src") ||
          img.getAttribute("src");
        if (!src) return;
        const lower = src.toLowerCase();
        if (
          ["advertisement", "blank", "loading"].some((x) => lower.includes(x))
        )
          return;
        urls.push(normalizeImageUrl(src));
      });
    }
  }

  const seen = new Set<string>();
  return urls.filter((u) => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

export function isWebtoonsSeriesListUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!webtoonsHost(u.hostname)) return false;
    if (u.pathname.includes("/list")) return true;
    if (u.searchParams.has("title_no") && !u.pathname.includes("/viewer"))
      return true;
    return false;
  } catch {
    return false;
  }
}

export class WebtoonsProvider implements SourceProvider {
  readonly id = "webtoons";
  readonly name = "LINE Webtoon";
  readonly domains = ["webtoons.com", "global.webtoons.com", "m.webtoons.com"];
  readonly contentType: ContentType = "manga";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["vertical"];

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
      return webtoonsHost(new URL(url).hostname);
    } catch {
      return url.includes("webtoons.com");
    }
  }

  async fetchContent(url: string): Promise<SourceContent> {
    const html = await fetchHtml(url, url);
    const raw = extractImageUrlsFromChapterHtml(html);
    if (raw.length === 0)
      throw new Error("No images found for this Webtoon episode");

    return {
      images: raw.map((u, i) => ({ url: u, pageNumber: i + 1 })),
      metadata: { sourceUrl: url },
    };
  }

  async fetchSeries(seriesUrl: string): Promise<SourceSeries> {
    const base = listBaseWithTrailingAmp(seriesUrl);
    const canonical = seriesUrl.split("&page=")[0];

    let lastPage = 1;
    try {
      const probeHtml = await fetchHtml(`${base}page=999999`, canonical);
      lastPage = parseLastListPage(probeHtml) ?? 1;
    } catch {
      lastPage = 10;
    }
    if (lastPage < 1) lastPage = 1;
    if (lastPage > 500) lastPage = 500;

    const seen = new Set<string>();
    const chaptersRaw: { url: string; title: string }[] = [];
    let firstPageHtml = "";

    for (let page = 1; page <= lastPage; page++) {
      const html = await fetchHtml(
        `${base}page=${page}`,
        page === 1 ? canonical : `${base}page=${page - 1}`,
      );
      if (page === 1) firstPageHtml = html;
      const rows = parseChapterRows(html);
      for (const row of rows) {
        if (seen.has(row.url)) continue;
        seen.add(row.url);
        chaptersRaw.push(row);
      }
      if (page < lastPage) await sleep(600);
    }

    if (chaptersRaw.length === 0)
      throw new Error("No chapters found for this Webtoon series");

    chaptersRaw.reverse();

    const chapters: SourceChapter[] = chaptersRaw.map((ch, idx) => {
      const ep = episodeNumberFromChapterUrl(ch.url);
      return {
        id: ch.url,
        number: ep ?? String(idx + 1),
        url: ch.url,
        title: ch.title,
        source: "www.webtoons.com",
      };
    });

    const title = parseSeriesTitle(firstPageHtml);
    const description = parseDescription(firstPageHtml);
    const coverUrl = parseCoverUrl(firstPageHtml);
    const tags = parseGenreTags(firstPageHtml);

    return {
      title,
      description,
      coverUrl,
      seriesUrl: canonical,
      source: "www.webtoons.com",
      tags: tags.length > 0 ? tags : undefined,
      chapters,
    };
  }

  async fetchChapterFeed(seriesUrl: string): Promise<SourceChapter[]> {
    const s = await this.fetchSeries(seriesUrl);
    return s.chapters;
  }
}
