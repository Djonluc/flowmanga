const PLACEHOLDER_IDS = new Set(["", "local", "unknown", "undefined", "null"]);

export function resolveMangaArchivePath(
  libraryPath: string | null | undefined,
  legacyDownloadPath: string | null | undefined,
): string | null {
  const primary = libraryPath?.trim();
  if (primary) return primary;

  const legacy = legacyDownloadPath?.trim();
  return legacy || null;
}

export function stableSeriesId(
  explicitId: unknown,
  identity: string,
): string {
  const candidate = String(explicitId ?? "").trim();
  if (!PLACEHOLDER_IDS.has(candidate.toLowerCase())) return candidate;

  // A deterministic ID lets an update find the same downloaded series while
  // preventing unrelated locally scraped manga from all sharing the old
  // placeholder ID "local".
  let hash = 0x811c9dc5;
  for (const character of identity.trim().toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `local-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
