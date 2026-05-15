# FlowManga Audit Report

## 1. Architecture Summary

- **Frontend**: React 19 + Tailwind CSS 4 + Framer Motion.
- **State**: Zustand stores for settings, library, discovery, gallery, reader, video, analytics, modals.
- **Backend/Services**:
  - `src/services/db.ts` — SQLite via Tauri plugin.
  - `src/services/DiscoveryService.ts` — discovery engine with cache, timeouts, interleaving, provider weighting.
  - `src/services/ScraperService.ts` — provider dispatch plus fallback generic scraping.
  - `src/services/DownloadService.ts`, `UpdateManager.ts`, `AutomationService.ts` — queue, downloads, scheduled workflows.
- **Provider Integration**: source registry in `src/services/sources/registry.ts`; registration in `src/services/sources/index.ts`.
- **Routing**: internal view state only; no URL-based navigation.
- **Layout**: `src/components/Layout.tsx` hosts sidebar, top bar, overlays, modals, global controllers, gallery viewer, slideshow.
- **Startup**: `src/main.tsx` initializes DB and library, then clears `isInitializing`.
- **Modals**: `useModalStore.ts` centralizes global modal state.

## 2. Architecture Strengths

- Good separation between UI components, Zustand stores, service layer, and native integration.
- Typed provider abstraction with a clear `SourceProvider` contract.
- Discovery caching and provider interleaving are explicitly built.
- Global layout shell supports consistent overlay/modal rendering.
- Adaptive color, native zoom, and window restore logic exist.

## 3. Architecture Risks and Issues

- Many stores import `useSettingsStore` and link state directly, increasing coupling.
- `useReadingStore` and others use dynamic lazy cross-imports to manage circular dependencies.
- No route-based navigation or deep linking.
- `react-window` is installed but no references were found.
- `useLibraryStore.loadFromDb()` loads the full library/chapter dataset at startup.
- `scraperService` mixes modern provider dispatch with legacy fallback logic.
- Dual persistence via Zustand and SQLite can create state drift.

## 4. UX / Journey Audit

### Works

- Main views exist: Home, Library, Discover, Videos, History, Stats.
- Reader flow opens directly when images exist.
- Search and discovery flows are present.
- Command palette and keyboard interactions are available.
- Ambient reader polish is strong.

### Friction

- Onboarding is not explicit; first-run flow is unclear.
- Navigation is state-driven and lacks browser-like history.
- Discover content type filtering relies on heuristics rather than metadata.
- Search recovery and fallback guidance are weak.
- Many actions are hidden behind context menus or modals.

## 5. Collection Ecosystem Audit

- Library, collections, gallery folders, slideshows, saved images are persisted in SQLite.
- `useGalleryStore` handles saved images, discovery feeds, slideshows, viewer context.
- `DiscoveryService.interleave()` attempts provider balance with source weights.
- Title-based deduplication is too coarse and may hide distinct content.
- `GalleryStore.fetchAllDiscovery()` triggers many independent loads and may stress resources.
- Slideshow/viewer preloading exists.

## 6. Search + Recommendation Intelligence

- Search fans out across providers and aggregates results.
- Recommendations use random searches plus history/tag seeds.
- Semantic and synonym handling is weak.
- Search ranking and diversity depend largely on provider output.
- Duplicate suppression exists but is limited.
- Personalization uses shallow tag/history seeds.

## 7. Performance / Resource Audit

### Positive

- In-memory and SQLite caching for discovery.
- Thumbnail preload after search.
- Reader preloading via `usePreloader` and `useMediaLoader`.
- Dedicated `withTimeout()` for discovery queries.

### Concerns

- Full library load on startup is not scalable.
- No virtualization found for large lists.
- `GalleryStore.fetchAllDiscovery()` can spawn many concurrent requests.
- Preload logic may create memory/network overhead.
- Native zoom detection logic is potentially expensive on frequent resizes.

## 8. Reliability / Stability Audit

### Good

- Async calls wrapped in `try/catch` in many places.
- Some `Promise.allSettled()` usage avoids total failure.
- DB init fallback allows load state to end even on error.

### Risks

- Many failures are console-only without user notification.
- Partial failure in `loadFromDb()` can leave inconsistent state.
- `setFeedback()` uses timeouts without cancellation.
- Legacy fallback scraping is broad and brittle.
- `useReadingStore.openFolder()` has no cancellation for overlapping loads.
- `DiscoveryStore.forceRefresh()` clears state before parallel refresh.

## 9. Visual / UI Consistency Audit

- Design language is polished and consistent.
- Desktop-first layout is strong, but mobile/responsive support is unclear.
- Accessibility attributes are not visible in core components.
- Global UI shell is complex, which may hinder future updates.
- Discovery filter controls are dense and may be hard to scan.

## 10. Provider / API Ecosystem Audit

- Good provider registry and abstraction.
- Source weighting and reliability tracking exist.
- Some providers are manually disabled by default.
- Content classification is brittle and partly heuristic.
- Reliability metrics are in-memory only.
- Generic scraper fallback shows provider coverage is incomplete.

## 11. Missing Features / Opportunities

- Explicit onboarding / first-run setup.
- Provider management and source enable/disable controls.
- Route/deep-link navigation.
- List virtualization for large libraries.
- Provider health/reliability dashboard.
- Better search synonyms and query suggestions.
- Consistent error banners and retry UI.
- Clearer safe/adult filter controls.
- Better accessibility support.

## 12. Final Ratings

- **Architecture**: 7 / 10
- **UX**: 6.5 / 10
- **Performance**: 6.5 / 10
- **Reliability**: 7 / 10
- **Scalability**: 6 / 10
- **Maintainability**: 7 / 10
- **Visual polish**: 8 / 10
- **Provider ecosystem**: 7 / 10

## 13. Critical Risks

- Full library load could break large collections.
- Lack of virtualization on large lists.
- Discovery/background fetches may overload network.
- Legacy scraper fallback introduces maintenance risk.
- Silent console errors reduce user confidence.

## 14. Medium Issues

- Mixed persistence strategies.
- Heuristic category filtering.
- No persistent provider reliability data.
- No view routing.
- Global modal complexity.

## 15. Strongest Parts

- Modular service design.
- Discovery caching and interleaving.
- Reader preloading and polish.
- Central layout with consistent overlays.
- Local-first SQLite backing.

## 16. Weakest Parts

- Onboarding and first-run UX.
- Large-scale list performance.
- Search taxonomy and provider classification.
- Error recovery visibility.
- Discovery/source stability.
