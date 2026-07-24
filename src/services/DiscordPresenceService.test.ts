import { describe, expect, it } from "vitest";
import {
  buildDiscordIdleActivity,
  buildDiscordReadingActivity,
  FLOWMANGA_DISCORD_APPLICATION_ID,
  isDiscordAdultContent,
} from "./DiscordPresenceService";

describe("DiscordPresenceService", () => {
  it("builds title, chapter, page, and elapsed-time presence", () => {
    expect(
      buildDiscordReadingActivity({
        title: "Example Manga",
        chapter: "Chapter 4",
        pageIndex: 6,
        totalPages: 24,
        shareTitle: true,
        shareProgress: true,
        showElapsedTime: true,
        startedAt: 10_000,
      }),
    ).toEqual({
      applicationId: FLOWMANGA_DISCORD_APPLICATION_ID,
      details: "Reading Example Manga",
      state: "Chapter 4 • Page 7 of 24",
      startTimestamp: 10,
      largeImage:
        "https://raw.githubusercontent.com/Djonluc/flowmanga/main/public/logo_square.png",
      largeText: "FlowManga — Read. Discover. Flow.",
    });
  });

  it("does not leak title or progress when privacy controls are disabled", () => {
    expect(
      buildDiscordReadingActivity({
        title: "Private Title",
        chapter: "Private Chapter",
        pageIndex: 10,
        totalPages: 20,
        shareTitle: false,
        shareProgress: false,
        showElapsedTime: false,
        startedAt: 10_000,
      }),
    ).toMatchObject({
      details: "Reading manga",
      state: "Reading in FlowManga",
    });
  });

  it("uses an in-theme ambient presence while no manga is open", () => {
    expect(buildDiscordIdleActivity(10_000)).toMatchObject({
      applicationId: FLOWMANGA_DISCORD_APPLICATION_ID,
      details: "Between story arcs",
      state: "Charting the next realm",
      startTimestamp: 10,
    });
  });

  it("never exposes adult titles, chapters, or page progress", () => {
    const activity = buildDiscordReadingActivity({
      title: "Private Explicit Title",
      chapter: "Private Chapter 8",
      pageIndex: 12,
      totalPages: 30,
      shareTitle: true,
      shareProgress: true,
      showElapsedTime: true,
      startedAt: 10_000,
      isAdultContent: true,
    });

    expect(activity).toMatchObject({
      details: "Reading a secret side story",
      state: "The after-hours arc has begun",
      startTimestamp: 10,
    });
    expect(JSON.stringify(activity)).not.toContain("Private");
    expect(JSON.stringify(activity)).not.toContain("Page 13");
  });

  it("detects explicit ratings, adult-only sources, tags, and titles", () => {
    expect(isDiscordAdultContent({ rating: "explicit" })).toBe(true);
    expect(isDiscordAdultContent({ source: "E-Hentai" })).toBe(true);
    expect(isDiscordAdultContent({ tags: ["full_color", "hentai"] })).toBe(true);
    expect(isDiscordAdultContent({ title: "A quiet fantasy adventure" })).toBe(
      false,
    );
  });

  it("does not hide titles for mature or questionable mainstream manga", () => {
    expect(
      isDiscordAdultContent({
        source: "MangaDex",
        rating: "mature",
        tags: ["mature", "psychological"],
      }),
    ).toBe(false);
    expect(
      isDiscordAdultContent({
        source: "AniList",
        rating: "questionable",
        tags: ["drama"],
      }),
    ).toBe(false);
  });
});
