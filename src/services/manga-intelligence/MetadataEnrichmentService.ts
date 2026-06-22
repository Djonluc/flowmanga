import { getDb } from "../db";
import type { Series } from "../../stores/useLibraryStore";

interface EnrichmentResult {
  title?: string;
  alternativeTitles?: string[];
  japaneseTitle?: string;
  englishTitle?: string;
  description?: string;
  genres?: string[];
  themes?: string[];
  author?: string;
  artist?: string;
  publisher?: string;
  status?: string;
  releaseDate?: string;
  coverUrl?: string;
  anilistId?: string;
  malId?: string;
  kitsuId?: string;
  mangadexId?: string;
  confidenceScore: number;
}

export class MetadataEnrichmentService {
  private static queue: string[] = [];
  private static isProcessing = false;

  /**
   * Cleans a folder or messy title to a queryable format
   * e.g., "Sousou_no_Frieren_v12" -> "Sousou no Frieren"
   */
  public static normalizeTitle(rawTitle: string): string {
    let title = rawTitle;
    
    // Remove volume/chapter markers at the end
    title = title.replace(/_(v|vol|volume|c|ch|chapter)\d+.*$/i, "");
    title = title.replace(/ (v|vol|volume|c|ch|chapter)\d+.*$/i, "");
    
    // Replace underscores with spaces
    title = title.replace(/_/g, " ");
    
    // Remove bracketed text like [Group Name]
    title = title.replace(/\[.*?\]/g, "");
    title = title.replace(/\(.*?\)/g, "");
    
    // Clean up multiple spaces
    return title.trim().replace(/\s+/g, " ");
  }

  /**
   * Compute a confidence score (0-100) based on title match and other fields
   */
  private static computeConfidence(originalTitle: string, resultTitle: string, resultAltTitles: string[] = []): number {
    const orig = this.normalizeTitle(originalTitle).toLowerCase();
    const res = resultTitle.toLowerCase();
    
    if (orig === res) return 100;
    if (res.includes(orig) || orig.includes(res)) return 90;
    
    for (const alt of resultAltTitles) {
      if (alt.toLowerCase() === orig) return 95;
      if (alt.toLowerCase().includes(orig) || orig.includes(alt.toLowerCase())) return 85;
    }
    
    // rudimentary jaccard similarity for words
    const origWords = new Set(orig.split(" "));
    const resWords = new Set(res.split(" "));
    const intersection = new Set([...origWords].filter(x => resWords.has(x)));
    const union = new Set([...origWords, ...resWords]);
    const sim = (intersection.size / union.size) * 100;
    
    return sim;
  }

  // --- API Providers ---

  private static async queryAnilist(query: string): Promise<EnrichmentResult | null> {
    const graphqlQuery = `
      query ($search: String) {
        Media(search: $search, type: MANGA) {
          id
          title {
            romaji
            english
            native
          }
          synonyms
          description
          genres
          tags {
            name
            rank
          }
          status
          startDate {
            year
            month
            day
          }
          coverImage {
            large
          }
          staff {
            edges {
              role
              node {
                name {
                  full
                }
              }
            }
          }
        }
      }
    `;

    try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: graphqlQuery, variables: { search: query } })
      });
      if (!res.ok) return null;
      const json = await res.json();
      const media = json.data?.Media;
      if (!media) return null;

      const altTitles = [...(media.synonyms || [])];
      if (media.title.english) altTitles.push(media.title.english);
      if (media.title.native) altTitles.push(media.title.native);

      let author, artist;
      for (const edge of media.staff?.edges || []) {
        if (edge.role?.toLowerCase().includes("story")) author = edge.node.name.full;
        if (edge.role?.toLowerCase().includes("art")) artist = edge.node.name.full;
      }
      if (!author && media.staff?.edges?.[0]) author = media.staff.edges[0].node.name.full;

      return {
        title: media.title.romaji || media.title.english,
        japaneseTitle: media.title.native,
        englishTitle: media.title.english,
        alternativeTitles: altTitles,
        description: media.description?.replace(/<br>/g, "\n"),
        genres: media.genres,
        themes: media.tags?.filter((t: any) => t.rank >= 50).map((t: any) => t.name),
        status: media.status,
        releaseDate: media.startDate?.year ? `${media.startDate.year}-${media.startDate.month || 1}-${media.startDate.day || 1}` : undefined,
        coverUrl: media.coverImage?.large,
        author,
        artist,
        anilistId: media.id.toString(),
        confidenceScore: this.computeConfidence(query, media.title.romaji || media.title.english, altTitles)
      };
    } catch (e) {
      console.warn("[Enrichment] AniList query failed", e);
      return null;
    }
  }

  private static async queryMangaDex(query: string): Promise<EnrichmentResult | null> {
    try {
      const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=1&includes[]=author&includes[]=artist&includes[]=cover_art`);
      if (!res.ok) return null;
      const json = await res.json();
      const manga = json.data?.[0];
      if (!manga) return null;

      const attrs = manga.attributes;
      const titleObj = attrs.title;
      const title = titleObj.en || titleObj[Object.keys(titleObj)[0]] || "Untitled";
      
      const altTitles = attrs.altTitles.map((t: any) => t.en || t[Object.keys(t)[0]]).filter(Boolean);
      const descObj = attrs.description;
      const description = descObj?.en || descObj?.[Object.keys(descObj)[0]];

      const authorRel = manga.relationships.find((r: any) => r.type === "author");
      const artistRel = manga.relationships.find((r: any) => r.type === "artist");
      const coverRel = manga.relationships.find((r: any) => r.type === "cover_art");

      const tags = attrs.tags.map((t: any) => t.attributes.name.en).filter(Boolean);

      return {
        title,
        alternativeTitles: altTitles,
        description,
        themes: tags,
        status: attrs.status,
        releaseDate: attrs.year?.toString(),
        author: authorRel?.attributes?.name,
        artist: artistRel?.attributes?.name,
        coverUrl: coverRel?.attributes?.fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${coverRel.attributes.fileName}` : undefined,
        mangadexId: manga.id,
        confidenceScore: this.computeConfidence(query, title, altTitles)
      };
    } catch (e) {
      console.warn("[Enrichment] MangaDex query failed", e);
      return null;
    }
  }

  private static async queryJikan(query: string): Promise<EnrichmentResult | null> {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=1`);
      if (!res.ok) return null;
      const json = await res.json();
      const manga = json.data?.[0];
      if (!manga) return null;

      const altTitles = [manga.title_english, manga.title_japanese, ...(manga.title_synonyms || [])].filter(Boolean);

      return {
        title: manga.title,
        englishTitle: manga.title_english,
        japaneseTitle: manga.title_japanese,
        alternativeTitles: altTitles,
        description: manga.synopsis,
        genres: manga.genres?.map((g: any) => g.name),
        themes: manga.themes?.map((t: any) => t.name),
        author: manga.authors?.[0]?.name,
        status: manga.status,
        releaseDate: manga.published?.from?.split("T")[0],
        coverUrl: manga.images?.webp?.large_image_url || manga.images?.jpg?.large_image_url,
        malId: manga.mal_id?.toString(),
        confidenceScore: this.computeConfidence(query, manga.title, altTitles)
      };
    } catch (e) {
      console.warn("[Enrichment] Jikan (MAL) query failed", e);
      return null;
    }
  }

  private static async queryKitsu(query: string): Promise<EnrichmentResult | null> {
    try {
      const res = await fetch(`https://kitsu.io/api/edge/manga?filter[text]=${encodeURIComponent(query)}&page[limit]=1`);
      if (!res.ok) return null;
      const json = await res.json();
      const manga = json.data?.[0];
      if (!manga) return null;

      const attrs = manga.attributes;
      const altTitles = [attrs.titles.en, attrs.titles.en_jp, attrs.titles.ja_jp, ...(attrs.abbreviatedTitles || [])].filter(Boolean);

      return {
        title: attrs.canonicalTitle,
        englishTitle: attrs.titles.en,
        japaneseTitle: attrs.titles.ja_jp,
        alternativeTitles: altTitles,
        description: attrs.synopsis,
        status: attrs.status,
        releaseDate: attrs.startDate,
        coverUrl: attrs.posterImage?.large || attrs.posterImage?.original,
        kitsuId: manga.id,
        confidenceScore: this.computeConfidence(query, attrs.canonicalTitle, altTitles)
      };
    } catch (e) {
      console.warn("[Enrichment] Kitsu query failed", e);
      return null;
    }
  }

  /**
   * Fetches from multiple providers and merges the best results.
   */
  public static async fetchEnrichmentData(rawQuery: string): Promise<EnrichmentResult | null> {
    const query = this.normalizeTitle(rawQuery);
    
    // We fetch in parallel, but handle failures gracefully
    const [anilist, mangadex, jikan, kitsu] = await Promise.all([
      this.queryAnilist(query),
      this.queryMangaDex(query),
      this.queryJikan(query),
      this.queryKitsu(query)
    ]);

    const results = [anilist, mangadex, jikan, kitsu].filter((r): r is EnrichmentResult => r !== null);
    if (results.length === 0) return null;

    // Find the result with the highest confidence
    results.sort((a, b) => b.confidenceScore - a.confidenceScore);
    const bestMatch = results[0];

    if (bestMatch.confidenceScore < 60) {
      console.log(`[Enrichment] Low confidence (${bestMatch.confidenceScore}%) for "${query}". Skipping enrichment.`);
      return null;
    }

    // Merge missing fields from other providers (prioritizing the highest confidence)
    const merged: EnrichmentResult = { ...bestMatch };
    
    for (const res of results) {
      if (!merged.description && res.description) merged.description = res.description;
      if (!merged.genres?.length && res.genres?.length) merged.genres = res.genres;
      if (!merged.themes?.length && res.themes?.length) merged.themes = res.themes;
      if (!merged.author && res.author) merged.author = res.author;
      if (!merged.artist && res.artist) merged.artist = res.artist;
      if (!merged.status && res.status) merged.status = res.status;
      if (!merged.releaseDate && res.releaseDate) merged.releaseDate = res.releaseDate;
      if (!merged.coverUrl && res.coverUrl) merged.coverUrl = res.coverUrl;
      if (!merged.englishTitle && res.englishTitle) merged.englishTitle = res.englishTitle;
      if (!merged.japaneseTitle && res.japaneseTitle) merged.japaneseTitle = res.japaneseTitle;
      if (!merged.anilistId && res.anilistId) merged.anilistId = res.anilistId;
      if (!merged.malId && res.malId) merged.malId = res.malId;
      if (!merged.kitsuId && res.kitsuId) merged.kitsuId = res.kitsuId;
      if (!merged.mangadexId && res.mangadexId) merged.mangadexId = res.mangadexId;
      
      if (res.alternativeTitles) {
        merged.alternativeTitles = Array.from(new Set([...(merged.alternativeTitles || []), ...res.alternativeTitles]));
      }
    }

    return merged;
  }

  /**
   * Main entrypoint to enqueue a series for metadata enrichment
   */
  public static async enqueueSeries(seriesId: string) {
    if (!this.queue.includes(seriesId)) {
      this.queue.push(seriesId);
    }
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private static async processQueue() {
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const seriesId = this.queue.shift();
      if (!seriesId) continue;
      
      try {
        await this.enrichSeries(seriesId);
      } catch (e) {
        console.error(`[Enrichment] Error enriching series ${seriesId}:`, e);
      }
      
      // Delay between queries to avoid rate limits (2 seconds)
      await new Promise(r => setTimeout(r, 2000));
    }
    this.isProcessing = false;
  }

  /**
   * The actual enrichment logic that writes to the DB.
   */
  private static async enrichSeries(seriesId: string) {
    const db = getDb();
    const rows = await db.select<any[]>("SELECT * FROM Series WHERE id = ?", [seriesId]);
    if (rows.length === 0) return;
    
    const series = rows[0];
    const rawTitle = series.title;

    console.log(`[Enrichment] Starting enrichment for "${rawTitle}"`);
    
    const enrichment = await this.fetchEnrichmentData(rawTitle);
    if (!enrichment) {
      console.log(`[Enrichment] No match found for "${rawTitle}"`);
      return;
    }

    console.log(`[Enrichment] Found match for "${rawTitle}": ${enrichment.title} (Score: ${enrichment.confidenceScore.toFixed(1)}%)`);

    // We only update fields that are missing or empty in the local DB, or update everything official while keeping user's displayName
    const newAnilistId = series.anilistId || enrichment.anilistId;
    const newMalId = series.malId || enrichment.malId;
    const newKitsuId = series.kitsuId || enrichment.kitsuId;
    const newMangaId = series.mangaId || enrichment.mangadexId; // cross-source provider identifier
    
    const newDesc = series.description || enrichment.description || "";
    const newAuthor = series.author || enrichment.author || "";
    const newArtist = series.artist || enrichment.artist || "";
    const newStatus = series.status || enrichment.status || "";
    const newReleaseDate = series.releaseDate || enrichment.releaseDate || "";
    
    // Merge tags/genres/themes
    const existingTags = series.tags ? series.tags.split(",").map((t: string) => t.trim()) : [];
    const mergedTags = new Set([...existingTags, ...(enrichment.genres || []), ...(enrichment.themes || [])]);
    const finalTags = Array.from(mergedTags).filter(Boolean).join(",");

    const altTitlesJson = JSON.stringify(enrichment.alternativeTitles || []);
    
    // Only update displayTitle if the user hasn't manually set one
    const newDisplayTitle = series.displayTitle || enrichment.title;
    
    await db.execute(
      `UPDATE Series 
       SET anilistId = ?, malId = ?, kitsuId = ?, mangaId = ?,
           description = ?, author = ?, artist = ?, status = ?, releaseDate = ?,
           tags = ?, alternativeTitles = ?, japaneseTitle = ?, englishTitle = ?,
           confidenceScore = ?, displayTitle = ?
       WHERE id = ?`,
      [
        newAnilistId, newMalId, newKitsuId, newMangaId,
        newDesc, newAuthor, newArtist, newStatus, newReleaseDate,
        finalTags, altTitlesJson, enrichment.japaneseTitle, enrichment.englishTitle,
        enrichment.confidenceScore, newDisplayTitle,
        seriesId
      ]
    );

    // If cover is missing, we could download it here, but it's handled by useLibraryStore.
    // At minimum, we updated the db text fields. We trigger a loadFromDb to reflect changes.
    // We cannot easily call useLibraryStore.getState().loadFromDb() without circular dependency,
    // so we dispatch an event or assume the UI will refresh it.
    
    // Tauri event
    try {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("library-metadata-enriched", { seriesId });
    } catch(e) {}
  }
}
