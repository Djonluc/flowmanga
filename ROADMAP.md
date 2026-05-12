# 🌊 FlowManga — Product, Roadmap & Ecosystem Document

> **Reality check (May 2026):** The shipping app in this repo is a **Tauri 2** desktop shell (Rust + WebView), **React 19**, **Vite 7**, and **SQLite** via `@tauri-apps/plugin-sql`. Sections below mix **historical planning**, **shipped behavior**, and **future vision**. For what the code actually does today, see [FEATURES.md](FEATURES.md).

FlowManga is a high-performance, immersive manga and comic reader built with **Tauri 2**, React, and Framer Motion.

This master document combines:
- Product overview
- Complete feature documentation
- Multi-phase development roadmap
- Community expansion strategy
- Monetization plan
- Ecosystem growth model
- Long-term vision

---

# 🧭 PRODUCT OVERVIEW

FlowManga transforms local manga and comic collections into a cinematic reading environment.

**Core philosophy:**
> Not just a reader. A reading environment.

**Target audience:**
- Manga collectors
- Comic enthusiasts
- Webtoon readers
- Power users
- Keyboard-first workflow users

---

# 🏠 CORE FEATURES

## Home Dashboard
- Dynamic hero header using user library covers
- Resume Last (exact page restore)
- Recently Read shelf
- Sidebar navigation

## Library System
- Multi-folder unified indexing (paths stored in SQLite; folders scanned in place)
- OS “open path” integration for quick import (see `useLibraryEvents`)
- Web URL import + chapter downloads into a **user-chosen** download directory (not a fixed `flowmanga_library` root in code)
- Duplicate / missing-chapter UX: partly aspirational — verify in UI before assuming behavior

## Display Modes
- High-performance virtualized Grid View
- 3D Shelf View with hover tilt
- Custom Shelf Builder (future)

## Reading Engines

### Vertical Mode (V)
- Smooth scrolling
- Auto-scroll (A)
- Adjustable speed

### Page Mode (P)
- LTR / RTL support
- Smart width / height fit
- Page snapping
- Preload next page

### Slideshow Mode (S)
- Auto-advance
- Adjustable timing
- Transition effects

---

# 🎭 IMMERSION FEATURES
- Adaptive UI color extraction
- Ambient sound loops (Rain, Lo-Fi, Nature)
- Immersive Fullscreen
- HUD toggle
- OLED mode
- Reading Room Mode (future desk aesthetic environment)
- Focus Mode (notification suppression)
- Deep Read timer mode

---

# 📊 ANALYTICS SYSTEM
- Total time read
- Pages flipped
- Weekly activity graphs
- Reading streak tracking
- Daily goals
- Reading heatmap calendar
- Speed analysis
- Peak reading hour detection
- Collection insights dashboard

---

# 🧱 FULL DEVELOPMENT ROADMAP

## Phase 0 — Foundation (historical / largely shipped)
- ~~Electron shell~~ **Tauri 2** shell (current)
- React architecture
- Global state management (Zustand)
- Local DB (**SQLite** via Tauri SQL plugin — `flowmanga.db`)
- File indexing engine (Rust `scan_manga_folder` / `scan_chapters`)
- Virtualized grid rendering
- Resume progress system
**Exit Goal:** Load 1000+ volumes smoothly.

## Phase 1 — Core Reader (Weeks 4-6)
- Vertical engine
- Page engine (LTR/RTL)
- Slideshow engine
- Full keyboard control
- Settings panel
- Basic stats tracking
**Exit Goal:** Stable MVP ready.

## Phase 2 — Immersion Upgrade (Weeks 7-9)
- Adaptive background engine
- Ambient audio system
- OLED mode
- Enhanced analytics
- Streak tracker
- Daily goals
**Exit Goal:** Premium feel achieved.

## Phase 3 — Smart Library Intelligence (Weeks 10-14)
- AI metadata detection
- Auto volume grouping
- Smart cover extraction
- Fuzzy search engine
- Collection insights analytics
- Smart recommendations prototype
**Exit Goal:** Library organizes itself intelligently.

## Phase 4 — Gamification Layer (Weeks 15-17)
- Achievement system
- Streak leaderboards
- Reading goals system
- Unlockable UI themes
- Session performance scoring
**Exit Goal:** Retention increases.

## Phase 5 — Ecosystem Expansion (Weeks 18-24)
- Account system
- Cloud sync (encrypted)
- Multi-device progress
- Backup & restore
- Plugin system foundation
**Exit Goal:** FlowManga becomes a platform.

---

# 🌐 COMMUNITY & DISCORD STRATEGY

## Official Discord Server
Core Channels:
- Announcements
- Dev Updates
- Feature Voting
- Bug Reports
- Theme Creators
- Plugin Developers
- Setup Showcases
- Manga Discussion

## Discord Bot Features
- Reading streak sync
- Achievement broadcast
- Weekly leaderboard
- Milestone celebration

## Roles
- Founder
- Beta Tester
- Plugin Dev
- Theme Creator
- 1000+ Hour Reader

**Goal:** Build cult-level community loyalty.

---

# 📢 SOCIAL & VIRAL FEATURES

## Shareable Stats Cards
- Monthly recap
- Year recap
- Streak highlights
- Most-read series

## "Your Year with FlowManga"
- Pages read
- Longest streak
- Favorite genre
- Reading time breakdown

*Marketing flywheel built in.*

---

# 🎨 PERSONALIZATION ENGINE
- Dynamic UI themes
- Custom shelf wood tones
- Lighting controls
- Reading HUD customization
- Ambient pack marketplace
- Animated page transitions (future)

---

# 🔌 PLUGIN & CREATOR ECONOMY
Plugin API allowing:
- Custom transitions
- New analytics modules
- Metadata scrapers
- Ambient sound packs
- UI themes

**Marketplace model:**
- 70% creator
- 30% platform

---

# 💰 MONETIZATION STRATEGY

## Freemium Model
**Free:**
- Core reader
- Basic stats
- Multi-folder support

**Pro:**
- AI metadata detection
- Cloud sync
- Advanced analytics
- Achievement system
- Exclusive themes

## One-Time Pro License
## Founder Tier
- Lifetime Pro
- Badge
- Early access

## Marketplace Revenue

---

# 🤝 PARTNERSHIPS & CREATOR STRATEGY
- Manga YouTubers
- Desk setup creators
- Productivity influencers
- Indie comic artists

*Influencer-exclusive themes & badges.*

---

# 🔐 POWER USER FEATURES
- Vault Mode (password collections)
- Duplicate volume detection
- File health diagnostics
- Metadata export
- Encrypted local database option

---

# 🔮 WILD FUTURE IDEAS
- AI panel zoom detection
- Voice page control
- Story timeline visualizer
- Reading clubs
- Shared group sessions
- AI playlist generator
- Immersion score per session
- Compare stats globally

---

# 📈 GROWTH FLYWHEEL
1. Immersive experience
2. Shareable stats
3. Discord engagement
4. Creator marketplace
5. Influencer exposure
6. Annual recap hype

---

# 🏁 LONG-TERM VISION
FlowManga evolves from:
**Desktop Reader → Collector Tool → Premium Platform → Community Ecosystem → Monetizable SaaS.**

**Ultimate Goal:** Become the most immersive offline-first manga reader in the desktop market.
