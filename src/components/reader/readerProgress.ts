export function getVisibleChapterMarks(
  chapters: Array<{ startIndex?: number }> | undefined,
  totalPages: number,
  isFlatMode: boolean,
): number[] {
  if (!isFlatMode || !chapters || totalPages <= 0) return [0];

  const validMarks = Array.from(
    new Set(
      chapters
        .map((chapter) => chapter.startIndex)
        .filter(
          (index): index is number =>
            index !== undefined &&
            Number.isFinite(index) &&
            index >= 0 &&
            index < totalPages,
        ),
    ),
  ).sort((a, b) => a - b);

  // Large merged libraries can contain thousands of chapter boundaries.
  // Keep the guide readable without reducing click/drag seek precision.
  const maximumVisibleMarks = 64;
  if (validMarks.length <= maximumVisibleMarks) return validMarks;

  return Array.from({ length: maximumVisibleMarks }, (_, index) => {
    const sourceIndex = Math.round(
      (index * (validMarks.length - 1)) / (maximumVisibleMarks - 1),
    );
    return validMarks[sourceIndex];
  }).filter((mark, index, marks) => index === 0 || mark !== marks[index - 1]);
}
