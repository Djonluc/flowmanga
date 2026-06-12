# FlowManga v2.3.0 Release Notes

Welcome to FlowManga v2.3.0! This release brings significant under-the-hood optimization, polished UX mechanics, advanced ambient integration, and robust metadata handling.

## ✨ New Features & Enhancements
- **Ambient Audio Expansion**: Offline audio integration has been upgraded! The engine now seamlessly parses obfuscated local ambient tracks via smart manifests while expanding format compatibility, creating a deeper, more cohesive reading atmosphere.
- **Search Optimization**: Say goodbye to UI stutter! Both the global command search and local library searches have been re-engineered with input debouncing. Searching through massive libraries now feels buttery smooth.
- **Unified Modals & Navigation**: We’ve strictly enforced bounding limits, ensuring crucial overlays like the `ImportModal` and `SettingsModal` never escape smaller viewports or collide. Transitions have been cut down by 50% (from 700ms to 300ms) for punchy, immediate feedback.
- **SmartImage Upgrades**: The core rendering engine for `SmartImage` now gracefully handles canvas processing with standardized bezier fade-ins, dramatically reducing visual jarring when transitioning between reading layers.
- **Consistent Visual Language**: Standardized typographic tracking tokens (`tracking-widest`) across all core elements. The result is a much sharper, perfectly aligned aesthetic across headers, buttons, and badges.

## 🐛 Fixes & Improvements
- Addressed potential z-index collisions between the Command Palette, Toast notifications, and the downloading panel.
- Enhanced Danbooru provider logic to handle complex search queries more gracefully.
- Improved the resilience of the WebNovel scraper integrations.
