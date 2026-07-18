import { useSettingsStore } from "../stores/useSettingsStore";
import { hasExcludedTag, hasExcludedText, mergeExcludedTags } from "./TagExclusions";
import type { SourceSearchResult } from "./sources/types";

export class ContentFilter {
  static filterResults(items: SourceSearchResult[], additionalExcludedTags: string[] = []): SourceSearchResult[] {
    return items.filter((item) => !this.isAdult(item, additionalExcludedTags));
  }

  static isAdultTag(tag: string): boolean {
    const t = tag.toLowerCase().trim();
    const normalized = t.replace(/[\s/-]+/g, "_");
    return [
      "hentai",
      "smut",
      "erotica",
      "erotic",
      "adult",
      "porn",
      "pornography",
      "doujinshi",
      "18+",
      "nsfw",
      "explicit",
      "nudity",
      "nude",
      "fetish",
      "sexualized",
      "cross-gender",
      "cross-dressing",
      "crossdressing",
      "trap",
      "femboy",
      "sissy",
      "gay",
      "lesbian",
      "homosexual",
      "bisexual",
      "transgender",
      "male/male",
      "female/female",
      "boys_love",
      "girls_love",
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
      "bl",
      "gl"
    ].includes(t) ||
    /(^|_)(trap|femboy|sissy|gay|lesbian|homosexual|bisexual|transgender|yaoi|yuri|bara)(_|$)/.test(normalized) ||
    t.includes("fetish") ||
    t.includes("explicit sexual") ||
    t.includes("erotic");
  }

  static isAdult(item: any, additionalExcludedTags: string[] = []): boolean {
    const { showAdultContent, excludedTags = [] } = useSettingsStore.getState();
    if (showAdultContent) return false;

    const titleLower = (item.title || "").toLowerCase();
    const source = (item.source || "").toLowerCase();
    const rating = (item.rating || "").toLowerCase();

    const allItemTags = [
      ...(item.tags || []),
      ...(item.generalTags || []),
      ...(item.characterTags || []),
      ...(item.copyrightTags || []),
      ...(item.artistTags || []),
      ...(item.metaTags || []),
    ].map((tag) => tag.toLowerCase().trim());

    if (!showAdultContent) {
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

      const hasAdultTag = allItemTags.some((t) => this.isAdultTag(t));
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
      const hasAdultTitle = adultKeywords.some((keyword) => titleLower.includes(keyword));

      if (isAdultSite || hasAdultTag || hasAdultTitle) return true;
    }

    // 2. Custom Excluded Tags
    const excludedTagsLower = mergeExcludedTags(excludedTags, additionalExcludedTags);

    if (excludedTagsLower.length > 0) {
      if (hasExcludedTag(allItemTags, excludedTagsLower)) return true;

      if (hasExcludedText(titleLower, excludedTagsLower)) return true;
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
      const t = tag
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
        source.includes("manhuaplus") ||
        source.includes("dbm") ||
        source.includes("webtoons") ||
        item.contentType === "manhwa" ||
        item.contentType === "manhua" ||
        item.contentType === "gallery";

      if (isNaturallyColored) return true;

      // Ensure black-and-white manga are excluded. No title scanning used.
      return normalizedTags.includes("COLOR_CONTENT");
    });
  }
}
