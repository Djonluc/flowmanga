import { useReadingStore } from '../../stores/useReadingStore';
import { useReaderStore } from '../../stores/useReaderStore';
import { ArrowLeft, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export const ReaderTopBar = ({ visible, onBack }: { visible: boolean, onBack: () => void }) => {
    const { mode, autoScroll, setAutoScroll, scrollSpeed } = useReaderStore();
    const { currentFolderPath } = useReadingStore();

    const title = currentFolderPath ? currentFolderPath.split(/[\\/]/).pop() : 'Reading Session';

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: -40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 32, scale: 1 }}
                    exit={{ opacity: 0, y: -40, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[90%] md:max-w-4xl px-8 py-3 flex items-center justify-between bg-black/40 backdrop-blur-[64px] border border-white/10 rounded-[32px] shadow-[0_32px_128px_rgba(0,0,0,0.6)] pointer-events-auto"
                >
                    {/* LEFT: Back & Title */}
                    <div className="flex items-center gap-6 min-w-0">
                        <button 
                            onClick={onBack}
                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-foreground hover:bg-accent transition-all hover:scale-110 active:scale-90 border border-white/5 group"
                        >
                            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        </button>

                        <div className="flex flex-col gap-0 min-w-0">
                            <span className="text-[8px] font-black text-accent uppercase tracking-[0.5em] opacity-80 mb-0.5">FlowManga Engine</span>
                            <h1 className="text-lg font-black text-foreground leading-tight truncate uppercase italic tracking-tighter">
                                {title}
                            </h1>
                        </div>
                    </div>

                    {/* RIGHT: Minimal Mode Indicator */}
                    <div className="flex items-center gap-3">
                         {/* Play Pill (Vertical Mode Only) */}
                         {mode === 'vertical' && (
                             <button
                                onClick={() => setAutoScroll(!autoScroll)}
                                className={clsx(
                                    "px-5 py-2 rounded-full border transition-all duration-500 flex items-center gap-3 group/pill",
                                    autoScroll 
                                        ? "bg-accent border-accent text-foreground shadow-[0_0_32px_rgba(59,130,246,0.3)]" 
                                        : "bg-white/5 border-white/5 text-foreground-dim hover:text-foreground"
                                )}
                             >
                                {autoScroll ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                                <span className="text-[9px] font-black uppercase tracking-widest flex items-center">
                                    {autoScroll ? 'Active' : 'Scroll'}
                                    {autoScroll && (
                                        <span className="ml-3 px-2 py-0.5 rounded-md bg-white/20 text-[7px]">
                                            {Math.round(scrollSpeed)} PPS
                                        </span>
                                    )}
                                </span>
                             </button>
                         )}

                         <div className="h-8 w-px bg-white/10 mx-2" />

                         <div className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/5">
                            <span className="text-[9px] font-black text-foreground-dim uppercase tracking-widest">
                                {mode}
                            </span>
                         </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
