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
    const tokens = rawQuery.trim().split(/\s+/).filter(Boolean);
    
    const positiveTags: string[] = [];
    const negativeTags: string[] = [];
    const predicates: Record<string, string> = {};

    for (const token of tokens) {
      if (token.includes(":") && !token.startsWith("-")) {
        // It's a predicate (e.g., source:danbooru)
        const [key, ...rest] = token.split(":");
        predicates[key.toLowerCase()] = rest.join(":").toLowerCase();
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
