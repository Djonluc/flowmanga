import { useSettingsStore } from '../stores/useSettingsStore';
import { useReadingStore } from '../stores/useReadingStore';
import { useTrackerStore } from '../stores/useTrackerStore';
import { BookOpen, MonitorPlay, ArrowDown, Keyboard, Sliders, X, Compass, Zap } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export const ControlPanel = () => {
  const { 
    readingMode, setReadingMode, 
    theme, setTheme,
    readingDirection, setReadingDirection,
    gapSize, setGapSize,
    ambientVolume, setAmbientVolume,
    isSettingsOpen, toggleSettings,
    isFullscreen, toggleFullScreenAction,
    fitMode, setFitMode,
    autoCrop, toggleAutoCrop,
    brightness, setBrightness,
    contrast, setContrast,
    saturation, setSaturation,
    toggleShortcuts,
    // Ambient
    ambientMode, setAmbientMode,
    ambientIntensity, setAmbientIntensity,
    ambientBlur, setAmbientBlur,
    ambientBrightness, setAmbientBrightness,
    showAmbientNoise, setAmbientNoise,
    selectedAmbientSound, setSelectedAmbientSound,
    isAutoScrolling, toggleAutoScrolling,
    autoScrollSpeed, setAutoScrollSpeed,
    slideshowInterval, setSlideshowInterval
  } = useSettingsStore();
  
  const { images } = useReadingStore();
  const { anilistToken, anilistUser, setAnilistToken } = useTrackerStore();

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          className="fixed inset-x-3 bottom-24 max-h-[calc(100vh-8rem)] bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl z-50 text-white flex flex-col gap-6 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[22rem] sm:p-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Settings</h3>
            <div className="flex gap-2">
                <button
                    onClick={toggleShortcuts}
                    className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                    title="Keyboard Shortcuts (?)"
                >
                    <Keyboard size={16} />
                </button>
                <button
                    onClick={toggleSettings}
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
          </div>

          <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
            {/* Theme & Volume always visible */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Theme</span>
                        <div className="flex gap-1.5">
                            {(['dark', 'light', 'oled', 'paper', 'cyberpunk'] as const).map((t) => (
                                <button 
                                    key={t}
                                    onClick={() => setTheme(t)} 
                                    className={`w-6 h-6 rounded-full border border-white/10 transition-transform hover:scale-110 ${theme === t ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
                                    style={{ background: t === 'dark' ? '#222' : t === 'light' ? '#fff' : t === 'oled' ? '#000' : t === 'paper' ? '#f5f5dc' : '#0ff' }}
                                    title={t}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                         <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Immersive Mode</span>
                         <button 
                            onClick={toggleFullScreenAction}
                            className={clsx(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                                isFullscreen 
                                    ? "bg-green-600 text-white shadow-lg shadow-green-500/30" 
                                    : "bg-white/5 text-neutral-400 hover:text-white"
                            )}
                         >
                             {isFullscreen ? 'ON' : 'OFF'}
                         </button>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex justify-between">
                            <span>Ambient Soundscape</span>
                            <span>{Math.round(ambientVolume * 100)}%</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2 p-2 bg-white/5 rounded-2xl border border-white/5 mb-3">
                            {(['none', 'lofi', 'rain', 'cafe', 'wind', 'space'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setSelectedAmbientSound(s)}
                                    className={clsx(
                                        "flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all border",
                                        selectedAmbientSound === s 
                                            ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20" 
                                            : "bg-white/[0.02] border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.05]"
                                    )}
                                >
                                    <div className="opacity-80">
                                        {s === 'none' && <X size={14} />}
                                        {s === 'lofi' && <MonitorPlay size={14} />}
                                        {s === 'rain' && <div className="w-1 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />}
                                        {s === 'cafe' && <BookOpen size={14} />}
                                        {s === 'wind' && <Compass size={14} className="animate-spin-slow" />}
                                        {s === 'space' && <Zap size={14} className="animate-pulse" />}
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest">{s === 'none' ? 'Silence' : s}</span>
                                </button>
                            ))}
                        </div>
                        <input 
                        type="range" min="0" max="1" step="0.05"
                        value={ambientVolume}
                        onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                        className="w-full accent-white h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>

            {/* Reading Settings - only if in reader */}
            {images.length > 0 ? (
                <div className="space-y-6 pt-4 border-t border-white/10">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Reading Mode</label>
                        <div className="grid grid-cols-2 gap-1 bg-white/5 p-1 rounded-lg">
                            {(['vertical', 'horizontal', 'single', 'slideshow'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setReadingMode(mode)}
                                    className={clsx(
                                        "flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-colors",
                                        readingMode === mode ? "bg-white text-black shadow-sm" : "hover:bg-white/5 text-neutral-300"
                                    )}
                                >
                                    {mode === 'vertical' && <ArrowDown size={12} />}
                                    {mode === 'horizontal' && <BookOpen size={12} className="rotate-90" />}
                                    {mode === 'single' && <BookOpen size={12} />}
                                    {mode === 'slideshow' && <MonitorPlay size={12} />}
                                    <span className="capitalize">{mode}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Fit Mode</label>
                        <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-lg">
                            {(['width', 'height', 'original'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setFitMode(mode)}
                                    className={clsx(
                                        "py-1.5 rounded-md text-[10px] font-medium transition-colors capitalize",
                                        fitMode === mode ? "bg-white text-black shadow-sm" : "hover:bg-white/5 text-neutral-300"
                                    )}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Ambient Background Section */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Ambient Background</label>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                            {/* Mode Selection */}
                            <div className="grid grid-cols-3 gap-1.5">
                                {(['blurred-page', 'blurred-cover', 'solid', 'gradient', 'oled'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setAmbientMode(mode)}
                                        className={clsx(
                                            "py-2 rounded-lg text-[10px] font-bold uppercase transition-all border border-transparent",
                                            ambientMode === mode 
                                                ? "bg-white text-black shadow-lg shadow-white/10" 
                                                : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
                                        )}
                                    >
                                        {mode.replace('-', ' ')}
                                    </button>
                                ))}
                            </div>
                            
                            {ambientMode !== 'oled' && ambientMode !== 'solid' && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="space-y-4 pt-2"
                                >
                                    <div className="space-y-2">
                                         <div className="flex justify-between text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                                            <span>Intensity</span>
                                            <span className="text-white">{Math.round(ambientIntensity * 100)}%</span>
                                         </div>
                                         <input 
                                            type="range" min="0" max="1" step="0.05"
                                            value={ambientIntensity}
                                            onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
                                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                                         />
                                    </div>

                                    <div className="space-y-2">
                                         <div className="flex justify-between text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                                            <span>Blur Radius</span>
                                            <span className="text-white">{ambientBlur}px</span>
                                         </div>
                                         <input 
                                            type="range" min="0" max="100" step="5"
                                            value={ambientBlur}
                                            onChange={(e) => setAmbientBlur(parseFloat(e.target.value))}
                                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                                         />
                                    </div>
                                    
                                    <div className="space-y-2">
                                         <div className="flex justify-between text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                                            <span>Brightness</span>
                                            <span className="text-white">{Math.round(ambientBrightness * 100)}%</span>
                                         </div>
                                         <input 
                                            type="range" min="0" max="1" step="0.05"
                                            value={ambientBrightness}
                                            onChange={(e) => setAmbientBrightness(parseFloat(e.target.value))}
                                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                                         />
                                    </div>

                                     <div className="flex items-center justify-between pt-1">
                                        <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Film Grain</span>
                                        <button 
                                            onClick={() => setAmbientNoise(!showAmbientNoise)}
                                            className={clsx(
                                                "w-10 h-5 rounded-full transition-colors relative border",
                                                showAmbientNoise ? "bg-white border-white" : "bg-transparent border-white/20"
                                            )}
                                        >
                                            <div className={clsx("absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-black rounded-full transition-transform shadow-sm", showAmbientNoise ? "translate-x-5 bg-black" : "bg-white/40")} />
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Auto-Advance / Auto-Scroll Section */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                        {readingMode === 'vertical' ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Gap Size: {gapSize}px</label>
                                    <input 
                                        type="range" min="0" max="100" value={gapSize} 
                                        onChange={(e) => setGapSize(Number(e.target.value))}
                                        className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
                                    />
                                </div>
                                
                                <div className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-neutral-300 uppercase tracking-tight">Auto-Scroll</label>
                                        <button 
                                            onClick={toggleAutoScrolling}
                                            className={clsx(
                                                "px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                                                isAutoScrolling 
                                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" 
                                                    : "bg-white/10 text-neutral-400"
                                            )}
                                        >
                                            {isAutoScrolling ? 'ACTIVE' : 'START'}
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-neutral-500">
                                            <span>Scroll Speed</span>
                                            <span>{autoScrollSpeed}px</span>
                                        </div>
                                        <input 
                                            type="range" min="0.5" max="10" step="0.5" 
                                            value={autoScrollSpeed} 
                                            onChange={(e) => setAutoScrollSpeed(Number(e.target.value))}
                                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-neutral-300 uppercase tracking-tight">Auto-Advance</label>
                                    <button 
                                        onClick={toggleAutoScrolling}
                                        className={clsx(
                                            "px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                                            isAutoScrolling 
                                                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30" 
                                                : "bg-white/10 text-neutral-400"
                                        )}
                                    >
                                        {isAutoScrolling ? 'ACTIVE' : 'START'}
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-neutral-500">
                                        <span>Interval Speed</span>
                                        <span>{slideshowInterval / 1000}s</span>
                                    </div>
                                    <input 
                                        type="range" min="1000" max="10000" step="500" 
                                        value={slideshowInterval} 
                                        onChange={(e) => setSlideshowInterval(Number(e.target.value))}
                                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {readingMode === 'single' && (
                        <div className="space-y-2 pt-4">
                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Direction</label>
                            <div className="flex bg-white/5 p-1 rounded-lg">
                                <button
                                    onClick={() => setReadingDirection('ltr')}
                                    className={clsx(
                                        "flex-1 py-1.5 rounded-md text-[10px] font-medium transition-colors",
                                        readingDirection === 'ltr' ? "bg-white text-black" : "hover:bg-white/5 text-neutral-300"
                                    )}
                                >
                                    LTR
                                </button>
                                <button
                                    onClick={() => setReadingDirection('rtl')}
                                    className={clsx(
                                        "flex-1 py-1.5 rounded-md text-[10px] font-medium transition-colors",
                                        readingDirection === 'rtl' ? "bg-white text-black" : "hover:bg-white/5 text-neutral-300"
                                    )}
                                >
                                    RTL
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                <Sliders size={12} /> Image Adjustment
                            </div>
                            <button 
                                onClick={toggleAutoCrop}
                                className={clsx(
                                    "px-2 py-1 rounded text-[10px] font-bold transition-colors",
                                    autoCrop ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-neutral-500'
                                )}
                            >
                                AUTO-CROP {autoCrop ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        
                        {[
                            { label: 'Brightness', val: brightness, set: setBrightness, min: 0.5, max: 1.5 },
                            { label: 'Contrast', val: contrast, set: setContrast, min: 0.5, max: 1.5 },
                            { label: 'Saturation', val: saturation, set: setSaturation, min: 0, max: 2 },
                        ].map((s) => (
                            <div key={s.label} className="space-y-1">
                                <div className="flex justify-between text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
                                    <span>{s.label}</span>
                                    <span>{Math.round(s.val * 100)}%</span>
                                </div>
                                <input 
                                    type="range" min={s.min} max={s.max} step="0.05"
                                    value={s.val}
                                    onChange={(e) => s.set(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                                />
                            </div>
                        ))}
                </div>
                </div>
            ) : (
                <div className="py-8 text-center border-t border-white/10">
                    <p className="text-xs text-neutral-500 italic">Open a book to see reading controls</p>
                </div>
            )}
            
            {/* Trackers Section */}
            <div className="space-y-4 pt-4 border-t border-white/10">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Trackers</label>
                <div className="space-y-3">
                    {/* Anilist */}
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {anilistUser?.avatar ? (
                                <img 
                                    src={anilistUser.avatar} 
                                    alt="Avatar" 
                                    className="w-8 h-8 rounded-lg object-cover border border-white/10"
                                />
                            ) : (
                                <div className="w-8 h-8 bg-[#02A9FF] rounded-lg flex items-center justify-center font-bold text-white">AL</div>
                            )}
                            <div>
                                <div className="text-xs font-bold text-white">
                                    {anilistUser?.name || 'Anilist'}
                                </div>
                                <div className="text-[10px] text-neutral-500">
                                    {anilistToken ? 'Connected' : 'Not Connected'}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                if (anilistToken) {
                                    if (confirm('Disconnect Anilist?')) {
                                        setAnilistToken(null);
                                    }
                                } else {
                                    const token = prompt("Enter your Anilist Personal Access Token:");
                                    if (token) setAnilistToken(token);
                                }
                            }}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors",
                                anilistToken ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                            )}
                        >
                            {anilistToken ? 'Disconnect' : 'Connect'}
                        </button>
                    </div>

                    {/* MyAnimeList */}
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between grayscale opacity-50 cursor-not-allowed" title="Coming Soon">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#2E51A2] rounded-lg flex items-center justify-center font-bold text-white">MAL</div>
                            <div>
                                <div className="text-xs font-bold text-white">MyAnimeList</div>
                                <div className="text-[10px] text-neutral-500">Coming Soon</div>
                            </div>
                        </div>
                        <button className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 text-neutral-500 pointer-events-none">
                            Connect
                        </button>
                    </div>
                </div>
            </div>

            {/* System Section - Always Visible */}
            <div className="space-y-4 pt-4 border-t border-white/10">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">System</label>
                <div className="grid grid-cols-2 gap-2">
                        <button
                        onClick={async () => {
                            try {
                                // Dynamic import to avoid build errors if package missing
                                const { check } = await import('@tauri-apps/plugin-updater');
                                const update = await check();
                                if (update?.available) {
                                    if (confirm(`Update ${update.version} is available! Download and install?`)) {
                                        await update.downloadAndInstall();
                                    }
                                } else {
                                    alert('You are on the latest version.');
                                }
                            } catch (e) {
                                console.error(e);
                                alert('checkForUpdates failed (Updater not configured in tauri.conf.json?)');
                            }
                        }}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-neutral-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <Zap size={14} /> Check Updates
                        </button>
                        <button
                        onClick={() => {
                            if (confirm('This will reset all local settings and cache. Are you sure?')) {
                                localStorage.clear();
                                window.location.reload();
                            }
                        }}
                        className="px-3 py-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-xs font-medium text-neutral-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <Sliders size={14} /> Reset App
                        </button>
                </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
