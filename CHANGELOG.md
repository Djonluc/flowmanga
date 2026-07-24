## FlowManga v2.5.9 - 2026-07-24

### Added

- Added opt-in Discord Rich Presence for manga title, chapter, page progress, and elapsed reading time.
- Added Discord privacy controls, public Application ID configuration, and a connection test under Settings → Integrations.

### Fixed

- Unified manga downloads with the configured primary Manga Archive so downloaded titles are saved where the Library scans.
- Waited for database registration and the Library refresh before marking a manga download complete.
- Assigned stable unique identities to locally scraped manga instead of reusing the conflicting `local` placeholder.
- Preserved the existing series identity when rescanning downloaded chapters.
- Renamed the misleading temporary-download setting and made path changes immediately scan existing manga.
- Opened installed builds maximized, rejected stale compressed window dimensions, and enforced a usable minimum window size.

---

## FlowManga v2.5.8 - 2026-07-23

### Fixed

- Hardened automation and scraping against missing chapter arrays in partial provider responses.
- Prevented placeholder SVGs, loading indicators, and decorative assets from being saved as manga pages.
- Paused Rule34 requests after rejected credentials until the credentials change.
- Added Zerochan failure cooldowns and stopped retrying terminal HTTP 4xx responses.
- Added regression tests for provider-series normalization and page-asset filtering.

---

## FlowManga v2.5.7 - 2026-07-21

### Fixed

- Allowed the Windows WebView2 `http://asset.localhost` origin for local images and media in the installed application's Content Security Policy.
- Restored rendering of existing downloaded covers and manga pages without moving or downloading the files again.

---

## FlowManga v2.5.6 - 2026-07-21

### Fixed

- Restored installed-build rendering of existing local manga covers and chapter pages.
- Prevented anonymous CORS mode from being applied to Tauri `asset.localhost` resources while preserving it for remote images.
- Replaced the diagnostics exporter's stale hard-coded version with the actual package version.

---

## FlowManga v2.5.5 - 2026-07-21

### Fixed

- Unified the displayed and persisted image-collection folder setting.
- Added recursive native media indexing, moved-file relinking, local media import, and nested album restoration.
- Added native custom-path existence checks so selected folders on other drives can be indexed.
- Added nested manga archive discovery and stable database identity when rescanning existing series.
- Prevented image collections from being processed by the manga migration scanner.
- Added actionable index error reporting and local filesystem album covers.

---

## FlowManga v2.5.4 - 2026-07-21

### Added

- Transactional database migrations, automatic backups, full export/restore, encrypted device transfer, library integrity checks, and duplicate management.
- Source diagnostics, structured redacted logging, troubleshooting export, request policies, schedules, and first-run setup.
- Frontend provider/filter/data tests, Rust URL-policy tests, CI quality checks, startup smoke testing, and installer checksums.

### Changed

- Gallery Hub now adapts the canonical image-platform providers instead of maintaining duplicate provider implementations.
- Major views, Settings panels, and third-party dependencies are code-split for faster startup.
- Reader, viewer, playlist, collection, video, menu, and settings interactions now include keyboard and assistive-technology support.

### Security

- Enabled CSP, reduced Tauri HTTP and shell permissions, and hardened every native remote fetch against insecure, private, local, or credential-bearing URLs.

---

# FlowManga v2.5.3 Hotfix

This hotfix corrects installed-build fullscreen sizing, improves Paper-theme readability, makes image details responsive, and clarifies Sankaku session and media failures.

### Bug Fixes

- Fixed the Windows installed app leaving a taskbar-sized strip beneath the reader after entering fullscreen.
- Fullscreen transitions are now verified against the native window state and retried when Windows does not accept the first transition.
- Fullscreen and maximized dimensions are no longer saved as the normal application window size.
- Pinned the document and application shell to every WebView edge and added a native-safe black backdrop to prevent white boundary flashes.
- Fixed image-detail actions, tags, and metadata being clipped on compact or short displays.
- Added independent metadata scrolling, responsive panel sizing, compact-height spacing, and safe truncation for long tags.
- Fixed Sankaku cards repeatedly retrying expired or blocked preview URLs.
- Sankaku Retry now requests fresh post metadata and a new signed media URL.
- Distinguished an unverified or rejected saved Sankaku session from a user who has never signed in.

### Theme Improvements

- Reworked Paper into an opaque warm-paper palette instead of a light tint over dark translucent layers.
- Improved primary, muted, placeholder, tag, border, input, focus, hover, and selected-state contrast.
- Preserved intentionally dark image and slideshow overlays where light controls are required.

---

# FlowManga v2.5.2 Release Notes

This patch improves live discovery feeds, media playback, safe-mode filtering, gallery navigation, packaged audio, and desktop stability.

### Feed and Search Improvements

- Latest now keeps each provider's chronological batches together and advances every source independently through older pages.
- Tag searches consistently request newest matches first without hiding previously viewed results.
- Discovery and For You retain recent-content protection while continuing through empty or filtered pages.
- Safe mode now filters explicit ratings, tags, titles, recommendation terms, and provider results before they are displayed.
- App-wide excluded tags are now managed separately from recommendation-only Interest Manager exclusions.

### Sankaku Improvements

- Latest follows Sankaku's canonical date ordering, refreshes page one as a live feed, and retains pending or unreviewed posts returned by the provider.
- Signed video URLs are resolved on demand, cached briefly, and streamed with byte-range support in cards and the detail viewer.
- Video thumbnails animate on hover or focus without flooding the provider request queue.
- Parent posts can be opened directly, and real multi-image groups include previous/next gallery navigation.
- Expanded diagnostics report session state, post status, pagination ranges, filtering, and media hydration failures.

### Interface and Reliability

- Added clear loading feedback while image feeds gather results and gallery badges for multi-image items.
- Improved compact-screen spacing, opaque sticky controls, theme contrast, download-count visibility, and true fullscreen sizing.
- Removed the Continue Reading panel from the manga home page.
- Packaged ambient music is now discovered from the installed Tauri resource layout.
- Reduced WebView2 memory pressure by avoiding full-video blobs in grid previews, limiting cached media, reducing stream chunks, and capping backend logs at Info.

### Provider Fixes

- Improved Rule34 video URL selection and chronological paging.
- Corrected E-Hentai first-page behavior and strengthened gallery metadata and exclusion handling.
- Hardened provider URL parsing and pagination for Nekos and Zerochan.

---

# FlowManga v2.5.1 Release Notes

This release activates E-Hentai galleries, improves Sankaku media reliability, reorganizes Collections and Playlists, and adds source-aware discovery with visual duplicate protection.

### New Features

- Added E-Hentai as an active gallery source with full-resolution reading, gallery tags, slideshows, favorites, and complete-gallery downloads.
- Downloaded E-Hentai galleries now register as grouped books in My Collection and the manga library.
- Added provider-aware tag translation and live alias resolution for booru, Sankaku, Zerochan, and E-Hentai search syntax.
- Added perceptual image fingerprints to suppress visually repeated reposts across providers in For You and Discovery.
- Added bulk selection, folder moves, uncategorizing, and removal to My Collection.
- Added Collection and Playlist search, sorting, clearer matching counts, and improved empty states.

### Improvements

- For You and Discovery now avoid content exposed during the previous 48 hours and automatically advance past fully seen pages.
- Latest remains a complete chronological feed: newest posts first, followed continuously by older pages without novelty filtering.
- Search remains a complete tag catalog with newest matching posts followed by older pages.
- Sankaku video filtering, streaming, poster fallback, and metadata hydration are more resilient.
- Sources settings no longer display synthetic request times or randomly generated error counts.
- E-Hentai gallery cards use the standard detail layout and preserve series grouping during download and playback.

### Bug Fixes

- Fixed seen timestamps not refreshing because duplicate history inserts were ignored.
- Fixed empty novelty-filtered pages being mistaken for provider failures and retried forever.
- Fixed provider tag prefixes and separators being sent in incompatible formats.
- Fixed plain and namespaced E-Hentai blacklist tags not matching one another.
- Fixed E-Hentai gallery downloads being rejected by the configured URL scope.
- Fixed collection folder recommendations using an unregistered search federator.
- Fixed Sankaku and Rule34 video cards falling back to static images when playable media was available.

---

# FlowManga v2.6.0 Release Notes

This release overhauls Sankaku discovery and pagination, adds provider-aware video streaming, expands For You themes and safety controls, and improves release diagnostics.

### New Features

- Added byte-range video streaming with fallback for Sankaku and Rule34.
- Added configurable For You profiles with core, secondary, excluded, artist, character, series, and source-specific Sankaku tags.
- Added Broad, Strict, and Themed recommendation modes.
- Added a 10% recent and 90% random Sankaku For You content mix.
- Added Sankaku session verification and shared image/Books authentication.

### Improvements

- Sankaku Latest now follows the live keyset cursor feed with continuous pagination.
- Video-only and GIF-only filters now enforce the selected mapped media type.
- Rule34 and Sankaku video cards prioritize playable files over static posters.
- Adult themes, examples, autocomplete, and learned suggestions respect the Adult Content setting.
- Network diagnostics redact credentials and explain blocked-tag and inaccessible-media filtering.

### Bug Fixes

- Fixed stale Sankaku Latest batches and pagination stopping early.
- Fixed Sankaku searches returning empty results for valid single tags.
- Fixed access-gated Sankaku records appearing as broken images or videos.
- Fixed Danbooru playback regressions introduced while separating Sankaku streaming.
- Fixed Rule34 thumbnails and detail videos failing to use the actual video URL.
- Fixed several Rust Clippy findings and confirmed unused frontend declarations.

---

# FlowManga v2.5.0 Release Notes

This update improves image discovery, source reliability, Sankaku support, and downloading.

### New Features
- Image feeds refresh more smoothly and keep your scroll position while loading more results.
- Discovery recommendations are more varied and avoid letting one source, artist, or character dominate.
- Sankaku image and book sessions now share one login, including protected book covers and pages.
- Sankaku Books downloads now use the normal manga download flow and appear in the manga library.
- Search exclusions are applied consistently across image discovery, collections, and federated search.

### Bug Fixes
- Fixed refreshes that left tabs scrolled away from the newest results.
- Fixed continuous loading that could move the page or leave masonry gaps around tall images.
- Fixed Sankaku book links with alphanumeric IDs.
- Failed download pages now retry and report a failed job instead of silently completing.

---

# FlowManga v2.4.3 Release Notes

This release introduces dynamic shuffling for recommendation engines and resolves update version mapping checks.

### 🚀 Features & Improvements
- **Dynamic For You Image Shuffling** — The "For You" image recommendations feed is now completely fresh and randomized on every refresh, using dynamic interest shuffling and high-quality fallback tags.
- **Manga For You Recommendation Pipeline** — The Manga "For You" feed now dynamically fetches and ranks candidate series from active discovery streams (trending, latest, random) against your reading profile.

### 🐛 Bug Fixes
- **Version Check Fixes** — Fixed version check mappings so the app correctly reports its current installed version on download and startup.

---

# FlowManga v2.4.2 Release Notes

This hotfix release focuses on squashing some of the biggest bugs you've reported recently. We've smoothed out library navigation, fixed image duplication, and made the reader much more stable!

### 🐛 Bug Fixes
- **Library Navigation Fixes** — Fixed a bug that caused the app to crash or go completely blank when clicking around and moving back and forth through your libraries.
- **No More Duplicate Images** — Fixed an issue where the same images would repeat endlessly when scrolling through the Image Collections or User tabs.
- **Reader & Slideshow Stability** — Fixed a severe crash (infinite loading loop) that occurred when reading manga or using the Slideshow feature. The reader is now completely stable!
- **Slideshow Overlaps** — The top search bar now properly hides itself when you're viewing image collections so it doesn't block your view.
- **Ambient Backgrounds** — Fixed a bug where the ambient lighting background could crash the app when you opened a chapter.
- **First-Time Setup Automation** — If your Windows PC is missing the required WebView2 runtime to run the app, FlowManga will now help you automatically install it.

---

# FlowManga v2.4.1 Release Notes

We've been hard at work polishing the engine, squashing bugs, and ensuring smooth access to all your favorite sources. Here is everything packed into this upcoming release:

### 🛡️ Networking & Anti-Bot Bypassing
- **Universal Cloudflare Bypass (wsrv.nl)** — Resolved severe `403 Forbidden` issues where strict sources (like ManhuaUS) were actively blocking thumbnail and cover image fetches. Completely bypassed their TLS bot-fingerprinting by routing all strict image requests through the `wsrv.nl` global CDN proxy. Covers now load instantaneously without being blocked.
- **MangaDex API Resilience** — Fixed metadata refreshing for MangaDex. Re-routed API calls from the headless Rust scraper to native frontend `fetch` calls, preventing Cloudflare from intercepting and challenging the request.
- **Proxy Fallback Optimization** — Optimized `useProxiedImage` so that fallback logic is lightning-fast and no longer relies on slow backend fetches when dealing with massively protected CDN endpoints.

### 🛠️ Enhancements & Updates
- **Universal Proxy Integration** — Applied the new anti-WAF proxy wrapper uniformly across the entire app interface. The `FeaturedCarousel`, `HomeView` widgets, `HistoryView`, `LibraryGrid`, `ShelfView`, and `QuickViewModal` all now seamlessly load strict images without throwing console errors.
- **WebNovel Cookie Auto-Extraction** — Added one-click automated cookie extraction from Chrome for WebNovel, bypassing Cloudflare security check issues.
- **WebNovel Cookie Paste Sanitizer** — Strips non-printable ASCII characters automatically when pasting cookies manually to prevent Rust backend builder errors.
- **System File Manager Integration** — Added a native command to open download folders directly in the system's file manager (Explorer, Finder, or Files).

### 🐛 Bug Fixes
- **Local File Asset Serving** — Fixed `404 Not Found` errors when attempting to load local cover images from the disk. The UI now properly utilizes Tauri's `convertFileSrc` asset protocol universally.
- **Broken Images & Layout Shifts** — Eliminated "blank cover" bugs and layout shifts caused by hotlink-protected images silently failing in the background.
- **IPC Invoke Errors** — Resolved a `ReferenceError: invoke is not defined` crash that occurred during metadata refresh pipelines.

---

# FlowManga v2.4.0 Release Notes

Welcome to FlowManga v2.4.0! This release focuses on expanding image platform integrations and delivering a massive UI/UX layout overhaul.

### ✨ New Features & Sources
- **Pixiv, Konachan, & Zerochan Support** — We've massively expanded the Image Platform federators! You can now search, discover, and download high-quality images directly from Pixiv, Konachan, and Zerochan APIs.

### 🛠️ UX, Layout & Visual Polish
- **Windows Taskbar Safe Area** — Completely re-engineered the main application wrapper layout to use dynamic padding and `100dvh`. Maximizing the frameless window on Windows will no longer bleed into or behind your taskbar!
- **Home View Expansion** — Slimmed down the right-hand panel widgets to grant vastly more horizontal screen real estate to the main Featured Content rows.
- **Music Player Overhaul** — The sidebar music player is no longer claustrophobic! We've increased the album art orb size, added generous padding to lift it off the bottom of the screen, and centered the playback controls beautifully.
- **TopBar Spacing** — Increased the flex gaps between action buttons in the top navigation bar for a cleaner, premium feel.

### 🐛 Bug Fixes
- **Restore Button Fixed** — Fixed a core Tauri v2 security capability bug that blocked the application from un-maximizing. 
- **Taskbar Icon Scaling** — Aggressively trimmed invisible borders from the FlowManga logo and completely regenerated all OS-level icons, making the app icon appear much larger and clearer in the Windows taskbar.
- **React State Crashes** — Resolved uncaught ReferenceErrors during app initialization by ensuring state hooks are properly scoped to their rendering components.

---

# FlowManga v2.3.0 Release Notes

Welcome to FlowManga v2.3.0! This massive release focuses on vastly expanding our scraping capabilities, hardening the UI/UX across the entire application, and improving privacy and performance.

## ✨ Major Additions & Sources
- **ManhuaPlus Integration**: Added a brand new, fully functioning scraper/downloader for ManhuaPlus! You can now read and bulk download chapters straight from their libraries.
- **MangaRead Polish**: The MangaRead integration has been heavily audited, tested, and marked as safe. Downloads and chapter fetching are faster and more reliable than ever.
- **Danbooru Downloader Logic**: Completely overhauled our Danbooru fetching and downloading logic, greatly improving tag search capabilities, image discovery, and offline saving. 

## ⚡ UX, Performance & UI Polish
- **10-Phase UI/UX Audit Executed**: The entire app received a massive layout and consistency pass:
  - **Snappier Modals**: Cut the overly long animations on `ImportModal` down to a punchy 300ms. Standardized backdrop blurs to `sm`.
  - **Viewport Constraints**: Imposed strict `max-h-[85vh]` boundaries on modals like `SettingsModal` and `ImportModal` to completely prevent screen overflow on smaller displays.
  - **Z-Index Unification**: Eliminated popup collisions. `CommandPalette`, `Toast`, and `DownloadPanel` all now exist in cleanly separated z-layers.
- **Global Search Debouncing**: Typing in the global `TopBar` search or the `MangaDetails` filter no longer stutters the UI! We implemented smart 300ms input debouncing, drastically reducing expensive re-renders on large libraries.
- **Consistent Visual Design**: Swept the entire application to eliminate ad-hoc typography styling. All core elements (headers, badges, carousels) now uniformly use the sleek `tracking-widest` design token.
- **Canvas Rendering Transitions**: The internal `SmartImage` renderer (which handles color correction like brightness/contrast) now gracefully applies the same bezier fade-in animation as standard images, preventing ugly pop-ins when navigating through manga pages.

## 🎵 Security & Ambient Audio
- **Ambient Audio Obfuscation**: The offline background music engine now obfuscates track files (`.mp3` converted to `.dat`) directly within the asset bundle. Exploring the installation directory will no longer expose readable music files!
- **Dynamic Audio Engine**: Updated the core Rust backend (`src-tauri`) to silently decode these `.dat` blobs, matching them via a hidden JSON manifest so the player UI still displays the beautiful, correct track names.

## 🐛 Bug Fixes & Quality of Life
- **Download Speed Awareness**: Added comprehensive UX warnings across the app (in the chapter selection view and active download panels) to notify users that download speeds may vary significantly depending on the source.
- Handled edge cases with Booru Search discovery where empty queries might crash the grid.
