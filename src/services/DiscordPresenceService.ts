export interface DiscordReadingContext {
  title?: string;
  chapter?: string;
  pageIndex: number;
  totalPages: number;
  shareTitle: boolean;
  shareProgress: boolean;
  showElapsedTime: boolean;
  startedAt: number;
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

export const FLOWMANGA_DISCORD_APPLICATION_ID = "1530083735691722833";
export const FLOWMANGA_DISCORD_LARGE_IMAGE =
  "https://raw.githubusercontent.com/Djonluc/flowmanga/main/public/logo_square.png";
export const FLOWMANGA_DISCORD_SMALL_IMAGE =
  "https://raw.githubusercontent.com/Djonluc/flowmanga/main/src-tauri/icons/128x128.png";

const discordText = (value: string) =>
  Array.from(value.trim()).slice(0, 128).join("");

export function buildDiscordReadingActivity(
  applicationId: string,
  context: DiscordReadingContext,
): DiscordActivityPayload {
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
    applicationId,
    details,
    state: progress.length > 0 ? progress.join(" • ") : "Reading in FlowManga",
    largeImage: FLOWMANGA_DISCORD_LARGE_IMAGE,
    largeText: "FlowManga — Read. Discover. Flow.",
    smallImage: FLOWMANGA_DISCORD_SMALL_IMAGE,
    smallText: "Reading with FlowManga",
    ...(context.showElapsedTime
      ? { startTimestamp: Math.floor(context.startedAt / 1000) }
      : {}),
  };
}
