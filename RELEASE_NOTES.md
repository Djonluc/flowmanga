## FlowManga 2.5.8 Provider and Download Reliability Hotfix

FlowManga 2.5.8 addresses the recoverable application errors identified in recent diagnostics and reduces repeated requests against unavailable providers.

### Fixes

- Automation and update checks no longer crash when a provider returns partial series data without a chapter array.
- Manga downloads now reject loading indicators, comment placeholders, SVGs, icons, and other non-page assets.
- ManhuaPlus filters invalid page assets during extraction and the downloader validates them again before saving.
- Rule34 pauses further requests after saved API credentials are rejected and resumes automatically when those credentials change.
- Zerochan enters a short cooldown after invalid HTML, 404, or blocked responses instead of flooding the source with retries.
- Terminal HTTP 400, 401, 403, and 404 responses no longer receive retries that cannot succeed.
- Added regression coverage for malformed series results and download-page validation.

### Installing

Download `FlowManga_2.5.8_x64-setup.exe` from the GitHub release assets. Existing downloads, settings, paths, and library metadata are preserved.

---

## FlowManga 2.5.7 Windows Local Media Hotfix

FlowManga 2.5.7 completes the installed-app fix for downloaded manga that could be located on disk but whose covers and pages were blocked inside the reader.

### Fixes

- Allowed WebView2's Windows local-media origin, `http://asset.localhost`, in the installed application's image and media Content Security Policy.
- Existing downloaded covers, chapter pages, local videos, and other library media can now load through Tauri's protected asset bridge.
- No folder changes, rescans, or repeat downloads are required after installing the update.

### Installing

Download `FlowManga_2.5.7_x64-setup.exe` from the GitHub release assets. Existing downloads, settings, paths, and library metadata are preserved.

---

## FlowManga 2.5.6 Local Library Display Hotfix

FlowManga 2.5.6 restores covers and chapter pages for downloaded manga that are present on disk but appeared missing inside the installed application.

### Fixes

- Fixed Tauri local-file images being rejected by WebView2 because the image renderer incorrectly applied remote CORS rules to `asset.localhost` URLs.
- Existing downloaded covers and chapter pages now display without moving, renaming, or downloading the files again.
- Diagnostics exports now report the installed package version instead of the stale hard-coded `2.5.3` value.
- Added regression tests covering Tauri local assets, remote-image CORS behavior, and diagnostic version reporting.

### Installing

Download `FlowManga_2.5.6_x64-setup.exe` from the GitHub release assets. Existing downloads, folder paths, settings, and library metadata are preserved.

---

## FlowManga 2.5.5 Folder Indexing Hotfix

FlowManga 2.5.5 repairs installed-build folder discovery when manga or image-collection storage is moved or reselected.

### Fixes

- Changing the Manga Archive path now immediately scans the selected folder and refreshes the library.
- Manga discovery now supports nested layouts such as `Library/Manga/Series` instead of checking only one directory level.
- Changing the Image Collections path now recursively scans images, GIFs, and videos and refreshes My Collection.
- Existing provider downloads are relinked after a folder move; previously unknown local media is imported with a stable identity.
- Nested image directories are represented as collection albums and local album covers load from their real filesystem paths.
- Rebuild Index now runs the manga scanner only on manga storage and the media scanner only on image collections.
- Custom folders outside Documents or Pictures, including folders on another drive, are validated through the native backend.
- Index failures now include the actual folder or scanner error instead of only displaying a generic failure message.

### Installing

Download `FlowManga_2.5.5_x64-setup.exe` from the GitHub release assets. Existing settings and library metadata are preserved. After updating, reselect either storage path or use Settings → General → Rebuild Index once.

---

## FlowManga 2.5.4

FlowManga 2.5.4 completes the reliability, privacy, accessibility, and maintainability work identified in the application audit.

### Reliability and data safety

- Added numbered, transactional database migrations with automatic database backup before schema changes.
- Added full library and settings export/restore without exporting credentials.
- Added AES-256-GCM password-encrypted device-transfer packages.
- Added download-integrity checks, missing-file repair tools, and exact/perceptual duplicate management.
- Added a first-run wizard for folders, content safety, and source selection.

### Providers and diagnostics

- Consolidated Gallery Hub onto the canonical visual-media providers so authentication, pagination, filtering, and media mapping no longer diverge between duplicate implementations.
- Added per-source request spacing, retries, schedules, status reporting, and last-error diagnostics.
- Added structured Error, Warning, Info, Debug, and Trace logging with opt-in troubleshooting and sanitized diagnostic export.

### Security and accessibility

- Enabled a Tauri content security policy, reduced network capability scope to HTTPS, and rejected private, local, credential-bearing, and insecure remote URLs in the Rust proxy layer.
- Removed unused broad shell capability while retaining safe external-link opening.
- Added focus trapping and restoration, Escape behavior, visible keyboard focus, reduced-motion support, labels, media alternatives, and keyboard operation for readers, cards, menus, and dialogs.

### Performance and release quality

- Lazy-loaded major application views and Settings panels and split major third-party dependencies into stable production chunks.
- Added 26 frontend tests and 3 Rust security tests.
- Added CI quality checks and release verification for tests, packaged audio, desktop startup, and SHA-256 installer checksums.

### Installing

Download `FlowManga_2.5.4_x64-setup.exe` from the GitHub release assets and run it. Existing libraries, downloads, settings, provider sessions, and application preferences are preserved.

---

## FlowManga 2.5.3 Hotfix

FlowManga 2.5.3 fixes fullscreen behavior in installed Windows builds, improves the Paper theme, makes image details fit compact displays, and strengthens Sankaku session and media recovery.

### Fixes and improvements

- Fixed a white or taskbar-sized strip appearing beneath the reader in fullscreen.
- Fullscreen is now confirmed by the native window before the app changes its layout, with an automatic retry when needed.
- Fullscreen and maximized dimensions are no longer saved as the normal window size.
- The document and application shell remain pinned to every WebView edge during Windows fullscreen transitions.
- Image details now use a responsive metadata panel with independent scrolling and compact-height spacing.
- Long tags and action labels no longer push controls outside the available space.
- Improved Paper-theme backgrounds, surfaces, borders, text, placeholders, focus states, tag colors, and controls.
- Sankaku media Retry now requests fresh post metadata and a new signed media link instead of reusing a failed URL.
- Sankaku now distinguishes “saved session needs verification” from “sign in required.”

### Installing

Download `FlowManga_2.5.3_x64-setup.exe` from the Assets section and run it. Existing libraries, downloads, settings, and provider sessions are preserved.

If Sankaku reports that the saved session needs verification, open Settings → Sources, select Sankaku, and use Verify Session. Recapture the session only if Sankaku rejects it.
