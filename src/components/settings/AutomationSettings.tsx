import { useAutomationStore } from '../../stores/useAutomationStore';
import { Sparkles, Clock, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import clsx from 'clsx';

export const AutomationSettings = () => {
    const { 
        isEnabled, setEnabled, 
        checkIntervalMinutes, setCheckInterval,
        lastCheckTime, isChecking, checkForUpdates
    } = useAutomationStore();

    return (
        <div className="flex flex-col gap-8 pb-12 w-full max-w-5xl mx-auto">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter">Automation</h2>
                    <p className="text-foreground-dim font-bold tracking-wide mt-1">Configure background polling and smart library reconciliation.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Background Polling Engine */}
                <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden group lg:col-span-2">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-indigo-500/20 transition-colors" />
                    
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="text-foreground font-black text-lg">Background Polling</h3>
                                <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest">Library Auto-Sync</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setEnabled(!isEnabled)}
                            className={clsx(
                                "w-14 h-8 rounded-full transition-colors relative flex-shrink-0",
                                isEnabled ? "bg-indigo-500" : "bg-black/40 border border-white/10"
                            )}
                        >
                            <div className={clsx(
                                "absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform",
                                isEnabled ? "translate-x-6 shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "translate-x-0"
                            )} />
                        </button>
                    </div>
                    
                    <div className={clsx("grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 transition-opacity", !isEnabled && "opacity-40 pointer-events-none")}>
                        {/* Check Frequency */}
                        <div className="bg-surface-elevated p-5 rounded-2xl border border-border-subtle hover:border-indigo-500/30 transition-colors">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <Clock size={16} className="text-indigo-500" />
                                    <h4 className="text-foreground font-bold text-sm uppercase tracking-wide">Polling Frequency</h4>
                                </div>
                                <span className="text-xl font-black text-indigo-400 italic">
                                    {checkIntervalMinutes >= 60 
                                        ? `${Math.floor(checkIntervalMinutes / 60)}h ${checkIntervalMinutes % 60}m` 
                                        : `${checkIntervalMinutes} min`}
                                </span>
                            </div>
                            <input 
                                type="range" min="15" max="720" step="15" value={checkIntervalMinutes}
                                onChange={(e) => setCheckInterval(parseInt(e.target.value))}
                                className="w-full h-2 bg-black/40 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer shadow-inner"
                            />
                            <div className="flex justify-between mt-3 px-1">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-foreground-dim">15m</span>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-foreground-dim">12h</span>
                            </div>
                        </div>

                        {/* Status Check */}
                        <div className="bg-surface-elevated p-5 rounded-2xl border border-border-subtle flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex flex-col gap-1">
                                    <h4 className="text-foreground font-bold text-sm uppercase tracking-wide">Last Sync</h4>
                                    <span className="text-[10px] font-bold text-foreground-dim uppercase tracking-widest">
                                        {lastCheckTime ? new Date(lastCheckTime).toLocaleString() : 'Never'}
                                    </span>
                                </div>
                                {isChecking && <RefreshCw size={20} className="text-indigo-400 animate-spin" />}
                            </div>
                            <button 
                                onClick={() => checkForUpdates()}
                                disabled={isChecking}
                                className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                {isChecking ? 'Checking for updates...' : 'Force Manual Check'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Smart Reconciliation Info */}
                <div className="glass-panel p-6 rounded-[32px] border border-amber-500/20 bg-amber-500/5 relative overflow-hidden lg:col-span-2 flex items-center justify-between group">
                    <div className="flex items-start gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
                            <Layers size={24} />
                        </div>
                        <div>
                            <h3 className="text-foreground font-black text-lg text-amber-100 mb-1">Smart Reconciliation</h3>
                            <p className="text-amber-400/80 text-sm font-bold leading-relaxed max-w-3xl">
                                FlowManga compares your local file count against the source's feed. If a new chapter is detected, you'll receive a notification and a "New" badge in your library automatically.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
