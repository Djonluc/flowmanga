import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Reader } from './components/Reader'
import { ControlPanel } from './components/ControlPanel'
import { LibraryGrid } from './components/LibraryGrid'
import { useReadingStore } from './stores/useReadingStore'
// import { useLibraryStore } from './stores/useLibraryStore'
import { useSettingsStore } from './stores/useSettingsStore'
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
// import { ArrowLeft } from 'lucide-react'
import { useLibraryEvents } from './hooks/useLibraryEvents'
import { useAdaptiveColor } from './hooks/useAdaptiveColor'
import { useReadingAnalytics } from './hooks/useReadingAnalytics'
import { AnimatePresence, motion } from 'framer-motion';

import { HomeView } from './components/HomeView';
import { DiscoverView } from './components/DiscoverView';
import { VideoLibrary } from './components/video/VideoLibrary';
import { HistoryView } from './components/HistoryView';
import { AmbientBackground } from './components/AmbientBackground';
import { AmbientSoundPlayer } from './components/AmbientSoundPlayer';
import { useVideoStore } from './stores/useVideoStore';
import { LocationModal } from './components/modals/LocationModal';
import { SafetyCheckModal } from './components/modals/SafetyCheckModal';

function App() {
  const { isInitializing, zoomScale, accentColor } = useSettingsStore();
  
  // Sync Accent Color to CSS Variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-accent', accentColor);
    // Generate a glow variant (lower opacity)
    root.style.setProperty('--color-accent-glow', `${accentColor}66`);
  }, [accentColor]);

  // Implement Native Browser-Style Zoom
  useEffect(() => {
    const applyZoom = async () => {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            // setZoomLevel in Tauri takes 1.0 for 100%
            await win.setZoomLevel(zoomScale);
        } catch (err) {
            console.error('[App] Failed to apply native zoom:', err);
            // Fallback to CSS zoom for dev/browser environments
            document.body.style.zoom = zoomScale.toString();
        }
    };
    applyZoom();
  }, [zoomScale]);

  if (isInitializing) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20" />
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-600 animate-pulse" />
        
        <div className="z-10 text-center space-y-8 max-w-md px-6">
          <div className="relative inline-block">
             <div className="w-24 h-24 border-t-2 border-blue-500 rounded-full animate-spin" />
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-black text-white italic tracking-tighter">F</span>
             </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white tracking-tighter">
                FLOW<span className="text-blue-500">MANGA</span>
            </h1>
            <p className="text-neutral-500 font-medium tracking-widest uppercase text-xs">
                 Initializing Core Engine
            </p>
          </div>
          
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
             <motion.div 
               className="h-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]"
               initial={{ width: 0 }}
               animate={{ width: "100%" }}
               transition={{ duration: 2, repeat: Infinity }}
             />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
        <AmbientBackground />
        <AmbientSoundPlayer />
        <MainContent />
    </>
  );
}

function MainContent() {
  const { images } = useReadingStore()
  const { currentVideo } = useVideoStore();
  const { 
    activeView, 
    isLocationModalOpen, setLocationModalOpen,
    isSafetyCheckModalOpen, safetyCheckTitle, onSafetyCheckResolved, setSafetyCheckModal
  } = useSettingsStore();

  useLibraryEvents();
  useAdaptiveColor();
  useReadingAnalytics();

  return (
    <>
    <Layout hideSidebar={images.length > 0 || !!currentVideo}>
        <AnimatePresence mode="wait">
            {images.length > 0 ? (
                <motion.div 
                    key="reader"
                    initial={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full w-full"
                >
                    <Reader />
                </motion.div>
            ) : (
                <motion.div
                    key={activeView}
                    initial={{ opacity: 0, scale: 0.99 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.01 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="h-full w-full"
                >
                    {activeView === 'stats' ? (
                        <AnalyticsDashboard />
                    ) : activeView === 'history' ? (
                        <HistoryView />
                    ) : activeView === 'home' ? (
                        <HomeView />
                    ) : activeView === 'discover' ? (
                        <DiscoverView />
                    ) : activeView === 'videos' ? (
                        <VideoLibrary />
                    ) : (
                        <LibraryGrid />
                    )}
                </motion.div>
            )}
        </AnimatePresence>
        <ControlPanel />
    </Layout>
    <LocationModal 
        isOpen={isLocationModalOpen} 
        onClose={() => setLocationModalOpen(false)}
        onSuccess={() => {} /* console.log('Download path set to:', path) */}
    />
    <SafetyCheckModal 
        isOpen={isSafetyCheckModalOpen}
        mangaTitle={safetyCheckTitle}
        onClose={() => setSafetyCheckModal(false)}
        onAction={(action) => {
            onSafetyCheckResolved?.(action);
            setSafetyCheckModal(false);
        }}
    />
    </>
  )
}


export default App
