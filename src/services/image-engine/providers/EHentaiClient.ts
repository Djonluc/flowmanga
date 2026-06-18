import { BaseProvider } from "./BaseProvider";
import type { 
  ImageMedia, 
  StructuredQuery, 
  EngineSearchOptions,
  SourceCapabilities
} from "../types";
import { useSettingsStore } from "../../../stores/useSettingsStore";

export class EHentaiClient extends BaseProvider {
  readonly id = "e-hentai";
  readonly name = "E-Hentai";
  readonly baseUrl = "https://e-hentai.org";
  
  readonly capabilities: SourceCapabilities = {
    supportsNegativeTags: true,
    maxTagsPerRequest: 10,
    supportsSort: false, // Sort is limited or handled differently
    supportsScore: true,
    nativeRecommendations: false,
    status: "auth_required",
    authentication: true,
    requiresCookies: true,
    authUrl: "https://forums.e-hentai.org/index.php?act=Login"
  };

  private getAuthHeaders(): Record<string, string> {
    const auth = useSettingsStore.getState().booruAuth?.[this.id];
    if (auth?.sessionCookies) {
      return {
        "Cookie": auth.sessionCookies
      };
    }
    return {};
  }

  async search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]> {
    const headers = this.getAuthHeaders();
    if (!headers["Cookie"]) {
      console.warn(`[EHentaiClient] Missing session cookies. Aborting to avoid ban.`);
      return [];
    }

    const apiTags = [...query.positiveTags, ...query.negativeTags.map(n => `-${n}`)];
    const tagsQueryString = apiTags.join(" ");

    const html = await this.fetchHtml(`/?f_search=${encodeURIComponent(tagsQueryString)}&page=${(options.page || 1) - 1}`, {}, {
      "Accept": "text/html",
      ...headers
    });

    return this.parseGalleryList(html);
  }

  async getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]> {
    const headers = this.getAuthHeaders();
    if (!headers["Cookie"]) return [];

    const html = await this.fetchHtml(`/?page=${(options.page || 1) - 1}`, {}, {
      "Accept": "text/html",
      ...headers
    });
    return this.parseGalleryList(html);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRecommendations(_image: ImageMedia): Promise<ImageMedia[]> {
    return [];
  }

  private parseGalleryList(html: string): ImageMedia[] {
    const results: ImageMedia[] = [];
    
    // We use simple regex extraction to avoid heavy DOM parsing in the backend/worker
    // We use simple regex extraction to avoid heavy DOM parsing in the backend/worker
    const urlRegex = /href="(https:\/\/e-hentai\.org\/g\/(\d+)\/([a-z0-9]+)\/)"/;
    const titleRegex = /<div class="glink"[^>]*>(.*?)<\/div>/;
    const imgRegex = /src="(https:\/\/[^"]+)"/;
    const tagRegex = /<div class="gt"[^>]*>(.*?)<\/div>/g;
    
    // A more reliable global regex for gallery rows (class "gl1t" or similar index rows)
    const galleryBlocks = html.split('<td class="gl1c');
    galleryBlocks.shift(); // Remove pre-header

    for (const block of galleryBlocks) {
      try {
        const urlMatch = block.match(urlRegex);
        if (!urlMatch) continue;
        
        const fullUrl = urlMatch[1];
        const gid = urlMatch[2];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _token = urlMatch[3];

        const titleMatch = block.match(titleRegex);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : `Gallery ${gid}`;

        let coverUrl = "";
        const imgMatch = block.match(imgRegex);
        if (imgMatch) {
          coverUrl = imgMatch[1];
        }

        const tags: string[] = [];
        let tagMatch;
        while ((tagMatch = tagRegex.exec(block)) !== null) {
          tags.push(tagMatch[1].trim());
        }

        let category = "manga";
        const catRegex = /<div class="cn[^>]*>(.*?)<\/div>/;
        const catMatch = block.match(catRegex);
        if (catMatch) {
            const rawCat = catMatch[1].toLowerCase();
            if (rawCat.includes("image set") || rawCat.includes("cosplay") || rawCat.includes("asian porn") || rawCat.includes("misc") || rawCat.includes("non-h")) {
                category = "image_set";
            } else {
                category = "doujin";
            }
        }

        results.push({
          id: `${this.id}-${gid}`,
          sourceId: gid,
          providerId: this.id,
          title,
          thumbnailUrl: coverUrl,
          previewUrl: coverUrl,
          sampleUrl: coverUrl, // Real images are inside the gallery
          fullUrl: coverUrl,
          tags,
          generalTags: tags,
          characterTags: [],
          artistTags: [],
          copyrightTags: [],
          metaTags: [],
          rating: "explicit", // E-Hentai
          score: 0,
          createdAt: new Date().toISOString(),
          mediaType: "image",
          contentCategory: category,
          sourceUrl: fullUrl,
        });
      } catch (e) {
        console.warn("[EHentaiClient] Failed to parse a gallery block", e);
      }
    }

    return results;
  }
}
