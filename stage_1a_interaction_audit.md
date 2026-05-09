# STAGE 1A: Full Interaction & UX Validation Audit

This audit documents every interactive element across the core UI components, verifying their state triggers, layout changes, and identifying "dead-end" experiences.

---

## 1. TopBar (`TopBar.tsx`)

| Interaction | Action / Trigger | Target System | Status |
| :--- | :--- | :--- | :--- |
| **Search Input** | Updates `searchQuery` | `useLibraryStore` | 🟢 Working (Filters Library) |
| **Import Manga (+)** | Triggers `openImportModal()` | `useModalStore` | 🟢 Working |
| **Filter Button** | None | None | 🔴 **DEAD END** (No `onClick` handler) |
| **Layout Mode** | Toggles `libraryViewMode` ('grid'/'shelf') | `useSettingsStore` | 🟢 Working |
| **Sync Library** | None | None | 🔴 **DEAD END** (No `onClick` handler) |
| **Download Panel** | Triggers `toggleDownloadPanel()` | `useSettingsStore` | 🟢 Working |
| **Notifications** | None | None | 🔴 **DEAD END** (No `onClick` handler) |

---

## 2. Sidebar (`Sidebar.tsx`)

| Interaction | Action / Trigger | Target System | Status |
| :--- | :--- | :--- | :--- |
| **Navigation Tabs** | Updates `activeView` (e.g., 'home', 'library') | `useSettingsStore` | 🟢 Working |
| **Currently Reading** | Triggers `openFolder()` with sequence | `useReadingStore` | 🟢 Working |
| **Sidebar Expand** | Triggers on hover (CSS/Motion) | UI State | 🟢 Working |
| **Profile Section** | `<div onClick={() => {}}>` | None | 🔴 **DEAD END** (Placeholder UI) |

---

## 3. Home Dashboard (`HomeView.tsx`)

| Interaction | Action / Trigger | Target System | Status |
| :--- | :--- | :--- | :--- |
| **Carousel Cards** | Opens reader or quick view | UI State | 🟢 Working |
| **Continue Rail** | Triggers `handleOpenItem()` | `useReadingStore` | 🟢 Working |
| **Picked For You Rail** | Triggers `openQuickView()` | `useModalStore` | 🟢 Working |
| **Trending Rail** | Triggers `openQuickView()` | `useModalStore` | 🟢 Working |
| **Active Session (Right)** | Triggers `handleOpenItem()` | `useReadingStore` | 🟢 Working |
| **Insights (Right)** | None (Informational) | None | ⚪ N/A |
| **Live Feed (Right)** | Triggers `handleOpenItem()` | `useReadingStore` | 🟢 Working |
| **Market Trends (Right)** | None | None | 🔴 **DEAD END** (Renders items, but no `onClick` handler) |

---

## 4. Library & Grid (`LibraryGrid.tsx`)

| Interaction | Action / Trigger | Target System | Status |
| :--- | :--- | :--- | :--- |
| **Explore Tags** | Adds tag to `filterTags` array | `useLibraryStore` | 🟢 Working |
| **Active Tag Pills** | Removes tag from `filterTags` | `useLibraryStore` | 🟢 Working |
| **Global Discoveries** | Triggers `openQuickView()` | `useModalStore` | 🟢 Working |
| **Manga Card Click** | Sets `selectedSeriesId` | `useLibraryStore` | 🟢 Working |
| **Context Menu** | Triggers various modal actions | `useModalStore` / DB | 🟢 Working |

---

## 5. Global UX Flows (Journey Validation)

### **A. Import Flow**
*   **Trigger**: Click Import (+) -> Opens Modal -> Select Folder -> `addMangaFolder` -> Loads into SQLite.
*   **Friction**: None, highly efficient V3 process.

### **B. Discovery Flow**
*   **Trigger**: User navigates to Home -> Rails load trending/recommended.
*   **Friction/Dead Ends**: The "Market Trends" sidebar on the Home view looks clickable but does nothing.

### **C. Tag & Filter Flow**
*   **Trigger**: User selects a tag in Library Grid -> `filterTags` updates.
*   **Friction/Dead Ends**: The main "Filter" button in the TopBar is completely dead, making advanced filtering impossible without using the specific tag rails.

---

## SUMMARY OF IDENTIFIED ISSUES (STAGE 1A RESULTS)

1.  **TopBar Filter Button**: Dead UI. Needs a dropdown or modal to manage complex filters (source, read status).
2.  **TopBar Sync Button**: Dead UI. Needs to trigger `refreshMangaMetadata` for the whole library.
3.  **TopBar Notifications**: Dead UI. Should either be hidden or show download/system alerts.
4.  **Sidebar Profile**: Dead UI. Placeholder "VoidWalker" profile does nothing.
5.  **Home Market Trends**: Dead UI. The 1-3 ranked trending items in the right panel cannot be clicked to view them.
