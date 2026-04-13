import { useSettingsStore } from '../stores/useSettingsStore';
import { useDownloadStore } from '../stores/useDownloadStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, Trash2, RotateCcw, Download, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

export const DownloadPanel = () => {
    const { isDownloadPanelOpen, toggleDownloadPanel } = useSettingsStore();
    const { queue, pauseJob, resumeJob, removeJob, retryJob } = useDownloadStore();

    const activeJobs = queue.filter(job => job.status === 'downloading');
    const queuedJobs = queue.filter(job => job.status === 'queued');
    const failedJobs = queue.filter(job => job.status === 'failed');
    const pausedJobs = queue.filter(job => job.status === 'paused');
    const completedJobs = queue.filter(job => job.status === 'completed');

    const handlePauseAll = () => {
        queue.forEach(job => {
            if (job.status === 'downloading' || job.status === 'queued') {
                pauseJob(job.id);
            }
        });
    };

    const handleResumeAll = () => {
        queue.forEach(job => {
            if (job.status === 'paused') {
                resumeJob(job.id);
            }
        });
    };

    const handleClearFinished = () => {
        completedJobs.forEach(job => removeJob(job.id));
    };

    return (
        <AnimatePresence>
            {isDownloadPanelOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleDownloadPanel}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-96 bg-neutral-900 border-l border-white/10 shadow-2xl z-50 flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex flex-col border-b border-white/5 bg-neutral-900/50 backdrop-blur-md px-6 py-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <Download size={18} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black uppercase tracking-widest text-white leading-none">Downloads</h2>
                                        <p className="text-[10px] text-neutral-500 mt-1 uppercase font-bold tracking-tighter">
                                            {queue.length} Total Items • {activeJobs.length} Active
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={toggleDownloadPanel}
                                    className="p-2 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <ActionBtn icon={<Pause size={12} />} label="Pause All" onClick={handlePauseAll} />
                                <ActionBtn icon={<Play size={12} />} label="Resume All" onClick={handleResumeAll} />
                                <ActionBtn icon={<Trash2 size={12} />} label="Clear Done" onClick={handleClearFinished} variant="danger" />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            
                            {/* Empty State */}
                            {queue.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30">
                                    <Download size={48} className="text-neutral-500" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-white">No active downloads</p>
                                        <p className="text-xs text-neutral-500">Your queue is empty</p>
                                    </div>
                                </div>
                            )}

                            {/* Active Downloads */}
                            {activeJobs.length > 0 && (
                                <Section title="In Progress" color="text-blue-400">
                                    {activeJobs.map(job => (
                                        <DownloadItem 
                                            key={job.id} 
                                            job={job} 
                                            onPause={() => pauseJob(job.id)} 
                                            onRemove={() => removeJob(job.id)}
                                        />
                                    ))}
                                </Section>
                            )}

                            {/* Failed Downloads */}
                            {failedJobs.length > 0 && (
                                <Section title="Errors" color="text-red-400">
                                    {failedJobs.map(job => (
                                        <div key={job.id} className="bg-red-500/5 rounded-2xl p-4 border border-red-500/20 flex justify-between items-center group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                                                    <AlertCircle size={16} className="text-red-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-white line-clamp-1">{job.title}</h4>
                                                    <p className="text-[10px] text-red-400/70 font-medium">Download failed</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => retryJob(job.id)} title="Retry" className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors">
                                                    <RotateCcw size={14} />
                                                </button>
                                                <button onClick={() => removeJob(job.id)} title="Remove" className="p-2 hover:bg-red-500/10 rounded-lg text-red-400/50 hover:text-red-400 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </Section>
                            )}

                            {/* Paused / Queued */}
                            {(pausedJobs.length > 0 || queuedJobs.length > 0) && (
                                <Section title="Waiting" color="text-neutral-500">
                                    {[...pausedJobs, ...queuedJobs].map(job => (
                                        <div key={job.id} className="bg-white/5 rounded-2xl p-4 border border-white/5 flex justify-between items-center group hover:border-white/10 transition-colors">
                                           <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                                    <Clock size={16} className="text-neutral-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-neutral-300 line-clamp-1">{job.title}</h4>
                                                    <p className="text-[10px] text-neutral-500 font-medium">{job.chapterList.length} Chapters • {job.status}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => resumeJob(job.id)} title="Start" className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-green-400">
                                                    <Play size={14} />
                                                </button>
                                                <button onClick={() => removeJob(job.id)} title="Remove" className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-red-400">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </Section>
                            )}

                             {/* Completed */}
                             {completedJobs.length > 0 && (
                                <Section title="Completed" color="text-emerald-500">
                                    {completedJobs.map(job => (
                                        <div key={job.id} className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10 flex justify-between items-center group">
                                            <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                    <CheckCircle2 size={16} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-emerald-200 line-clamp-1">{job.title}</h4>
                                                    <p className="text-[10px] text-emerald-500/70 font-medium">Download complete</p>
                                                </div>
                                            </div>
                                            <button onClick={() => removeJob(job.id)} title="Clear" className="p-2 opacity-0 group-hover:opacity-100 hover:bg-emerald-500/10 rounded-lg text-emerald-400 transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </Section>
                            )}

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

const Section = ({ title, color, children }: { title: string, color: string, children: React.ReactNode }) => (
    <div className="space-y-3">
        <h3 className={`text-[10px] font-black uppercase ${color} tracking-[0.2em] mb-3`}>{title}</h3>
        <div className="space-y-3">
            {children}
        </div>
    </div>
);

const ActionBtn = ({ icon, label, onClick, variant = 'default' }: { icon: React.ReactNode, label: string, onClick: () => void, variant?: 'default' | 'danger' }) => (
    <button 
        onClick={onClick}
        className={clsx(
            "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
            variant === 'default' 
                ? "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10 hover:text-white"
                : "bg-red-500/5 border-red-500/10 text-red-500 hover:bg-red-500/10 hover:border-red-500/20"
        )}
    >
        {icon}
        {label}
    </button>
);

const DownloadItem = ({ job, onPause, onRemove }: { job: any, onPause: () => void, onRemove: () => void }) => (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3 group hover:border-white/10 transition-colors">
        <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white truncate">{job.title}</h4>
                <p className="text-[10px] text-neutral-500 font-medium mt-0.5">
                    {job.downloadedChapters} / {job.totalChapters} Chapters
                </p>
            </div>
            <div className="flex gap-1 shrink-0">
                <button onClick={onPause} className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-yellow-400">
                    <Pause size={14} />
                </button>
                <button onClick={onRemove} className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-red-400">
                    <X size={14} />
                </button>
            </div>
        </div>
        
        <div className="space-y-2">
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${job.progress}%` }}
                    className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                />
            </div>
            <div className="flex justify-between text-[10px] font-mono font-bold tracking-tighter">
                <span className="text-blue-500/70">PROCESSING</span>
                <span className="text-white">{Math.round(job.progress)}%</span>
            </div>
        </div>
    </div>
);
