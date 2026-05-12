# FlowManga — Features & Behavior (Desktop)

This document describes the **shipping Tauri 2 desktop application** as implemented in this repository (`src/`, `src-tauri/`). It replaces older text that described a multi-user web platform (accounts, comments, S3, IP-based view counts, etc.), which **does not apply** to this codebase.

For product vision and future ideas, see [ROADMAP.md](ROADMAP.md).

---

## 1. Platform & architecture

| Area | Implementation |
|------|----------------|
| Shell | **Tauri 2** (Rust backend, WebView UI) |
| UI | **React 19**, **Vite 7**, **Tailwind CSS 4**, **Framer Motion** |
| State | **Zustand** stores (`src/stores/`) |
| Local data | **SQLite** via `@tauri-apps/plugin-sql` — database file `flowmanga.db` (see `src/services/db.ts`) |
| Filesystem / scan | Tauri **commands** in `src-tauri/src/lib.rs` (e.g. `scan_manga_folder`, `scan_chapters`) |

**Views** (from `App.tsx` / `useSettingsStore`): `home`, `library`, `discover`, `videos`, `stats` (analytics dashboard), `history`, plus **reader** when a chapter is open.

---

## 2. Data model (SQLite)

Core tables created/migrated in `initDatabase()`:

- **Series** — title, path, author, type (`manga` \| `video`), cover, source (`local` \| `scraped`), tags, description, `seriesUrl`, `mangaId`, tracker ids (`anilistId`, `malId`), `contentType`, `providerId`, timestamps.
- **Chapters** — per-series chapters with `filePath`, `chapterNumber`, `totalPages`, optional `coverPath`, `sourceId`.
- **ReadingProgress** — `seriesId`, `chapterId`, `currentPage`, `totalPages`, `lastReadAt` (drives resume and **History**).
- **VideoFolders** / **Videos** — video roots and files, `lastPosition`, shuffle/repeat metadata.
- **Collections** / **CollectionItems** — user-defined shelves of series.
- **DiscoveryCache** — cached discovery payloads (trending / search / etc.) as JSON.
- **TagIndex** — maps normalized tags to source-specific tag names.

There is **no** Postgres, NextAuth, multi-user auth, or remote comment system in this app.

---

## 3. Library management

### Add local manga

- User picks a **folder** (dialogs from Tauri). The app invokes **`scan_manga_folder`** on that path and **`scan_chapters`** per detected series.
- Series and chapters are **indexed in place**; paths stored in SQLite point at the user’s existing files (no mandatory “copy everything into an app-owned root” for local adds).
- **Web / scraped imports** download image archives into the user-configured download location (see scraper flow and Rust copy helpers) — that is separate from “add existing folder.”

### Library UI

- **Grid** and **3D shelf** style browsing (`LibraryGrid`, shelf components).
- **Search** (`searchQuery`) and filters: tags, genre, status, source (`useLibraryStore`).
- **Collections**: create, add/remove series, delete collection.
- **Tags** on series: persisted as comma-separated on `Series.tags`.
- **Rename** series (display/title in DB).
- **Delete** series: DB cleanup with optional **delete files from disk** when that path is chosen (see `deleteSeries` / modals — not a separate “soft delete for users / hard for admin” web model; it’s desktop confirmations).
- **Favorites**, metadata refresh, chapter thumbnail refresh, integrity checks exist as store actions (invoked from UI where wired).
- **External trackers**: when `anilistId` / `malId` are set, near-end-of-chapter progress can call **AniList** / **MAL** update APIs (`useTrackerStore` + `updateReadingProgress`).

### OS integration

- **`open-path` event** (`useLibraryEvents`): opening a path from the OS can import a **manga folder** or detect **video** extensions and add a video folder + switch view.

### Not implemented (legacy file)

- `src/utils/webScrapers.ts` is a **stub** (returns `null` / warns). Real remote logic lives in **`ScraperService`** and **`src/services/sources/*`**. Do not assume the old `webScrapers` helpers work.

---

## 4. Reading engine

### Modes

`Reader.tsx` mounts **`useReaderStore`** modes:

- **`vertical`** — `VerticalReader` (continuous scroll / webtoon-style).
- **`single`** — `SinglePageReader` (one page at a time, with tap zones).
- **`slideshow`** — `SlideshowReader`.

`HorizontalReader.tsx` and `DualPageReader.tsx` exist in the tree but are **not** referenced from `Reader.tsx` today (dead / alternate implementations unless wired elsewhere).

### Behavior

- **Progress**: `ReadingProgress` updated via `useLibraryStore.updateReadingProgress`; used for resume and history.
- **Fullscreen**, **HUD** / chrome visibility, **auto-scroll** (vertical), zoom/fit options, keyboard shortcuts (see `ShortcutsGuide` / `ControlPanel` / reader toolbars).
- **Adaptive colors** (`useAdaptiveColor`, `AmbientBackground`) sample the current page; **ambient audio** (`AmbientSoundPlayer`) plays optional loops.

### Caveats (engineering)

- `AmbientBackground` uses `setState` inside an effect in a way ESLint’s React compiler plugin flags (`react-hooks/set-state-in-effect`). Worth revisiting with `useLayoutEffect` or derived state to avoid extra renders.
- `Reader.tsx` syncs `useReaderStore` → `useReadingStore` in an effect whose dependency array uses `useReaderStore.getState().currentPage`; that value is **not reactive** as written, so progress index sync may miss updates until another re-render. Worth subscribing with a selector (`useReaderStore(s => s.currentPage)`) instead.

---

## 5. Discovery & recommendations

- **Discover** (`DiscoverView`) uses `DiscoveryService`, `ScraperService`, tag rails, and **DiscoveryCache** for performance.
- **Source registry** (`src/services/sources/index.ts`) registers providers (e.g. **MangaDex**, **ManhwaRead**, **LuaComic**, **BlueLock**, **DBM**, **ManhuaPlus**, **NHentai**; **MangaRead** registered but disabled in code). Availability depends on site changes, rate limits, and optional cookies (`VITE_COMIX_COOKIE` where used).
- Users must comply with each site’s **terms of service** and copyright law.

---

## 6. Scraping, import modal & downloads

- **Import modal** (`ImportModal`): local folder handoff + **URL scrape** flow via `useScraperStore` (metadata, chapter list, selection, download).
- **Safety** flows can prompt (`SafetyCheckModal`) before writing into certain paths.
- **Download queue** (`useDownloadStore`, `DownloadService`, `DownloadPanel`): queued jobs, status, interaction with Tauri for filesystem work.
- **Content filter** (`ContentFilter.ts`) can gate NSFW sources where integrated.

---

## 7. Video library

- **Video folders** and files in SQLite; `VideoLibrary`, `VideoPlayer`, playlists, thumbnails where generated.
- **History** merges manga `ReadingProgress` with partially played **Videos** (`HistoryView`).

---

## 8. Analytics & statistics

- **Dashboard** (`AnalyticsDashboard`): charts and summaries from **`useAnalyticsStore`**.
- That store uses **Zustand `persist`** (browser local storage in the WebView) for aggregates: time read, pages, streaks, daily buckets, per-series time — **not** server-side “unique views per IP” or social likes.
- Treat analytics as **local / device-scoped** unless you add export/sync later.

---

## 9. Automation

- **Automation** settings and `AutomationService` / `AutomationManager` support scheduled or scripted behaviors where enabled (inspect store + service for current triggers).

---

## 10. Settings & personalization

- **General**, **Reader**, **Appearance**, **Downloads**, **Sources**, **Ambient**, **Automation**, etc. (`src/components/settings/`).
- **Native zoom** level from settings applied via Tauri window API in `App.tsx` (with CSS zoom fallback in plain browser dev).

---

## 11. Updates & deployment

- Optional **Tauri updater** plugin — see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 12. Quality bar & known debt

| Topic | Notes |
|-------|--------|
| **TypeScript** | `npx tsc --noEmit` succeeds on the current tree. |
| **ESLint** | `npm run lint` reports a **large** number of issues (unused imports/vars, `no-explicit-any`, empty `catch` blocks in a few stores, etc.). Safe refactors are recommended but were out of scope for this doc-only pass. |
| **Node** | ESLint may warn that `eslint.config.js` is ESM without `"type": "module"` in `package.json` — cosmetic warning. |
| **Docs vs code** | [ROADMAP.md](ROADMAP.md) mixes shipped features with future vision; top of that file should be read as **aspirational** where it contradicts this document. |

---

## 13. Design principle (unchanged intent)

Destructive actions should stay behind **explicit confirmation**. Library state should remain **recoverable** where the UI offers “remove from library only” vs “delete files.”

When in doubt, **trust the code** (`src/`, `src-tauri/`) over any older marketing or feature prose.
