import { useState } from 'react';
import { RefreshCw, Download, ExternalLink, CheckCircle2, AlertCircle, Loader2, Clock, Star, Wrench, TrendingUp, Zap, Monitor, Globe } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { AppVersionService } from '../../services/AppVersionService';
import type { ReleaseNote } from '../../services/AppVersionService';
import clsx from 'clsx';

const categoryConfig: Record<
  ReleaseNote['category'],
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  features:     { label: 'New Features',    color: 'text-blue-400',   bgColor: 'bg-blue-500/10 border-blue-500/20',   icon: <Star size={11} /> },
  improvements: { label: 'Improvements',   color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20', icon: <TrendingUp size={11} /> },
  fixes:        { label: 'Bug Fixes',       color: 'text-emerald-400',bgColor: 'bg-emerald-500/10 border-emerald-500/20',icon: <Wrench size={11} /> },
  performance:  { label: 'Performance',    color: 'text-amber-400',  bgColor: 'bg-amber-500/10 border-amber-500/20',  icon: <Zap size={11} /> },
  ui:           { label: 'UI / UX',         color: 'text-pink-400',   bgColor: 'bg-pink-500/10 border-pink-500/20',   icon: <Monitor size={11} /> },
  sources:      { label: 'Source Support',  color: 'text-cyan-400',   bgColor: 'bg-cyan-500/10 border-cyan-500/20',   icon: <Globe size={11} /> },
  other:        { label: 'Other',           color: 'text-foreground-dim', bgColor: 'bg-white/5 border-white/10',       icon: null },
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
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
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

  // Group notes by category
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
    <div className="space-y-8 pb-12">
      {/* Version Status Card */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
          <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
            Version Info
          </h4>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Current Version */}
          <div className="bg-white/5 rounded-[24px] p-5 border border-white/5">
            <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mb-2">Installed</p>
            <p className="text-foreground text-2xl font-black tracking-tighter">v{currentVersion}</p>
            <p className="text-foreground-muted text-[10px] font-medium mt-1">Current build</p>
          </div>

          {/* Latest Version */}
          <div className={clsx(
            'rounded-[24px] p-5 border transition-all duration-300',
            updateStatus === 'available'
              ? 'bg-blue-500/10 border-blue-500/20'
              : updateStatus === 'up-to-date'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-white/5 border-white/5',
          )}>
            <p className={clsx(
              'text-[10px] font-black uppercase tracking-widest mb-2',
              updateStatus === 'available' ? 'text-blue-400' :
              updateStatus === 'up-to-date' ? 'text-emerald-400' : 'text-foreground-dim',
            )}>
              Latest
            </p>
            {updateInfo ? (
              <>
                <p className={clsx(
                  'text-2xl font-black tracking-tighter',
                  updateStatus === 'available' ? 'text-blue-300' :
                  updateStatus === 'up-to-date' ? 'text-emerald-300' : 'text-foreground',
                )}>
                  v{updateInfo.latestVersion}
                </p>
                {updateInfo.releaseDate && (
                  <p className="text-foreground-muted text-[10px] font-medium mt-1">{updateInfo.releaseDate}</p>
                )}
              </>
            ) : (
              <p className="text-foreground-dim text-base font-bold tracking-tight">—</p>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className={clsx(
          'flex items-center gap-3 px-5 py-4 rounded-2xl border',
          updateStatus === 'available' ? 'bg-blue-500/10 border-blue-500/20' :
          updateStatus === 'up-to-date' ? 'bg-emerald-500/10 border-emerald-500/20' :
          updateStatus === 'error' ? 'bg-red-500/10 border-red-500/20' :
          'bg-white/5 border-white/5',
        )}>
          {updateStatus === 'checking' || isChecking ? (
            <Loader2 size={16} className="animate-spin text-blue-400" />
          ) : updateStatus === 'available' ? (
            <Download size={16} className="text-blue-400" />
          ) : updateStatus === 'up-to-date' ? (
            <CheckCircle2 size={16} className="text-emerald-400" />
          ) : updateStatus === 'error' ? (
            <AlertCircle size={16} className="text-red-400" />
          ) : (
            <RefreshCw size={16} className="text-foreground-dim" />
          )}
          <div className="flex-1 min-w-0">
            <p className={clsx(
              'text-sm font-bold',
              updateStatus === 'available' ? 'text-blue-300' :
              updateStatus === 'up-to-date' ? 'text-emerald-300' :
              updateStatus === 'error' ? 'text-red-300' : 'text-foreground',
            )}>
              {updateStatus === 'checking' || isChecking
                ? 'Checking for updates...'
                : updateStatus === 'available'
                  ? `v${updateInfo?.latestVersion} is available`
                  : updateStatus === 'up-to-date'
                    ? 'FlowManga is up to date'
                    : updateStatus === 'error'
                      ? 'Unable to check for updates'
                      : 'Click below to check for updates'}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Clock size={10} className="text-foreground-muted" />
              <p className="text-foreground-muted text-[10px] font-medium">Last checked: {lastCheckedDisplay}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-6 bg-purple-600 rounded-full" />
          <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
            Actions
          </h4>
        </div>

        <div className="space-y-3">
          {/* Check for Updates */}
          <div className="group bg-white/5 p-5 rounded-[24px] border border-white/5 hover:border-blue-500/20 transition-all duration-500 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <RefreshCw size={22} className={clsx(isChecking && 'animate-spin')} />
              </div>
              <div>
                <p className="text-foreground text-sm font-bold">Check for Updates</p>
                <p className="text-foreground-muted text-[10px] font-medium mt-0.5">Manually check GitHub for the latest release</p>
              </div>
            </div>
            <button
              onClick={handleCheckForUpdates}
              disabled={isChecking}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-foreground border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
            >
              {isChecking ? <Loader2 size={14} className="animate-spin" /> : null}
              {isChecking ? 'Checking...' : 'Check Now'}
            </button>
          </div>

          {/* Download / Open GitHub — only show when update available */}
          {updateStatus === 'available' && updateInfo && (
            <div className="group bg-blue-500/10 p-5 rounded-[24px] border border-blue-500/20 hover:border-blue-500/40 transition-all duration-500 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Download size={22} />
                </div>
                <div>
                  <p className="text-blue-300 text-sm font-bold">Download v{updateInfo.latestVersion}</p>
                  <p className="text-blue-400/60 text-[10px] font-medium mt-0.5">Opens the GitHub release page</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleViewOnGitHub}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-foreground-dim border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  GitHub
                </button>
                <button
                  onClick={handleDownload}
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Download size={12} />
                  Download
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Changelog Section */}
      {orderedCategories.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-6 bg-cyan-600 rounded-full" />
            <h4 className="text-foreground font-black uppercase tracking-widest text-sm italic">
              Changelog — v{updateInfo?.latestVersion}
            </h4>
          </div>

          <div className="space-y-3">
            {orderedCategories.map((cat) => {
              const cfg = categoryConfig[cat];
              const notes = notesByCategory[cat];
              return (
                <div key={cat} className={clsx('rounded-2xl p-4 border', cfg.bgColor)}>
                  <div className={clsx('flex items-center gap-1.5 mb-2.5', cfg.color)}>
                    {cfg.icon}
                    <span className="text-[10px] font-black uppercase tracking-widest">{cfg.label}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {notes.map((note, i) => (
                      <li key={i} className="text-foreground-dim text-xs flex items-start gap-2">
                        <span className={clsx('mt-1.5 w-1 h-1 rounded-full shrink-0', cfg.color.replace('text-', 'bg-'))} />
                        {note.text}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Background check info */}
      <div className="pt-4 border-t border-white/5">
        <p className="text-foreground-muted text-[10px] font-medium text-center leading-relaxed">
          FlowManga automatically checks for updates on startup and every 24 hours in the background.
          <br />
          Updates are downloaded and installed manually from GitHub.
        </p>
      </div>
    </div>
  );
};
