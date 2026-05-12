import { useSettingsStore, type ReadingMode } from '../../stores/useSettingsStore';
import { Layout, Maximize, Clock, GalleryHorizontal, GalleryVertical, Layers } from 'lucide-react';
import clsx from 'clsx';

export const ReaderSettings = () => {
    const { 
        readingMode, setReadingMode,
        gapSize, setGapSize,
        fitMode, setFitMode,
        slideshowInterval, setSlideshowInterval,
        slideshowTransition, setSlideshowTransition
    } = useSettingsStore();

    const modes: { id: ReadingMode; label: string; icon: any }[] = [
        { id: 'vertical', label: 'Vertical', icon: GalleryVertical },
        { id: 'single', label: 'Single', icon: GalleryHorizontal },
        { id: 'slideshow', label: 'Slideshow', icon: PlayIcon }, // Define local icon or import Play
        { id: 'dual', label: 'Dual', icon: Layers },
    ];

    return (
        <div className="space-y-8">
            {/* Reading Mode */}
            <section className="space-y-4">
                <h4 className="text-foreground font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Viewer Mode
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {modes.map((m) => {
                        const Icon = m.icon;
                        const active = readingMode === m.id;
                        return (
                            <button
                                key={m.id}
                                onClick={() => setReadingMode(m.id)}
                                className={clsx(
                                    "flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all",
                                    active 
                                        ? "bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/40" 
                                        : "bg-white/5 border-white/5 hover:bg-white/10 text-foreground-dim hover:text-foreground"
                                )}
                            >
                                <Icon size={24} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

             {/* Layout Controls */}
             <section className="space-y-4">
                <h4 className="text-foreground font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Layout
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Gap Size */}
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold uppercase text-foreground-dim">
                             <span className="flex items-center gap-2"><Layout size={14} /> Page Spacing</span>
                             <span className="text-foreground">{gapSize}px</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="100" step="5"
                            value={gapSize}
                            onChange={(e) => setGapSize(Number(e.target.value))}
                            className="w-full accent-blue-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>

                    {/* Fit Mode */}
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold uppercase text-foreground-dim">
                             <span className="flex items-center gap-2"><Maximize size={14} /> Fitting</span>
                             <span className="text-foreground capitalize">{fitMode}</span>
                        </div>
                        <div className="flex p-1 bg-black/40 rounded-lg">
                            {['width', 'height', 'original'].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setFitMode(m as any)}
                                    className={clsx(
                                        "flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all",
                                        fitMode === m ? "bg-white/20 text-foreground" : "text-foreground-dim hover:text-foreground"
                                    )}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Slideshow Config */}
            {readingMode === 'slideshow' && (
                <section className="space-y-4">
                    <h4 className="text-foreground font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                        Slideshow Configuration
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Interval */}
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                             <div className="flex justify-between items-center text-xs font-bold uppercase text-foreground-dim">
                                 <span className="flex items-center gap-2"><Clock size={14} /> Duration</span>
                                 <span className="text-foreground">{(slideshowInterval / 1000).toFixed(1)}s</span>
                            </div>
                            <input 
                                type="range" 
                                min="1000" max="10000" step="500"
                                value={slideshowInterval}
                                onChange={(e) => setSlideshowInterval(Number(e.target.value))}
                                className="w-full accent-blue-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                            />
                        </div>

                         {/* Transition */}
                         <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                             <div className="flex justify-between items-center text-xs font-bold uppercase text-foreground-dim">
                                 <span className="flex items-center gap-2"><Layers size={14} /> Transition</span>
                                 <span className="text-foreground capitalize">{slideshowTransition}</span>
                            </div>
                            <div className="flex p-1 bg-black/40 rounded-lg">
                                {['fade', 'slide', 'none'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setSlideshowTransition(t as any)}
                                        className={clsx(
                                            "flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all",
                                            slideshowTransition === t ? "bg-white/20 text-foreground" : "text-foreground-dim hover:text-foreground"
                                        )}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};

// Simple Icon for Play
function PlayIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    )
  }
