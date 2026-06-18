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
import { OfflineAudioEngine } from './components/OfflineAudioEngine';
import { useVideoStore } from './stores/useVideoStore';
import { LocationModal } from './components/modals/LocationModal';
import { SafetyCheckModal } from './components/modals/SafetyCheckModal';
import { UpdateNotificationModal } from './components/modals/UpdateNotificationModal';

function App() {
  const { isInitializing, zoomScale, accentColor, theme } = useSettingsStore();
  
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
            const { getCurrentWebview } = await import('@tauri-apps/api/webview');
            const webview = getCurrentWebview();
            await webview.setZoom(zoomScale);
        } catch (err) {
            console.error('[App] Failed to apply native zoom:', err);
        }
    };
    applyZoom();
  }, [zoomScale]);

  // Track Native Viewport Zoom (ctrl + scroll) via devicePixelRatio
  useEffect(() => {
    let timeout: any;
    const handleResize = () => {
       clearTimeout(timeout);
       timeout = setTimeout(async () => {
          try {
             const { getCurrentWindow } = await import('@tauri-apps/api/window');
             const factor = await getCurrentWindow().scaleFactor();
             
             // In Chromium, devicePixelRatio = OS DPI Scale * Browser Zoom Level
             const calculatedZoom = window.devicePixelRatio / factor;
             
             const currentStoreZoom = useSettingsStore.getState().zoomScale;
             // Only persist if the user actually manually changed it (via ctrl+scroll)
             if (Math.abs(calculatedZoom - currentStoreZoom) > 0.05) {
                 useSettingsStore.getState().setZoomScale(calculatedZoom);
             }
          } catch(e) { }
       }, 500); // debounce zoom events
    };

    window.addEventListener('resize', handleResize);
    // Trigger once on mount to capture any initial OS state anomalies
    handleResize();

    return () => {
       window.removeEventListener('resize', handleResize);
       clearTimeout(timeout);
    };
  }, []);

  // Restore and Track Window Dimensions
  useEffect(() => {
    let resizeTimer: any;
    let unlisten: (() => void) | undefined;

    const setupWindow = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const { LogicalSize } = await import('@tauri-apps/api/dpi');
        const win = getCurrentWindow();
        
        // Restore Size
        const { windowWidth, windowHeight } = useSettingsStore.getState();
        if (windowWidth && windowHeight) {
           await win.setSize(new LogicalSize(windowWidth, windowHeight));
        }

        // Listen for resize
        unlisten = await win.onResized(async () => {
           clearTimeout(resizeTimer);
           resizeTimer = setTimeout(async () => {
              try {
                const factor = await win.scaleFactor();
                const size = await win.innerSize();
                const logical = size.toLogical(factor);
                useSettingsStore.getState().setWindowSize(logical.width, logical.height);
              } catch (e) {
                console.warn("[App] Failed to save window size", e);
              }
           }, 500); // 500ms debounce
        });

      } catch (err) {
         console.warn("[App] Window dimension tracking unavailable in this environment:", err);
      }
    };
    setupWindow();

    return () => {
      clearTimeout(resizeTimer);
      if (unlisten) unlisten();
    };
  }, []);

  if (isInitializing) {
    return (
      <div
        data-theme={theme}
        className="h-screen w-screen bg-background flex items-center justify-center relative overflow-hidden text-foreground"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20" />
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-600 animate-pulse" />
        
        <div className="z-10 text-center space-y-8 max-w-md px-6">
          <div className="relative inline-block">
             <div className="w-32 h-32 border-t-2 border-blue-500 rounded-full animate-spin" />
             <div className="absolute inset-0 flex items-center justify-center">
                <img src="/logo.png" alt="F" className="w-24 h-24 object-contain scale-[1.35] drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
             </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-foreground tracking-tighter">
                FLOW<span className="text-blue-500">MANGA</span>
            </h1>
            <p className="text-foreground-dim font-medium tracking-widest uppercase text-xs">
                 Initializing Core Engine
            </p>
          </div>
          
          <div className="w-full h-1 bg-border-subtle rounded-full overflow-hidden">
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
        <OfflineAudioEngine />
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
    <UpdateNotificationModal />
    </>
  )
}


export default App
