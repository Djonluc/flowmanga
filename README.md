<div align="center">

![DjonStNix Watermark](https://img.shields.io/badge/Created%20by-DjonStNix-5B8CFF?style=for-the-badge&logo=github&logoColor=white)

<img src="public/banner.jpg" alt="FlowManga Banner" width="420" />

# FlowManga

**Read. Discover. Flow.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?style=flat-square&logo=tauri)](https://tauri.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

FlowManga is a **Tauri 2** desktop app: a local-first library with multiple reading layouts, a download queue, tag-based discovery, optional video library, and reading analytics. The UI is **React 19** with **Tailwind CSS 4** and **Zustand** for state.

[Features](#-features) · [Installation](#-installation) · [Tech stack](#-tech-stack) · [Documentation](#-documentation) · [Roadmap](#-roadmap)

</div>

---

## Features

### Library and Collections

- **Local folders** are scanned in place; SQLite stores paths to your existing files (see [FEATURES.md](FEATURES.md)).
- **URL imports** download chapters into a folder you choose in settings (not the same as “moving your whole collection into an app-owned vault”).
- **Unified Collection UI**: Grid and shelf-style views, dynamic masonry grids, smart albums, playlists, and a dedicated "For You" feed.
- **Media Type Filtering**: Seamlessly filter out Images, Videos, or GIFs universally across search, discovery, and collections!
- **Command palette** and keyboard-driven navigation for common actions.

### Reader & Viewing

- **Vertical** (webtoon-style scroll), **single-page** mode, and **dual-page** reading.
- **Slideshow System**: Auto-advance, shuffle, and looping controls directly inside image collections.
- Auto-scroll, zoom / fit modes, fullscreen, HUD toggle, and shortcut guide.
- **Adaptive theming** from the current page; optional **ambient** soundscapes.

### Discovery, Sources, and Downloads

- **Discover** view with curated rails, recommendations, and tag exploration (backed by `ScraperService` and source providers).
- **Manga & Comic Sources**: MangaDex (API), plus scraper-backed providers such as ManhwaRead, LuaComic, BlueLock, DBM, ManhuaPlus.
- **Booru & Gallery Ecosystem**: Deep integrations for Danbooru, Gelbooru, Rule34, E-Hentai, Sankaku Complex, and Nekos.best! Includes fuzzy tag autocomplete and advanced negations.
- **Download manager**: queued jobs, background chunk cleanup, pause/resume, and native Rust processing to effortlessly reconstruct heavily scrambled pages.

### Beyond Comics

- **Video library** for local video folders and playback inside the shell, with robust filtering.
- **Analytics** dashboard and **reading history** views.
- **Automation** hooks (see settings and `AutomationService`) for scripted or scheduled behaviors where enabled.

### Desktop Integration

- **Tauri 2** windowing, filesystem, SQL, dialogs, and shell integrations.
- **Automatic Updates**: FlowManga checks for updates natively in the background and prompts you with a stylish popup and categorized changelog when a new version drops.
- Native **zoom** level synced from settings when running under Tauri.

---

## Tech stack

| Layer | Stack |
|--------|--------|
| UI | React 19, Framer Motion, Tailwind CSS 4, Lucide icons |
| State | Zustand |
| Charts / lists | Recharts, react-window (where used) |
| Desktop | Tauri 2 (Rust), Vite 7 |
| Validation | Zod |

---

## Installation

### Prerequisites

- **Node.js** 18 or newer (LTS recommended)
- **Rust** toolchain (stable), for Tauri
- **Platform**: Windows, macOS, or Linux (Tauri targets vary by OS; see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### Clone and run

```bash
git clone https://github.com/Djonluc/flowmamga.git
cd flowmamga
npm install
npm run tauri dev
```

### Production build

```bash
npm run tauri build
```

Artifacts are emitted under `src-tauri/target/release/` (and bundle output per your Tauri bundle config).

### Environment

Copy `.env.example` to `.env` if you need non-default behavior. The app runs without a `.env` file. Optional variables (see `.env.example`) include display metadata and `VITE_COMIX_COOKIE` for scraper flows that send a session cookie—only use this where you are explicitly allowed to access the service, and never commit secrets.

---

## Project structure

```
flowmamga/
├── src-tauri/           # Tauri 2 Rust crate, capabilities, icons, tauri.conf.json
├── src/
│   ├── components/      # UI (reader, library, modals, settings, video, home, …)
│   ├── image-platform/  # Booru/Gallery federation, tag intelligence, query parsing
│   ├── stores/          # Zustand stores
│   ├── services/        # Downloads, scrapers, discovery, automation, …
│   ├── hooks/           # Reader, library, analytics, adaptive color, …
│   ├── config/          # App config (e.g. spotlight)
│   └── types/           # Shared TypeScript types
├── index.html           # Vite entry
├── vite.config.mts
├── package.json
└── .env.example
```

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [FEATURES.md](FEATURES.md) | **Authoritative** behavior notes for the desktop app (synced to the codebase) |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Builds, updates, and ops |
| [WINDOW_ARCHITECTURE.md](WINDOW_ARCHITECTURE.md) | Windows-specific layout notes |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

---

## Roadmap

### Done (high level)

- Local library, scanning, 3D shelf, multiple reader modes  
- Adaptive color, ambient audio, keyboard shortcuts  
- MangaDex and extended source registry; download queue and native image descrambling
- Discover home rails, video library, analytics and history surfaces  
- Booru & gallery ecosystem integration with native tag intelligence and playlists

### In progress / next

- Reader polish (e.g. long-strip performance, advanced spread / gap options)  
- Broader gesture and touch tuning on supported devices  

### Ideas

- Optional self-hosted sync  
- Companion / plugin-style source extensions  

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs are welcome.

---

## License

[MIT](LICENSE)

---

<div align="center">

### Created by **DjonStNix**

[![GitHub](https://img.shields.io/badge/GitHub-Djonluc-5B8CFF?style=flat-square&logo=github)](https://github.com/Djonluc)
[![YouTube](https://img.shields.io/badge/YouTube-@Djonluc-FF0000?style=flat-square&logo=youtube)](https://www.youtube.com/@Djonluc)
[![Email](https://img.shields.io/badge/Email-djonstnix@gmail.com-5B8CFF?style=flat-square&logo=gmail)](mailto:djonstnix@gmail.com)

**Version:** 2.4.4 (see `package.json` and `src-tauri/tauri.conf.json`) · **Status:** active development

</div>
