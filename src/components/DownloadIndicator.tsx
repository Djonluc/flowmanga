import { useDownloadStore } from '../stores/useDownloadStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { motion } from 'framer-motion';
import { Download, Loader2, AlertCircle } from 'lucide-react';

export const DownloadIndicator = () => {
    const { queue } = useDownloadStore();
    const { toggleDownloadPanel } = useSettingsStore();

    // Filter jobs that are currently active or were just completed (briefly)
    const activeJobs = queue.filter(j => j.status === 'downloading');
    const queuedJobs = queue.filter(j => j.status === 'queued');
    const failedJobs = queue.filter(j => j.status === 'failed');
    
    const isActive = activeJobs.length > 0;
    const totalCount = activeJobs.length + queuedJobs.length;

    if (totalCount === 0 && failedJobs.length === 0) return null;

    return (
        <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 right-8 z-[60]"
        >
            <motion.button
                onClick={toggleDownloadPanel}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-4 pl-4 pr-5 py-3 bg-surface/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] group overflow-hidden relative"
            >
                {/* Accent Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center relative">
                        {isActive ? (
                            <Loader2 size={18} className="text-blue-500 animate-spin" />
                        ) : failedJobs.length > 0 ? (
                            <AlertCircle size={18} className="text-red-500" />
                        ) : (
                            <Download size={18} className="text-foreground-dim" />
                        )}
                        
                        {totalCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[9px] font-black w-4 h-4 rounded-full border-2 border-background flex items-center justify-center">
                                {totalCount}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-start min-w-[140px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground-dim group-hover:text-blue-400 transition-colors">
                        {isActive ? 'Downloading' : failedJobs.length > 0 ? 'Action Required' : 'Download Queue'}
                    </span>
                    
                    <div className="flex flex-col w-full gap-1 mt-0.5">
                        {activeJobs.length > 0 ? (
                            <>
                                <span className="text-xs font-bold text-foreground max-w-[120px] truncate">
                                    {activeJobs[0].title}
                                </span>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${activeJobs[0].progress}%` }}
                                        transition={{ type: 'spring', damping: 20 }}
                                    />
                                </div>
                            </>
                        ) : (
                            <span className="text-xs font-medium text-foreground-muted">
                                {failedJobs.length > 0 ? `${failedJobs.length} Failed Items` : `${queuedJobs.length} Items Enqueued`}
                            </span>
                        )}
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center ml-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    <motion.div
                        animate={isActive ? { scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-1.5 h-1.5 rounded-full bg-blue-500"
                    />
                </div>
            </motion.button>
        </motion.div>
    );
};
