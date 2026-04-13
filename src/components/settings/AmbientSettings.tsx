import { useEffect } from 'react';
import { Volume2, X, MonitorPlay, CloudRain, Coffee, Wind, Zap, Plus, FileAudio } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import clsx from 'clsx';

export const AmbientSettings = () => {
    const { 
        selectedAmbientSound, setSelectedAmbientSound,
        ambientVolume, setAmbientVolume,
        availableSounds, loadAvailableSounds, importSound
    } = useSettingsStore();

    useEffect(() => {
        loadAvailableSounds();
    }, []);

    const defaultSounds = [
        { id: 'none', icon: X, label: 'Off' },
        { id: 'lofi', icon: MonitorPlay, label: 'Lofi' },
        { id: 'rain', icon: CloudRain, label: 'Rain' },
        { id: 'cafe', icon: Coffee, label: 'Cafe' },
        { id: 'wind', icon: Wind, label: 'Wind' },
        { id: 'space', icon: Zap, label: 'Space' },
    ];

    const handleImport = async () => {
        try {
            const selected = await openDialog({
                multiple: false,
                filters: [{ name: 'Audio', extensions: ['mp3', 'ogg', 'wav', 'm4a'] }]
            });
            if (selected && typeof selected === 'string') {
                await importSound(selected);
            }
        } catch (err) {
            console.error('[AmbientSettings] Import failed:', err);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Volume Control */}
            <section className="space-y-4">
                <h4 className="text-white font-black uppercase tracking-widest text-xs border-b border-white/10 pb-2">
                    Master Volume
                </h4>
                <div className="bg-white/5 p-6 rounded-[32px] border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 text-neutral-400">
                            <Volume2 size={18} />
                            <span className="text-xs font-bold uppercase tracking-wider">Ambient Level</span>
                         </div>
                         <span className="text-sm font-black text-blue-500 italic">{Math.round(ambientVolume * 100)}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="1" step="0.05"
                        value={ambientVolume}
                        onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
            </section>

            {/* Sound Library */}
            <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="text-white font-black uppercase tracking-widest text-xs">
                        Sound Library
                    </h4>
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                        {defaultSounds.length + availableSounds.length} Available
                    </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Default Sounds */}
                    {defaultSounds.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => setSelectedAmbientSound(s.id)}
                            className={clsx(
                                "flex flex-col items-center justify-center gap-3 p-6 rounded-[24px] border transition-all relative overflow-hidden group",
                                selectedAmbientSound === s.id
                                    ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10"
                                    : "bg-white/2 border-white/5 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                            )}
                        >
                            <s.icon size={24} className={clsx("transition-transform group-hover:scale-110", selectedAmbientSound === s.id && "animate-pulse")} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center">{s.label}</span>
                            {selectedAmbientSound === s.id && <div className="absolute inset-0 bg-blue-500/5" />}
                        </button>
                    ))}

                    {/* Custom Sounds */}
                    {availableSounds.map((s) => (
                        <button
                            key={s.path}
                            onClick={() => setSelectedAmbientSound(s.path)}
                            className={clsx(
                                "flex flex-col items-center justify-center gap-3 p-6 rounded-[24px] border transition-all relative overflow-hidden group",
                                selectedAmbientSound === s.path
                                    ? "bg-purple-600/10 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/10"
                                    : "bg-white/2 border-white/5 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                            )}
                        >
                            <FileAudio size={24} className={clsx("transition-transform group-hover:scale-110", selectedAmbientSound === s.path && "animate-pulse")} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center truncate w-full px-2" title={s.name}>
                                {s.name}
                            </span>
                            {selectedAmbientSound === s.path && <div className="absolute inset-0 bg-purple-500/5" />}
                        </button>
                    ))}

                    {/* Add Button */}
                    <button
                        onClick={handleImport}
                        className="flex flex-col items-center justify-center gap-3 p-6 rounded-[24px] border border-dashed border-white/10 text-neutral-500 hover:bg-white/5 hover:text-white transition-all group"
                    >
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <Plus size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-center">Add Custom</span>
                    </button>
                </div>
            </section>
        </div>
    );
};
