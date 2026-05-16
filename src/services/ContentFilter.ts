import { useSettingsStore } from "../stores/useSettingsStore";
import type { SourceSearchResult } from "./sources/types";

export class ContentFilter {
  static filterResults(items: SourceSearchResult[]): SourceSearchResult[] {
    const { showAdultContent, excludedTags = [] } = useSettingsStore.getState();
    const excludedTagsLower = excludedTags
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean);

    return items.filter((item) => {
      const titleLower = item.title.toLowerCase();

      // 1. Adult Content Filter
      if (!showAdultContent) {
        const isAdultSite =
          item.source?.toLowerCase().includes("nhentai") ||
          item.source?.toLowerCase().includes("rule34") ||
          item.source?.toLowerCase().includes("luscious") ||
          item.source?.toLowerCase().includes("kemono") ||
          item.source?.toLowerCase().includes("hentai");

        const hasAdultTag = item.tags?.some((tag) => {
          const t = tag.toLowerCase();
          return [
            "hentai",
            "smut",
            "erotica",
            "adult",
            "porn",
            "doujinshi",
            "18+",
            "nsfw",
            "yuri",
            "yaoi",
            "bara",
            "shounen ai",
            "shoujo ai",
            "boys love",
            "girls love",
          ].includes(t);
        });

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

        if (isAdultSite || hasAdultTag || hasAdultTitle) return false;
      }

      // 2. Custom Excluded Tags (Checks all available tag fields and title)
      const allItemTags = [
        ...(item.tags || []),
        ...(item.generalTags || []),
        ...(item.characterTags || []),
        ...(item.copyrightTags || []),
        ...(item.artistTags || []),
        ...(item.metaTags || []),
      ]
        .map((tag) => tag.toLowerCase().trim())
        .filter(Boolean);

      if (excludedTagsLower.length > 0) {
        const hasExcludedTag = allItemTags.some((tag) =>
          excludedTagsLower.some((excluded) => tag.includes(excluded)),
        );
        if (hasExcludedTag) return false;

        const hasExcludedWordInTitle = excludedTagsLower.some((excluded) =>
          titleLower.includes(excluded),
        );
        if (hasExcludedWordInTitle) return false;
      }

      // 3. Global Hard Exclusions (Always remove explicit abusive themes)
      const hardExclusions = [
        //'yaoi',
        //'yuri',
        // 'boys love',
        //'girls love',
        // "shounen ai",
        // "shoujo ai",
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
      const urlLower = item.url?.toLowerCase() || "";
      const hasHardExclusion = hardExclusions.some(
        (ex) =>
          titleLower.includes(ex) ||
          urlLower.includes(ex.replace(/\s+/g, "-")) ||
          allItemTags.some((tag) => tag.includes(ex)),
      );

      if (hasHardExclusion) return false;

      return true;
    });
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
