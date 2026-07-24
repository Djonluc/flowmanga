import { describe, expect, it } from "vitest";
import { buildDiscordReadingActivity } from "./DiscordPresenceService";

describe("DiscordPresenceService", () => {
  it("builds title, chapter, page, and elapsed-time presence", () => {
    expect(
      buildDiscordReadingActivity("123456789012345678", {
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
      applicationId: "123456789012345678",
      details: "Reading Example Manga",
      state: "Chapter 4 • Page 7 of 24",
      startTimestamp: 10,
      largeImage: "https://raw.githubusercontent.com/Djonluc/flowmanga/main/public/logo_square.png",
      largeText: "FlowManga — Read. Discover. Flow.",
      smallImage: "https://raw.githubusercontent.com/Djonluc/flowmanga/main/src-tauri/icons/128x128.png",
      smallText: "Reading with FlowManga",
    });
  });

  it("does not leak title or progress when privacy controls are disabled", () => {
    expect(
      buildDiscordReadingActivity("123456789012345678", {
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
});
