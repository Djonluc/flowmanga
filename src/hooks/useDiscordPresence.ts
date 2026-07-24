import { useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLibraryStore } from "../stores/useLibraryStore";
import { useReadingStore } from "../stores/useReadingStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { buildDiscordReadingActivity } from "../services/DiscordPresenceService";

const validApplicationId = (value: string) => /^\d{17,20}$/.test(value);

export function useDiscordPresence() {
  const enabled = useSettingsStore((state) => state.discordRichPresenceEnabled);
  const applicationId = useSettingsStore((state) => state.discordApplicationId);
  const shareTitle = useSettingsStore((state) => state.discordShareMangaTitle);
  const shareProgress = useSettingsStore((state) => state.discordShareReadingProgress);
  const showElapsedTime = useSettingsStore((state) => state.discordShowElapsedTime);

  const seriesId = useReadingStore((state) => state.seriesId);
  const metadata = useReadingStore((state) => state.metadata);
  const chapters = useReadingStore((state) => state.chapters);
  const currentChapterIndex = useReadingStore((state) => state.currentChapterIndex);
  const pageIndex = useReadingStore((state) => state.currentPageIndex);
  const totalPages = useReadingStore((state) => state.images.length);
  const series = useLibraryStore((state) =>
    seriesId ? state.series.find((item) => item.id === seriesId) : undefined,
  );

  const sessionKey = `${seriesId || metadata?.mangaId || metadata?.title || "reader"}`;
  const session = useRef<{ key: string; startedAt: number } | null>(null);

  const chapter = useMemo(() => {
    const flatChapter = metadata?.chapters?.[currentChapterIndex];
    if (flatChapter) {
      return flatChapter.title || `Chapter ${flatChapter.number}`;
    }
    return chapters[currentChapterIndex]?.title;
  }, [chapters, currentChapterIndex, metadata]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!enabled || !validApplicationId(applicationId) || totalPages === 0) {
        await invoke("clear_discord_presence").catch(() => undefined);
        return;
      }

      if (!session.current || session.current.key !== sessionKey) {
        session.current = { key: sessionKey, startedAt: Date.now() };
      }
      const payload = buildDiscordReadingActivity(applicationId, {
        title: series?.displayName || series?.title || metadata?.displayTitle || metadata?.title,
        chapter,
        pageIndex,
        totalPages,
        shareTitle,
        shareProgress,
        showElapsedTime,
        startedAt: session.current.startedAt,
      });

      try {
        await invoke("set_discord_presence", { input: payload });
      } catch (error) {
        if (!cancelled) {
          console.debug("[DiscordPresence] Discord desktop connection unavailable:", error);
        }
      }
    }, 750);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    applicationId,
    chapter,
    enabled,
    metadata?.displayTitle,
    metadata?.title,
    pageIndex,
    series?.displayName,
    series?.title,
    sessionKey,
    shareProgress,
    shareTitle,
    showElapsedTime,
    totalPages,
  ]);

  useEffect(
    () => () => {
      void invoke("clear_discord_presence").catch(() => undefined);
    },
    [],
  );
}
