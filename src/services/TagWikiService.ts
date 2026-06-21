import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getDb } from './db';

export interface TagWiki {
  title: string;
  body: string;
  parsedBody: string;
}

export class TagWikiService {
  static async fetchDescription(tag: string): Promise<TagWiki | null> {
    const db = getDb();
    
    // Check cache first
    try {
      const cached = await db.select<any[]>("SELECT * FROM TagDefinitions WHERE tag = ?", [tag]);
      if (cached && cached.length > 0) {
        return {
          title: cached[0].title,
          body: cached[0].body,
          parsedBody: TagWikiService.parseDText(cached[0].body)
        };
      }
    } catch (e) {
      console.warn("Failed to check tag cache:", e);
    }

    try {
      const response = await tauriFetch(`https://danbooru.donmai.us/wiki_pages.json?search[title]=${encodeURIComponent(tag)}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'FlowManga/1.0'
        }
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || data.length === 0) return null;

      const wiki = data[0];
      if (wiki.is_deleted) return null;

      const result = {
        title: wiki.title,
        body: wiki.body,
        parsedBody: this.parseDText(wiki.body)
      };

      // Save to cache
      try {
        await db.execute(
          "INSERT OR REPLACE INTO TagDefinitions (tag, title, body, parsedBody) VALUES (?, ?, ?, ?)",
          [tag, result.title, result.body, result.parsedBody]
        );
      } catch (e) {
        console.warn("Failed to save tag cache:", e);
      }

      return result;
    } catch (e) {
      console.error("Failed to fetch tag wiki:", e);
      return null;
    }
  }

  static parseDText(text: string): string {
    if (!text) return "";
    
    let parsed = text;
    
    // Basic formatting
    parsed = parsed.replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>');
    parsed = parsed.replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>');
    parsed = parsed.replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>');
    parsed = parsed.replace(/\[s\](.*?)\[\/s\]/gi, '<s>$1</s>');

    // Headers (h1. Title)
    parsed = parsed.replace(/^h[1-6][\.#]?\s*(.*)$/gm, '<strong class="text-foreground block mt-4 mb-2">$1</strong>');
    
    // Lists (* item)
    parsed = parsed.replace(/^\*\s*(.*)$/gm, '<li class="ml-4 list-disc">$1</li>');

    // Links [[tag]] or [[tag|label]]
    parsed = parsed.replace(/\[\[([^\]]+)\]\]/g, (match, p1) => {
      const parts = p1.split('|');
      const label = parts.length > 1 ? parts[1] : parts[0];
      return `<span class="text-accent cursor-pointer hover:underline" title="Tag: ${parts[0]}">${label}</span>`;
    });
    
    // URLs "title":url
    parsed = parsed.replace(/"([^"]+)":([^\s]+)/g, '<a href="$2" target="_blank" class="text-blue-400 hover:underline">$1</a>');

    // Convert newlines to breaks
    parsed = parsed.replace(/\r\n/g, '\n');
    parsed = parsed.replace(/\n\n/g, '</p><p class="mt-2 mb-2">');
    parsed = parsed.replace(/\n/g, '<br/>');

    return `<p>${parsed}</p>`;
  }
}
