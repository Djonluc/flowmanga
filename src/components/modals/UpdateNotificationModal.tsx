import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, Clock, Zap, Wrench, TrendingUp, Monitor, Globe, Star } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { AppVersionService } from '../../services/AppVersionService';
import type { ReleaseNote } from '../../services/AppVersionService';
import clsx from 'clsx';

const categoryConfig: Record<
  ReleaseNote['category'],
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  features: {
    label: 'New Features',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    icon: <Star size={12} />,
  },
  improvements: {
    label: 'Improvements',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
    icon: <TrendingUp size={12} />,
  },
  fixes: {
    label: 'Bug Fixes',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    icon: <Wrench size={12} />,
  },
  performance: {
    label: 'Performance',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
    icon: <Zap size={12} />,
  },
  ui: {
    label: 'UI / UX',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10 border-pink-500/20',
    icon: <Monitor size={12} />,
  },
  sources: {
    label: 'Source Support',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 border-cyan-500/20',
    icon: <Globe size={12} />,
  },
  other: {
    label: 'Other',
    color: 'text-foreground-dim',
    bgColor: 'bg-white/5 border-white/10',
    icon: null,
  },
};

export const UpdateNotificationModal = () => {
  const { updateInfo, setUpdateInfo, setUpdateStatus } = useSettingsStore();
  const [showFullChangelog, setShowFullChangelog] = useState(false);

  // Only show if there's a newer version that hasn't been dismissed
  const dismissedVersion = AppVersionService.getDismissedVersion();
  const isOpen =
    !!updateInfo?.isNewer && updateInfo.latestVersion !== dismissedVersion;

  const handleDismiss = () => {
    if (updateInfo?.latestVersion) {
      AppVersionService.dismissVersion(updateInfo.latestVersion);
    }
    // Force a re-render by clearing and re-setting update info
    // (dismissed state is stored in localStorage so rerender via null/set)
    setUpdateInfo({ ...updateInfo!, latestVersion: updateInfo!.latestVersion }); // triggers re-check of dismissedVersion
    // Actually just clear to close
    setUpdateInfo(null);
    setUpdateStatus('idle');
  };

  const handleDownload = async () => {
    await AppVersionService.openDownloadPage(updateInfo?.downloadUrl);
  };

  const handleViewChangelog = async () => {
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

  const categoryOrder: ReleaseNote['category'][] = ['features', 'improvements', 'fixes', 'performance', 'ui', 'sources', 'other'];
  const orderedCategories = categoryOrder.filter(c => notesByCategory[c]?.length > 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg bg-surface rounded-[28px] border border-border-strong shadow-cinematic overflow-hidden pointer-events-auto"
          >
            {/* Gradient top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500" />

            {/* Header */}
            <div className="p-6 pb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Download size={20} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-foreground font-black text-lg tracking-tight">Update Available</h2>
                  <p className="text-foreground-dim text-xs font-medium">A new version of FlowManga is ready</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-2 rounded-full hover:bg-white/10 text-foreground-dim hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Version comparison */}
            <div className="px-6 py-4 grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mb-1">Current Version</p>
                <p className="text-foreground text-xl font-black tracking-tighter">
                  v{updateInfo?.currentVersion}
                </p>
              </div>
              <div className="bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20">
                <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">Latest Version</p>
                <p className="text-blue-300 text-xl font-black tracking-tighter">
                  v{updateInfo?.latestVersion}
                </p>
                {updateInfo?.releaseDate && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={10} className="text-blue-400/60" />
                    <span className="text-blue-400/60 text-[9px] font-medium">{updateInfo.releaseDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* What's New */}
            {orderedCategories.length > 0 && (
              <div className="px-6 pb-2">
                <p className="text-foreground-dim text-[10px] font-black uppercase tracking-widest mb-3">What's New</p>
                <div className={clsx('space-y-2 overflow-hidden transition-all duration-500', !showFullChangelog && 'max-h-36')}>
                  {orderedCategories.map((cat) => {
                    const cfg = categoryConfig[cat];
                    const notes = notesByCategory[cat];
                    return (
                      <div key={cat} className={clsx('rounded-xl p-3 border', cfg.bgColor)}>
                        <div className={clsx('flex items-center gap-1.5 mb-1.5', cfg.color)}>
                          {cfg.icon}
                          <span className="text-[10px] font-black uppercase tracking-widest">{cfg.label}</span>
                        </div>
                        <ul className="space-y-1">
                          {notes.map((note, i) => (
                            <li key={i} className="text-foreground-dim text-xs flex items-start gap-1.5">
                              <span className={clsx('mt-1 w-1 h-1 rounded-full shrink-0', cfg.color.replace('text-', 'bg-'))} />
                              {note.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                {orderedCategories.length > 2 && (
                  <button
                    onClick={() => setShowFullChangelog(v => !v)}
                    className="text-blue-400 text-[10px] font-black uppercase tracking-widest hover:text-blue-300 transition-colors mt-2"
                  >
                    {showFullChangelog ? '↑ Show Less' : '↓ Show Full Changelog'}
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="p-6 pt-4 flex flex-col gap-2">
              <button
                onClick={handleDownload}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Download size={16} />
                Download v{updateInfo?.latestVersion}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleViewChangelog}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-foreground-dim hover:text-foreground border border-white/10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  Full Changelog
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-foreground-dim hover:text-foreground border border-white/10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                >
                  Remind Me Later
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
