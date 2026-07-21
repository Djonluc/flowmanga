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
