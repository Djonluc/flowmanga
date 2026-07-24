# FlowManga Deployment

## Local checks

Run these commands from the repository root:

```bash
npm ci
npm run typecheck
npm run vite-build
cargo check --manifest-path src-tauri/Cargo.toml
```

The full ESLint pass is currently too noisy for release gating because older files still contain `any` usage and unused catch variables. Keep lint cleanup incremental and do not skip the typecheck or native Rust check.

## Publishing a Windows release

1. Update `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` to the same version.
2. Update `RELEASE_NOTES.md` with short, user-facing notes.
3. Run the local checks above.
4. Commit the changes and create a matching tag:

```bash
git add .
git commit -m "chore: release v2.6.0"
git tag v2.6.0
git push origin main --follow-tags
```

The tag starts `.github/workflows/release.yml`. GitHub Actions builds the Windows NSIS installer, uses the Tauri icon files from `src-tauri/icons`, and publishes the installer to the [FlowManga GitHub release](https://github.com/Djonluc/flowmanga/releases) Assets section.

## Installer identity

The desktop installer and the application window use the icon files configured in `src-tauri/tauri.conf.json`. The browser tab uses `public/logo_square.png`, which is the same FlowManga mark.
# Discord Rich Presence branding

Discord Rich Presence ships with FlowManga's developer-owned public Application ID and branded artwork already bundled. End users only choose whether presence is enabled and which reading details they share; they never configure the Discord application identity.
