import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlayCircle, Film, ListMusic } from 'lucide-react';
import { useVideoStore } from '../../stores/useVideoStore';
import clsx from 'clsx';

interface VideoPlaylistProps {
    isOpen: boolean;
    onClose: () => void;
}

export const VideoPlaylist = ({ isOpen, onClose }: VideoPlaylistProps) => {
    const { queue, currentVideo, playVideo } = useVideoStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Scroll to current video when opened
    useEffect(() => {
        if (isOpen && scrollRef.current && currentVideo) {
             const activeEl = scrollRef.current.querySelector(`[data-id="${currentVideo.id}"]`);
             if (activeEl) {
                 activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
             }
        }
    }, [isOpen, currentVideo]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                        className="fixed top-4 right-4 bottom-4 w-96 z-[70] bg-[#0A0A0A]/90 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <ListMusic size={14} className="text-accent" />
                                    <span className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">Playback</span>
                                </div>
                                <h3 className="text-2xl font-black text-foreground uppercase italic tracking-tighter">
                                    Media <span className="text-blue-500">Queue</span>
                                </h3>
                                <p className="text-foreground-dim text-[10px] font-bold uppercase tracking-widest mt-1">
                                    {queue.length} items available
                                </p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full transition-all text-foreground-dim hover:text-foreground border border-white/5"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Items */}
                        <div 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3"
                        >
                            {queue.map((video) => {
                                const isActive = currentVideo?.id === video.id;
                                return (
                                    <motion.div 
                                        key={video.id}
                                        data-id={video.id}
                                        onClick={() => playVideo(video)}
                                        whileHover={{ x: -4 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={clsx(
                                            "group flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border",
                                            isActive 
                                                ? 'bg-accent/10 border-accent/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                                                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                                        )}
                                    >
                                        <div className="relative w-24 aspect-video rounded-xl overflow-hidden flex-shrink-0 bg-surface shadow-lg group-hover:shadow-accent/5 transition-all">
                                            {/* Thumbnail strategy */}
                                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                                                {isActive ? (
                                                    <div className="flex gap-1 items-end h-4">
                                                        <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-accent rounded-full" />
                                                        <motion.div animate={{ height: [12, 6, 12] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-accent rounded-full" />
                                                        <motion.div animate={{ height: [6, 14, 6] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1 bg-accent rounded-full" />
                                                    </div>
                                                ) : (
                                                    <PlayCircle size={20} className="text-foreground-muted group-hover:text-foreground-dim transition-colors" />
                                                )}
                                            </div>
                                            
                                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-[4px] text-[8px] font-black text-white/90">
                                                {video.resolution || 'HD'}
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <h4 className={clsx(
                                                "text-sm font-black italic tracking-tight truncate transition-colors",
                                                isActive ? 'text-foreground' : 'text-foreground-dim group-hover:text-foreground'
                                            )}>
                                                {video.title}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Film size={10} className="text-foreground-muted" />
                                                <p className="text-[9px] text-foreground-dim font-bold uppercase tracking-widest">
                                                    {video.folderId ? 'In Library' : 'Stand-alone'}
                                                </p>
                                            </div>
                                        </div>

                                        {isActive && (
                                            <div className="flex-shrink-0">
                                                <motion.div 
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_rgba(59,130,246,0.8)]" 
                                                />
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Footer Status */}
                        <div className="p-6 bg-white/[0.02] border-t border-white/5 text-center">
                            <span className="text-[9px] font-black text-foreground-muted uppercase tracking-[0.4em]">
                                End of Playlist
                            </span>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
