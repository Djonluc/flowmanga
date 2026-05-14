import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initDatabase } from './services/db'
import { useSettingsStore } from './stores/useSettingsStore'
import { useLibraryStore } from './stores/useLibraryStore'

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
    
    // 2. Preload Library State and Collections
    await useLibraryStore.getState().loadFromDb();
    
    // 3. Notify the app that initialisation is complete
    useSettingsStore.getState().setInitializing(false);
  } catch (err) {
    console.error('Failed to initialize application:', err);
    // Even if it fails, we should stop the loading state so the error can be shown or handled
    useSettingsStore.getState().setInitializing(false);
  }
};

init();
