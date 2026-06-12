# FlowManga Update & Release Notes (v2.2.6)

Here is a summary of all recent changes, additions, and bug fixes implemented in FlowManga:

---

## 🔌 1. Core Manga & Novel Sources (Added & Updated)
* **Added Manga Providers:** Integrated core scraper-backed providers for **MangaRead**, **ManhuaPlus**, and **ManhwaRead** (`src/services/sources/manga/`).
* **Added Novel Support:** Introduced **WebNovelProvider** (`src/services/sources/novel/WebNovelProvider.ts`) and a dedicated **NovelReader** (`src/components/readers/NovelReader.tsx`) for native text novel support.
* **LuaComic & ManhwaRead Refinements:** Updated selectors, request bridges, and content filters in `LuaComicProvider.ts` and `ManhwaReadProvider.ts`.
* **Chapter Cache Store:** Added `useChapterCacheStore.ts` to cache scraped pages locally for offline/lag-free reading.

## 🎵 2. Ambient Music & Offline Audio Engine
* **Offline Audio Engine:** Implemented `OfflineAudioEngine.tsx` to handle audio streaming and local playbacks.
* **Custom Lo-Fi Tracks:** Added 10+ cozy, royalty-free Lo-Fi MP3 tracks to `assets/audio/lofi/`:
  - *Anime Lofi Mix (Energy Boost)*
  - *Monume - Lofi Girl*
  - *Prettyjohn1 - Lofi & Sad Lofi*
  - *Pulsebox - Cinematic Lofi, Lofi Melody, Lofi Mood, Lofi Smooth*
* **Music Player & Music Store:** Redesigned `MusicPlayer.tsx` and added `useMusicStore.ts` to handle custom local playlist selections, volume, and playback state natively.
* **Atmospheric Settings:** Updated `AmbientSettings.tsx` to support individual playlist configurations and ambient audio loops.

## 🛠️ 3. Bug Fixes & UI Refinements
* **SQLite Invalidation Fix:** Resolved a database boot-up crash by automatically invalidating the SQLite `DiscoveryCache` table on database load, preventing property mismatch crashes.
* **Reader Scrolling Fix:** Removed the full-screen scroll-blocking overlay in the Reader. Replaced it with a clean bubbling click handler on the wrapper to enable native scrolling in release builds.
* **Home/Discover View Fixes:** Fixed home endpoint fetches and query parameter bugs in `HomeView.tsx` and `DiscoverView.tsx`.
* **CI Build Fix:** Switched Tauri bundle targets from MSI to NSIS in `tauri.conf.json` to fix Windows-based release building pipelines.
* **Callback Typing:** Explicitly typed callback parameters in the safety check modal to eliminate implicit `any` compiler warnings.
