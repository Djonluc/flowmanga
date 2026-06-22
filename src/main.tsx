import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initDatabase } from './services/db'
import { MangaIntelligenceService } from './services/manga-intelligence/MangaIntelligenceService'
import { useSettingsStore } from './stores/useSettingsStore'
import { useLibraryStore } from './stores/useLibraryStore'
import { useGalleryStore } from './stores/useGalleryStore'
import { AppVersionService } from './services/AppVersionService'

// Initialize the root early to show a loading state immediately
const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

const init = async () => {
  try {
    // 1. Initialize SQLite Database
    await initDatabase();
    
    // Seed Manga Intelligence taxonomy
    await MangaIntelligenceService.seedTaxonomyIfEmpty();
    await MangaIntelligenceService.mapHistoricalData();
    
    // 2. Preload Library State and Collections
    await useLibraryStore.getState().loadFromDb();
    await useGalleryStore.getState().loadFromDb();
    
    // 3. Notify the app that initialisation is complete
    useSettingsStore.getState().setInitializing(false);

    // 4. Background version check (non-blocking, fire-and-forget)
    setTimeout(async () => {
      try {
        const { setUpdateInfo, setUpdateStatus } = useSettingsStore.getState();
        setUpdateStatus('checking');
        const info = await AppVersionService.checkForUpdates();
        setUpdateInfo(info);
        AppVersionService.startBackgroundCheck();
      } catch (_) {
        useSettingsStore.getState().setUpdateStatus('error');
      }
    }, 3000); // wait 3s after startup so it doesn't interfere with init
  } catch (err) {
    console.error('Failed to initialize application:', err);
    // Even if it fails, we should stop the loading state so the error can be shown or handled
    useSettingsStore.getState().setInitializing(false);
  }
};

init();
