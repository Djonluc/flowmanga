import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings2,
  ScrollText,
  BookOpen,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Settings,
  X,
  Plus,
  Minus,
  Sparkles,
  Timer,
} from "lucide-react";
import { useReaderStore } from "../../stores/useReaderStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import clsx from "clsx";

export const QuickSettings = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    mode,
    setMode,
    autoScroll,
    setAutoScroll,
    scrollSpeed,
    setScrollSpeed,
    imageFit,
    setImageFit,
    slideshowActive,
    setSlideshowActive,
  } = useReaderStore();

  const {
    isFullscreen,
    toggleFullScreenAction,
    toggleSettings,
    slideshowInterval,
    setSlideshowInterval,
    ambientMode,
    setAmbientMode,
    ambientIntensity,
    setAmbientIntensity,
    ambientBlur,
    setAmbientBlur,
    gapSize,
    setGapSize,
  } = useSettingsStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSpeedChange = (delta: number) => {
    setScrollSpeed(Math.max(10, Math.min(500, scrollSpeed + delta)));
  };

  const handleDelayChange = (delta: number) => {
    setSlideshowInterval(
      Math.max(1000, Math.min(20000, slideshowInterval + delta)),
    );
  };

  return (
    <div
      className="fixed bottom-12 right-12 z-[60] pointer-events-auto"
      ref={menuRef}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9, filter: "blur(20px)" }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 100, scale: 0.9, filter: "blur(20px)" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-20 right-0 w-[340px] bg-black/40 backdrop-blur-[64px] border border-white/10 rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-accent uppercase tracking-[0.4em]">
                  Engine
                </span>
                <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
                  Quick Settings
                </h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar max-h-[60vh]">
              {/* Mode Section */}
              <div className="space-y-3">
                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em] block pl-1">
                  Reading Mode
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "vertical", icon: ScrollText, label: "Scroll" },
                    { id: "single", icon: BookOpen, label: "Single" },
                    { id: "auto", icon: Play, label: "Auto" },
                  ].map((m) => {
                    const isActive =
                      (m.id === "auto" && mode === "vertical" && autoScroll) ||
                      (m.id === "vertical" &&
                        mode === "vertical" &&
                        !autoScroll) ||
                      (m.id === "single" && mode === "single");

                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (m.id === "auto") {
                            setMode("vertical");
                            setAutoScroll(true);
                          } else if (m.id === "vertical") {
                            setMode("vertical");
                            setAutoScroll(false);
                          } else {
                            setMode(m.id as any);
                          }
                        }}
                        className={clsx(
                          "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-300",
                          isActive
                            ? "bg-accent border-accent text-white shadow-lg shadow-accent/20"
                            : "bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10",
                        )}
                      >
                        <m.icon size={18} />
                        <span className="text-[8px] font-black uppercase tracking-widest">
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Image Fit Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">
                    Image Fit
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {["width", "height", "contain", "stretch"].map((fit) => (
                    <button
                      key={fit}
                      onClick={() => setImageFit(fit as any)}
                      className={clsx(
                        "px-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                        imageFit === fit
                          ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                          : "bg-white/5 border-white/5 text-neutral-500 hover:text-white hover:bg-white/10",
                      )}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamics Section */}
              <div className="space-y-4">
                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em] block pl-1">
                  Dynamics
                </span>

                <button
                  onClick={() =>
                    setAmbientMode(
                      ambientMode === "blurred-page"
                        ? "adaptive-vibrant"
                        : "blurred-page",
                    )
                  }
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles
                      size={16}
                      className={clsx(
                        ambientMode === "adaptive-vibrant"
                          ? "text-accent"
                          : "text-neutral-500",
                      )}
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">
                      Adaptive UI
                    </span>
                  </div>
                  <div
                    className={clsx(
                      "w-8 h-4 rounded-full relative transition-colors",
                      ambientMode === "adaptive-vibrant"
                        ? "bg-accent"
                        : "bg-neutral-800",
                    )}
                  >
                    <motion.div
                      animate={{
                        x: ambientMode === "adaptive-vibrant" ? 16 : 0,
                      }}
                      className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full"
                    />
                  </div>
                </button>

                {/* Atmosphere Controls */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em]">
                      Atmosphere
                    </span>
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest italic">
                      Diffusion Flow
                    </span>
                  </div>

                  {/* Intensity */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                        Intensity
                      </span>
                      <span className="text-[10px] font-black text-accent">
                        {Math.round(ambientIntensity * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: `${ambientIntensity * 100}%` }}
                          className="h-full bg-accent"
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={ambientIntensity}
                        onChange={(e) =>
                          setAmbientIntensity(parseFloat(e.target.value))
                        }
                        className="absolute inset-x-6 opacity-0 cursor-pointer h-8"
                      />
                    </div>
                  </div>

                  {/* Blur */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                        Diffusion
                      </span>
                      <span className="text-[10px] font-black text-accent">
                        {ambientBlur}px
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: `${(ambientBlur / 150) * 100}%` }}
                          className="h-full bg-accent"
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="150"
                        step="5"
                        value={ambientBlur}
                        onChange={(e) =>
                          setAmbientBlur(parseInt(e.target.value))
                        }
                        className="absolute inset-x-6 opacity-0 cursor-pointer h-8"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contextual Controllers */}
              <div className="pt-2">
                {mode === "vertical" && (
                  <div className="space-y-6">
                    {/* Auto-Scroll Main Toggle */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Timer
                            size={12}
                            className={clsx(
                              autoScroll ? "text-accent" : "text-neutral-500",
                            )}
                          />
                          <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">
                            Cinematic Flow
                          </span>
                        </div>
                        <span
                          className={clsx(
                            "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md",
                            autoScroll
                              ? "bg-accent/20 text-accent"
                              : "bg-white/5 text-neutral-500",
                          )}
                        >
                          {autoScroll ? "Active" : "Standby"}
                        </span>
                      </div>

                      <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={clsx(
                          "w-full flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all duration-300 group overflow-hidden relative",
                          autoScroll
                            ? "bg-accent border-accent text-white shadow-[0_0_25px_rgba(59,130,246,0.4)]"
                            : "bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10 hover:border-white/10",
                        )}
                      >
                        {autoScroll && (
                          <motion.div
                            layoutId="auto-bg"
                            className="absolute inset-0 bg-gradient-to-r from-accent via-blue-400 to-accent opacity-50"
                            animate={{ x: ["-100%", "100%"] }}
                            transition={{
                              repeat: Infinity,
                              duration: 3,
                              ease: "linear",
                            }}
                          />
                        )}
                        <div className="relative z-10 flex items-center gap-2">
                          {autoScroll ? (
                            <Pause size={18} fill="currentColor" />
                          ) : (
                            <Play size={18} fill="currentColor" />
                          )}
                          <span className="font-black text-xs uppercase tracking-widest">
                            {autoScroll ? "Pause Scroll" : "Begin Auto-Scroll"}
                          </span>
                        </div>
                      </button>
                    </div>

                    {/* Speed Slider */}
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em]">
                          Flow Velocity
                        </span>
                        <span className="text-[10px] font-black text-accent">
                          {scrollSpeed} PPS
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleSpeedChange(-20)}
                          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-accent/20 hover:text-accent transition-all active:scale-90"
                        >
                          <Minus size={16} />
                        </button>

                        <div className="flex-1 relative group/slider py-2">
                          <input
                            type="range"
                            min="10"
                            max="500"
                            step="5"
                            value={scrollSpeed}
                            onChange={(e) =>
                              setScrollSpeed(parseInt(e.target.value))
                            }
                            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent"
                          />
                          <motion.div
                            initial={false}
                            animate={{
                              width: `${((scrollSpeed - 10) / 490) * 100}%`,
                            }}
                            className="absolute top-[13px] left-0 h-1.5 bg-accent rounded-full pointer-events-none"
                          />
                        </div>

                        <button
                          onClick={() => handleSpeedChange(20)}
                          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-accent/20 hover:text-accent transition-all active:scale-90"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest text-center opacity-60">
                        Adjust speed for your reading pace
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em]">
                          Vertical Gap
                        </span>
                        <span className="text-[10px] font-black text-blue-400">
                          {gapSize}px
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setGapSize(Math.max(0, gapSize - 8))}
                          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10"
                        >
                          <Minus size={14} />
                        </button>
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            animate={{ width: `${(gapSize / 100) * 100}%` }}
                            className="h-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]"
                          />
                        </div>
                        <button
                          onClick={() => setGapSize(Math.min(100, gapSize + 8))}
                          className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {mode === "slideshow" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em]">
                        Frame Delay
                      </span>
                      <span className="text-[10px] font-black text-purple-400">
                        {(slideshowInterval / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleDelayChange(-500)}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10"
                      >
                        <Minus size={14} />
                      </button>
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          animate={{
                            width: `${(slideshowInterval / 20000) * 100}%`,
                          }}
                          className="h-full bg-purple-500"
                        />
                      </div>
                      <button
                        onClick={() => handleDelayChange(500)}
                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-white/5 border-t border-white/5 grid grid-cols-2 gap-2">
              <button
                onClick={toggleFullScreenAction}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all text-[8px] font-black uppercase tracking-widest"
              >
                {isFullscreen ? (
                  <Minimize2 size={14} />
                ) : (
                  <Maximize2 size={14} />
                )}
                Screen
              </button>
              <button
                onClick={toggleSettings}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all text-[8px] font-black uppercase tracking-widest"
              >
                <Settings size={14} />
                Global
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border border-white/10 backdrop-blur-3xl",
          isOpen
            ? "bg-accent text-white rotate-90"
            : "bg-black/60 text-neutral-400 hover:text-white",
        )}
      >
        {isOpen ? <X size={24} /> : <Settings2 size={24} />}
      </motion.button>
    </div>
  );
};
