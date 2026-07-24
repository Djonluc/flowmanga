const explicitAdultSourceSignals = [
  "e-hentai",
  "ehentai",
  "hentai",
  "hitomi.la",
  "luscious",
  "nhentai",
  "rule34",
  "rule 34",
];

export function isExplicitAdultSource(
  ...sourceValues: Array<string | undefined | null>
): boolean {
  const identity = sourceValues.filter(Boolean).join(" ").toLowerCase();
  return explicitAdultSourceSignals.some((signal) => identity.includes(signal));
}

export function ensureExplicitSourceTag(
  tags: string[] | undefined,
  ...sourceValues: Array<string | undefined | null>
): string[] {
  const normalizedTags = Array.from(
    new Set((tags || []).map((tag) => String(tag).trim()).filter(Boolean)),
  );

  if (
    isExplicitAdultSource(...sourceValues) &&
    !normalizedTags.some((tag) => tag.toLowerCase() === "hentai")
  ) {
    normalizedTags.push("hentai");
  }

  return normalizedTags;
}
