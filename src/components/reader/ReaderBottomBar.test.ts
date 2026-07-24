import { describe, expect, it } from "vitest";
import { getVisibleChapterMarks } from "./readerProgress";

describe("getVisibleChapterMarks", () => {
  it("bounds and samples markers for very large flattened libraries", () => {
    const chapters = Array.from({ length: 20_000 }, (_, startIndex) => ({
      startIndex,
    }));
    chapters.push({ startIndex: 99_999 }, { startIndex: -1 });

    const marks = getVisibleChapterMarks(chapters, 19_846, true);

    expect(marks).toHaveLength(64);
    expect(marks[0]).toBe(0);
    expect(marks.at(-1)).toBe(19_845);
    expect(marks.every((mark) => mark >= 0 && mark < 19_846)).toBe(true);
  });

  it("keeps every valid marker for an ordinary book", () => {
    expect(
      getVisibleChapterMarks(
        [{ startIndex: 0 }, { startIndex: 20 }, { startIndex: 40 }],
        60,
        true,
      ),
    ).toEqual([0, 20, 40]);
  });
});
