import { describe, expect, it } from "vitest";
import {
  ensureExplicitSourceTag,
  isExplicitAdultSource,
} from "./AdultContentClassification";

describe("AdultContentClassification", () => {
  it("adds a hentai tag to downloads from explicitly adult sources", () => {
    expect(
      ensureExplicitSourceTag(["full_color"], "https://e-hentai.org/g/123/abc"),
    ).toEqual(["full_color", "hentai"]);
    expect(ensureExplicitSourceTag([], "nhentai.net")).toEqual(["hentai"]);
    expect(ensureExplicitSourceTag([], "hentaicomicsfree.com")).toEqual([
      "hentai",
    ]);
  });

  it("does not classify mature mainstream manga as explicit by source", () => {
    expect(isExplicitAdultSource("mangadex", "https://mangadex.org/title/1")).toBe(
      false,
    );
    expect(ensureExplicitSourceTag(["mature"], "mangadex")).toEqual(["mature"]);
  });
});
