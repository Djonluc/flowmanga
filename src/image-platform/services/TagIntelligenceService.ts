import { getDb } from '../../services/db';

export interface UserInterest {
  id: string;
  type: 'dominant_tag' | 'supporting_tag' | 'artist' | 'character' | 'series' | 'media_type';
  name: string;
  score: number;
  isPinned: boolean;
}

export interface TagAlias {
  alias: string;
  canonicalTag: string;
  confidence: number;
}

export class TagIntelligenceService {
  /**
   * Incrementally updates user interests based on a single image's tags.
   * This is called when an image is favorited ('add') or unfavorited ('remove').
   */
  static async processImageTags(tags: string[], action: 'add' | 'remove'): Promise<void> {
    const db = getDb();
    if (!tags || tags.length === 0) return;

    for (const t of tags) {
      if (t.startsWith('meta:') || t.startsWith('source:') || t.startsWith('rating:')) continue;

      let type: UserInterest['type'] = 'supporting_tag';
      let name = t.trim();

      if (t.startsWith('artist:')) {
        type = 'artist';
        name = t.replace('artist:', '').trim();
      } else if (t.startsWith('character:')) {
        type = 'character';
        name = t.replace('character:', '').trim();
      } else if (t.startsWith('series:') || t.startsWith('copyright:')) {
        type = 'series';
        name = t.replace(/^(series|copyright):/, '').trim();
      } else if (t.startsWith('media_type:')) {
        type = 'media_type';
        name = t.replace('media_type:', '').trim();
      }

      // Check if it already exists
      const existing = await db.select<UserInterest[]>(
        "SELECT * FROM UserInterests WHERE type = ? AND name = ?",
        [type, name]
      );

      if (action === 'add') {
        if (existing.length > 0) {
          // Only update score for tags the user already added manually
          // Do NOT auto-insert new tags — user controls what's in their interests
          const newScore = existing[0].score + 1;

          // Auto-promote to dominant if score reaches 5 (and it's a tag, not pinned manually)
          let newType = existing[0].type;
          if (newType === 'supporting_tag' && newScore >= 5 && !existing[0].isPinned) {
            newType = 'dominant_tag';
          }

          await db.execute(
            "UPDATE UserInterests SET score = ?, type = ? WHERE id = ?",
            [newScore, newType, existing[0].id]
          );
          // If tag doesn't exist yet — skip. User must add it manually.
        }
      } else if (action === 'remove' && existing.length > 0) {
        const newScore = existing[0].score - 1;

        if (newScore <= 0 && !existing[0].isPinned) {
          // Remove from DB if score reaches 0 and not pinned
          await db.execute("DELETE FROM UserInterests WHERE id = ?", [existing[0].id]);
        } else {
          // Auto-demote to supporting if score drops below 5
          let newType = existing[0].type;
          if (newType === 'dominant_tag' && newScore < 5 && !existing[0].isPinned) {
            newType = 'supporting_tag';
          }
          await db.execute(
            "UPDATE UserInterests SET score = ?, type = ? WHERE id = ?",
            [newScore, newType, existing[0].id]
          );
        }
      }
    }
  }

  /**
   * Expands an array of tags to include their mapped aliases or canonical forms
   * with confidence scores.
   */
  static async expandTags(tags: string[]): Promise<{ tag: string; confidence: number }[]> {
    if (!tags || tags.length === 0) return [];
    
    const db = getDb();
    const expanded: Map<string, number> = new Map();
    
    // Add original tags with 100% confidence
    tags.forEach(t => expanded.set(t, 100));

    // Try to find aliases where these tags are the canonical form
    for (const tag of tags) {
      const aliases = await db.select<TagAlias[]>("SELECT * FROM TagAliases WHERE canonicalTag = ?", [tag]);
      aliases.forEach(a => {
        if (!expanded.has(a.alias) || expanded.get(a.alias)! < a.confidence) {
          expanded.set(a.alias, a.confidence);
        }
      });

      // Try to find if the tag itself is an alias, and fetch its canonical form
      const canonicals = await db.select<TagAlias[]>("SELECT * FROM TagAliases WHERE alias = ?", [tag]);
      canonicals.forEach(c => {
        if (!expanded.has(c.canonicalTag) || expanded.get(c.canonicalTag)! < c.confidence) {
          expanded.set(c.canonicalTag, c.confidence);
        }
      });
    }

    return Array.from(expanded.entries()).map(([tag, confidence]) => ({ tag, confidence })).sort((a, b) => b.confidence - a.confidence);
  }

  static async getInterests(type?: UserInterest['type']): Promise<UserInterest[]> {
    const db = getDb();
    if (type) {
      return db.select<UserInterest[]>("SELECT * FROM UserInterests WHERE type = ? ORDER BY score DESC, isPinned DESC", [type]);
    }
    return db.select<UserInterest[]>("SELECT * FROM UserInterests ORDER BY score DESC, isPinned DESC");
  }

  static async togglePinInterest(id: string, isPinned: boolean): Promise<void> {
    const db = getDb();
    await db.execute("UPDATE UserInterests SET isPinned = ? WHERE id = ?", [isPinned ? 1 : 0, id]);
  }
}
