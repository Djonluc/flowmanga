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
