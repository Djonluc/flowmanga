import { invoke } from "@tauri-apps/api/core";
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

export class DBMProvider implements SourceProvider {
  readonly id = "dbm";
  readonly name = "Dragon Ball Multiverse";
  readonly domains = ["dragonball-multiverse.com"];
  readonly contentType: ContentType = "manga";
  readonly mediaDomain: MediaDomain = "manga";
  readonly mediaTypes: MediaType[] = ["image"];
  readonly defaultPersistence = "library" as const;
  readonly readerModes: ReaderMode[] = ["single"];

  readonly capabilities: SourceCapabilities = {
    search: false,
    tagSearch: false,
    seriesBrowse: true,
    chapterFeed: true,
    pagination: false,
    authentication: false,
  };

  matchesUrl(url: string): boolean {
    return url.includes("dragonball-multiverse.com");
  }

  async fetchContent(url: string): Promise<SourceContent> {
    const html = await invoke<string>("fetch_html", { url, headers: null });
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const img = doc.querySelector("#manga_page, #manga_canvas img");
    const src = img?.getAttribute("src");

    return {
      images: src
        ? [
            {
              url: `https://www.dragonball-multiverse.com${src}`,
              pageNumber: 1,
            },
          ]
        : [],
      metadata: { sourceUrl: url },
    };
  }

  async fetchSeries(url: string): Promise<SourceSeries> {
    return {
      title: "Dragon Ball Multiverse",
      description: "The sequel to Dragon Ball Z created by fans.",
      coverUrl: "https://www.dragonball-multiverse.com/imgs/title_en.png",
      seriesUrl: url,
      source: "dragonball-multiverse.com",
      chapters: [], // DBM is handled differently, usually page by page
    };
  }
}
