import type { StructuredQuery } from "../types";

export class TagParser {
  /**
   * Parses a raw search string into a StructuredQuery.
   * Extracts negative tags, source targeting, and positive tags.
   */
  static parse(query: string, ratingFilter: "sfw" | "all" = "all"): StructuredQuery {
    const tokens = (query || "").trim().split(/\s+/).filter(Boolean);
    const positiveTags: string[] = [];
    const negativeTags: string[] = [];
    let targetSource: string | undefined;

    for (const token of tokens) {
      if (token.startsWith("source:")) {
        targetSource = token.slice("source:".length).toLowerCase().trim();
      } else if (token.startsWith("-") && token.length > 1) {
        negativeTags.push(token.slice(1).trim().toLowerCase());
      } else {
        positiveTags.push(token.trim().toLowerCase());
      }
    }

    return {
      raw: query,
      positiveTags,
      negativeTags,
      targetSource,
      ratingFilter,
    };
  }

  /**
   * Serializes a StructuredQuery back into a string, typically for 
   * providers that natively support full advanced queries.
   */
  static serialize(query: StructuredQuery): string {
    const tokens: string[] = [...query.positiveTags];
    for (const neg of query.negativeTags) {
      tokens.push(`-${neg}`);
    }
    return tokens.join(" ");
  }

  /**
   * Normalizes tags by converting spaces to underscores and removing
   * invalid special characters.
   */
  static normalizeBooruTag(tag: string): string {
    return tag
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w\-:@~.()]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }
}
