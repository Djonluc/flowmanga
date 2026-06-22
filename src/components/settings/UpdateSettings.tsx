import { useState } from 'react';
import { RefreshCw, Download, ExternalLink, CheckCircle2, AlertCircle, Loader2, Clock, Star, Wrench, TrendingUp, Zap, Monitor, Globe } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { AppVersionService } from '../../services/AppVersionService';
import type { ReleaseNote } from '../../services/AppVersionService';
import clsx from 'clsx';

const categoryConfig: Record<
  ReleaseNote['category'],
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  features:     { label: 'New Features',    color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   icon: <Star size={14} /> },
  improvements: { label: 'Improvements',   color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', icon: <TrendingUp size={14} /> },
  fixes:        { label: 'Bug Fixes',       color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20',icon: <Wrench size={14} /> },
  performance:  { label: 'Performance',    color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',  icon: <Zap size={14} /> },
  ui:           { label: 'UI / UX',         color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/20',   icon: <Monitor size={14} /> },
  sources:      { label: 'Source Support',  color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20',   icon: <Globe size={14} /> },
  other:        { label: 'Other',           color: 'text-foreground-dim', bg: 'bg-white/5 border-white/10',       icon: null },
};

const categoryOrder: ReleaseNote['category'][] = ['features', 'improvements', 'fixes', 'performance', 'ui', 'sources', 'other'];

function formatLastChecked(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return 'Unknown';
  }
}

export const UpdateSettings = () => {
  const { updateInfo, updateStatus, setUpdateInfo, setUpdateStatus } = useSettingsStore();
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedDisplay, setLastCheckedDisplay] = useState<string>(
    formatLastChecked(AppVersionService.getLastChecked()),
  );

  const currentVersion = AppVersionService.getCurrentVersion();

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    setUpdateStatus('checking');
    AppVersionService.clearDismissal();
    try {
      const info = await AppVersionService.checkForUpdates();
      setUpdateInfo(info);
      setLastCheckedDisplay(formatLastChecked(AppVersionService.getLastChecked()));
    } catch (_) {
      setUpdateStatus('error');
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownload = async () => {
    await AppVersionService.openDownloadPage(updateInfo?.downloadUrl);
  };

  const handleViewOnGitHub = async () => {
    await AppVersionService.openDownloadPage(updateInfo?.releaseUrl);
  };

  const notesByCategory = updateInfo?.notes.reduce(
    (acc, note) => {
      if (!acc[note.category]) acc[note.category] = [];
      acc[note.category].push(note);
      return acc;
    },
    {} as Record<ReleaseNote['category'], ReleaseNote[]>,
  ) ?? {};
  const orderedCategories = categoryOrder.filter(c => notesByCategory[c]?.length > 0);

  return (
    <div className="flex flex-col gap-8 pb-12 w-full max-w-5xl mx-auto">
        {/* Header Area */}
        <div className="flex items-center justify-between mb-2">
            <div>
                <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter">System Updates</h2>
                <p className="text-foreground-dim font-bold tracking-wide mt-1">Check for new versions and review changelogs.</p>
            </div>
            <button 
                onClick={handleCheckForUpdates}
                disabled={isChecking}
                className={clsx(
                    "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                    isChecking ? "bg-white/5 text-foreground-dim" : "bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20"
                )}
            >
                {isChecking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {isChecking ? 'Checking...' : 'Check Now'}
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Current Version */}
            <div className="glass-panel p-6 rounded-[32px] border border-border-subtle relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[50px] rounded-full pointer-events-none" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground-dim mb-4 relative z-10">Installed Version</h4>
                <div className="flex items-end gap-2 relative z-10">
                    <span className="text-4xl font-black text-foreground tracking-tighter">v{currentVersion}</span>
                </div>
                <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-foreground-muted uppercase tracking-widest relative z-10">
                    <Clock size={12} /> Last checked: {lastCheckedDisplay}
                </div>
            </div>

            {/* Latest Version Status */}
            <div className={clsx(
                "glass-panel p-6 rounded-[32px] border relative overflow-hidden group lg:col-span-2",
                updateStatus === 'available' ? "border-blue-500/30 bg-blue-500/5" :
                updateStatus === 'up-to-date' ? "border-emerald-500/30 bg-emerald-500/5" :
                updateStatus === 'error' ? "border-red-500/30 bg-red-500/5" : "border-border-subtle"
            )}>
                {updateStatus === 'available' && <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />}
                {updateStatus === 'up-to-date' && <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />}
                
                <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground-dim mb-4 relative z-10">Status</h4>
                
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className={clsx(
                            "w-12 h-12 rounded-2xl flex items-center justify-center",
                            updateStatus === 'available' ? "bg-blue-500/20 text-blue-400" :
                            updateStatus === 'up-to-date' ? "bg-emerald-500/20 text-emerald-400" :
                            updateStatus === 'error' ? "bg-red-500/20 text-red-400" : "bg-surface-elevated text-foreground-dim"
                        )}>
                            {updateStatus === 'checking' || isChecking ? <Loader2 size={24} className="animate-spin" /> :
                             updateStatus === 'available' ? <Download size={24} /> :
                             updateStatus === 'up-to-date' ? <CheckCircle2 size={24} /> :
                             updateStatus === 'error' ? <AlertCircle size={24} /> : <RefreshCw size={24} />}
                        </div>
                        <div>
                            <h3 className={clsx(
                                "text-2xl font-black tracking-tight",
                                updateStatus === 'available' ? "text-blue-400" :
                                updateStatus === 'up-to-date' ? "text-emerald-400" :
                                updateStatus === 'error' ? "text-red-400" : "text-foreground"
                            )}>
                                {updateStatus === 'checking' || isChecking ? 'Checking for updates...' :
                                 updateStatus === 'available' ? `Update Available: v${updateInfo?.latestVersion}` :
                                 updateStatus === 'up-to-date' ? 'You are up to date' :
                                 updateStatus === 'error' ? 'Check Failed' : 'Unknown Status'}
                            </h3>
                            {updateInfo?.releaseDate && updateStatus === 'available' && (
                                <p className="text-blue-400/60 text-[10px] font-bold uppercase tracking-widest mt-1">Released {updateInfo.releaseDate}</p>
                            )}
                        </div>
                    </div>

                    {updateStatus === 'available' && (
                        <button 
                            onClick={handleDownload}
                            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                        >
                            <Download size={16} /> Get Update
                        </button>
                    )}
                </div>
            </div>

            {/* Release Notes */}
            {updateInfo && orderedCategories.length > 0 && (
                <div className="glass-panel p-8 rounded-[32px] border border-border-subtle relative overflow-hidden lg:col-span-3">
                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                        <div>
                            <h3 className="text-xl font-black text-foreground">Release Notes</h3>
                            <p className="text-foreground-dim text-[10px] font-bold uppercase tracking-widest mt-1">What's new in v{updateInfo.latestVersion}</p>
                        </div>
                        <button 
                            onClick={handleViewOnGitHub}
                            className="flex items-center gap-2 text-xs font-bold text-foreground-muted hover:text-foreground transition-colors uppercase tracking-widest"
                        >
                            View on GitHub <ExternalLink size={14} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {orderedCategories.map(cat => {
                            const conf = categoryConfig[cat];
                            const notes = notesByCategory[cat];
                            return (
                                <div key={cat} className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className={clsx("p-1.5 rounded-lg border", conf.bg, conf.color)}>
                                            {conf.icon}
                                        </div>
                                        <h4 className={clsx("font-black text-sm uppercase tracking-wide", conf.color)}>{conf.label}</h4>
                                    </div>
                                    <ul className="space-y-3 pl-2">
                                        {notes.map((n, i) => (
                                            <li key={i} className="flex gap-3 text-sm">
                                                <span className="text-foreground-dim mt-1.5 w-1 h-1 rounded-full bg-current flex-shrink-0" />
                                                <span className="text-foreground font-medium leading-relaxed">{n.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
