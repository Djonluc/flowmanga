import { describe, expect, it } from "vitest";
import { resolveMangaArchivePath, stableSeriesId } from "./mangaStorage";

describe("manga storage", () => {
  it("uses the primary archive path before the legacy download path", () => {
    expect(resolveMangaArchivePath("D:\\Manga", "C:\\Old")).toBe("D:\\Manga");
  });

  it("keeps the legacy path for upgraded installations without a library path", () => {
    expect(resolveMangaArchivePath(null, "C:\\FlowManga")).toBe("C:\\FlowManga");
  });

  it("creates stable, distinct IDs for local downloads", () => {
    const first = stableSeriesId("local", "https://example.test/series/one");
    expect(first).toBe(stableSeriesId(undefined, "https://example.test/series/one"));
    expect(first).not.toBe(stableSeriesId("local", "https://example.test/series/two"));
  });
});
