import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSettingsStore } from './useSettingsStore';
import { type DownloadJob } from '../types';

interface DownloadState {
    queue: DownloadJob[];
    activeJobIds: string[];
    
    addJob: (job: Omit<DownloadJob, 'status' | 'progress' | 'downloadedChapters'> & { force?: boolean }) => void;
    removeJob: (id: string) => void;
    pauseJob: (id: string) => void;
    resumeJob: (id: string) => void;
    updateJobProgress: (id: string, progress: number, downloadedChapters?: number) => void;
    updateJobStatus: (id: string, status: DownloadJob['status']) => void;
    startQueue: () => Promise<void>;
    retryJob: (id: string) => void;
    clearCompleted: () => void;
}


export const useDownloadStore = create<DownloadState>()(
    persist(
        (set, get) => ({
            queue: [],
            activeJobIds: [],

            addJob: (jobData) => {
                const existing = get().queue.find(j => j.id === jobData.id);
                if (existing) return;

                const newJob: DownloadJob = {
                    ...jobData,
                    status: 'queued',
                    progress: 0,
                    downloadedChapters: 0,
                    force: jobData.force
                };
                
                set((state) => ({ queue: [...state.queue, newJob] }));
                get().startQueue();
            },

            removeJob: (id) => {
                set((state) => ({
                    queue: state.queue.filter(job => job.id !== id),
                    activeJobIds: state.activeJobIds.filter(jobId => jobId !== id)
                }));
                get().startQueue();
            },

            pauseJob: (id) => {
                set((state) => ({
                    queue: state.queue.map(job => 
                        job.id === id ? { ...job, status: 'paused' } : job
                    ),
                    activeJobIds: state.activeJobIds.filter(jobId => jobId !== id)
                }));
                get().startQueue();
            },

            resumeJob: (id) => {
                set((state) => ({
                    queue: state.queue.map(job => 
                        job.id === id ? { ...job, status: 'queued' } : job
                    )
                }));
                get().startQueue();
            },

            retryJob: (id) => {
                set((state) => ({
                    queue: state.queue.map(job => 
                        job.id === id ? { ...job, status: 'queued', progress: 0 } : job
                    )
                }));
                get().startQueue();
            },

            updateJobProgress: (id, progress, downloadedChapters) => {
                set((state) => ({
                    queue: state.queue.map(job => 
                        job.id === id ? { 
                            ...job, 
                            progress, 
                            downloadedChapters: downloadedChapters !== undefined ? downloadedChapters : job.downloadedChapters 
                        } : job
                    )
                }));
            },

            updateJobStatus: (id, status) => {
                set((state) => ({
                    queue: state.queue.map(job => 
                        job.id === id ? { ...job, status } : job
                    ),
                    activeJobIds: (status === 'completed' || status === 'failed') 
                        ? state.activeJobIds.filter(jobId => jobId !== id)
                        : state.activeJobIds
                }));
            },

            clearCompleted: () => {
                 set((state) => ({
                    queue: state.queue.filter(job => job.status !== 'completed')
                }));
            },

            startQueue: async () => {
                const { queue, activeJobIds } = get();
                const { maxConcurrentJobs } = useSettingsStore.getState();
                
                // 1. Clean up activeJobIds from state (just in case)
                const currentActive = activeJobIds.filter(id => 
                    queue.find(j => j.id === id && j.status === 'downloading')
                );

                if (currentActive.length >= maxConcurrentJobs) return;

                // 2. Find next available jobs
                const nextJobs = queue
                    .filter(j => j.status === 'queued')
                    .slice(0, maxConcurrentJobs - currentActive.length);

                if (nextJobs.length === 0) return;

                // 3. Mark as active and start
                set({ activeJobIds: [...currentActive, ...nextJobs.map(j => j.id)] });

                for (const job of nextJobs) {
                    get().updateJobStatus(job.id, 'downloading');
                    
                    // Fire and forget (independent workers)
                    (async () => {
                        try {
                            const { DownloadService } = await import('../services/DownloadService');
                            await DownloadService.processJob(job, get());
                        } catch (error) {
                            console.error(`[Queue] Job ${job.id} failed`, error);
                            get().updateJobStatus(job.id, 'failed');
                        } finally {
                            set(state => ({
                                activeJobIds: state.activeJobIds.filter(id => id !== job.id)
                            }));
                            get().startQueue(); // Check for more
                        }
                    })();
                }
            }
        }),
        {
            name: 'download-storage',
            onRehydrateStorage: () => (state) => {
                // Ensure everything that was "downloading" becomes "queued" on restart
                // because workers don't survive restart if not using a separate process.
                // In Tauri, unless we use sidecars, simple async jobs stop.
                if (state) {
                    state.activeJobIds = [];
                    state.queue = state.queue.map(j => 
                        j.status === 'downloading' ? { ...j, status: 'queued' } : j
                    );
                    state.startQueue();
                }
            }
        }
    )
);
