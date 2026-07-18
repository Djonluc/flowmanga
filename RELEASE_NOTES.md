## FlowManga 2.5.0

This update improves image discovery, source reliability, Sankaku support, and downloading.

### New Features

- Image feeds now refresh more smoothly and keep your scroll position while loading more results.
- Discovery and For You recommendations are more varied and less likely to repeat the same source, artist, or character.
- Rule34 and Danbooru metadata now separate artists, characters, and other tag types more accurately.
- Broken thumbnails and protected source images retry automatically when possible.
- Sankaku image and book sessions now share one login, including protected book covers and pages.
- Sankaku Books can be downloaded through the normal manga download flow and appear in the manga library.
- Search exclusions are applied consistently across image discovery, collections, and federated search.

### Bug Fixes

- Fixed refreshes that left tabs scrolled away from the newest results.
- Fixed continuous loading that could move the page or leave masonry gaps around tall images.
- Fixed Sankaku book links with alphanumeric IDs such as `nQyMkLpKakm`.
- Failed download pages now retry and report a failed job instead of silently completing.

### Installing

Download the Windows setup file from the Assets section below and run it. Your library and settings are preserved during an update.
