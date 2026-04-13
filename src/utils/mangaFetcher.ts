// Manga metadata fetching utilities
// Supports multiple sources: MangaDex, AniList, MyAnimeList

export type MangaMetadata = {
  title: string;
  alternativeTitles?: string[];
  description?: string;
  author?: string;
  artist?: string;
  coverUrl?: string;
  genres?: string[];
  tags?: string[];
  status?: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  year?: number;
  rating?: number;
  chapters?: number;
  volumes?: number;
  source?: string;
};

// MangaDex API
export async function fetchFromMangaDex(title: string): Promise<MangaMetadata | null> {
  try {
    const searchUrl = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=1`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.data || data.data.length === 0) return null;
    
    const manga = data.data[0];
    const attributes = manga.attributes;
    
    // Get cover art
    let coverUrl: string | undefined;
    const coverRelationship = manga.relationships?.find((rel: any) => rel.type === 'cover_art');
    if (coverRelationship) {
      const coverId = coverRelationship.id;
      const coverResponse = await fetch(`https://api.mangadex.org/cover/${coverId}`);
      if (coverResponse.ok) {
        const coverData = await coverResponse.json();
        const fileName = coverData.data.attributes.fileName;
        coverUrl = `https://uploads.mangadex.org/covers/${manga.id}/${fileName}`;
      }
    }
    
    return {
      title: attributes.title.en || Object.values(attributes.title)[0] as string,
      alternativeTitles: attributes.altTitles?.map((t: any) => Object.values(t)[0]) as string[],
      description: attributes.description?.en || Object.values(attributes.description || {})[0] as string,
      author: manga.relationships?.find((r: any) => r.type === 'author')?.attributes?.name,
      artist: manga.relationships?.find((r: any) => r.type === 'artist')?.attributes?.name,
      coverUrl,
      genres: attributes.tags?.filter((t: any) => t.attributes.group === 'genre').map((t: any) => t.attributes.name.en),
      tags: attributes.tags?.map((t: any) => t.attributes.name.en),
      status: attributes.status,
      year: attributes.year,
      source: 'MangaDex',
    };
  } catch (error) {
    console.error('MangaDex fetch error:', error);
    return null;
  }
}

// AniList API
export async function fetchFromAniList(title: string): Promise<MangaMetadata | null> {
  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: MANGA) {
          title {
            romaji
            english
            native
          }
          description
          coverImage {
            large
          }
          genres
          tags {
            name
          }
          status
          startDate {
            year
          }
          averageScore
          chapters
          volumes
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
    
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { search: title },
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const media = data.data?.Media;
    if (!media) return null;
    
    const author = media.staff?.edges?.find((e: any) => e.role === 'Story')?.node?.name?.full;
    const artist = media.staff?.edges?.find((e: any) => e.role === 'Art')?.node?.name?.full;
    
    return {
      title: media.title.english || media.title.romaji,
      alternativeTitles: [media.title.romaji, media.title.native].filter(Boolean),
      description: media.description?.replace(/<[^>]*>/g, ''), // Strip HTML
      author,
      artist,
      coverUrl: media.coverImage?.large,
      genres: media.genres,
      tags: media.tags?.map((t: any) => t.name),
      status: media.status?.toLowerCase(),
      year: media.startDate?.year,
      rating: media.averageScore ? media.averageScore / 10 : undefined,
      chapters: media.chapters,
      volumes: media.volumes,
      source: 'AniList',
    };
  } catch (error) {
    console.error('AniList fetch error:', error);
    return null;
  }
}

// MyAnimeList API (using Jikan - unofficial MAL API)
export async function fetchFromMyAnimeList(title: string): Promise<MangaMetadata | null> {
  try {
    const searchUrl = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(title)}&limit=1`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.data || data.data.length === 0) return null;
    
    const manga = data.data[0];
    
    return {
      title: manga.title,
      alternativeTitles: manga.title_synonyms,
      description: manga.synopsis,
      author: manga.authors?.[0]?.name,
      artist: manga.authors?.find((a: any) => a.type === 'Art')?.name,
      coverUrl: manga.images?.jpg?.large_image_url,
      genres: manga.genres?.map((g: any) => g.name),
      tags: manga.themes?.map((t: any) => t.name),
      status: manga.status?.toLowerCase(),
      year: manga.published?.from ? new Date(manga.published.from).getFullYear() : undefined,
      rating: manga.score,
      chapters: manga.chapters,
      volumes: manga.volumes,
      source: 'MyAnimeList',
    };
  } catch (error) {
    console.error('MyAnimeList fetch error:', error);
    return null;
  }
}

// Main fetching function - tries multiple sources
export async function fetchMangaMetadata(title: string): Promise<MangaMetadata | null> {
  // Try sources in order of preference
  const sources = [
    fetchFromAniList,
    fetchFromMangaDex,
    fetchFromMyAnimeList,
  ];
  
  for (const fetchFn of sources) {
    try {
      const result = await fetchFn(title);
      if (result) {
        // console.log(`✅ Found metadata from ${result.source} for: ${title}`);
        return result;
      }
    } catch (error) {
      console.error(`Failed to fetch from source:`, error);
    }
  }
  
  console.warn(`❌ No metadata found for: ${title}`);
  return null;
}

// Batch fetch for multiple titles
export async function batchFetchMetadata(titles: string[]): Promise<Map<string, MangaMetadata>> {
  const results = new Map<string, MangaMetadata>();
  
  // Fetch with rate limiting (1 request per 500ms to avoid API limits)
  for (const title of titles) {
    const metadata = await fetchMangaMetadata(title);
    if (metadata) {
      results.set(title, metadata);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

// Download and cache cover image
export async function downloadCover(coverUrl: string, mangaId: string): Promise<string | null> {
  try {
    const { writeFile, BaseDirectory, mkdir } = await import('@tauri-apps/plugin-fs');
    const response = await fetch(coverUrl);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Ensure covers directory exists
    await mkdir('covers', { baseDir: BaseDirectory.AppData, recursive: true });
    
    const fileName = `cover_${mangaId}.jpg`;
    const localPath = `covers/${fileName}`;
    
    await writeFile(localPath, uint8Array, { baseDir: BaseDirectory.AppData });
    
    return localPath;
  } catch (error) {
    console.error('Cover download error:', error);
    return null;
  }
}
