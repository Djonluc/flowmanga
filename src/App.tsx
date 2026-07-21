import { lazy, Suspense, useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Reader } from './components/Reader'
import { useReadingStore } from './stores/useReadingStore'
// import { useLibraryStore } from './stores/useLibraryStore'
import { useSettingsStore } from './stores/useSettingsStore'
// import { ArrowLeft } from 'lucide-react'
import { useLibraryEvents } from './hooks/useLibraryEvents'
import { useAdaptiveColor } from './hooks/useAdaptiveColor'
import { useReadingAnalytics } from './hooks/useReadingAnalytics'
import { AnimatePresence, motion } from 'framer-motion';


import { AmbientBackground } from './components/AmbientBackground';
import { OfflineAudioEngine } from './components/OfflineAudioEngine';
import { useVideoStore } from './stores/useVideoStore';
import { LocationModal } from './components/modals/LocationModal';
import { SafetyCheckModal } from './components/modals/SafetyCheckModal';
import { UpdateNotificationModal } from './components/modals/UpdateNotificationModal';
import { TitleBar } from './components/TitleBar';
import { FirstRunWizard } from './components/modals/FirstRunWizard';

const LibraryGrid = lazy(() => import('./components/LibraryGrid').then(module => ({ default: module.LibraryGrid })));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard').then(module => ({ default: module.AnalyticsDashboard })));
const HomeView = lazy(() => import('./components/HomeView').then(module => ({ default: module.HomeView })));
const DiscoverView = lazy(() => import('./components/DiscoverView').then(module => ({ default: module.DiscoverView })));
const VideoLibrary = lazy(() => import('./components/video/VideoLibrary').then(module => ({ default: module.VideoLibrary })));
const DownloadsView = lazy(() => import('./components/DownloadsView').then(module => ({ default: module.DownloadsView })));

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
          } catch (error) {
            console.debug('[App] Could not synchronize browser zoom:', error);
          }
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
        const [isFull, isMaximized] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
        if (windowWidth && windowHeight && !isFull && !isMaximized) {
           await win.setSize(new LogicalSize(windowWidth, windowHeight));
        }

        // Listen for resize
        unlisten = await win.onResized(async () => {
           clearTimeout(resizeTimer);
           resizeTimer = setTimeout(async () => {
              try {
                const [full, maximized] = await Promise.all([win.isFullscreen(), win.isMaximized()]);
                // Never persist a monitor-sized fullscreen/maximized viewport
                // as the user's normal window size.
                if (full || maximized) return;
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
        className="fixed inset-0 bg-background flex items-center justify-center overflow-hidden text-foreground"
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

const LazyTab = ({ active, children }: { active: boolean; children: React.ReactNode }) => {
    const [mounted, setMounted] = useState(active);
    
    useEffect(() => {
        if (active && !mounted) setMounted(true);
    }, [active, mounted]);

    if (!mounted) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.99 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={`absolute inset-0 ${active ? 'pointer-events-auto z-10' : 'pointer-events-none z-0'}`}
        >
            {children}
        </motion.div>
    );
};

function MainContent() {
  const { images } = useReadingStore()
  const { currentVideo } = useVideoStore();
  const { 
    activeView, firstRunComplete, downloadPath,
    isLocationModalOpen, setLocationModalOpen,
    isSafetyCheckModalOpen, safetyCheckTitle, onSafetyCheckResolved, setSafetyCheckModal
  } = useSettingsStore();

  useLibraryEvents();
  useAdaptiveColor();
  useReadingAnalytics();

  // Fix Windows maximized frameless bleed
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const isFullscreen = useSettingsStore((s) => s.isFullscreen);
  const setFullscreenState = useSettingsStore((s) => s.setFullscreenState);

  useEffect(() => {
    let unmounted = false;
    const checkMax = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const currentWindow = getCurrentWindow();
        const [max, full] = await Promise.all([
          currentWindow.isMaximized(),
          currentWindow.isFullscreen(),
        ]);
        if (!unmounted) {
          setIsWindowMaximized(max);
          setFullscreenState(full);
        }
      } catch (error) {
        console.debug('[App] Could not synchronize native window state:', error);
      }
    };
    checkMax();
    window.addEventListener('resize', checkMax);
    return () => {
      unmounted = true;
      window.removeEventListener('resize', checkMax);
    };
  }, [setFullscreenState]);

  return (
    <div className={`fixed inset-0 min-h-0 flex flex-col bg-background text-foreground overflow-hidden box-border ${isWindowMaximized && !isFullscreen ? 'p-2' : ''}`}>
      {!isFullscreen && <TitleBar />}
      <div className="flex-1 min-h-0 relative">
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
                <div className="h-full w-full relative">
                  <Suspense fallback={<div className="h-full w-full grid place-items-center text-sm font-bold text-foreground-dim">Loading view…</div>}>
                    <LazyTab active={activeView === 'stats'}><AnalyticsDashboard /></LazyTab>
                    <LazyTab active={activeView === 'downloads'}>
                        <div className="flex-1 min-h-0 bg-transparent relative h-full">
                            <DownloadsView />
                        </div>
                    </LazyTab>
                    <LazyTab active={activeView === 'home'}><HomeView /></LazyTab>
                    <LazyTab active={activeView === 'discover'}><DiscoverView /></LazyTab>
                    <LazyTab active={activeView === 'videos'}><VideoLibrary /></LazyTab>
                    <LazyTab active={!['stats', 'downloads', 'home', 'discover', 'videos'].includes(activeView)}>
                        <LibraryGrid />
                    </LazyTab>
                  </Suspense>
                </div>
            )}
        </AnimatePresence>
    </Layout>
    {!firstRunComplete && !downloadPath && <FirstRunWizard />}
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
      </div>
    </div>
  )
}


export default App
