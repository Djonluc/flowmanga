import { useSettingsStore, type ReadingMode } from '../../stores/useSettingsStore';
import { Layout, Maximize, Clock, GalleryHorizontal, GalleryVertical, Layers, Play } from 'lucide-react';
import clsx from 'clsx';

export const ReaderSettings = () => {
    const { 
        readingMode, setReadingMode,
        gapSize, setGapSize,
        fitMode, setFitMode,
        slideshowInterval, setSlideshowInterval,
        slideshowTransition, setSlideshowTransition
    } = useSettingsStore();

    const modes: { id: ReadingMode; label: string; icon: any; desc: string }[] = [
        { id: 'vertical', label: 'Vertical Scroll', icon: GalleryVertical, desc: 'Webtoon style continuous scroll' },
        { id: 'single', label: 'Single Page', icon: GalleryHorizontal, desc: 'Classic manga page-by-page' },
        { id: 'slideshow', label: 'Cinematic', icon: Play, desc: 'Auto-playing cinematic slideshow' },
        { id: 'dual', label: 'Dual Page', icon: Layers, desc: 'Two pages side-by-side spread' },
    ];

    return (
        <div className="flex flex-col gap-8 pb-12 w-full max-w-5xl mx-auto">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter">Reader Experience</h2>
                    <p className="text-foreground-dim font-bold tracking-wide mt-1">Configure layout, reading direction, and cinematic playback.</p>
                </div>
            </div>

            {/* Reading Mode Selection */}
            <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />
                <h3 className="text-foreground font-black uppercase tracking-widest text-sm italic opacity-50 mb-6 relative z-10">Viewer Mode</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                    {modes.map((m) => {
                        const Icon = m.icon;
                        const active = readingMode === m.id;
                        return (
                            <button
                                key={m.id}
                                onClick={() => setReadingMode(m.id)}
                                className={clsx(
                                    "flex flex-col p-5 rounded-2xl border transition-all text-left relative overflow-hidden",
                                    active 
                                        ? "bg-blue-500/10 border-blue-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" 
                                        : "bg-surface border-border-subtle hover:border-white/20"
                                )}
                            >
                                {active && <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />}
                                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center mb-3", active ? "bg-blue-500/20 text-blue-400" : "bg-surface-elevated text-foreground-dim")}>
                                    <Icon size={20} />
                                </div>
                                <span className={clsx("text-sm font-black tracking-wide", active ? "text-blue-400" : "text-foreground")}>{m.label}</span>
                                <span className="text-[10px] font-medium text-foreground-dim mt-1 line-clamp-2">{m.desc}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Layout Spacing */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden">
                    <div className="flex items-start justify-between relative z-10 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                                <Layout size={24} />
                            </div>
                            <div>
                                <h3 className="text-foreground font-black text-lg">Page Spacing</h3>
                                <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest">Gap between pages</p>
                            </div>
                        </div>
                        <span className="text-2xl font-black text-foreground italic">{gapSize}px</span>
                    </div>
                    
                    <div className="relative z-10 px-2 mt-8">
                        <input 
                            type="range" min="0" max="100" step="5" value={gapSize}
                            onChange={(e) => setGapSize(Number(e.target.value))}
                            className="w-full h-2 bg-black/40 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                        />
                        <div className="flex justify-between mt-3 px-1">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground-dim">Seamless (0px)</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-foreground-dim">Wide (100px)</span>
                        </div>
                    </div>
                </div>

                {/* Page Fitting */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden">
                    <div className="flex items-start justify-between relative z-10 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <Maximize size={24} />
                            </div>
                            <div>
                                <h3 className="text-foreground font-black text-lg">Image Fitting</h3>
                                <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Scale mode</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 relative z-10 mt-8">
                        {[
                            { id: 'width', label: 'Fit Width' },
                            { id: 'height', label: 'Fit Height' },
                            { id: 'original', label: 'Original' }
                        ].map((m) => (
                            <button
                                key={m.id}
                                onClick={() => setFitMode(m.id as any)}
                                className={clsx(
                                    "py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                                    fitMode === m.id 
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                        : "bg-surface-elevated border-border-subtle text-foreground-dim hover:text-foreground hover:border-white/20"
                                )}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Slideshow Configuration */}
                {readingMode === 'slideshow' && (
                    <div className="col-span-1 lg:col-span-2 glass-panel p-6 rounded-[32px] border border-blue-500/20 bg-blue-500/5 relative overflow-hidden">
                        <h3 className="text-blue-400 font-black uppercase tracking-widest text-sm italic opacity-80 mb-6">Cinematic Playback</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Slideshow Interval */}
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-foreground font-bold">Duration</h4>
                                            <span className="text-[10px] text-foreground-dim font-bold uppercase tracking-widest">Time per page</span>
                                        </div>
                                    </div>
                                    <span className="text-xl font-black text-blue-400 italic">{(slideshowInterval / 1000).toFixed(1)}s</span>
                                </div>
                                
                                <input 
                                    type="range" min="1000" max="10000" step="500" value={slideshowInterval}
                                    onChange={(e) => setSlideshowInterval(Number(e.target.value))}
                                    className="w-full h-2 bg-black/40 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                                />
                                <div className="flex justify-between mt-3 px-1">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-foreground-dim">Fast (1s)</span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-foreground-dim">Slow (10s)</span>
                                </div>
                            </div>

                            {/* Slideshow Transition */}
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                            <Layers size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-foreground font-bold">Transition</h4>
                                            <span className="text-[10px] text-foreground-dim font-bold uppercase tracking-widest">Animation style</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-2">
                                    {['fade', 'slide', 'none'].map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setSlideshowTransition(t as any)}
                                            className={clsx(
                                                "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                                slideshowTransition === t 
                                                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300" 
                                                    : "bg-black/20 border-transparent text-foreground-dim hover:text-foreground hover:bg-white/5"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
