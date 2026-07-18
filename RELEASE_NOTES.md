## FlowManga 2.6.0

FlowManga 2.6.0 is a major reliability and recommendation update for visual-media discovery, especially Sankaku Complex, Rule34, and Danbooru.

### Highlights

- Rebuilt Sankaku Latest around its live cursor feed so new posts and continuous pagination remain current.
- Improved Sankaku search, tag autocomplete, discovery, session handling, and detailed request diagnostics.
- Added streaming video playback for Sankaku and Rule34 with byte-range support and automatic fallback.
- Corrected video detection so MP4/WebM files are preferred over static poster thumbnails.
- Made the global Images, GIFs, and Videos selector enforce the selected media type across feeds.
- Expanded For You with editable themes, core and secondary tags, typed artist/character/series tags, exclusions, and a dedicated Sankaku tag.
- Sankaku For You now mixes 10% recent results with 90% randomized matching results to reduce repetition.

### Safety and privacy

- Adult-only preset themes and generated suggestions remain hidden unless Adult Content is enabled.
- Safe mode now filters provider autocomplete and learned suggestions consistently.
- Protected network errors redact API keys, tokens, passwords, and user identifiers.
- Access-gated Sankaku posts without usable media URLs are skipped instead of appearing as broken cards.

### Reliability fixes

- Restored Danbooru video proxy behavior after separating provider-specific streaming paths.
- Fixed Rule34 cards treating video poster images as the playable media.
- Fixed Sankaku pagination, stale first-page caching, alphanumeric post IDs, and richer post-detail hydration.
- Improved masonry continuous loading, empty states, scroll resets, retry behavior, and media diagnostics.
- Seen history now ranks results without permanently emptying small or slow-moving feeds.
- Blocked-tag logs identify the exclusions responsible for removed results.
- Sankaku image and Books access share authentication and session verification.

### Recommendation improvements

- Added configurable Broad, Strict, and Themed recommendation modes.
- Added editable built-in themes and a Custom Theme profile.
- Added required tags, favorite-tag support, exclusions, and source-aware query behavior.
- Balanced recommendations by source and related content while retaining recently viewed fallback candidates.

### Developer and release readiness

- Updated project documentation and corrected stale README links.
- Synchronized the desktop, Rust, npm, and lockfile versions at 2.6.0.
- Added accurate Cargo package metadata and resolved strict Clippy findings.
- Removed confirmed unused imports, values, and recommendation constants.

### Installing

Download the Windows setup file from the Assets section and run it. Existing libraries, downloads, and settings are preserved during an update.

Some Sankaku media requires a valid provider session. If restricted posts are missing, open Source Settings, recapture the Sankaku session, and use Verify Session.
