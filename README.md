<div align="center">

![DjonStNix Watermark](https://img.shields.io/badge/Created%20by-DjonStNix-5B8CFF?style=for-the-badge&logo=github&logoColor=white)

# FlowManga 🎨📚

**Your Personal Manga Library Manager**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?style=flat-square&logo=tauri)](https://tauri.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

*Transform your reading experience with a cinematic, self-hosted manga library manager. FlowManga combines the power of a local file system with smart cloud integration.*

[Features](#-features) • [Installation](#-installation) • [Tech Stack](#-tech-stack) • [Roadmap](#-roadmap)

</div>

---

## ✨ Features

### 🚀 Smart Library Management
- **Personal Archive**: Your manga, your files. Full control over organization with a robust local file system backend.
- **Smart Updates**: Automatically tracks source URLs (MangaDex support) and notifies you of new chapters.
- **Background Downloads**: Queue hundreds of chapters with a powerful, concurrent download manager that works silently while you read.
- **Metadata Intelligence**: Parses series info, authors, and genres automatically.

### 🎯 Core Reading Experience
- **Cinematic Modes**: Vertical Webtoon scroll, classic page flip, and immersive slideshows.
- **Auto-Scroll**: Hands-free reading with adjustable speeds.
- **Zoom & Fit**: Smart scaling for any screen size.
- **Progress Sync**: Never lose your place with automatic bookmarking and history tracking.

### 🎨 Immersive UI/UX
- **Adaptive Theming**: The interface colors evolve based on the current page's artwork.
- **Ambient Audio**: Built-in soundscapes (Rain, Lo-Fi, Nature) to enhance your reading atmosphere.
- **Distraction-Free**: Fullscreen mode tailored for deep immersion.
- **Keyboard Control**: Complete shortcut support for power users.
- **3D Cinematic Shelf**: A high-performance 3D visualization of your collection.

### 🕵️ Stealth Scraping & Security
- **Headless-First Engine**: Bypasses aggressive Cloudflare "403 Forbidden" blocks using browser-level emulation.
- **Session Injection**: Support for manual cookie injection to access authenticated user accounts on remote sources.
- **Privacy Centric**: All data and downloads stay on your local machine.

---

## 🚀 Tech Stack

### Frontend Architecture
- **React 19** - Cutting-edge UI rendering.
- **Framer Motion** - Silky smooth animations and transitions.
- **Zustand** - Efficient, scalable state management.
- **Tailwind CSS** - Modern, responsive styling system.

### Native Power (Tauri 2)
- **Rust Core**: Blazing fast backend logic for file operations and networking.
- **Headless Chrome**: Native browser integration for stealth data extraction.
- **SQLite**: Reliable, persistent local database.
- **Asynchronous I/O**: Non-blocking operations for a responsive UI.

### Integration
- **MangaDex API**: Seamless search and download integration.
- **Comix.to Stealth Scraper**: Advanced regex and headless fallback for protected sources.

---

## 📦 Installation

### Prerequisites
- **Node.js 18+**
- **Rust** (for building from source)
- **Windows / macOS / Linux** support

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Djonluc/flowmamga.git
   cd flowmamga
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run Development Mode**
   ```bash
   npm run tauri dev
   ```

4. **Build Production Release**
   ```bash
   npm run tauri build
   ```

---

## 📁 Project Structure

```
flowmamga/
├── src-tauri/                 # Rust Backend (Tauri 2)
│   ├── src/lib.rs            # Command definitions & initialization
│   ├── capabilities/         # Security permissions
│   └── tauri.conf.json       # Application config
├── src/                      # React Frontend
│   ├── components/           # UI Components
│   ├── stores/               # Zustand Stores (Download, Library, Reading)
│   ├── services/             # Logic Services (DownloadService, UpdateManager)
│   └── hooks/                # Custom React Hooks
└── public/                   # Static Assets
```

---

## 🎯 Roadmap

### ✅ Phase 1: Foundation (Complete)
- [x] Local library scanning & file system integration
- [x] 3D shelf visualization
- [x] Basic reading modes (Vertical, Horizontal)

### ✅ Phase 2: Enhanced UI & Immersion (Complete)
- [x] Adaptive color system
- [x] Ambient sound player
- [x] Keyboard navigation
- [x] Dark mode architecture

### ✅ Phase 3: Connected Library (Complete)
- [x] MangaDex search integration
- [x] **Background Download Manager** (Queue, Pause, Resume)
- [x] **Smart Updates** (Track sources, Metadata enhancement)

### � Phase 4: Reader Refinement (In Progress)
- [ ] Advanced reader settings (Gapless, Double-page)
- [ ] Performance optimization for long-strip webtoons
- [ ] Improved touch gestures

### 🔮 Phase 5: Ecosystem
- [ ] Cloud sync via self-hosted server
- [ ] Mobile companion app
- [ ] Plugin system for custom sources

---

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
VITE_APP_NAME=FlowManga
VITE_APP_VERSION=2.2.0

# Scraper Authentication (Optional)
# For sites like Comix.to, paste your session and cf_clearance cookies here
VITE_COMIX_COOKIE="session=...; cf_clearance=..."
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

### 👨‍💻 Created by **Djon StNix**

[![GitHub](https://img.shields.io/badge/GitHub-Djonluc-5B8CFF?style=flat-square&logo=github)](https://github.com/Djonluc)
[![YouTube](https://img.shields.io/badge/YouTube-@Djonluc-FF0000?style=flat-square&logo=youtube)](https://www.youtube.com/@Djonluc)
[![Email](https://img.shields.io/badge/Email-djonstnix@gmail.com-5B8CFF?style=flat-square&logo=gmail)](mailto:djonstnix@gmail.com)

**Software Developer & Digital Creator**

*FlowManga is crafted with passion for the manga community.*

---

**Status**: Alpha 🚀 | **Version**: 2.1.0

</div>
