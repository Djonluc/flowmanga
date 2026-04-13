import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Settings2, ScrollText, BookOpen, Play, Maximize2, Minimize2, 
    Settings, X, Plus, Minus, Sparkles, Timer 
} from 'lucide-react';
import { useReaderStore } from '../../stores/useReaderStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import clsx from 'clsx';

export const QuickSettings = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { 
        mode, setMode, 
        autoScroll, setAutoScroll, 
        scrollSpeed, setScrollSpeed,
        imageFit, setImageFit,
        slideshowActive, setSlideshowActive
    } = useReaderStore();
    
    const { 
        isFullscreen, toggleFullScreenAction, toggleSettings,
        slideshowInterval, setSlideshowInterval,
        ambientMode, setAmbientMode,
        gapSize, setGapSize
    } = useSettingsStore();

    const handleSpeedChange = (delta: number) => {
        setScrollSpeed(Math.max(10, Math.min(500, scrollSpeed + delta)));
    };

    const handleDelayChange = (delta: number) => {
        setSlideshowInterval(Math.max(1000, Math.min(20000, slideshowInterval + delta)));
    };

    return (
        <div className="fixed bottom-12 right-12 z-[60] pointer-events-auto">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: 100, scale: 0.9, filter: 'blur(20px)' }}
                        animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, x: 100, scale: 0.9, filter: 'blur(20px)' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="absolute bottom-20 right-0 w-[340px] bg-black/40 backdrop-blur-[64px] border border-white/10 rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-accent uppercase tracking-[0.4em]">Engine</span>
                                <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">Quick Settings</h2>
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
                                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em] block pl-1">Reading Mode</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'vertical', icon: ScrollText, label: 'Scroll' },
                                        { id: 'single', icon: BookOpen, label: 'Single' },
                                        { id: 'slideshow', icon: Play, label: 'Auto' },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => setMode(m.id as any)}
                                            className={clsx(
                                                "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-300",
                                                mode === m.id 
                                                    ? "bg-accent border-accent text-white shadow-lg shadow-accent/20" 
                                                    : "bg-white/5 border-white/5 text-neutral-400 hover:bg-white/10"
                                            )}
                                        >
                                            <m.icon size={18} />
                                            <span className="text-[8px] font-black uppercase tracking-widest">{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Image Fit Selection */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                     <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                     <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Image Fit</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {['width', 'height', 'contain', 'stretch'].map((fit) => (
                                        <button
                                            key={fit}
                                            onClick={() => setImageFit(fit as any)}
                                            className={clsx(
                                                "px-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                                                imageFit === fit 
                                                    ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                                                    : "bg-white/5 border-white/5 text-neutral-500 hover:text-white hover:bg-white/10"
                                            )}
                                        >
                                            {fit}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dynamics Section */}
                            <div className="space-y-4">
                                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em] block pl-1">Dynamics</span>
                                
                                <button
                                    onClick={() => setAmbientMode(ambientMode === 'blurred-page' ? 'adaptive-vibrant' : 'blurred-page')}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <Sparkles size={16} className={clsx(ambientMode === 'adaptive-vibrant' ? "text-accent" : "text-neutral-500")} />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Adaptive UI</span>
                                    </div>
                                    <div className={clsx(
                                        "w-8 h-4 rounded-full relative transition-colors",
                                        ambientMode === 'adaptive-vibrant' ? "bg-accent" : "bg-neutral-800"
                                    )}>
                                        <motion.div 
                                            animate={{ x: ambientMode === 'adaptive-vibrant' ? 16 : 0 }}
                                            className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full"
                                        />
                                    </div>
                                </button>
                            </div>

                            {/* Contextual Controllers */}
                            <div className="pt-2">
                                {mode === 'vertical' && (
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em]">Scroll Speed</span>
                                                <span className="text-[10px] font-black text-accent">{scrollSpeed} PPS</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button onClick={() => handleSpeedChange(-10)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10"><Minus size={14} /></button>
                                                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        animate={{ width: `${(scrollSpeed / 500) * 100}%` }}
                                                        className="h-full bg-accent shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                    />
                                                </div>
                                                <button onClick={() => handleSpeedChange(10)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10"><Plus size={14} /></button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em]">Page Spacing</span>
                                                <span className="text-[10px] font-black text-blue-400">{gapSize}px</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button onClick={() => setGapSize(Math.max(0, gapSize - 8))} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10"><Minus size={14} /></button>
                                                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        animate={{ width: `${(gapSize / 100) * 100}%` }}
                                                        className="h-full bg-blue-400"
                                                    />
                                                </div>
                                                <button onClick={() => setGapSize(Math.min(100, gapSize + 8))} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {mode === 'slideshow' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.4em]">Frame Delay</span>
                                            <span className="text-[10px] font-black text-purple-400">{(slideshowInterval / 1000).toFixed(1)}s</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => handleDelayChange(-500)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10"><Minus size={14} /></button>
                                            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                                <motion.div 
                                                    animate={{ width: `${(slideshowInterval / 20000) * 100}%` }}
                                                    className="h-full bg-purple-500"
                                                />
                                            </div>
                                            <button onClick={() => handleDelayChange(500)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10"><Plus size={14} /></button>
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
                                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
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
                    isOpen ? "bg-accent text-white rotate-90" : "bg-black/60 text-neutral-400 hover:text-white"
                )}
            >
                {isOpen ? <X size={24} /> : <Settings2 size={24} />}
            </motion.button>
        </div>
    );
};
