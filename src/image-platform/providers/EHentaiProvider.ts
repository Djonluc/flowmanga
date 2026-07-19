import { BaseProvider } from "./BaseProvider";
import type { PlatformImage, SearchQuery } from "../types";
import { useSettingsStore } from "../../stores/useSettingsStore";

const BASE_URL = "https://e-hentai.org";
const PLACEHOLDER_PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

function normalizeSearchTag(tag: string): string {
  return tag.trim().replace(/_/g, " ");
}

function numericStyleValue(style: string | null, property: string): number {
  if (!style) return 0;
  const match = style.match(new RegExp(`${property}\\s*:\\s*(\\d+)px`, "i"));
  return match ? Number(match[1]) : 0;
}

export class EHentaiProvider extends BaseProvider {
  id = "e-hentai";
  name = "E-Hentai";
  domains = ["e-hentai.org", "ehgt.org"];
  capabilities = {
    maxTags: 10,
    supportsNegative: true,
    supportsScore: false,
    authentication: true,
    // Public galleries work anonymously. This flag exposes the optional session
    // controls in Settings so signed-in users can receive the freshest feed.
    requiresCookies: true,
    authUrl: "https://forums.e-hentai.org/index.php?act=Login",
    status: "working",
    search: true,
    tagSearch: true,
  };

  private pageUrls = new Map<string, Map<number, string>>();

  private getHeaders(): Record<string, string> {
    const cookies = useSettingsStore.getState().booruAuth?.[this.id]?.sessionCookies?.trim();
    return {
      Accept: "text/html,application/xhtml+xml",
      Referer: `${BASE_URL}/`,
      ...(cookies ? { Cookie: cookies } : {}),
    };
  }

  private buildSearchText(query: SearchQuery): string {
    return [
      ...query.positiveTags.map(normalizeSearchTag),
      ...query.negativeTags.map(tag => `-${normalizeSearchTag(tag)}`),
    ].filter(Boolean).join(" ");
  }

  private async fetchPage(key: string, firstUrl: string, page: number): Promise<PlatformImage[]> {
    if (!useSettingsStore.getState().showAdultContent) {
      console.info("[EHentaiProvider] Adult content is disabled; skipping E-Hentai request.");
      return [];
    }

    let pages = this.pageUrls.get(key);
    if (!pages || page <= 1) {
      pages = new Map([[1, firstUrl]]);
      this.pageUrls.set(key, pages);
    }

    const url = pages.get(page);
    if (!url) {
      console.info(`[EHentaiProvider] No cursor is available for ${key} page=${page}.`);
      return [];
    }

    try {
      const html = await this.fetchHtml(url, this.getHeaders());
      const { images, nextUrl } = this.parseGalleryList(html);
      if (nextUrl) pages.set(page + 1, nextUrl);
      else pages.delete(page + 1);
      console.info(`[EHentaiProvider] ${key} page=${page} galleries=${images.length} next=${nextUrl || "none"}`);
      return images;
    } catch (error) {
      console.warn(`[EHentaiProvider] ${key} page=${page} failed`, error);
      return [];
    }
  }

  async search(query: SearchQuery, page: number): Promise<PlatformImage[]> {
    const searchText = this.buildSearchText(query);
    const key = `search:${searchText.toLowerCase()}`;
    const firstUrl = searchText
      ? `${BASE_URL}/?f_search=${encodeURIComponent(searchText)}`
      : `${BASE_URL}/`;
    return this.fetchPage(key, firstUrl, page);
  }

  async getLatest(page: number): Promise<PlatformImage[]> {
    return this.fetchPage("latest", `${BASE_URL}/`, page);
  }

  async getDiscovery(page: number): Promise<PlatformImage[]> {
    if (page === 1) return this.fetchPage("popular", `${BASE_URL}/popular`, page);
    return this.fetchPage("discover", `${BASE_URL}/`, page - 1);
  }

  async autocompleteTags(): Promise<string[]> {
    return [];
  }

  async getById(id: string): Promise<PlatformImage | null> {
    const match = id.match(/^(\d+)[_-]([a-f0-9]+)$/i);
    if (!match) return null;
    const html = await this.fetchHtml(`${BASE_URL}/g/${match[1]}/${match[2]}/`, this.getHeaders());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cover = doc.querySelector<HTMLElement>("#gd1 div")?.style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1] || "";
    const title = doc.querySelector("#gn")?.textContent?.trim() || `Gallery ${match[1]}`;
    const tags = Array.from(doc.querySelectorAll<HTMLAnchorElement>("#taglist a"))
      .map(anchor => anchor.textContent?.trim() || "")
      .filter(Boolean);
    return this.createImage({ gid: match[1], token: match[2], title, coverUrl: cover, tags });
  }

  async getGalleryDetails(sourceId: string): Promise<{ pageLinks: string[]; title: string; tags: string[] }> {
    const match = sourceId.match(/^(\d+)[_-]([a-f0-9]+)$/i);
    if (!match) throw new Error("Invalid E-Hentai gallery identifier.");

    const galleryUrl = `${BASE_URL}/g/${match[1]}/${match[2]}/`;
    const firstHtml = await this.fetchHtml(galleryUrl, this.getHeaders());
    const firstDoc = new DOMParser().parseFromString(firstHtml, "text/html");
    const indexUrls = new Set<string>([galleryUrl]);
    firstDoc.querySelectorAll<HTMLAnchorElement>('.ptt a[href*="?p="]').forEach(anchor => {
      indexUrls.add(new URL(anchor.href, galleryUrl).toString());
    });

    const documents = [firstDoc];
    for (const indexUrl of Array.from(indexUrls).slice(1)) {
      const html = await this.fetchHtml(indexUrl, this.getHeaders());
      documents.push(new DOMParser().parseFromString(html, "text/html"));
    }

    const pageLinks: string[] = [];
    const seen = new Set<string>();
    for (const doc of documents) {
      doc.querySelectorAll<HTMLAnchorElement>('#gdt a[href*="/s/"]').forEach(anchor => {
        const url = new URL(anchor.href, BASE_URL).toString();
        if (!seen.has(url)) {
          seen.add(url);
          pageLinks.push(url);
        }
      });
    }
    const tags = Array.from(firstDoc.querySelectorAll<HTMLAnchorElement>("#taglist a"))
      .map(anchor => anchor.textContent?.trim() || "")
      .filter(Boolean);
    const title = firstDoc.querySelector("#gn")?.textContent?.trim() || `Gallery ${match[1]}`;
    console.info(`[EHentaiProvider] gallery=${sourceId} pageLinks=${pageLinks.length} tags=${tags.length} indexPages=${documents.length}`);
    return { pageLinks, title, tags };
  }

  async resolveGalleryPage(pageUrl: string): Promise<{ url: string; width: number; height: number; extension: string }> {
    const html = await this.fetchHtml(pageUrl, this.getHeaders());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const displayed = doc.querySelector<HTMLImageElement>("#img");
    const originalLink = Array.from(doc.querySelectorAll<HTMLAnchorElement>("#i7 a[href]"))
      .find(anchor => /original/i.test(anchor.textContent || ""));
    const url = originalLink?.href || displayed?.src || "";
    if (!url) throw new Error("E-Hentai did not return a readable image for this page.");
    const width = Number(displayed?.getAttribute("width")) || numericStyleValue(displayed?.getAttribute("style") || null, "width");
    const height = Number(displayed?.getAttribute("height")) || numericStyleValue(displayed?.getAttribute("style") || null, "height");
    const formatText = `${originalLink?.textContent || ""} ${url} ${displayed?.src || ""}`;
    const extension = formatText.match(/\b(jpe?g|png|gif|webp|avif)\b/i)?.[1]?.toLowerCase().replace("jpeg", "jpg") || "jpg";
    return { url: new URL(url, BASE_URL).toString(), width, height, extension };
  }

  private parseGalleryList(html: string): { images: PlatformImage[]; nextUrl?: string } {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = Array.from(doc.querySelectorAll<HTMLTableRowElement>("table.itg tr"));
    const images = rows.flatMap(row => {
      const galleryLink = row.querySelector<HTMLAnchorElement>('.glname a[href*="/g/"]');
      const match = galleryLink?.href.match(/\/g\/(\d+)\/([a-f0-9]+)\/?/i);
      if (!galleryLink || !match) return [];

      const image = row.querySelector<HTMLImageElement>(".glthumb img");
      const lazyUrl = image?.getAttribute("data-src") || "";
      const sourceUrl = image?.getAttribute("src") || "";
      const coverUrl = lazyUrl || (sourceUrl !== PLACEHOLDER_PIXEL ? sourceUrl : "");
      const tags = Array.from(row.querySelectorAll<HTMLElement>(".gt"))
        .map(tag => tag.title || tag.textContent?.trim() || "")
        .filter(Boolean);
      const category = row.querySelector<HTMLElement>(".glcat .cn")?.textContent?.trim() || "Gallery";
      const postedText = row.querySelector<HTMLElement>(`#posted_${match[1]}`)?.textContent?.trim();
      const width = Number(image?.getAttribute("width")) || numericStyleValue(image?.getAttribute("style") || null, "width");
      const height = Number(image?.getAttribute("height")) || numericStyleValue(image?.getAttribute("style") || null, "height");

      return [this.createImage({
        gid: match[1],
        token: match[2],
        title: row.querySelector<HTMLElement>(".glink")?.textContent?.trim() || galleryLink.textContent?.trim() || `Gallery ${match[1]}`,
        coverUrl,
        tags,
        category,
        postedText,
        width,
        height,
      })];
    });

    const nextHref = doc.querySelector<HTMLAnchorElement>('a[id$="next"][href]')?.href;
    return {
      images,
      nextUrl: nextHref ? new URL(nextHref, BASE_URL).toString() : undefined,
    };
  }

  private createImage(input: {
    gid: string;
    token: string;
    title: string;
    coverUrl: string;
    tags: string[];
    category?: string;
    postedText?: string;
    width?: number;
    height?: number;
  }): PlatformImage {
    const width = input.width || 250;
    const height = input.height || 354;
    const categoryTag = input.category ? `category:${input.category.toLowerCase().replace(/\s+/g, "_")}` : "category:gallery";
    return {
      id: `${this.id}-${input.gid}-${input.token}`,
      sourceId: `${input.gid}_${input.token}`,
      providerId: this.id,
      title: input.title,
      thumbnailUrl: input.coverUrl,
      previewUrl: input.coverUrl,
      sampleUrl: input.coverUrl,
      fullUrl: input.coverUrl,
      width,
      height,
      aspectRatio: height > 0 ? width / height : 1,
      tags: [...input.tags, categoryTag],
      generalTags: input.tags,
      rating: "explicit",
      score: 0,
      sourceUrl: `${BASE_URL}/g/${input.gid}/${input.token}/`,
      createdAt: input.postedText ? Date.parse(`${input.postedText} UTC`) : Date.now(),
      mediaType: "image",
      relatedGroupId: `e-hentai-gallery-${input.gid}`,
      isLocal: false,
    };
  }
}
