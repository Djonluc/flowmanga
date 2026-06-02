/**
 * MangaDex Source Provider
 *
 * Extracted from the monolithic ScraperService.ts.
 * Uses the official MangaDex API for all operations.
 *
 * This is the reference implementation for the SourceProvider interface.
 */

import type {
  SourceProvider,
  SourceContent,
  SourceSeries,
  SourceChapter,
  SourceSearchResult,
  SourceCapabilities,
  ContentType,
  MediaType,
  MediaDomain,
  ReaderMode,
} from "../types";

export class MangaDexProvider implements SourceProvider {
  readonly id = "mangadex";
  readonly name = "MangaDex";
  readonly domains = ["mangadex.org"];
  readonly contentType: ContentType = "manga";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["vertical", "single", "dual"];

  readonly capabilities: SourceCapabilities = {
    search: true,
    tagSearch: true,
    seriesBrowse: true,
    chapterFeed: true,
    pagination: true,
    authentication: false,
  };

  // ─── Tag Cache ────────────────────────────────────────────────────
  private tagCache: Record<string, string> | null = null;

  // ─── URL Matching ─────────────────────────────────────────────────

  matchesUrl(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace("www.", "");
      return this.domains.some((d) =>
        hostname.toLowerCase().includes(d.toLowerCase()),
      );
    } catch {
      // Handle raw UUIDs or partial paths
      return (
        /^[a-f0-9-]{36}$/i.test(url) ||
        url.toLowerCase().includes("mangadex.org/title/") ||
        url.toLowerCase().includes("mangadex.org/chapter/")
      );
    }
  }

  // ─── Content Fetching ─────────────────────────────────────────────

  async fetchContent(url: string): Promise<SourceContent> {
    // Normalize raw UUIDs
    let targetUrl = url;
    if (url.match(/^[a-f0-9-]{36}$/i)) {
      targetUrl = `https://mangadex.org/chapter/${url}`;
    }

    const mangaIdMatch = targetUrl.match(
      /mangadex\.org\/title\/([a-f0-9-]{36})/i,
    );
    const chapterIdMatch = targetUrl.match(
      /mangadex\.org\/chapter\/([a-f0-9-]{36})/i,
    );

    let chapterId: string | null = null;
    let metadata: SourceContent["metadata"] = undefined;

    if (chapterIdMatch) {
      chapterId = chapterIdMatch[1];
      const chapRes = await fetch(
        `https://api.mangadex.org/chapter/${chapterId}?includes[]=manga`,
      );
      const chapData = await chapRes.json();

      if (chapData.result === "error" || !chapData.data) {
        // Composite ID fallback
        if (targetUrl.includes("-")) {
          const lastPart = targetUrl.split("/").pop() || "";
          const match = lastPart.match(/^([a-f0-9-]{36})-(.+)$/);
          if (match) {
            const mId = match[1];
            const chNum = match[2];
            const feed = await this.fetchChapterFeed(mId);
            const found = feed.find((c) => c.number === chNum);
            if (found) {
              return await this.fetchContent(
                `https://mangadex.org/chapter/${found.id}`,
              );
            }
          }
        }
        throw new Error(
          chapData.errors?.[0]?.detail || "Chapter not found on MangaDex",
        );
      }

      const mangaRel = chapData.data.relationships.find(
        (r: any) => r.type === "manga",
      );
      if (mangaRel) {
        const mId = mangaRel.id;
        const details = await this.getMangaDetails(mId);
        const chapterAttribs = chapData.data.attributes;
        const chapterNum = chapterAttribs.chapter;
        const chapTitle = chapterAttribs.title
          ? `: ${chapterAttribs.title}`
          : "";

        metadata = {
          title: details.title,
          coverUrl: details.coverUrl,
          description: details.description,
          sourceId: mId,
          author: details.author,
          tags: details.tags,
        };
        // Store chapterTitle as part of the title for display
        // (bridge layer will map sourceId -> mangaId)
      }
    } else if (mangaIdMatch) {
      const mId = mangaIdMatch[1];
      const details = await this.getMangaDetails(mId);
      const feed = await this.fetchChapterFeed(mId);

      if (feed.length > 0) {
        const latestChapter = feed[feed.length - 1];
        chapterId = latestChapter.id;
        metadata = {
          title: details.title,
          coverUrl: details.coverUrl,
          description: details.description,
          sourceId: mId,
          author: details.author,
          tags: details.tags,
        };
      } else {
        throw new Error(
          "No English chapters found on MangaDex for this series.",
        );
      }
    } else {
      throw new Error("Invalid MangaDex URL format.");
    }

    // Fetch image server info
    const atHomeRes = await fetch(
      `https://api.mangadex.org/at-home/server/${chapterId}`,
    );
    const atHome = await atHomeRes.json();

    if (atHome.result !== "ok") {
      throw new Error("Failed to get chapter server: " + atHome.result);
    }

    const { baseUrl, chapter } = atHome;
    const images = chapter.data.map((file: string, index: number) => ({
      url: `${baseUrl}/data/${chapter.hash}/${file}`,
      pageNumber: index + 1,
    }));

    return { images, metadata };
  }

  // ─── Series ───────────────────────────────────────────────────────

  async fetchSeries(url: string): Promise<SourceSeries> {
    const mangaIdMatch = url.match(/mangadex\.org\/title\/([a-f0-9-]{36})/i);
    if (!mangaIdMatch) throw new Error("Invalid MangaDex series URL");

    const mId = mangaIdMatch[1];
    const details = await this.getMangaDetails(mId);
    const chapters = await this.fetchChapterFeed(mId);

    return {
      title: details.title,
      description: details.description,
      coverUrl: details.coverUrl || "",
      seriesUrl: url,
      source: "mangadex.org",
      tags: details.tags,
      chapters,
      metadata: {
        mangaId: mId, // CRITICAL: preserve UUID for store logic
        author: details.author,
      },
    };
  }

  // ─── Chapter Feed ─────────────────────────────────────────────────

  async fetchChapterFeed(mangaId: string): Promise<SourceChapter[]> {
    const allChapters: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const feedUrl =
        `https://api.mangadex.org/manga/${mangaId}/feed?` +
        `translatedLanguage[]=en&limit=${limit}&offset=${offset}&` +
        `order[chapter]=asc&` +
        `includes[]=scanlation_group`;

      const res = await fetch(feedUrl);
      if (!res.ok) throw new Error("Failed to fetch chapter feed");

      const feed = await res.json();
      if (feed.result !== "ok" || !feed.data?.length) break;

      allChapters.push(...feed.data);
      offset += limit;

      if (offset >= feed.total) break;
    }

    const uniqueChapters: any[] = [];
    const seenNumbers = new Set<string>();
    
    for (const ch of allChapters) {
      const num = ch.attributes?.chapter || "0";
      if (!seenNumbers.has(num)) {
        seenNumbers.add(num);
        uniqueChapters.push(ch);
      }
    }

    return uniqueChapters.map((ch: any) => ({
      id: ch.id,
      number: ch.attributes?.chapter || "0",
      url: `https://mangadex.org/chapter/${ch.id}`,
      title: ch.attributes?.title || undefined,
      source: "mangadex.org",
    }));
  }

  // ─── Search ───────────────────────────────────────────────────────

  async search(
    query: string,
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const res = await fetch(
      `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&includes[]=cover_art&availableTranslatedLanguage[]=en`,
    );
    if (!res.ok) throw new Error("MangaDex search failed");
    const json = await res.json();
    return this.mapSearchResults(json.data);
  }

  async searchByTags(
    tags: string[],
    options: SourceSearchOptions = {},
  ): Promise<SourceSearchResult[]> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const tagMap = await this.getMangaDexTags();
    const tagIds = tags.map((t) => tagMap[t.toLowerCase()]).filter(Boolean);
    if (tagIds.length === 0) return [];

    const tagParams = tagIds.map((id) => `includedTags[]=${id}`).join("&");
    const res = await fetch(
      `https://api.mangadex.org/manga?${tagParams}&limit=${limit}&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=en`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    return this.mapSearchResults(json.data);
  }

  async fetchPopular(
    page: number = 1,
    limit: number = 20,
    coloredOnly: boolean = false,
  ): Promise<SourceSearchResult[]> {
    const offset = (page - 1) * limit;
    let url = `https://api.mangadex.org/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&order[followedCount]=desc&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=en`;

    if (coloredOnly) {
      const tagMap = await this.getMangaDexTags();
      const colorTagId = tagMap["full color"];
      if (colorTagId) url += `&includedTags[]=${colorTagId}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return this.mapSearchResults(json.data);
  }

  async fetchLatest(
    page: number = 1,
    limit: number = 20,
    coloredOnly: boolean = false,
  ): Promise<SourceSearchResult[]> {
    const offset = (page - 1) * limit;
    let url = `https://api.mangadex.org/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&order[latestUploadedChapter]=desc&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=en`;

    if (coloredOnly) {
      const tagMap = await this.getMangaDexTags();
      const colorTagId = tagMap["full color"];
      if (colorTagId) url += `&includedTags[]=${colorTagId}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return this.mapSearchResults(json.data);
  }

  // ─── Internal Helpers ─────────────────────────────────────────────

  async getMangaDetails(mangaId: string): Promise<{
    title: string;
    description: string;
    author?: string;
    tags: string[];
    coverUrl?: string;
  }> {
    const res = await fetch(
      `https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
    );
    if (!res.ok) throw new Error("Failed to fetch manga details");

    const json = await res.json();
    const attrs = json.data.attributes;

    const titleObj = attrs.title;
    const title =
      titleObj.en || titleObj[Object.keys(titleObj)[0]] || "Untitled";

    const descObj = attrs.description;
    const description =
      descObj?.en ||
      descObj?.[Object.keys(descObj)[0]] ||
      "No description available";

    const authorRel = json.data.relationships.find(
      (r: any) => r.type === "author" || r.type === "artist",
    );
    const author = authorRel?.attributes?.name;

    const tags = attrs.tags
      .map((t: any) => t.attributes.name.en)
      .filter(Boolean);

    const coverRel = json.data.relationships.find(
      (r: any) => r.type === "cover_art",
    );
    const fileName = coverRel?.attributes?.fileName;
    const coverUrl = fileName
      ? `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`
      : undefined;

    return { title, description, author, tags, coverUrl };
  }

  async getMangaDexTags(): Promise<Record<string, string>> {
    if (this.tagCache) return this.tagCache;
    try {
      const res = await fetch("https://api.mangadex.org/manga/tag");
      if (!res.ok) return {};
      const json = await res.json();
      const mapping: Record<string, string> = {};
      json.data.forEach((t: any) => {
        const name = t.attributes.name.en.toLowerCase();
        mapping[name] = t.id;
      });
      this.tagCache = mapping;
      return mapping;
    } catch {
      return {};
    }
  }

  private mapSearchResults(data: any[]): SourceSearchResult[] {
    return data.map((m: any) => {
      const attrs = m.attributes;
      const title =
        attrs.title.en ||
        attrs.title[Object.keys(attrs.title)[0]] ||
        "Untitled";
      const coverRel = m.relationships.find((r: any) => r.type === "cover_art");
      const fileName = coverRel?.attributes?.fileName;

      return {
        id: m.id,
        title,
        tags: attrs.tags?.map((t: any) => t.attributes.name.en) || [],
        description: attrs.description?.en || "",
        coverUrl: fileName
          ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}`
          : undefined,
        source: "mangadex.org",
        contentType: "manga" as ContentType,
        url: `https://mangadex.org/title/${m.id}`,
      };
    });
  }
}
