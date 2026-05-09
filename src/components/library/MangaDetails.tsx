import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { 
    Play, ArrowLeft, Clock, Library as LibraryIcon, User, RefreshCw, 
    Trash2, Image as ImageIcon, Sparkles, ShieldCheck, Loader2, Wrench,
    Globe, Edit2, Bomb, Calendar, BookOpen, Download, Plus
} from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { useLibraryStore, type Book } from '../../stores/useLibraryStore';
import { useReadingStore } from '../../stores/useReadingStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useModalStore } from '../../stores/useModalStore';
import { UpdateManager } from '../../services/UpdateManager';
import { DownloadService } from '../../services/DownloadService';
import { toast } from '../Toast';
import clsx from 'clsx';
import { InputModal } from '../InputModal';
import { ImportModal } from '../ImportModal';
import { extractDominantColor } from '../../utils/colorUtils';

interface MangaDetailsProps {
  seriesId: string;
  onBack: () => void;
}

export const MangaDetails: React.FC<MangaDetailsProps> = ({ seriesId, onBack }) => {
  const { series, loadFromDb, renameSeries, refreshMangaMetadata, toggleFilterTag, clearFilterTags } = useLibraryStore();
  const { openFolder } = useReadingStore();
  const { setAmbientImage } = useSettingsStore();
  
  const [isDraggingCover, setIsDraggingCover] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [accentColor, setAccentColor] = useState<string>('#6366f1'); // Default indigo-500
  
  const selectedSeries = series.find(s => s.id === seriesId);

  const coverSrc = selectedSeries?.cover ? (selectedSeries.cover.startsWith('http') ? selectedSeries.cover : convertFileSrc(selectedSeries.cover)) : '';

  React.useEffect(() => {
    let active = true;
    if (coverSrc) {
        setAmbientImage(coverSrc);
        extractDominantColor(coverSrc).then(color => {
            if (active && color) setAccentColor(color);
        });
    }
    return () => {
        active = false;
        setAmbientImage(null);
    };
  }, [coverSrc, setAmbientImage]);

  if (!selectedSeries) return null;

  const sortedChapters = [...selectedSeries.books].sort((a, b) => {
    const numA = parseFloat(a.meta.chapter || '0');
    const numB = parseFloat(b.meta.chapter || '0');
    return numA - numB;
  });

  const handleReadChapter = async (targetBook: Book, startPage?: number) => {
    const sequence = sortedChapters.map(b => ({ id: b.id, path: b.path, title: b.title }));
    await openFolder(targetBook.path, targetBook.seriesId, targetBook.id, sequence, startPage);
  };

  const handleContinueReading = () => {
    const latestWithProgress = sortedChapters.filter(b => b.progress && b.progress.currentPage > 0).pop();
    if (latestWithProgress) {
      handleReadChapter(latestWithProgress, latestWithProgress.progress?.currentPage);
    } else {
      if (sortedChapters.length > 0) handleReadChapter(sortedChapters[0], 0);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col bg-[#060607] relative overflow-hidden"
    >
      {/* Background Glow */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 blur-[120px] scale-150 transition-all duration-1000"
        style={{ background: `radial-gradient(circle at 30% 30%, ${accentColor}, transparent)` }}
      />

      <div className="z-30 p-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest group backdrop-blur-xl shadow-2xl"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Library
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar z-10 px-8 pb-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-16 items-start pt-6">
            
            {/* Poster Container */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              className={clsx(
                  "group shrink-0 w-full lg:w-[380px] aspect-[2/3] rounded-[48px] overflow-hidden shadow-[0_48px_96px_rgba(0,0,0,0.6)] border border-white/10 relative transition-all duration-700",
                  isDraggingCover && "border-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.4)] scale-105"
              )}
            >
              {coverSrc ? (
                <img 
                    src={coverSrc} 
                    alt={selectedSeries.displayName} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]" 
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ) : (
                <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center gap-6">
                  <LibraryIcon size={64} className="text-neutral-800" />
                  <span className="text-[10px] font-black text-neutral-700 uppercase tracking-[0.4em]">No Cover Found</span>
                </div>
              )}

              {/* Cover Actions Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
                 <button className="px-6 py-3 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-2xl">
                    <ImageIcon size={14} /> Change Cover
                 </button>
              </div>
            </motion.div>

            {/* Info Section */}
            <div className="flex-1 min-w-0 space-y-12 py-4">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                   <span className="px-3 py-1 bg-indigo-500 text-white rounded-lg text-[9px] font-black tracking-tighter uppercase shadow-lg shadow-indigo-500/20">
                    {selectedSeries.type || 'MANGA'}
                  </span>
                  {selectedSeries.tags.map(tag => (
                    <button 
                      key={tag} 
                      onClick={() => {
                        onBack(); // Clear selected series and go back to library
                        useSettingsStore.getState().setActiveView('library');
                        toggleFilterTag(tag);
                      }}
                      className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold text-neutral-400 tracking-wider uppercase hover:bg-white/10 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                  <button 
                    onClick={() => useModalStore.getState().openTagManager(selectedSeries.id, selectedSeries.tags)}
                    className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black text-indigo-400 hover:text-indigo-300 tracking-widest uppercase transition-colors"
                  >
                    <Edit2 size={10} />
                    <span>Edit</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-[0.9] break-words">
                    {selectedSeries.displayName}
                  </h1>
                  <div className="flex items-center gap-6 text-neutral-500 font-bold text-xs uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <User size={14} className="text-indigo-500" />
                        <span>{selectedSeries.author || 'Unknown Author'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Globe size={14} className="text-indigo-500" />
                        <span>{selectedSeries.source || 'Local Library'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-12 py-8 border-y border-white/5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">Collection</span>
                    <span className="text-2xl font-black text-white tracking-tighter tabular-nums">{selectedSeries.books.length} <span className="text-sm font-medium text-neutral-500">Chapters</span></span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">Released</span>
                    <span className="text-2xl font-black text-white tracking-tighter">{new Date(selectedSeries.updatedAt).getFullYear()}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">Status</span>
                    <span className="text-2xl font-black text-indigo-500 tracking-tighter uppercase">Active</span>
                  </div>
                </div>
              </div>

              {/* Synopsis */}
              <div className="space-y-4 max-w-3xl">
                <p className="text-neutral-400 leading-relaxed font-medium text-lg opacity-80">
                  {selectedSeries.description || "Journey into this masterpiece. No synopsis available yet, but the content awaits."}
                </p>
              </div>

              {/* Main Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-6">
                <button 
                  onClick={handleContinueReading}
                  className="px-12 py-5 bg-white text-black rounded-[24px] font-black uppercase tracking-widest text-sm hover:scale-105 transition-all flex items-center gap-4 shadow-[0_20px_50px_rgba(255,255,255,0.15)] active:scale-95 group"
                >
                   <Play size={20} fill="currentColor" className="group-hover:scale-110 transition-transform" />
                   <span>{sortedChapters.some(b => b.progress?.currentPage) ? 'Continue Journey' : 'Begin Reading'}</span>
                 </button>

                 <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-[24px] border border-white/10 backdrop-blur-2xl">
                    <ActionButton icon={<Sparkles size={18} />} title="Sync Info" onClick={() => {
                        toast.success("Syncing Series Info...");
                        refreshMangaMetadata(selectedSeries.id).then(() => toast.success("Series info updated!"));
                    }} />
                    <ActionButton icon={<RefreshCw size={18} />} title="Download All" onClick={async () => {
                        toast.success("Checking for all updates...");
                        const num = await UpdateManager.checkForUpdates(selectedSeries.id);
                        if (num > 0) {
                            toast.success(`Queued ${num} new chapters for download!`);
                        } else if (num === 0) {
                            toast.success("Series is up to date.");
                        } else {
                            toast.error("Failed to check for updates.");
                        }
                    }} />
                    <ActionButton icon={<Download size={18} />} title="Download Next 5" onClick={async () => {
                        toast.success("Queuing next 5 chapters...");
                        const num = await UpdateManager.checkForUpdates(selectedSeries.id, 5);
                        if (num > 0) {
                            toast.success(`Queued ${num} chapters!`);
                        } else if (num === 0) {
                            toast.info("No new chapters to download.");
                        }
                    }} />
                    <ActionButton icon={<Plus size={18} />} title="Download X" onClick={() => {
                        useModalStore.getState().openInputModal({
                            title: "Batch Download",
                            placeholder: "Number of chapters (e.g. 10)",
                            description: "How many upcoming chapters would you like to queue?",
                            onSubmit: async (val) => {
                                const amount = parseInt(val);
                                if (isNaN(amount) || amount <= 0) {
                                    toast.error("Please enter a valid number");
                                    return;
                                }
                                toast.success(`Queuing next ${amount} chapters...`);
                                const num = await UpdateManager.checkForUpdates(selectedSeries.id, amount);
                                if (num > 0) {
                                    toast.success(`Queued ${num} chapters!`);
                                } else if (num === 0) {
                                    toast.info("No new chapters found.");
                                }
                            }
                        });
                    }} />
                    <ActionButton icon={<ShieldCheck size={18} />} title="Verify Files" onClick={async () => {
                        toast.success("Verifying file integrity...");
                        const { verifyLibraryIntegrity } = useLibraryStore.getState();
                        await verifyLibraryIntegrity(selectedSeries.id);
                        toast.success("Verification complete.");
                    }} />
                    {selectedSeries.seriesUrl && (
                        <ActionButton icon={<Globe size={18} />} title="Manage Source" onClick={async () => {
                            const { open } = await import('@tauri-apps/plugin-shell');
                            open(selectedSeries.seriesUrl!);
                        }} />
                    )}
                    <div className="w-px h-8 bg-white/10 mx-2" />
                    <ActionButton icon={<Bomb size={18} />} title="Nuclear Wipe" onClick={() => {
                        useModalStore.getState().openDeleteModal({
                            id: selectedSeries.id,
                            path: selectedSeries.path,
                            title: selectedSeries.title,
                            count: sortedChapters.length,
                            isSeries: true
                        });
                    }} danger />
                 </div>
              </div>
            </div>
          </div>

          {/* Chapter Grid */}
          <div className="mt-32 space-y-12">
            <div className="flex flex-col sm:flex-row items-end justify-between gap-4 border-b border-white/5 pb-8">
               <div className="space-y-2">
                   <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Chapter <span className="text-indigo-500">Log</span></h2>
                   <p className="text-neutral-600 text-[10px] font-black uppercase tracking-[0.4em]">{sortedChapters.length} Total Volumes Loaded</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {sortedChapters.map((book, idx) => {
                const isRead = book.progress && book.progress.currentPage >= book.progress.totalPages - 2;
                const percent = book.progress ? Math.floor((book.progress.currentPage / book.progress.totalPages) * 100) : 0;
                const chCover = book.cover ? (book.cover.startsWith('http') ? book.cover : convertFileSrc(book.cover)) : null;

                return (
                  <div
                    key={book.id}
                    onClick={() => handleReadChapter(book)}
                    className="group flex flex-row h-44 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-[32px] transition-all cursor-pointer overflow-hidden active:scale-[0.98]"
                  >
                    <div className="w-32 h-full flex-shrink-0 bg-neutral-900 relative">
                      {chCover ? (
                        <img src={chCover} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-800"><BookOpen size={28} /></div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col p-6 min-w-0 justify-between">
                      <div className="flex items-center justify-between">
                        <span className={clsx(
                            "px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest",
                            isRead ? "bg-indigo-500 text-white" : "bg-white/5 text-neutral-500"
                        )}>
                            VOL.{book.meta.chapter || idx + 1}
                        </span>
                        {isRead && <Clock size={12} className="text-indigo-500" />}
                      </div>
                      
                      <h4 className="text-white font-bold text-sm group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug tracking-tight">
                        {book.title}
                      </h4>

                      <div className="space-y-2">
                         <div className="flex items-center justify-between text-[9px] font-black uppercase text-neutral-600 tracking-widest">
                            <span>{percent}% SYNCED</span>
                            <span>{book.totalPages || '?'} PGS</span>
                         </div>
                         <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" style={{ width: `${percent}%` }} />
                         </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ActionButton = ({ icon, title, onClick, danger }: any) => (
    <button 
        onClick={onClick}
        className={clsx(
            "p-4 rounded-xl transition-all active:scale-90 flex items-center justify-center",
            danger ? "text-red-500 hover:bg-red-500/10" : "text-white hover:bg-white/10"
        )}
        title={title}
    >
        {icon}
    </button>
);
