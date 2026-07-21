import { useSettingsStore, type Theme, type AmbientMode } from '../../stores/useSettingsStore';
import { Palette, Zap, Sun, Moon, FileText, LayoutTemplate, Layers, Eye, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';

export const AppearanceSettings = () => {
    const { 
        theme, setTheme,
        ambientMode, setAmbientMode,
        ambientBlur, setAmbientBlur,
        ambientIntensity, setAmbientIntensity,
        ambientBrightness, setAmbientBrightness,
        showAmbientNoise, setAmbientNoise,
    } = useSettingsStore();

    const themes: { id: Theme; label: string; icon: any; color: string; bg: string }[] = [
        { id: 'dark', label: 'Dark', icon: Moon, color: '#3b82f6', bg: '#0f172a' },
        { id: 'oled', label: 'OLED', icon: Eye, color: '#10b981', bg: '#000000' },
        { id: 'amethyst', label: 'Amethyst', icon: Zap, color: '#c084fc', bg: '#2e1065' },
        { id: 'paper', label: 'Paper', icon: FileText, color: '#a74620', bg: '#fffaf0' },
        { id: 'light', label: 'Light', icon: Sun, color: '#eab308', bg: '#f8fafc' },
    ];

    const ambientModes: { id: AmbientMode; label: string; desc: string }[] = [
        { id: 'blurred-page', label: 'Page Blur', desc: 'Dynamic blur based on current reading page' },
        { id: 'blurred-cover', label: 'Cover Blur', desc: 'Static blur based on series cover art' },
        { id: 'gradient', label: 'Gradient Mesh', desc: 'Smooth animated cinematic mesh' },
        { id: 'solid', label: 'Solid Color', desc: 'Minimal solid color backing' },
    ];

    return (
        <div className="flex flex-col gap-6 sm:gap-8 pb-12 w-full max-w-5xl mx-auto">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-foreground uppercase tracking-tighter">Appearance</h2>
                    <p className="text-sm sm:text-base text-foreground-muted font-semibold tracking-wide mt-1">Customize themes and configure the ambient background engine.</p>
                </div>
            </div>

            {/* Interface Theme Selection */}
            <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-[32px] border border-border-subtle relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[80px] rounded-full pointer-events-none" />
                <h3 className="text-foreground font-black uppercase tracking-widest text-sm italic opacity-50 mb-6 relative z-10">Application Theme</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 relative z-10">
                    {themes.map((t) => {
                        const Icon = t.icon;
                        const active = theme === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setTheme(t.id)}
                                className={clsx(
                                    "flex flex-col items-center justify-center p-5 rounded-2xl border transition-all relative overflow-hidden",
                                    active 
                                        ? "ring-2 ring-offset-2 ring-offset-surface shadow-xl" 
                                        : "border-border-subtle hover:border-border-strong hover:bg-surface-raised opacity-90 hover:opacity-100 bg-surface"
                                )}
                                style={{ 
                                   borderColor: active ? t.color : undefined,
                                   backgroundColor: active ? `${t.color}22` : undefined,
                                }}
                            >
                                <div 
                                    className="w-12 h-12 rounded-full mb-3 shadow-inner flex items-center justify-center"
                                    style={{ backgroundColor: t.bg }}
                                >
                                    <Icon size={20} style={{ color: t.color }} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: active ? t.color : 'var(--color-foreground)' }}>{t.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Ambient Mode Selection */}
                <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-[32px] border border-border-subtle relative overflow-hidden lg:col-span-2">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
                    
                    <div className="flex items-center gap-4 mb-6 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <Layers size={24} />
                        </div>
                        <div>
                            <h3 className="text-foreground font-black text-lg">Ambient Background</h3>
                            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest">Atmosphere Engine</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                        {ambientModes.map((m) => (
                            <button
                                key={m.id}
                                onClick={() => setAmbientMode(m.id)}
                                className={clsx(
                                    "flex flex-col p-4 rounded-xl border transition-all text-left relative overflow-hidden",
                                    ambientMode === m.id 
                                        ? "bg-blue-500/10 border-blue-500/30" 
                                        : "bg-surface border-border-subtle hover:border-border-strong"
                                )}
                            >
                                {ambientMode === m.id && <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />}
                                <span className={clsx("text-sm font-black tracking-wide", ambientMode === m.id ? "text-blue-400" : "text-foreground")}>{m.label}</span>
                                <span className="text-[10px] font-medium text-foreground-dim mt-1 line-clamp-2">{m.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ambient Tuning */}
                <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-[32px] border border-border-subtle relative overflow-hidden lg:col-span-2">
                    <div className="flex items-center gap-4 mb-6 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <SlidersHorizontal size={24} />
                        </div>
                        <div>
                            <h3 className="text-foreground font-black text-lg">Engine Tuning</h3>
                            <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest">Fine-tune visuals</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                        <div className="bg-surface-elevated p-5 rounded-2xl border border-border-subtle">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-foreground font-bold text-sm">Intensity</h4>
                                <span className="text-xl font-black text-purple-400 italic">{Math.round(ambientIntensity * 100)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="1" step="0.05" value={ambientIntensity}
                                onChange={(e) => setAmbientIntensity(Number(e.target.value))}
                                className="w-full h-2 bg-border-strong rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                            />
                        </div>

                        <div className="bg-surface-elevated p-5 rounded-2xl border border-border-subtle">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-foreground font-bold text-sm">Blur Radius</h4>
                                <span className="text-xl font-black text-emerald-400 italic">{ambientBlur}px</span>
                            </div>
                            <input 
                                type="range" min="0" max="120" step="5" value={ambientBlur}
                                onChange={(e) => setAmbientBlur(Number(e.target.value))}
                                className="w-full h-2 bg-border-strong rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                            />
                        </div>

                        <div className="bg-surface-elevated p-5 rounded-2xl border border-border-subtle">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-foreground font-bold text-sm">Brightness</h4>
                                <span className="text-xl font-black text-amber-400 italic">{Math.round(ambientBrightness * 100)}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="2" step="0.1" value={ambientBrightness}
                                onChange={(e) => setAmbientBrightness(Number(e.target.value))}
                                className="w-full h-2 bg-border-strong rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                            />
                        </div>

                        {/* Texture Noise Toggle */}
                        <div className="col-span-1 md:col-span-3 bg-surface-elevated p-5 rounded-2xl border border-border-subtle flex items-center justify-between">
                            <div>
                                <h4 className="text-foreground font-bold text-sm">Cinematic Texture Noise</h4>
                                <p className="text-foreground-dim text-[10px] font-medium mt-1">Applies a subtle film grain effect over the ambient background.</p>
                            </div>
                            <button 
                                onClick={() => setAmbientNoise(!showAmbientNoise)}
                                className={clsx(
                                    "w-14 h-8 rounded-full transition-colors relative flex-shrink-0",
                                    showAmbientNoise ? "bg-accent" : "bg-surface-raised border border-border-strong"
                                )}
                            >
                                <div className={clsx(
                                    "absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform",
                                    showAmbientNoise ? "translate-x-6 shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "translate-x-0"
                                )} />
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
