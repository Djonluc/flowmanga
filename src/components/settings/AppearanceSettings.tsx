import { useSettingsStore, type Theme, type AmbientMode } from '../../stores/useSettingsStore';
import { Palette, Zap, Sun, Moon, FileText } from 'lucide-react';
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

    const themes: { id: Theme; label: string; icon: any; color: string }[] = [
        { id: 'dark', label: 'Dark', icon: Moon, color: '#1a1a1a' },
        { id: 'light', label: 'Light', icon: Sun, color: '#ffffff' },
        { id: 'oled', label: 'OLED', icon: Palette, color: '#000000' },
        { id: 'paper', label: 'Paper', icon: FileText, color: '#f5f5dc' },
        { id: 'cyberpunk', label: 'Cyber', icon: Zap, color: '#ff00ff' },
    ];

    const ambientModes: { id: AmbientMode; label: string }[] = [
        { id: 'blurred-page', label: 'Page Blur' },
        { id: 'blurred-cover', label: 'Cover Blur' },
        { id: 'gradient', label: 'Gradient' },
        { id: 'solid', label: 'Solid Color' },
    ];

    return (
        <div className="space-y-8">
            {/* Theme Selection */}
            <section className="space-y-4">
                <h4 className="text-foreground font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Interface Theme
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {themes.map((t) => {
                        const Icon = t.icon;
                        const active = theme === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setTheme(t.id)}
                                className={clsx(
                                    "flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all relative overflow-hidden",
                                    active 
                                        ? "border-blue-500 ring-1 ring-blue-500 shadow-lg shadow-blue-900/40" 
                                        : "border-white/5 hover:bg-white/5 opacity-60 hover:opacity-100"
                                )}
                                style={{ backgroundColor: active ? `${t.color}33` : 'transparent' }}
                            >
                                <Icon size={24} style={{ color: active ? '#3b82f6' : 'currentColor' }} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                                {active && <div className="absolute inset-0 bg-blue-500/10" />}
                            </button>
                        );
                    })}
                </div>
            </section>

             {/* Ambient System */}
             <section className="space-y-4">
                <h4 className="text-foreground font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Ambient Atmosphere
                </h4>
                
                {/* Mode Selector */}
                <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 mb-6">
                    {ambientModes.map((m) => (
                        <button
                            key={m.id}
                            onClick={() => setAmbientMode(m.id)}
                            className={clsx(
                                "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                ambientMode === m.id 
                                    ? "bg-blue-600 text-white shadow-lg" 
                                    : "text-foreground-dim hover:text-foreground"
                            )}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-center text-xs font-bold uppercase text-foreground-dim">
                             <span>Intensity</span>
                             <span className="text-foreground">{Math.round(ambientIntensity * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="1" step="0.05"
                            value={ambientIntensity}
                            onChange={(e) => setAmbientIntensity(Number(e.target.value))}
                            className="w-full accent-blue-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>
                    
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-center text-xs font-bold uppercase text-foreground-dim">
                             <span>Blur Radius</span>
                             <span className="text-foreground">{ambientBlur}px</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="120" step="5"
                            value={ambientBlur}
                            onChange={(e) => setAmbientBlur(Number(e.target.value))}
                            className="w-full accent-blue-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4">
                        <div className="flex justify-between items-center text-xs font-bold uppercase text-foreground-dim">
                             <span>Brightness</span>
                             <span className="text-foreground">{Math.round(ambientBrightness * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="2" step="0.1"
                            value={ambientBrightness}
                            onChange={(e) => setAmbientBrightness(Number(e.target.value))}
                            className="w-full accent-blue-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-foreground-dim">Texture Noise</span>
                        <button 
                            onClick={() => setAmbientNoise(!showAmbientNoise)}
                            className={clsx(
                                "w-12 h-6 rounded-full transition-colors relative",
                                showAmbientNoise ? "bg-blue-600" : "bg-white/10"
                            )}
                        >
                            <div className={clsx(
                                "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                                showAmbientNoise ? "translate-x-6" : "translate-x-0"
                            )} />
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};
