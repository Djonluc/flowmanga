import { useEffect, useRef } from "react";
import { useReadingStore } from "../../stores/useReadingStore";
import { useReaderStore } from "../../stores/useReaderStore";

export const NovelReader = () => {
  const { chapterData } = useReadingStore();
  const { currentThemeColor } = useReaderStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // For novels, 'chapterData' should contain the text payload.
  // We need to fetch the current chapter's text from the store, but wait,
  // FlowManga's 'useReadingStore' currently sets 'images' array.
  // We added 'text' to SourceContent, but useReadingStore needs to surface it.
  
  // For now, let's assume chapterData has the text paragraphs if it's a novel.
  // We'll map through images if they are actually text? No, DownloadService/ScraperService 
  // will be updated to pass text correctly.

  // Let's use a temporary fallback if we pass text via `images` array for simplicity,
  // OR we should properly update useReadingStore to have a `text` array.
  
  // Actually, if we just pass the text paragraphs in `chapterData.text`?
  // Let's assume useReadingStore will be updated to expose `text: string[]`.
  const text = useReadingStore((state: any) => state.text) || [];

  useEffect(() => {
    // Reset scroll on chapter change
    if (containerRef.current) {
      containerRef.current.scrollTo(0, 0);
    }
  }, [text]);

  if (!text || text.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-foreground-muted">
        Loading novel content...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center py-20 px-4 scroll-smooth"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="max-w-2xl w-full flex flex-col gap-6 text-foreground/90 font-serif text-lg leading-relaxed md:text-xl md:leading-loose pb-32">
        {text.map((paragraph: string, i: number) => (
          <div
            key={i}
            dangerouslySetInnerHTML={{ __html: paragraph }}
            className="break-words"
          />
        ))}
      </div>
    </div>
  );
};
