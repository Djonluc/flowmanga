export function normalizeExcludedTags(tags: string[] = []): string[] {
  return Array.from(new Set(
    tags
      .map(tag => tag.toLowerCase().trim().replace(/\s+/g, ' '))
      .filter(Boolean),
  ));
}

export function mergeExcludedTags(...tagLists: string[][]): string[] {
  return normalizeExcludedTags(tagLists.flat());
}

function comparableTag(value: string): string {
  return value.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function hasExcludedTag(tags: string[] = [], excludedTags: string[] = []): boolean {
  const normalizedTags = new Set(tags.flatMap(tag => {
    const normalized = comparableTag(tag);
    const namespaceSeparator = normalized.indexOf(':');
    // E-Hentai exposes namespaced tags (for example `female:tag` and
    // `parody:title`). A user's plain `tag` blacklist should still match the
    // value, while a namespaced blacklist remains precise.
    return namespaceSeparator > 0
      ? [normalized, normalized.slice(namespaceSeparator + 1).trim()]
      : [normalized];
  }));
  return normalizeExcludedTags(excludedTags).map(comparableTag)
    .some(excluded => normalizedTags.has(excluded));
}

export function hasExcludedText(text: string | undefined, excludedTags: string[] = []): boolean {
  const normalizedText = comparableTag(text || '');
  return normalizeExcludedTags(excludedTags)
    .map(comparableTag)
    .some(excluded => normalizedText.includes(excluded));
}
