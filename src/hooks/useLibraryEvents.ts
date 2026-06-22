import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useVideoStore } from '../stores/useVideoStore';
import { useReadingStore } from '../stores/useReadingStore';
import { useSettingsStore } from '../stores/useSettingsStore';

export const useLibraryEvents = () => {
  const { loadFromDb, addMangaFolder } = useLibraryStore();
  const { addFolder } = useVideoStore();
  const { openFolder } = useReadingStore();
  const { setActiveView } = useSettingsStore();

  useEffect(() => {
    let unlistenOpenPath: (() => void) | undefined;
    let unlistenUpdate: (() => void) | undefined;
    let unlistenEnriched: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenOpenPath = await listen<string>('open-path', async (event) => {
        const path = event.payload;
        // console.log('[Native] Received open-path:', path);

        try {
          const lowerPath = path.toLowerCase();
          const isVideo = lowerPath.endsWith('.mp4') || lowerPath.endsWith('.mkv') || lowerPath.endsWith('.avi') || lowerPath.endsWith('.webm');

          if (isVideo) {
            const parentPath = path.includes('\\') ? path.substring(0, path.lastIndexOf('\\')) : path;
            await addFolder(parentPath);
            setActiveView('videos');
          } else {
            await addMangaFolder(path);
            setActiveView('library');
            await openFolder(path);
          }
        } catch (err) {
          console.error('[Native] Failed to auto-import path:', err);
        }
      });

      unlistenUpdate = await listen('library:updated', async () => {
        // console.log('[Native] Library updated event received');
        await loadFromDb();
      });

      unlistenEnriched = await listen('library-metadata-enriched', async () => {
        // console.log('[Native] Metadata enriched event received');
        await loadFromDb();
      });
    };

    setupListeners();

    return () => {
      unlistenOpenPath?.();
      unlistenUpdate?.();
      unlistenEnriched?.();
    };
  }, [addMangaFolder, addFolder, openFolder, setActiveView, loadFromDb]);
};
