# FlowManga: Complete Application Breakdown & Documentation Map

> **PURPOSE:** This document serves as the absolute source of truth for the FlowManga architecture as of May 2026. It is designed to preserve stability, prevent destructive rewrites, and document the exact state of all working systems.

---

## 1. APPLICATION STRUCTURE

FlowManga utilizes a "Single Page App" architecture heavily reliant on Zustand for state and view orchestration, rather than a traditional router like `react-router`.

### **Core Routing & Layouts**
*   **`App.tsx` & `main.tsx`**: The entry points. `App.tsx` manages the top-level view orchestration based on `useSettingsStore.activeView` and `useReadingStore.images`.
*   **`components/Layout.tsx`**: The master wrapper. It houses the global UI structure:
    *   **Sidebar** (Left navigation)
    *   **TopBar** (Search and global actions)
    *   **Main Content Area** (Dynamic injection of active views)
    *   **Global Overlays** (`CommandPalette`, `ShortcutsManager`, `ToastContainer`, `DownloadPanel`)
    *   **V3 Modals** (Managed centrally by `useModalStore` to prevent context loss).

### **Data & State Management (Zustand Stores)**
*   `useSettingsStore.ts`: Global UI state (theme, active view, adaptive color toggles).
*   `useLibraryStore.ts`: The core data model. Fetches, caches, and mutates series data from SQLite.
*   `useModalStore.ts`: (V3 System) Centralized registry for all destructive or complex modals (`ImportModal`, `DeleteConfirmModal`, `TagManagerModal`). *Stable.*
*   `useReadingStore.ts`: Manages reader state (active chapter, page index, loaded images).
*   `useDownloadStore.ts`: Background worker queue for downloading chapters.
*   `useTrackerStore.ts`: Handles syncing with external trackers (e.g., AniList).
*   `useVideoStore.ts`: Manages local video content playback state.
*   `useAnalyticsStore.ts`: Aggregates reading statistics for the dashboard.
*   `useScraperStore.ts`: Manages scraper configuration and session states.

### **Services & Backend Integration**
*   `db.ts`: The SQLite wrapper (`@tauri-apps/plugin-sql`). Enforces the V3 flat-file metadata schema.
*   `ScraperService.ts`: Complex multi-strategy scraping engine.
    *   *MangaDex*: Primary source via REST API.
    *   *Headless Rust Fallback*: Uses Tauri `invoke` to run headless browsers for Cloudflare-protected sites (e.g., ManhwaRead, Comix).
*   `DownloadService.ts`: Handles concurrent fetching and file system writing (`@tauri-apps/plugin-fs`).

---

## 2. FEATURE BREAKDOWN

| Feature | Description | Controllers | Status |
| :--- | :--- | :--- | :--- |
| **Library Management** | Loads, sorts, and filters local manga from the SQLite DB. | `LibraryGrid.tsx`, `useLibraryStore` | 🟢 Stable |
| **Importing** | Native Tauri folder selection dialog that parses local directories into the V3 schema. | `ImportModal.tsx`, `useLibraryStore` | 🟢 Stable |
| **Scraping Engine** | Fetches external metadata and chapter images. Fallbacks to headless Rust for WAF bypass. | `ScraperService.ts`, Rust Backend | 🟡 Fragile (WAF dependent) |
| **Downloading** | Background queue that fetches images in parallel and saves them locally. | `DownloadPanel.tsx`, `useDownloadStore` | 🟢 Stable |
| **Reader Engine** | Infinite vertical scrolling, image preloading, and dynamic sizing. | `Reader.tsx`, `useReadingStore` | 🟢 Stable |
| **Ambient Engine** | Dynamically extracts dominant colors from manga covers/pages to tint the app's CSS variables. | `AmbientBackground.tsx`, `useAdaptiveColor` | 🟢 Stable |
| **Analytics** | Tracks reading velocity, time spent, and genre distribution. | `AnalyticsDashboard.tsx`, `useAnalyticsStore`| 🟢 Stable |
| **Search & Filter** | Real-time memory filtering of the library grid via the TopBar. | `TopBar.tsx`, `useLibraryStore` | 🟢 Stable |
| **Recommendations** | Fetches "Trending" and "Picked for You" data based on tags and external APIs. | `HomeView.tsx`, `ScraperService.ts` | 🟢 Stable (Recently Fixed) |

---

## 3. PAGE-BY-PAGE UX BREAKDOWN

### **A. HomeView (`activeView === 'home'`)**
*   **Layout**: `FeaturedCarousel` (Top) -> `HorizontalRail` lists (Continue, Trending, Recommendations) -> `RightSidebar` (Session, Stats).
*   **UX**: Highly cinematic. Uses horizontal scrolling for discovery, keeping vertical space compact. The right panel provides persistent user context without navigating to the stats page.

### **B. LibraryGrid (`activeView === 'library'`)**
*   **Layout**: Masonry or Shelf grid of `MangaCard` components.
*   **UX**: Optimizes for visual density. Hovering a card lifts it slightly and reveals context menu triggers. Uses `framer-motion` for smooth layout transitions when filtering.

### **C. Reader (`images.length > 0`)**
*   **Layout**: Fullscreen overlay that unmounts the standard Layout. Contains `ReaderTopBar` and `ReaderBottomBar`.
*   **UX**: Pure immersion. UI elements auto-hide on scroll. The background color shifts dynamically based on the current page's color palette via the Ambient Engine.

### **D. AnalyticsDashboard (`activeView === 'stats'`)**
*   **Layout**: Bento-box style grid utilizing `recharts` for data visualization (`ActivityHeatmap`, `GenreDistribution`).
*   **UX**: Provides gamified feedback on reading habits.

---

## 4. BUTTON & INTERACTION AUDIT

### **Working Interactions (PRESERVE THESE)**
*   **Sidebar Navigation**: Instantly switches `activeView` without full re-renders.
*   **MangaCard Click**: In Library -> Opens `QuickViewModal` or details. In Home -> Initiates reading.
*   **MangaCard Right-Click**: Opens custom `ContextMenu` (Edit, Delete, Tag).
*   **TopBar Search**: Typing instantly updates the `searchQuery` in `useLibraryStore`, triggering grid filtering.
*   **Command Palette (Ctrl+K)**: Opens a global quick-action menu.
*   **Import Button (TopBar)**: Opens `ImportModal` -> Triggers Tauri OS Dialog.

### **Interaction Rules**
*   **Destructive Actions**: ALWAYS route through `useModalStore` (e.g., `DeleteConfirmModal`). Never trigger a delete directly from a card.
*   **State Updates**: Must utilize Zustand's shallow comparison or specific selectors to prevent re-rendering the entire Library Grid.

---

## 5. LAYOUT & DESIGN BREAKDOWN

FlowManga employs a **"Cinematic Glassmorphism"** design system:
*   **Glass Panels**: Components use `bg-white/5` or `bg-white/[0.03]` with `backdrop-blur-[40px]`.
*   **Borders**: Subtle `border-white/5` to define edges without harsh lines.
*   **Typography**: `Inter` font. Heavy use of `font-black`, `uppercase`, and `italic` for section headers (e.g., *TRENDING NOW*).
*   **Geometry**: Extreme rounding (`rounded-[32px]` to `rounded-[48px]`) on major layout containers to mimic modern OS windows.
*   **Motion**: `framer-motion` is used globally. Page transitions use `scale` and `opacity` fades. Lists use staggered entry animations.

**Rule:** DO NOT replace custom CSS glassmorphism with generic Tailwind classes unless the exact blur and opacity ratios are maintained.

---

## 6. RESPONSIVENESS AUDIT

*   **Desktop/Ultrawide (1080p+)**: The app operates optimally. The Layout component utilizes flexboxes that expand gracefully. The `RightSidebar` remains fixed.
*   **Laptops (720p - 1080p)**: `MangaCard` density adjusts automatically.
*   **Mobile/Small**: *Not a primary target.* The app is a desktop Tauri client. However, the sidebar supports collapsing, and horizontal rails switch to touch-scroll behavior.

---

## 7. PERFORMANCE AUDIT

### **🟢 Optimized Areas**
*   **SQLite Queries**: Direct DB queries are fast and offload filtering from the JS thread where possible.
*   **Zustand**: Stores are segmented (Reading vs. Library) to prevent massive re-renders when reading progress updates.

### **🟡 Potential Bottlenecks (Monitor Only, Do Not Rewrite Yet)**
*   **Heavy Blurs**: Excessive `backdrop-blur` on large panels can spike GPU usage on integrated graphics.
*   **Image DOM Nodes**: If a chapter has 200+ images, rendering them all simultaneously in `Reader.tsx` without virtualization can cause memory bloat. *Currently mitigated by native browser lazy-loading, but strict virtualization may be required later.*

---

## 8. IMPLEMENTATION SAFETY RULES

Before modifying any code, the AI must explicitly answer:
1.  **Affected Files:** Which files am I touching?
2.  **Affected Systems:** What Zustand stores or Tauri endpoints rely on this?
3.  **Possible Regressions:** Will this break the Reader? Will it desync the UI from SQLite?
4.  **Implementation Strategy:** What is the absolute minimum code required to fix the issue?
5.  **Why:** Is this solving a real bug, or just "modernizing"?

---

## 9. SAFE IMPLEMENTATION POLICY

1.  **ZERO DELETION:** Never delete working layout components, functions, or imports unless replacing them with an exact, verified equivalent requested by the user.
2.  **NO GLOBAL REWRITES:** Do not refactor `Layout.tsx`, `App.tsx`, or `useLibraryStore.ts` unless solving a critical, blocking crash.
3.  **PRESERVE STORE CONTRACTS:** If a component expects `item.mangaId`, do not change the data model to `item.id` without migrating the entire SQLite database and all UI components simultaneously.
4.  **UI STABILITY:** UI changes must strictly adhere to the existing Glassmorphism/Dark theme variables.

---

## 10. FINAL GOAL

FlowManga is a **mature, production-grade platform**.
The role of any AI or developer interacting with this codebase is to **maintain, stabilize, and carefully extend** — NEVER to disrupt, redesign, or assume code is redundant. If a system looks complex, it was likely built that way to handle edge cases (e.g., the `ScraperService` handling raw UUIDs, Next.js JSON, and hidden DOM elements). 

**Respect the architecture. Preserve the UX. Implement minimally.**
