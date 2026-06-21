import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Copy } from 'lucide-react';

export const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isWindowSetup, setIsWindowSetup] = useState(false);

  useEffect(() => {
    let unmounted = false;
    const updateMaximized = async () => {
      try {
        const win = getCurrentWindow();
        const max = await win.isMaximized();
        if (!unmounted) setIsMaximized(max);
        setIsWindowSetup(true);
      } catch (e) {
        console.warn('Failed to check window state', e);
      }
    };
    
    updateMaximized();
    window.addEventListener('resize', updateMaximized);
    return () => {
      unmounted = true;
      window.removeEventListener('resize', updateMaximized);
    };
  }, []);

  const minimize = async () => {
    try { await getCurrentWindow().minimize(); } catch(e) {}
  };
  
  const toggleMaximize = async () => {
    try { 
      const win = getCurrentWindow();
      const max = await win.isMaximized();
      if (max) {
        await win.unmaximize();
        setIsMaximized(false);
      } else {
        await win.maximize();
        setIsMaximized(true);
      }
    } catch(e) {
      console.error(e);
    }
  };
  
  const closeWindow = async () => {
    try { await getCurrentWindow().close(); } catch(e) {}
  };

  if (!isWindowSetup) return null; // Prevent hydration mismatch or errors before tauri API is ready

  return (
    <div className="h-[36px] bg-[#0A0A0A] flex items-center justify-between select-none shrink-0 relative">
      {/* Background drag region */}
      <div data-tauri-drag-region className="absolute inset-0 z-0 cursor-default"></div>

      <div className="relative z-10 flex items-center pl-4 gap-3 h-full flex-1 pointer-events-none">
         <img src="/logo_square.png" alt="Logo" className="w-5 h-5 pointer-events-none rounded-sm" />
         <span className="text-xs font-black tracking-[0.2em] uppercase text-foreground-muted pointer-events-none mt-px">FlowManga</span>
      </div>
      
      <div className="relative z-10 flex h-full">
        <button 
          className="w-12 h-full flex items-center justify-center text-foreground-muted hover:bg-white/10 transition-colors cursor-pointer"
          onClick={minimize}
          title="Minimize"
        >
          <Minus size={16} />
        </button>
        <button 
          className="w-12 h-full flex items-center justify-center text-foreground-muted hover:bg-white/10 transition-colors"
          onClick={toggleMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy size={14} className="scale-x-[-1]" /> : <Square size={14} />}
        </button>
        <button 
          className="w-12 h-full flex items-center justify-center text-foreground-muted hover:bg-red-500 hover:text-white transition-colors"
          onClick={closeWindow}
          title="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
