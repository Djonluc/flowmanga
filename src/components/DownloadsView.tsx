import { useDownloadStore } from '../stores/useDownloadStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Play, Pause, Trash2, RotateCcw, AlertCircle, Clock, CheckCircle2, ChevronRight, BarChart2 } from 'lucide-react';
import clsx from 'clsx';

export const DownloadsView = () => {
    const { queue, pauseJob, resumeJob, removeJob, retryJob } = useDownloadStore();

    const activeJobs = queue.filter(job => job.status === 'downloading');
    const queuedJobs = queue.filter(job => job.status === 'queued' || job.status === 'paused');
    const failedJobs = queue.filter(job => job.status === 'failed');
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
        <div className="h-full w-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
            {/* Header Section */}
            <div className="flex flex-col gap-2 mb-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-foreground uppercase tracking-tight">
                            Download Center
                        </h1>
                        <p className="text-foreground-dim font-bold mt-2">
                            Manage your local manifestations and offline library.
                        </p>
                    </div>
                    
                    <div className="flex gap-4">
                        <ActionButton icon={<Pause size={16} />} label="Halt All" onClick={handlePauseAll} />
                        <ActionButton icon={<Play size={16} />} label="Resume All" onClick={handleResumeAll} />
                        <ActionButton icon={<Trash2 size={16} />} label="Clear Finished" onClick={handleClearFinished} variant="danger" />
                    </div>
                </div>
                
                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                    <StatCard icon={<BarChart2 />} label="Total in Queue" value={queue.length} color="text-indigo-400" bg="bg-indigo-500/10" />
                    <StatCard icon={<Download />} label="Active" value={activeJobs.length} color="text-blue-400" bg="bg-blue-500/10" />
                    <StatCard icon={<CheckCircle2 />} label="Completed" value={completedJobs.length} color="text-emerald-400" bg="bg-emerald-500/10" />
                    <StatCard icon={<AlertCircle />} label="Failed" value={failedJobs.length} color="text-red-400" bg="bg-red-500/10" />
                </div>
            </div>

            {/* Main Content Areas */}
            {queue.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-30 mt-10">
                    <Download size={80} className="mb-6 text-foreground-dim" />
                    <h2 className="text-2xl font-black text-foreground">Aether is quiet</h2>
                    <p className="text-foreground-dim font-bold">No tomes are currently being summoned.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-10 pb-20">
                    {/* Active Jobs */}
                    {activeJobs.length > 0 && (
                        <JobSection title="Channeling" icon={<Download size={20} className="text-blue-400" />} color="text-blue-400">
                            {activeJobs.map(job => (
                                <ActiveJobCard key={job.id} job={job} onPause={() => pauseJob(job.id)} onRemove={() => removeJob(job.id)} />
                            ))}
                        </JobSection>
                    )}

                    {/* Queued / Paused Jobs */}
                    {queuedJobs.length > 0 && (
                        <JobSection title="Stasis (Queued / Paused)" icon={<Clock size={20} className="text-foreground-dim" />} color="text-foreground-dim">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {queuedJobs.map(job => (
                                    <MiniJobCard 
                                        key={job.id} 
                                        job={job} 
                                        icon={<Clock size={16} />} 
                                        onPrimary={() => resumeJob(job.id)} 
                                        primaryIcon={<Play size={14} />} 
                                        onRemove={() => removeJob(job.id)} 
                                    />
                                ))}
                            </div>
                        </JobSection>
                    )}

                    {/* Failed Jobs */}
                    {failedJobs.length > 0 && (
                        <JobSection title="Corrupted" icon={<AlertCircle size={20} className="text-red-400" />} color="text-red-400">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {failedJobs.map(job => (
                                    <MiniJobCard 
                                        key={job.id} 
                                        job={job} 
                                        icon={<AlertCircle size={16} className="text-red-400" />} 
                                        onPrimary={() => retryJob(job.id)} 
                                        primaryIcon={<RotateCcw size={14} />} 
                                        onRemove={() => removeJob(job.id)} 
                                        isDanger
                                    />
                                ))}
                            </div>
                        </JobSection>
                    )}

                    {/* Completed Jobs */}
                    {completedJobs.length > 0 && (
                        <JobSection title="Manifested" icon={<CheckCircle2 size={20} className="text-emerald-500" />} color="text-emerald-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {completedJobs.map(job => (
                                    <MiniJobCard 
                                        key={job.id} 
                                        job={job} 
                                        icon={<CheckCircle2 size={16} className="text-emerald-500" />} 
                                        onRemove={() => removeJob(job.id)} 
                                        isSuccess
                                    />
                                ))}
                            </div>
                        </JobSection>
                    )}
                </div>
            )}
        </div>
    );
};

const StatCard = ({ icon, label, value, color, bg }: { icon: React.ReactNode, label: string, value: number, color: string, bg: string }) => (
    <div className="bg-surface glass-panel border border-border-subtle rounded-[24px] p-6 flex items-center gap-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${bg} ${color}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-4xl font-black text-foreground">{value}</h3>
            <p className="text-foreground-dim font-bold uppercase tracking-widest text-xs mt-1">{label}</p>
        </div>
    </div>
);

const JobSection = ({ title, icon, color, children }: { title: string, icon: React.ReactNode, color: string, children: React.ReactNode }) => (
    <div className="space-y-6">
        <div className="flex items-center gap-3">
            {icon}
            <h2 className={`text-xl font-black uppercase tracking-widest ${color}`}>{title}</h2>
        </div>
        {children}
    </div>
);

const ActionButton = ({ icon, label, onClick, variant = 'default' }: { icon: React.ReactNode, label: string, onClick: () => void, variant?: 'default' | 'danger' }) => (
    <button 
        onClick={onClick}
        className={clsx(
            "flex items-center gap-3 px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all border",
            variant === 'default' 
                ? "bg-surface-elevated border-border-subtle text-foreground hover:bg-surface-raised hover:scale-105"
                : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 hover:scale-105"
        )}
    >
        {icon}
        {label}
    </button>
);

const ActiveJobCard = ({ job, onPause, onRemove }: { job: any, onPause: () => void, onRemove: () => void }) => (
    <div className="bg-surface glass-panel border border-border-subtle rounded-[24px] p-6 group transition-all hover:border-blue-500/30 hover:shadow-cinematic">
        <div className="flex justify-between items-start gap-6">
            <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground truncate">{job.title}</h3>
                <div className="flex items-center gap-4 mt-2">
                    <p className="text-sm font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg">
                        {Math.round(job.progress)}% Complete
                    </p>
                    <p className="text-sm text-foreground-dim font-medium">
                        {job.downloadedChapters} of {job.totalChapters} Chapters Manifested
                    </p>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={onPause} className="p-3 bg-surface-elevated hover:bg-yellow-500/20 rounded-xl text-foreground hover:text-yellow-400 transition-colors">
                    <Pause size={18} />
                </button>
                <button onClick={onRemove} className="p-3 bg-surface-elevated hover:bg-red-500/20 rounded-xl text-foreground hover:text-red-400 transition-colors">
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
        
        <div className="mt-6 h-2 w-full bg-surface-elevated rounded-full overflow-hidden">
            <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${job.progress}%` }}
                className="h-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] rounded-full"
            />
        </div>
    </div>
);

const MiniJobCard = ({ job, icon, onPrimary, primaryIcon, onRemove, isDanger, isSuccess }: any) => (
    <div className={clsx(
        "glass-panel rounded-2xl p-4 border flex justify-between items-center group transition-colors",
        isDanger ? "bg-red-500/5 border-red-500/10 hover:border-red-500/30" : 
        isSuccess ? "bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30" : 
        "bg-surface border-border-subtle hover:border-white/20"
    )}>
        <div className="flex items-center gap-4">
            <div className={clsx(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                isDanger ? "bg-red-500/10" : isSuccess ? "bg-emerald-500/10" : "bg-surface-elevated"
            )}>
                {icon}
            </div>
            <div>
                <h4 className="text-sm font-bold text-foreground line-clamp-1">{job.title}</h4>
                <p className="text-xs text-foreground-dim font-medium">{job.totalChapters} Chapters</p>
            </div>
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onPrimary && (
                <button onClick={onPrimary} className="p-2 hover:bg-white/10 rounded-lg text-foreground-dim hover:text-foreground">
                    {primaryIcon}
                </button>
            )}
            <button onClick={onRemove} className="p-2 hover:bg-white/10 rounded-lg text-foreground-dim hover:text-red-400">
                <Trash2 size={14} />
            </button>
        </div>
    </div>
);
