# STAGE 1C: Recommendation System Architecture Audit

## 1. Current Implementation Analysis
Currently, `ScraperService.getRecommendationsByTags()` and `getPersonalizedRecommendations()` rely on two hardcoded sources: **MangaDex** (API) and **ManhwaRead** (Static HTML). 

**Identified Bottlenecks:**
*   **Sequential Fetching:** The system waits for MangaDex to finish, *then* fetches ManhwaRead. This doubles the latency.
*   **Blocking Operations:** If ManhwaRead triggers a Cloudflare challenge or hangs, the entire recommendation rail stalls, causing infinite UI spinners.
*   **Missing Sources:** Comix, LuaComic, BlueLock, and DBM are ignored in discovery rails.
*   **Server Hammering:** Rapidly switching tags in the Library Grid fires concurrent, un-cached HTML requests to ManhwaRead, risking IP bans.

---

## 2. Broadening the Source Queries
To safely include all supported sources without looping or hammering:

*   **API-Based Sources (MangaDex, Comix):** 
    *   *Comix* has an accessible JSON API (`/api/v1/...`). We can easily integrate its trending/search endpoints alongside MangaDex.
*   **HTML-Based Sources (ManhwaRead, LuaComic):** 
    *   These require DOM parsing. We should limit queries to 1 page (top 10 items) and strictly avoid deep pagination during background fetching.
*   **Single-Series Sources (BlueLock, DBM):**
    *   These sites *only* host one manga. They cannot be queried dynamically for "tags".
    *   *Solution:* Hardcode these specific series into a "Featured / Spotlight" rail or randomly inject them into the "Trending" feed as static discovery cards.

---

## 3. Caching & Batching Strategy (The Fix)

To keep the UI fluid and resilient, we must architect the following patterns into `ScraperService`:

### A. Parallel Execution with Timeouts (`Promise.allSettled`)
Instead of `await MD; await MR;`, we will fire all source requests simultaneously. 
Crucially, we will wrap them in a **Promise.race timeout (e.g., 3000ms)**. If ManhwaRead or Comix is slow, they silently fail and return `[]`, allowing MangaDex to instantly populate the UI without waiting.

### B. In-Memory LRU Cache
Implement a static cache map:
```typescript
private static cache = new Map<string, { data: any[], timestamp: number }>();
private static CACHE_TTL = 1000 * 60 * 15; // 15 minutes
```
Every time a rail requests `getTrending(coloredOnly=true)`, it checks the cache first. This guarantees instant UI rendering when navigating between Home and Library views.

### C. Source Interleaving
Instead of dumping 20 MangaDex items followed by 20 ManhwaRead items, we will interleave the arrays: `[MD_1, MR_1, CX_1, MD_2, MR_2...]` up to the requested `limit`. This visually diversifies the sources presented to the user.

---

## Next Steps (Stage 1D/Stage 2)
Do you want me to refactor `ScraperService.ts` to implement this Caching/Parallel architecture now, or would you prefer to move straight to Stage 2 (Library Data Integrity)?
