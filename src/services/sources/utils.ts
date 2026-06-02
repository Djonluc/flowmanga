import { invoke } from "@tauri-apps/api/core";
import type { SourceChapter } from "./types";

/**
 * Extracts the Next.js hydration payload (`__NEXT_DATA__`) from an HTML string.
 */
export function extractNextData(html: string): any | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.warn("Failed to parse __NEXT_DATA__ JSON", e);
    }
  }
  return null;
}

/**
 * Extracts the Nuxt.js hydration payload (`window.__NUXT__`) from an HTML string.
 */
export function extractNuxtData(html: string): any | null {
  const startStr = "window.__NUXT__=";
  const startIdx = html.indexOf(startStr);
  if (startIdx !== -1) {
    const jsonStart = html.substring(startIdx + startStr.length);
    const endIdx = jsonStart.indexOf(";</script>");
    if (endIdx !== -1) {
      const jsonStr = jsonStart.substring(0, endIdx);
      try {
        // Nuxt data sometimes contains JS variable references, so JSON.parse might fail
        // Using an evaluator pattern or regex replacements might be needed for advanced Nuxt
        return JSON.parse(jsonStr);
      } catch (e) {
        console.warn("Failed to parse window.__NUXT__ JSON", e);
      }
    }
  }
  return null;
}

/**
 * Attempts to fetch Madara chapters using the hidden admin-ajax.php endpoint.
 * This is useful for Madara sites that use lazy-loaded chapters (e.g., UToon, ManhwaRead).
 */
export async function fetchMadaraChaptersAjax(
  baseUrl: string,
  mangaId: string,
  seriesUrl: string,
  sourceId: string
): Promise<SourceChapter[]> {
  try {
    const ajaxUrl = `${baseUrl.replace(/\/$/, '')}/wp-admin/admin-ajax.php`;
    const body = `action=manga_get_chapters&manga=${mangaId}`;

    console.log(`[${sourceId}] Attempting Madara AJAX chapter fetch at ${ajaxUrl} for manga ID ${mangaId}`);

    const res = await invoke<any>("fetch_json", {
      url: ajaxUrl,
      method: "POST",
      body: body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (!res || !res.status || !res.html) {
      throw new Error("AJAX endpoint returned invalid/empty response");
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(res.html, "text/html");
    const chapterNodes = Array.from(doc.querySelectorAll(".wp-manga-chapter"));

    const chapters: SourceChapter[] = [];
    let num = chapterNodes.length;

    chapterNodes.forEach((node) => {
      const a = node.querySelector("a");
      if (a) {
        const chapterUrl = a.getAttribute("href") || "";
        if (!chapterUrl) return;

        const title = a.textContent?.trim() || "";
        
        // Attempt to parse chapter number
        let chapterNumber = num;
        const lowerTitle = title.toLowerCase();
        const parts = lowerTitle.split(/\s+/);
        let found = false;

        for (let i = 0; i < parts.length; i++) {
          if (["chapter", "ch", "ch.", "chap", "chap."].includes(parts[i])) {
            if (i + 1 < parts.length) {
              const textNum = parts[i + 1].replace(/[^\d.]/g, '');
              const parsed = parseFloat(textNum);
              if (!isNaN(parsed)) {
                chapterNumber = parsed;
                found = true;
                break;
              }
            }
          }
        }

        if (!found) {
          for (const part of parts) {
            const textNum = part.replace(/[^\d.]/g, '');
            if (textNum) {
              const parsed = parseFloat(textNum);
              if (!isNaN(parsed)) {
                chapterNumber = parsed;
                break;
              }
            }
          }
        }

        chapters.push({
          id: chapterUrl,
          number: chapterNumber.toString(),
          url: chapterUrl,
          title: title,
          source: sourceId,
        });

        num--;
      }
    });

    return chapters;
  } catch (err) {
    console.warn(`[${sourceId}] fetchMadaraChaptersAjax failed:`, err);
    return [];
  }
}
