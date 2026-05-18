import { useSettingsStore } from "../stores/useSettingsStore";
import type { SourceSearchResult } from "./sources/types";

export class ContentFilter {
  static filterResults(items: SourceSearchResult[]): SourceSearchResult[] {
    const { showAdultContent } = useSettingsStore.getState();
    if (showAdultContent) return items;

    return items.filter((item) => !this.isAdult(item));
  }

  static isAdult(item: any): boolean {
    const { showAdultContent, excludedTags = [] } = useSettingsStore.getState();
    if (showAdultContent) return false;

    const titleLower = (item.title || "").toLowerCase();
    const source = (item.source || "").toLowerCase();
    const rating = (item.rating || "").toLowerCase();

    // 0. Provider Rating Metadata
    if (rating === "explicit" || rating === "questionable" || rating === "e" || rating === "q") {
      return true;
    }

    // 1. Adult Content Filter
    const isAdultSite =
      source.includes("nhentai") ||
      source.includes("rule34") ||
      source.includes("luscious") ||
      source.includes("kemono") ||
      source.includes("hentai") ||
      source.includes("danbooru") ||
      source.includes("gelbooru") ||
      source.includes("konachan") ||
      source.includes("yandere");

    const allItemTags = [
      ...(item.tags || []),
      ...(item.generalTags || []),
      ...(item.characterTags || []),
      ...(item.copyrightTags || []),
      ...(item.artistTags || []),
      ...(item.metaTags || []),
    ].map((tag) => tag.toLowerCase().trim());

    const hasAdultTag = allItemTags.some(
      (t) =>
        [
          "hentai",
          "smut",
          "erotica",
          "erotic",
          "adult",
          "porn",
          "pornography",
          "doujinshi",
          //"18+",
          "nsfw",
          "explicit",
          "nudity",
          "nude",
          "fetish",
          "sexualized",
          "cross-gender",
          "cross-dressing",
          "crossdressing",
          "gender swap",
          "genderswap",
          "gender transformation",
          "roleplay",
          "bdsm",
          "intercourse",
          "genitals",
          "yuri",
          "yaoi",
          "bara",
          "shounen ai",
          "shoujo ai",
          "boys love",
          "girls love",
        ].includes(t) ||
        t.includes("fetish") ||
        t.includes("explicit sexual") ||
        t.includes("erotic"),
    );

    const adultKeywords = [
      "hentai",
      "smut",
      "18+",
      "yuri",
      "yaoi",
      "bara",
      "boys love",
      "girls love",
      "bl",
      "gl",
    ];
    const hasAdultTitle = adultKeywords.some((keyword) =>
      titleLower.includes(keyword),
    );

    if (isAdultSite || hasAdultTag || hasAdultTitle) return true;

    // 2. Custom Excluded Tags
    const excludedTagsLower = excludedTags
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean);

    if (excludedTagsLower.length > 0) {
      const hasExcludedTag = allItemTags.some((tag) =>
        excludedTagsLower.some((excluded) => tag.includes(excluded)),
      );
      if (hasExcludedTag) return true;

      const hasExcludedWordInTitle = excludedTagsLower.some((excluded) =>
        titleLower.includes(excluded),
      );
      if (hasExcludedWordInTitle) return true;
    }

    // 3. Global Hard Exclusions
    const hardExclusions = [
      "jinx",
      "painter of the night",
      "bestiality",
      "scat",
      "zoophilia",
      "coprophagia",
      "coprophilia",
      "watersports",
      "golden shower",
      "feces",
      "urine",
    ];
    const urlLower = (item.url || item.imageUrl || "").toLowerCase();
    const hasHardExclusion = hardExclusions.some(
      (ex) =>
        titleLower.includes(ex) ||
        urlLower.includes(ex.replace(/\s+/g, "-")) ||
        allItemTags.some((tag) => tag.includes(ex)),
    );

    if (hasHardExclusion) return true;

    return false;
  }

  static normalizeTags(tags: string[] = []): string[] {
    return tags.map((tag) => {
      let t = tag
        .toLowerCase()
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const colorVariations = [
        "full color",
        "full colour",
        "full coloured",
        "fully colored",
        "colored",
        "coloured",
        "official colored",
        "digital colored",
        "colorized",
        "fullcolour",
        "fullcolour manga",
        "colored release",
        "all color",
        "color",
      ];

      // Fuzzy matching for color tags
      if (colorVariations.some((c) => t.includes(c))) return "COLOR_CONTENT";

      const webtoonVariations = [
        "webtoon",
        "long strip",
        "vertical scan",
        "manhwa",
        "manhua",
      ];
      if (webtoonVariations.some((w) => t.includes(w))) return "COLOR_CONTENT";

      return t;
    });
  }

  static filterColoredContent(
    items: SourceSearchResult[],
  ): SourceSearchResult[] {
    return items.filter((item) => {
      const source = item.source?.toLowerCase() || "";
      const normalizedTags = this.normalizeTags(item.tags);

      // Known exclusively colored sources / providers
      const isNaturallyColored =
        source.includes("manhwaread") ||
        source.includes("luacomic") ||
        source.includes("bluelock") ||
        source.includes("asura") ||
        source.includes("flame") ||
        source.includes("reaper") ||
        source.includes("zerochan") ||
        item.contentType === "manhwa" ||
        item.contentType === "manhua" ||
        item.contentType === "gallery";

      if (isNaturallyColored) return true;

      // Ensure black-and-white manga are excluded. No title scanning used.
      return normalizedTags.includes("COLOR_CONTENT");
    });
  }
}
