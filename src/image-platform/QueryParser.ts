import type { SearchQuery } from "./types";

export class QueryParser {
  /**
   * Parses a raw search string into a structured SearchQuery object.
   * Supports:
   * - Positive tags: "boy", "cat_ears"
   * - Negative tags: "-gun", "-blood"
   * - System predicates: "source:danbooru", "rating:safe"
   */
  static parse(rawQuery: string): SearchQuery {
    // `+` is a visual AND separator in the search UI. Treat both
    // "tag1 + tag2" and "tag1+tag2" exactly like whitespace so a bare plus
    // is never sent to providers as an invalid tag.
    const tokens = rawQuery.replace(/\s*\+\s*/g, ' ').trim().split(/\s+/).filter(Boolean);
    
    const positiveTags: string[] = [];
    const negativeTags: string[] = [];
    const predicates: Record<string, string> = {};

    const predicateKeys = new Set(["source", "rating", "score", "order", "sort", "limit", "page"]);

    for (const token of tokens) {
      const separator = token.indexOf(":");
      const key = separator > 0 ? token.slice(0, separator).toLowerCase() : "";
      if (separator > 0 && predicateKeys.has(key) && !token.startsWith("-")) {
        // Category tags such as artist:..., character:..., and series:...
        // remain searchable tags instead of being mistaken for controls.
        predicates[key] = token.slice(separator + 1).toLowerCase();
      } else if (token.startsWith("-") && token.length > 1) {
        // It's a negative tag (e.g., -gun)
        negativeTags.push(token.substring(1).toLowerCase());
      } else {
        // It's a positive tag
        positiveTags.push(token.toLowerCase());
      }
    }

    return {
      raw: rawQuery,
      positiveTags,
      negativeTags,
      predicates
    };
  }

  /**
   * Rebuilds a raw query string from a structured SearchQuery object.
   */
  static stringify(query: SearchQuery): string {
    const parts: string[] = [];

    // Add predicates first
    for (const [key, value] of Object.entries(query.predicates)) {
      parts.push(`${key}:${value}`);
    }

    // Add positive tags
    for (const tag of query.positiveTags) {
      parts.push(tag);
    }

    // Add negative tags
    for (const tag of query.negativeTags) {
      parts.push(`-${tag}`);
    }

    return parts.join(" ");
  }
}
