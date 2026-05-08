import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { 
    Play, ArrowLeft, Clock, Library as LibraryIcon, User, RefreshCw, 
    Trash2, Image as ImageIcon, Sparkles, ShieldCheck, Loader2, Wrench,
    Globe, Edit2, Bomb
} from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { useLibraryStore, type Book } from '../../stores/useLibraryStore';
import { useReadingStore } from '../../stores/useReadingStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useScraperStore } from '../../stores/useScraperStore';
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
  const [ambientColor, setAmbientColor] = useState<string>('#3b82f6'); // Default blue-500
  
  const selectedSeries = series.find(s => s.id === seriesId);

  // Derive cover
  const coverSrc = selectedSeries?.cover ? (selectedSeries.cover.startsWith('http') ? selectedSeries.cover : convertFileSrc(selectedSeries.cover)) : '';

  // Sync Ambient & Extract Color
  React.useEffect(() => {
    let active = true;
    if (coverSrc) {
        setAmbientImage(coverSrc);
        
        // Extract dominant color for local UI
        extractDominantColor(coverSrc).then(color => {
            if (active && color) {
                setAmbientColor(color);
            }
        });
    } else {
        setAmbientColor('#3b82f6');
    }
    return () => {
        active = false;
        setAmbientImage(null);
    };
  }, [coverSrc, setAmbientImage]);

  if (!selectedSeries) return null;

  // Sort chapters numerically
  const sortedChapters = [...selectedSeries.books].sort((a, b) => {
    const numA = parseFloat(a.meta.chapter || '0');
    const numB = parseFloat(b.meta.chapter || '0');
    return numA - numB;
  });

  const handleChangeCover = async () => {
      try {
        const selected = await openDialog({
            multiple: false,
            filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp']}]
        });
        
        if (selected && typeof selected === 'string') {
            toast.info('Updating cover...');
            await useLibraryStore.getState().setSeriesCover(seriesId, selected);
            toast.success('Cover updated');
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to update cover');
      }
  };

  const handleRemoveCover = async () => {
      if (confirm('Remove this cover image?')) {
          try {
              await useLibraryStore.getState().removeSeriesCover(seriesId);
              toast.success('Cover removed');
          } catch (e) {
              console.error(e);
              toast.error('Failed to remove cover');
          }
      }
  };

  const handleReadChapter = async (targetBook: Book, startPage?: number) => {
    const sequence = sortedChapters.map(b => ({ id: b.id, path: b.path, title: b.title }));
    await openFolder(targetBook.path, targetBook.seriesId, targetBook.id, sequence, startPage);
  };

  const handleStartFromBeginning = () => {
    if (sortedChapters.length > 0) {
      handleReadChapter(sortedChapters[0], 0);
    }
  };

  const handleContinueReading = () => {
    const latestWithProgress = sortedChapters.filter(b => b.progress && b.progress.currentPage > 0).pop();
    if (latestWithProgress) {
      handleReadChapter(latestWithProgress, latestWithProgress.progress?.currentPage);
    } else {
      handleStartFromBeginning();
    }
  };
  
  const handleVerifyAndRepair = async () => {
    if (isVerifying) return;
    setIsVerifying(true);
    
    try {
        toast.info('Verifying files...');
        await refreshMangaMetadata(seriesId);
        
        const results = await invoke<any[]>('validate_chapter_contents', { seriesPath: selectedSeries.path });
        const corrupt = results.filter(r => !r.isValid);
        
        if (corrupt.length > 0) {
            toast.info(`Repairing ${corrupt.length} chapters...`);
            for (const c of corrupt) {
                await DownloadService.repairChapter(seriesId, c.id);
            }
            toast.success('Repair complete');
        } else {
            toast.success('All chapters verified');
        }
        await loadFromDb();
    } catch (e) {
        toast.error('Verification failed');
    } finally {
        setIsVerifying(false);
    }
  };

  const handleManageSource = async () => {
    const seriesUrl = await UpdateManager.resolveSeriesUrl(seriesId);

    if (seriesUrl) {
        useScraperStore.getState().setUrl(seriesUrl);
        setIsImportModalOpen(true);
    } else {
        toast.error("No source URL found for this series.");
    }
  };

  const handleNuclearRedownload = async () => {
    const seriesUrl = await UpdateManager.resolveSeriesUrl(seriesId);

    if (!seriesUrl) {
        toast.error("No source URL found for nuclear redownload.");
        return;
    }

    if (confirm("NUCLEAR ACTION: This will delete all local chapter files and re-download everything from the original source. Continue?")) {
        setIsVerifying(true);
        try {
            const success = await DownloadService.wipeAndRedownload(
                selectedSeries.id, 
                selectedSeries.path, 
                seriesUrl
            );
            
            if (success) {
                toast.success("Nuclear wipe complete. Starting fresh download...");
                // Use global store to trigger modal in parent after navigation
                useScraperStore.getState().setUrl(seriesUrl);
                useScraperStore.getState().setAutoOpenModal(true);
                onBack(); 
            } else {
                toast.error("Nuclear wipe failed.");
            }
        } catch (e) {
            toast.error("Nuclear wipe failed.");
        } finally {
            setIsVerifying(false);
        }
    }
  };

  const handleRepairSingle = async (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    try {
        toast.info(`Repairing Chapter ${book.meta.chapter}...`);
        const success = await DownloadService.repairChapter(seriesId, book.id);
        
        if (success) {
            toast.success('Chapter repaired successfully');
            await loadFromDb();
        } else {
            toast.error('Repair failed');
        }
    } catch (e) {
        toast.error('Repair failed');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col bg-[#080808] relative overflow-hidden"
    >
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 blur-[100px] scale-150 transition-opacity duration-1000"
        style={{
          background: coverSrc ? `radial-gradient(circle at 30% 30%, ${ambientColor}, transparent)` : 'none'
        }}
      />

      <div className="z-30 p-8 flex items-center justify-between pointer-events-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.2em] group backdrop-blur-md"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to Library
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar z-10 px-8 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 items-start pt-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={clsx(
                  "group shrink-0 w-full lg:w-96 aspect-[2/3] rounded-[40px] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/10 relative transition-all",
                  isDraggingCover && "border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.3)] scale-105"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingCover(true); }}
              onDragLeave={() => setIsDraggingCover(false)}
              onDrop={async (e) => {
                  e.preventDefault();
                  setIsDraggingCover(false);
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) {
                      const file = files[0]; 
                      const filePath = (file as any).path; 
                      if (filePath) {
                          toast.info('Updating cover...');
                          await useLibraryStore.getState().setSeriesCover(seriesId, filePath);
                          toast.success('Cover updated');
                      }
                  }
              }}
            >
              {coverSrc ? (
                <img src={coverSrc} alt={selectedSeries.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center gap-6">
                  <LibraryIcon size={64} className="text-neutral-700" />
                  <span className="text-xs font-black text-neutral-600 uppercase tracking-widest">Missing Cover Art</span>
                </div>
              )}

              <div className={clsx(
                  "absolute inset-0 bg-black/60 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-sm pointer-events-none",
                  isDraggingCover ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto"
              )}>
                  {isDraggingCover ? (
                      <div className="flex flex-col items-center gap-2 text-blue-400">
                          <ImageIcon size={32} className="animate-bounce" />
                          <span className="font-black uppercase tracking-widest text-xs">Drop to Update</span>
                      </div>
                  ) : (
                    <>
                        <button 
                            onClick={handleChangeCover}
                            className="px-6 py-3 bg-white text-black rounded-full font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-xl"
                        >
                            <ImageIcon size={14} /> Change Cover
                        </button>
                        {selectedSeries.cover && (
                            <button 
                                onClick={handleRemoveCover}
                                className="px-6 py-3 bg-red-500/20 text-red-500 rounded-full font-black uppercase text-[10px] tracking-widest hover:bg-red-500/30 transition-colors flex items-center gap-2 border border-red-500/20"
                            >
                                <Trash2 size={14} /> Remove
                            </button>
                        )}
                    </>
                  )}
              </div>
            </motion.div>

            <div className="flex-1 min-w-0 space-y-10">
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">
                    STORY
                  </span>
                  {selectedSeries.tags.map(tag => (
                    <button 
                        key={tag} 
                        onClick={() => {
                            clearFilterTags();
                            toggleFilterTag(tag);
                            onBack();
                        }}
                        className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em] hover:bg-accent hover:border-accent hover:text-white transition-all active:scale-95"
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter uppercase italic leading-[0.85] break-words">
                    {selectedSeries.displayName}
                  </h1>
                  <div className="flex items-center gap-4">
                    {selectedSeries.author && (
                        <div className="flex items-center gap-2 text-neutral-500 font-bold text-xs">
                        <User size={14} className="text-blue-500" />
                        <span className="uppercase tracking-[0.2em]">{selectedSeries.author}</span>
                        </div>
                    )}
                    <span className="w-1 h-1 rounded-full bg-neutral-800" />
                    <span className="text-neutral-500 font-bold text-[10px] uppercase tracking-[0.3em]">{selectedSeries.source || 'Local'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-8 py-4 border-y border-white/5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Chapters</span>
                    <span className="text-xl font-black text-white uppercase italic">{selectedSeries.books.length} VOLS</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Last Modified</span>
                    <span className="text-xl font-black text-white uppercase italic">{new Date(selectedSeries.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Progress</span>
                    <span className="text-xl font-black text-white uppercase italic">
                      {Math.floor((sortedChapters.filter(b => b.progress?.currentPage && b.progress.currentPage >= b.progress.totalPages - 1).length / sortedChapters.length) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center gap-4">
                    <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">Story</h3>
                    <div className="h-px flex-1 bg-white/5" />
                </div>
                <p className="text-neutral-400 leading-relaxed font-bold text-sm md:text-base opacity-80 line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
                  {selectedSeries.description || "No synopsis found. Tap Sync to fetch data."}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                <button 
                  onClick={handleContinueReading}
                  className="px-12 py-5 bg-white text-black rounded-[28px] font-black uppercase tracking-[0.2em] text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-4 shadow-[0_20px_50px_rgba(255,255,255,0.1)] active:scale-95 group"
                >
                   <Play size={20} fill="currentColor" className="group-hover:scale-110 transition-transform" />
                   <span>{sortedChapters.some(b => b.progress?.currentPage) ? 'Continue Reading' : 'Read Now'}</span>
                 </button>

                 <div className="flex items-center gap-2 p-1 bg-white/5 rounded-[32px] border border-white/10 backdrop-blur-md">
                    <button 
                    onClick={async () => {
                        setIsRefreshing(true);
                        toast.info(`Updating info from Source...`);
                        await refreshMangaMetadata(selectedSeries.id);
                        toast.success('Info updated');
                        setIsRefreshing(false);
                    }}
                    disabled={isRefreshing}
                    className="p-4 bg-white/5 hover:bg-white/10 text-white rounded-[24px] transition-all active:scale-90 disabled:opacity-50"
                    title="Sync Info"
                    >
                        <Sparkles size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>

                    <button 
                    onClick={async () => {
                        const limit = (window as any).__updateLimit !== undefined ? (window as any).__updateLimit : 5;
                        toast.info(`Checking for updates...`);
                        try {
                            const count = await UpdateManager.checkForUpdates(selectedSeries.id, limit);
                            if (count > 0) {
                                toast.success(`Queued ${count} new chapters!`);
                            } else if (count === 0) {
                                toast.info('Series is up to date');
                            }
                        } catch (e) {
                            toast.error('Error checking updates');
                        }
                    }}
                    className="p-4 bg-white/5 hover:bg-white/10 text-white rounded-[24px] transition-all active:scale-90"
                    title="Check Updates"
                    >
                        <RefreshCw size={18} />
                    </button>

                    <button 
                    onClick={handleVerifyAndRepair}
                    disabled={isVerifying}
                    className={clsx(
                        "p-4 rounded-[24px] transition-all active:scale-90",
                        isVerifying 
                            ? "bg-yellow-500/20 text-yellow-500 animate-pulse"
                            : "bg-white/5 hover:bg-white/10 text-white"
                    )}
                    title="Verify Files"
                    >
                    {isVerifying ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                    </button>

                    <button 
                        onClick={handleManageSource}
                        className="p-4 bg-white/5 hover:bg-white/10 text-white rounded-[24px] transition-all active:scale-90"
                        title="Manage Source"
                    >
                        <Globe size={18} />
                    </button>

                    <button 
                        onClick={() => setShowRenameModal(true)}
                        className="p-4 bg-white/5 hover:bg-white/10 text-white rounded-[24px] transition-all active:scale-90"
                        title="Rename"
                    >
                        <Edit2 size={18} />
                    </button>

                    <button 
                        onClick={handleNuclearRedownload}
                        className="p-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-[24px] transition-all active:scale-90 border border-red-500/20"
                        title="Nuclear Redownload (Wipe & Re-fetch)"
                    >
                        <Bomb size={18} />
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-2" />

                    <select 
                        className="bg-transparent text-neutral-400 text-[9px] font-black uppercase tracking-widest px-4 py-2 outline-none cursor-pointer [&>option]:bg-black"
                        onChange={(e) => {
                             (window as any).__updateLimit = Number(e.target.value);
                        }}
                        defaultValue="5"
                    >
                        <option value="1">L.1</option>
                        <option value="5">L.5</option>
                        <option value="10">L.10</option>
                        <option value="0">ALL</option>
                    </select>
                </div>

                <button 
                  onClick={handleStartFromBeginning}
                  className="px-8 py-5 bg-white/5 hover:bg-white/10 border border-white/5 text-neutral-400 hover:text-white rounded-[28px] font-black uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95"
                >
                   Start Over
                 </button>
              </div>
            </div>
          </div>

          <div className="mt-20 space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
               <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">
                CHAPTER <span className="text-blue-500">LIST</span>
              </h2>
              <div className="flex items-center gap-6">
                 <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-[0.4em]">
                   {sortedChapters.length} Total Volumes
                 </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedChapters.map((book, idx) => {
                const isRead = book.progress && book.progress.currentPage >= book.progress.totalPages - 2;
                const percent = book.progress ? Math.floor((book.progress.currentPage / book.progress.totalPages) * 100) : 0;
                
                return (
                  <div
                    key={book.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleReadChapter(book)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleReadChapter(book);
                      }
                    }}
                    className="group flex flex-row p-0 bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 rounded-[32px] transition-all text-left relative overflow-hidden active:scale-[0.98] h-40 cursor-pointer"
                  >
                    <div className="w-28 h-full flex-shrink-0 rounded-l-[32px] overflow-hidden bg-neutral-950 relative">
                      {(() => {
                        const chCover = book.cover 
                          ? (book.cover.startsWith('http') ? book.cover : convertFileSrc(book.cover)) 
                          : null;
                        return chCover ? (
                          <>
                            <img src={chCover} alt={book.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-neutral-950/20" />
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-800">
                            <LibraryIcon size={24} />
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex-1 flex flex-col p-6 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className={clsx(
                          "px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-[0.2em]",
                          isRead ? "bg-blue-500 text-white" : "bg-white/5 text-neutral-500 group-hover:text-neutral-300 transition-colors"
                        )}>
                          VOL.{book.meta.chapter || idx + 1}
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={(e) => handleRepairSingle(e, book)}
                                className="p-2 bg-white/0 hover:bg-white/10 rounded-xl text-neutral-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                title="Repair Chapter"
                            >
                                <Wrench size={10} />
                            </button>
                            {isRead && <Clock size={12} className="text-blue-500" />}
                        </div>
                      </div>
                      
                      <h4 className="text-white font-black uppercase italic text-xs md:text-sm group-hover:text-blue-400 transition-colors line-clamp-2 leading-tight">
                        {book.title}
                      </h4>

                      <div className="mt-auto space-y-2">
                         <div className="flex items-center justify-between text-[9px] font-black uppercase text-neutral-500 tracking-widest">
                            <span>{percent}% Read</span>
                            <span>{book.totalPages || book.progress?.totalPages || '?'} Pgs</span>
                         </div>
                         <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              className="h-full bg-blue-500"
                            />
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

      {showRenameModal && (
        <InputModal 
            isOpen={true}
            onClose={() => setShowRenameModal(false)}
            title="Rename Series"
            placeholder="New title..."
            description={`Renaming: ${selectedSeries.displayName}`}
            onSubmit={(newTitle) => {
                renameSeries(seriesId, newTitle);
                toast.success('Series renamed');
            }}
        />
      )}

      <ImportModal 
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImportFolder={() => {}}
            onImportWeb={() => {}}
      />
    </motion.div>
  );
};
