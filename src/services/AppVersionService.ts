/**
 * AppVersionService
 *
 * Checks the GitHub releases API for the latest version of FlowManga.
 * Compares against the current installed version from package.json.
 * Caches results and persists dismissal state to localStorage.
 */

const CURRENT_VERSION = "2.3.1";
const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/Djonluc/flowmamga/releases/latest";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LS_KEY = "flowmanga_update_state";

export interface ReleaseNote {
  category:
    | "features"
    | "improvements"
    | "fixes"
    | "performance"
    | "ui"
    | "sources"
    | "other";
  text: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  downloadUrl: string;
  releaseUrl: string;
  notes: ReleaseNote[];
  isNewer: boolean;
}

interface PersistedState {
  dismissedVersion: string | null;
  lastChecked: string | null;
  previousVersion: string | null;
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { dismissedVersion: null, lastChecked: null, previousVersion: null };
}

function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (_) {}
}

/**
 * Parse GitHub release markdown body into categorized release notes.
 * Looks for heading markers like ### New Features, ### Bug Fixes, etc.
 */
function parseReleaseNotes(body: string): ReleaseNote[] {
  const notes: ReleaseNote[] = [];
  if (!body) return notes;

  const categoryMap: Record<string, ReleaseNote["category"]> = {
    "new feature": "features",
    "new features": "features",
    feature: "features",
    features: "features",
    improvement: "improvements",
    improvements: "improvements",
    "bug fix": "fixes",
    "bug fixes": "fixes",
    fix: "fixes",
    fixes: "fixes",
    performance: "performance",
    ui: "ui",
    ux: "ui",
    "ui / ux": "ui",
    "ui/ux": "ui",
    source: "sources",
    sources: "sources",
    "source support": "sources",
  };

  let currentCategory: ReleaseNote["category"] = "other";
  const lines = body.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect headings like ## New Features or ### Bug Fixes
    const headingMatch = line.match(/^#{1,4}\s+(.+)/);
    if (headingMatch) {
      const headingText = headingMatch[1].toLowerCase().trim();
      currentCategory = categoryMap[headingText] ?? "other";
      continue;
    }

    // Bullet points
    const bulletMatch = line.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      notes.push({ category: currentCategory, text: bulletMatch[1].trim() });
    }
  }

  return notes;
}

/**
 * Compares two semver strings. Returns true if `latest` is newer than `current`.
 */
function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [cMaj, cMin, cPatch] = parse(current);
  const [lMaj, lMin, lPatch] = parse(latest);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

class AppVersionServiceClass {
  private cachedInfo: UpdateInfo | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  getCurrentVersion(): string {
    return CURRENT_VERSION;
  }

  getPersistedState(): PersistedState {
    return loadPersistedState();
  }

  /**
   * Fetch the latest release from GitHub.
   * Returns UpdateInfo or null on failure.
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      const response = await fetch(GITHUB_RELEASES_URL, {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const data = await response.json();
      const latestVersion = (data.tag_name || "").replace(/^v/, "");
      const notes = parseReleaseNotes(data.body || "");
      const releaseDate = data.published_at
        ? new Date(data.published_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "";

      // Find the Windows installer asset
      const assets: any[] = data.assets || [];
      const windowsAsset = assets.find(
        (a: any) =>
          a.name?.toLowerCase().includes("setup") ||
          a.name?.toLowerCase().endsWith(".exe") ||
          a.name?.toLowerCase().endsWith(".msi"),
      );

      const info: UpdateInfo = {
        currentVersion: CURRENT_VERSION,
        latestVersion,
        releaseDate,
        downloadUrl: windowsAsset?.browser_download_url || data.html_url || "",
        releaseUrl:
          data.html_url ||
          `https://github.com/Djonluc/flowmamga/releases/latest`,
        notes,
        isNewer: isNewerVersion(CURRENT_VERSION, latestVersion),
      };

      this.cachedInfo = info;

      // Persist last checked timestamp
      const state = loadPersistedState();
      state.lastChecked = new Date().toISOString();
      savePersistedState(state);

      return info;
    } catch (err) {
      console.warn(
        "[AppVersionService] Update check failed (non-blocking):",
        err,
      );
      return null;
    }
  }

  getCachedInfo(): UpdateInfo | null {
    return this.cachedInfo;
  }

  getLastChecked(): string | null {
    return loadPersistedState().lastChecked;
  }

  getDismissedVersion(): string | null {
    return loadPersistedState().dismissedVersion;
  }

  /** Mark a version as "remind me later" so the modal doesn't auto-show for it. */
  dismissVersion(version: string) {
    const state = loadPersistedState();
    state.dismissedVersion = version;
    savePersistedState(state);
  }

  /** Clear a previously dismissed version (e.g. user clicked Check for Updates again). */
  clearDismissal() {
    const state = loadPersistedState();
    state.dismissedVersion = null;
    savePersistedState(state);
  }

  /** Open the GitHub releases page or direct download in the system browser. */
  async openDownloadPage(url?: string) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url || `https://github.com/Djonluc/flowmamga/releases/latest`);
    } catch (err) {
      console.error("[AppVersionService] Failed to open browser:", err);
    }
  }

  /** Start background polling every 24h. Safe to call multiple times. */
  startBackgroundCheck() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.checkForUpdates().then((info) => {
        if (info?.isNewer) {
          // Notify the store so the UI can react
          import("../stores/useSettingsStore").then(({ useSettingsStore }) => {
            useSettingsStore.getState().setUpdateInfo(info);
          });
        }
      });
    }, CHECK_INTERVAL_MS);
  }
}

export const AppVersionService = new AppVersionServiceClass();
