## FlowManga 2.5.2

FlowManga 2.5.2 is a reliability patch for live image feeds, Sankaku video playback, safety filtering, gallery navigation, packaged music, and the desktop layout.

### Highlights

- Latest keeps every source in chronological order, presents provider batches together, and continuously advances into older posts.
- Searches start with the newest matching posts and do not hide results merely because they were viewed before.
- Discovery and For You continue paging while avoiding recently repeated content.
- Safe mode now blocks explicit ratings, tags, titles, recommendation terms, and unsafe provider results more consistently.
- App-wide excluded tags have a cleaner chip editor and are separated from recommendation-only Interest Manager exclusions.
- Sankaku Latest uses the provider's date ordering and includes pending or unreviewed posts returned by its live feed.
- Sankaku videos resolve signed streams on demand, animate on hover or focus, and play through byte-range streaming in the detail viewer.
- Sankaku parent links and real multi-image groups now support direct navigation.
- Multi-image items display a Gallery badge before opening.
- Fullscreen sizing, compact-screen controls, sticky headers, theme contrast, and download-count placement have been improved.
- Bundled ambient music is correctly discovered in installed builds.
- WebView2 memory pressure is reduced by limiting video blobs, media caches, stream chunk sizes, and backend log volume.
- The manga home page no longer includes the Continue Reading panel.

### Installing

Download the Windows setup file from the Assets section and run it. Existing libraries, downloads, settings, and provider sessions are preserved during an update.

Some Sankaku media still depends on the permissions of the saved provider session. If restricted posts or videos are unavailable, open Source Settings, recapture the Sankaku session, and use Verify Session.
