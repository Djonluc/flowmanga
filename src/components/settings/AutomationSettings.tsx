import { useAutomationStore } from '../../stores/useAutomationStore';
import { Sparkles, Clock, AlertCircle } from 'lucide-react';

export const AutomationSettings = () => {
    const { 
        isEnabled, setEnabled, 
        checkIntervalMinutes, setCheckInterval,
        lastCheckTime, isChecking, checkForUpdates
    } = useAutomationStore();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Background Polling Toggle */}
            <div className="bg-white/[0.03] border border-white/5 rounded-[32px] p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h4 className="text-foreground font-black uppercase tracking-tighter italic flex items-center gap-2">
                            <Sparkles size={18} className="text-indigo-400" />
                            Auto-Check for Chapters
                        </h4>
                        <p className="text-foreground-dim text-xs font-bold leading-relaxed">
                            Automatically monitor your library for new chapter releases.
                        </p>
                    </div>
                    <button 
                        onClick={() => setEnabled(!isEnabled)}
                        className={`w-14 h-8 rounded-full transition-all relative ${isEnabled ? 'bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-white/10'}`}
                    >
                        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${isEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-6">
                    {/* Interval Slider */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase tracking-widest text-foreground-dim flex items-center gap-2">
                                <Clock size={12} />
                                Check Frequency
                            </label>
                            <span className="text-indigo-400 font-black text-sm">
                                {checkIntervalMinutes >= 60 
                                    ? `${Math.floor(checkIntervalMinutes / 60)}h ${checkIntervalMinutes % 60}m` 
                                    : `${checkIntervalMinutes} min`}
                            </span>
                        </div>
                        <input 
                            type="range"
                            min="15"
                            max="720"
                            step="15"
                            value={checkIntervalMinutes}
                            onChange={(e) => setCheckInterval(parseInt(e.target.value))}
                            className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[8px] font-bold text-foreground-muted uppercase tracking-widest">
                            <span>15m</span>
                            <span>12h</span>
                        </div>
                    </div>

                    {/* Status Info */}
                    <div className="flex items-center justify-between bg-black/40 rounded-2xl p-4 border border-white/5">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-foreground-dim uppercase tracking-widest">Last Sync</span>
                            <span className="text-xs text-foreground-muted font-bold tracking-tight">
                                {lastCheckTime ? new Date(lastCheckTime).toLocaleString() : 'Never'}
                            </span>
                        </div>
                        <button 
                            onClick={() => checkForUpdates()}
                            disabled={isChecking}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isChecking ? 'bg-indigo-500/20 text-indigo-400 animate-pulse' : 'bg-white/5 hover:bg-white/10 text-foreground border border-white/5'}`}
                        >
                            {isChecking ? 'Checking...' : 'Check Now'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Smart Reconciliation Info */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[32px] p-8 flex gap-4">
                <AlertCircle className="text-amber-500 shrink-0" size={24} />
                <div className="space-y-2">
                    <h4 className="text-amber-500 font-black uppercase tracking-tighter italic text-sm">
                        Smart Reconciliation
                    </h4>
                    <p className="text-amber-500/70 text-xs font-bold leading-relaxed">
                        FlowManga compares your local file count against the source's feed. If a new chapter is detected, you'll receive a notification and a "New" badge in your library.
                    </p>
                </div>
            </div>
        </div>
    );
};
