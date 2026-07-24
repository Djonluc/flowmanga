export interface DiscordReadingContext {
  title?: string;
  chapter?: string;
  pageIndex: number;
  totalPages: number;
  shareTitle: boolean;
  shareProgress: boolean;
  showElapsedTime: boolean;
  startedAt: number;
  isAdultContent?: boolean;
}

export interface DiscordContentIdentity {
  title?: string;
  source?: string;
  rating?: string;
  tags?: string[];
}

export interface DiscordActivityPayload {
  applicationId: string;
  details: string;
  state: string;
  startTimestamp?: number;
  largeImage?: string;
  largeText?: string;
  smallImage?: string;
  smallText?: string;
}

// Developer-owned FlowManga Discord application. This is public app metadata,
// not a user credential or client secret.
export const FLOWMANGA_DISCORD_APPLICATION_ID = "1530083735691722833";
export const FLOWMANGA_DISCORD_LARGE_IMAGE =
  "https://raw.githubusercontent.com/Djonluc/flowmanga/main/public/logo_square.png";

const discordText = (value: string) =>
  Array.from(value.trim()).slice(0, 128).join("");

const adultSignals = [
  "18+",
  "adult",
  "erotica",
  "erotic",
  "explicit",
  "hentai",
  "mature",
  "nsfw",
  "porn",
  "smut",
];

export function isDiscordAdultContent(
  content: DiscordContentIdentity,
): boolean {
  const rating = String(content.rating || "").toLowerCase();
  if (
    ["adult", "explicit", "questionable", "mature", "18+", "e", "q"].includes(
      rating,
    )
  ) {
    return true;
  }

  const source = String(content.source || "").toLowerCase();
  if (
    ["e-hentai", "ehentai", "nhentai", "rule34", "rule 34"].some((signal) =>
      source.includes(signal),
    )
  ) {
    return true;
  }

  const searchableText = [content.title, ...(content.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return adultSignals.some((signal) => searchableText.includes(signal));
}

const commonArtwork = {
  largeImage: FLOWMANGA_DISCORD_LARGE_IMAGE,
  largeText: "FlowManga — Read. Discover. Flow.",
};

export function buildDiscordIdleActivity(
  startedAt: number,
): DiscordActivityPayload {
  return {
    applicationId: FLOWMANGA_DISCORD_APPLICATION_ID,
    details: "Between story arcs",
    state: "Charting the next realm",
    startTimestamp: Math.floor(startedAt / 1000),
    ...commonArtwork,
  };
}

export function buildDiscordReadingActivity(
  context: DiscordReadingContext,
): DiscordActivityPayload {
  if (context.isAdultContent) {
    return {
      applicationId: FLOWMANGA_DISCORD_APPLICATION_ID,
      details: "Reading a secret side story",
      state: "The after-hours arc has begun",
      ...commonArtwork,
      ...(context.showElapsedTime
        ? { startTimestamp: Math.floor(context.startedAt / 1000) }
        : {}),
    };
  }

  const details =
    context.shareTitle && context.title
      ? discordText(`Reading ${context.title}`)
      : "Reading manga";

  const progress: string[] = [];
  if (context.shareProgress) {
    if (context.chapter) progress.push(discordText(context.chapter));
    if (context.totalPages > 0) {
      const currentPage = Math.min(
        Math.max(context.pageIndex + 1, 1),
        context.totalPages,
      );
      progress.push(`Page ${currentPage} of ${context.totalPages}`);
    }
  }

  return {
    applicationId: FLOWMANGA_DISCORD_APPLICATION_ID,
    details,
    state: progress.length > 0 ? progress.join(" • ") : "Reading in FlowManga",
    ...commonArtwork,
    ...(context.showElapsedTime
      ? { startTimestamp: Math.floor(context.startedAt / 1000) }
      : {}),
  };
}
