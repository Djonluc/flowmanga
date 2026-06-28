import { getDb } from "../db";
import type {
  MangaTagCategory,
  MangaTagRelationship,
  MangaTagRelationship,
  MangaInterestProfile,
  MangaFollowedEntity,
  SmartRecommendation
} from "./types";

/**
 * Predefined taxonomy based on the Manga Intelligence specifications.
 */
const PREDEFINED_CATEGORIES: Record<string, string[]> = {
  "Genres": [
    "action", "adventure", "fantasy", "dark_fantasy", "high_fantasy", "urban_fantasy",
    "magic", "supernatural", "sci_fi", "cyberpunk", "mecha", "romance", "drama",
    "comedy", "slice_of_life", "school_life", "sports", "horror", "psychological",
    "thriller", "mystery", "historical", "martial_arts", "cultivation", "isekai",
    "reverse_isekai", "reincarnation", "regression", "time_travel", "survival",
    "post_apocalyptic", "military", "war", "crime", "detective"
  ],
  "Character Archetypes": [
    "tsundere", "yandere", "kuudere", "dandere", "genki_girl", "tomboy", "gyaru",
    "idol", "princess", "queen", "villainess", "hero", "anti_hero", "villain",
    "mage", "witch", "necromancer", "assassin", "knight", "swordsman", "archer",
    "healer", "summoner", "demon_lord", "dragon_girl", "catgirl", "fox_girl",
    "elf", "dark_elf", "vampire", "werewolf", "android", "robot", "spirit",
    "goddess", "deity", "angel", "fallen_angel"
  ],
  "Personality Tags": [
    "cold", "stoic", "kind", "shy", "timid", "aggressive", "dominant", "confident",
    "arrogant", "intelligent", "genius", "lazy", "obsessive", "protective", "loyal",
    "caring", "playful", "sarcastic", "serious", "mischievous"
  ],
  "Appearance Tags": [
    "white_hair", "black_hair", "blonde_hair", "brown_hair", "red_hair", "blue_hair",
    "green_hair", "pink_hair", "purple_hair", "silver_hair", "long_hair", "short_hair",
    "ponytail", "twin_tails", "braid", "curly_hair", "heterochromia", "red_eyes",
    "blue_eyes", "green_eyes", "gold_eyes", "purple_eyes", "dark_skin", "tan_skin",
    "pale_skin", "freckles", "tattoo", "glasses"
  ],
  "Setting Tags": [
    "academy", "magic_school", "high_school", "college", "dungeon", "tower", "guild",
    "kingdom", "empire", "village", "city", "underworld", "heaven", "hell", "space",
    "future", "modern", "medieval", "ancient", "victorian", "feudal"
  ],
  "Relationship Tags": [
    "friends", "best_friends", "childhood_friend", "rivals", "enemies", "enemies_to_lovers",
    "lovers", "married", "family", "siblings", "mentor", "student", "teacher", "master",
    "servant", "party_members", "guild_members", "companions"
  ],
  "Story Themes": [
    "revenge", "redemption", "betrayal", "politics", "kingdom_building", "survival",
    "power_fantasy", "underdog", "coming_of_age", "self_discovery", "leadership",
    "conspiracy", "warfare", "exploration", "adventure_party"
  ],
  "Power System Tags": [
    "magic", "mana", "ki", "chakra", "cultivation", "swordsmanship", "alchemy",
    "summoning", "necromancy", "elemental_magic", "dark_magic", "light_magic",
    "healing_magic", "blood_magic", "runes", "skills", "system", "leveling",
    "status_window", "classes", "job_system"
  ],
  "Popular Manga Themes": [
    "op_mc", "weak_to_strong", "overpowered", "hidden_power", "dungeon_crawling",
    "monster_hunting", "adventurer", "guild", "ranking_system", "awakening",
    "reincarnated_as", "villainess_reborn", "second_chance", "regressor",
    "time_loop", "tower_climbing", "academy_arc"
  ]
};

export class MangaIntelligenceService {
  /**
   * Run this once on startup or explicitly via Settings to populate
   * the taxonomy if it is empty.
   */
  static async seedTaxonomyIfEmpty(): Promise<void> {
    try {
      const db = getDb();
      const existingCategories = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM MangaTagCategories"
      );

      if (existingCategories[0]?.count > 0) {
        console.log("[MangaIntelligence] Taxonomy already seeded. Skipping.");
        return;
      }

      console.log("[MangaIntelligence] Seeding base taxonomy...");

      for (const [categoryName, tags] of Object.entries(PREDEFINED_CATEGORIES)) {
        const catId = crypto.randomUUID();
        await db.execute(
          "INSERT INTO MangaTagCategories (id, name) VALUES (?, ?)",
          [catId, categoryName]
        );

        if (tags.length > 0) {
          const values: any[] = [];
          const placeholders: string[] = [];
          for (const tag of tags) {
            placeholders.push("(?, ?, ?, 'belongs_to')");
            values.push(crypto.randomUUID(), categoryName, tag);
          }
          await db.execute(
            `INSERT INTO MangaTagRelationships (id, parentTag, childTag, type) VALUES ${placeholders.join(',')}`,
            values
          );
        }
      }

      console.log("[MangaIntelligence] Base taxonomy seeded successfully.");
    } catch (error) {
      console.error("[MangaIntelligence] Failed to seed taxonomy:", error);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 1 API methods for future recommendation system
  // ---------------------------------------------------------------------------

  /**
   * Follows a specific entity (series, author, tag, etc.).
   */
  static async followEntity(
    type: MangaFollowedEntity["type"],
    name: string,
    entityId?: string
  ): Promise<void> {
    const db = getDb();
    const id = crypto.randomUUID();
    await db.execute(
      `INSERT INTO MangaFollowedEntities (id, type, name, entityId) 
       VALUES (?, ?, ?, ?)
       ON CONFLICT(type, name) DO NOTHING`,
      [id, type, name, entityId || null]
    );
  }

  /**
   * Unfollows a specific entity.
   */
  static async unfollowEntity(
    type: MangaFollowedEntity["type"],
    name: string
  ): Promise<void> {
    const db = getDb();
    await db.execute(
      "DELETE FROM MangaFollowedEntities WHERE type = ? AND name = ?",
      [type, name]
    );
  }

  /**
   * Adds or updates an interest profile weight.
   */
  static async setInterest(
    type: "dominant" | "supporting",
    name: string,
    weight: number = 1.0
  ): Promise<void> {
    const db = getDb();
    const id = crypto.randomUUID();
    await db.execute(
      `INSERT INTO MangaInterestProfiles (id, type, name, weight)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(type, name) DO UPDATE SET weight = ?`,
      [id, type, name, weight, weight]
    );
  }

  /**
   * Normalizes a tag utilizing synonyms and aliases.
   */
  static async normalizeTag(tag: string): Promise<string> {
    const db = getDb();
    const lowerTag = tag.toLowerCase().trim();

    // 1. Check direct synonyms
    const synonymRes = await db.select<{ canonicalTag: string }[]>(
      "SELECT canonicalTag FROM MangaTagSynonyms WHERE synonym = ? LIMIT 1",
      [lowerTag]
    );
    if (synonymRes.length > 0) return synonymRes[0].canonicalTag;

    // 2. Check aliases
    const aliasRes = await db.select<{ canonicalTag: string }[]>(
      "SELECT canonicalTag FROM MangaTagAliases WHERE alias = ? ORDER BY confidence DESC LIMIT 1",
      [lowerTag]
    );
    if (aliasRes.length > 0) return aliasRes[0].canonicalTag;

    return lowerTag;
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Data Mapping & Smart Recommendations
  // ---------------------------------------------------------------------------

  /**
   * Scans the user's local reading history, favorites, and library to infer
   * their dominant and supporting interests.
   */
  static async mapHistoricalData(): Promise<void> {
    const db = getDb();
    console.log("[MangaIntelligence] Starting historical data mapping...");

    // 1. Map Followed Series (Any series in the library)
    const seriesList = await db.select<{ id: string; title: string; tags: string; author: string }[]>(
      "SELECT id, title, tags, author FROM Series WHERE type = 'manga'"
    );

    const tagFrequencies: Record<string, number> = {};
    const normalizedTagCache = new Map<string, string>();
    
    const followedValues: any[] = [];
    const followedPlaceholders: string[] = [];

    for (const series of seriesList) {
      // Prepare batch for series
      followedPlaceholders.push("(?, ?, ?, ?)");
      followedValues.push(crypto.randomUUID(), "series", series.title, series.id);

      // Prepare batch for author if available
      if (series.author && series.author !== "Unknown") {
        followedPlaceholders.push("(?, ?, ?, ?)");
        followedValues.push(crypto.randomUUID(), "author", series.author, null);
      }

      // Tally up tags
      if (series.tags) {
        let parsedTags: string[] = [];
        try {
            parsedTags = JSON.parse(series.tags);
            if (!Array.isArray(parsedTags)) {
                parsedTags = typeof series.tags === 'string' ? series.tags.split(',').map(t => t.trim()) : [series.tags];
            }
        } catch (e) {
            if (typeof series.tags === 'string') {
                parsedTags = series.tags.split(',').map(t => t.trim()).filter(Boolean);
            }
        }

        for (const rawTag of parsedTags) {
          let canonical = normalizedTagCache.get(rawTag);
          if (!canonical) {
             canonical = await this.normalizeTag(rawTag);
             normalizedTagCache.set(rawTag, canonical);
          }
          tagFrequencies[canonical] = (tagFrequencies[canonical] || 0) + 1;
        }
      }
    }
    
    // Execute Followed Entities batch in chunks of 100 to respect SQLite parameter limits
    const CHUNK_SIZE = 100 * 4; // 100 rows * 4 params
    for (let i = 0; i < followedValues.length; i += CHUNK_SIZE) {
      const valChunk = followedValues.slice(i, i + CHUNK_SIZE);
      const placeChunk = followedPlaceholders.slice(i / 4, (i + CHUNK_SIZE) / 4);
      if (placeChunk.length > 0) {
          await db.execute(
            `INSERT INTO MangaFollowedEntities (id, type, name, entityId) VALUES ${placeChunk.join(',')} ON CONFLICT(type, name) DO NOTHING`,
            valChunk
          );
      }
    }

    // 2. Clear old interest profiles to start fresh
    await db.execute("DELETE FROM MangaInterestProfiles");

    // 3. Sort tags by frequency to determine Dominant vs Supporting
    const sortedTags = Object.entries(tagFrequencies).sort((a, b) => b[1] - a[1]);
    
    const interestValues: any[] = [];
    const interestPlaceholders: string[] = [];

    // Top 3 tags become "dominant" (weight 2.0)
    for (let i = 0; i < Math.min(3, sortedTags.length); i++) {
      const [tag] = sortedTags[i];
      interestPlaceholders.push("(?, ?, ?, ?)");
      interestValues.push(crypto.randomUUID(), "dominant", tag, 2.0);
    }

    // Next 10 tags become "supporting" (weight 1.0)
    for (let i = 3; i < Math.min(13, sortedTags.length); i++) {
      const [tag] = sortedTags[i];
      interestPlaceholders.push("(?, ?, ?, ?)");
      interestValues.push(crypto.randomUUID(), "supporting", tag, 1.0);
    }
    
    if (interestPlaceholders.length > 0) {
        await db.execute(
          `INSERT INTO MangaInterestProfiles (id, type, name, weight) VALUES ${interestPlaceholders.join(',')} ON CONFLICT(type, name) DO UPDATE SET weight = excluded.weight`,
          interestValues
        );
    }

    console.log("[MangaIntelligence] Historical mapping complete!");
  }

  /**
   * Evaluates a list of candidate manga against the user's intelligence profile.
   */
  static async getSmartRecommendations(candidates: any[]): Promise<SmartRecommendation[]> {
    if (!candidates || !Array.isArray(candidates)) return [];
    
    const db = getDb();

    // Fetch user profiles for fast memory lookup
    const profiles = await db.select<{ type: string; name: string; weight: number }[]>(
      "SELECT type, name, weight FROM MangaInterestProfiles"
    );
    const dominantInterests = profiles.filter(p => p.type === "dominant").map(p => p.name);
    const supportingInterests = profiles.filter(p => p.type === "supporting").map(p => p.name);

    const follows = await db.select<{ type: string; name: string }[]>(
      "SELECT type, name FROM MangaFollowedEntities"
    );
    const followedSeries = follows.filter(f => f.type === "series").map(f => f.name.toLowerCase());
    const followedAuthors = follows.filter(f => f.type === "author").map(f => f.name.toLowerCase());

    const scoredCandidates: SmartRecommendation[] = [];

    for (const item of candidates) {
      let score = 0;
      const matchReasons: string[] = [];

      const title = (item.title || "").toLowerCase();
      const author = (item.author || "").toLowerCase();
      const rawTags = Array.isArray(item.tags) ? item.tags : [];

      // Check author/series follows
      if (followedSeries.includes(title)) {
        score += 50;
        matchReasons.push(`You already follow this series`);
      }
      if (author && followedAuthors.includes(author)) {
        score += 50;
        matchReasons.push(`You follow author: ${item.author}`);
      }

      // Check tag matching
      for (const rawTag of rawTags) {
        const tag = await this.normalizeTag(rawTag);

        if (dominantInterests.includes(tag)) {
          score += 20;
          if (!matchReasons.includes(`Matches Dominant Interest: ${tag}`)) {
            matchReasons.push(`Matches Dominant Interest: ${tag}`);
          }
        } else if (supportingInterests.includes(tag)) {
          score += 10;
          if (!matchReasons.includes(`Matches Supporting Interest: ${tag}`)) {
            matchReasons.push(`Matches Supporting Interest: ${tag}`);
          }
        }
      }

      scoredCandidates.push({ item, score, matchReasons });
    }

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    return scoredCandidates;
  }
}
