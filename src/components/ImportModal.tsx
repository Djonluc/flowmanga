import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen, Globe, Download, Loader2, CheckCircle, AlertCircle, User } from 'lucide-react';
import { useScraperStore } from '../stores/useScraperStore';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportFolder: () => void;
  onImportWeb: (url: string) => void;
}

export function ImportModal({ isOpen, onClose, onImportFolder }: ImportModalProps) {
  const [mode, setMode] = useState<'choose' | 'web'>('choose');
  const [localUrl, setLocalUrl] = useState('');
  const [showFullDesc, setShowFullDesc] = useState(false);
  
  const { 
      setUrl, scrape, download, reset,
      isScraping, isDownloading, scrapedImages, progress, error,
      downloadPath, failedCount, metadata, chapterFeed, selectedChapterKeys, setSelectedChapters
  } = useScraperStore();

  // Reset store when modal opens/closes, or trigger scrape if prefilled
  useEffect(() => {
    if (isOpen) {
      if (useScraperStore.getState().url) {
        setLocalUrl(useScraperStore.getState().url);
        setMode('web');
        scrape();
      }
    } else {
        setMode('choose');
        setLocalUrl('');
        reset();
    }
  }, [isOpen]);

  const handleWebSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localUrl.trim()) {
      setUrl(localUrl.trim());
      setMode('web');
      await scrape();
    }
  };

  const handleFolderClick = () => {
    onImportFolder();
    onClose();
  };
  
  const handleDownload = async () => {
      const result = await download();
      
      if (result === 'prompted') {
          // Immediately close this modal so the SafetyCheckModal is focused and clean
          onClose();
          return;
      }

      if (result === 'started' && !useScraperStore.getState().error) {
           setTimeout(() => {
               onClose();
           }, 2000);
      }
  };

  const handleToggleChapter = (id: string) => {
      if (selectedChapterKeys.includes(id)) {
          setSelectedChapters(selectedChapterKeys.filter(k => k !== id));
      } else {
          setSelectedChapters([...selectedChapterKeys, id]);
      }
  };

  const handleSelectLatest = (n: number) => {
      setSelectedChapters(chapterFeed.slice(-n).map(c => c.id)); // Feed is ascending, latest are at the end
  };

  const handleSelectFirst = (n: number) => {
      setSelectedChapters(chapterFeed.slice(0, n).map(c => c.id)); // First are at the start
  };

  const handleSelectAll = () => {
      setSelectedChapters(chapterFeed.map(c => c.id));
  };

  const handleSelectRange = (from: number, to: number) => {
      const selected = chapterFeed.filter(ch => {
          const num = parseFloat(ch.attributes.chapter || '0');
          return num >= from && num <= to;
      });
      setSelectedChapters(selected.map(c => c.id));
  };

  // Local state for range inputs
  const [rangeFrom, setRangeFrom] = useState<string>('1');
  const [rangeTo, setRangeTo] = useState<string>('10');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />
          
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Globe size={18} className="text-blue-400" />
                  </div>
                  <h2 className="text-xl font-black text-foreground italic tracking-tighter uppercase">
                    {mode === 'choose' ? 'Add Manga' : 'Online Link'}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-foreground-dim hover:text-foreground transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {mode === 'choose' ? (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-foreground">Add New Content</p>
                      <p className="text-sm text-foreground-dim">Select your preferred source to expand your library</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <button
                        onClick={handleFolderClick}
                        className="p-10 bg-black/20 hover:bg-white/5 border border-white/5 hover:border-accent/50 rounded-[40px] transition-all duration-300 group text-left relative overflow-hidden backdrop-blur-3xl shadow-cinematic"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                          <FolderOpen size={120} />
                        </div>
                        <div className="relative">
                          <div className="w-20 h-20 bg-blue-500/10 rounded-3xl group-hover:scale-110 group-hover:-rotate-12 transition-all duration-300 flex items-center justify-center mb-8 shadow-lg border border-blue-500/20">
                            <FolderOpen size={40} className="text-blue-400 drop-shadow-md" />
                          </div>
                          <h3 className="font-black italic uppercase tracking-widest text-foreground text-3xl mb-4 group-hover:text-blue-400 transition-colors">Local Archive</h3>
                          <p className="text-sm font-bold text-foreground-dim leading-relaxed tracking-wide max-w-[85%]">
                            Import existing directories or archives from your system directly into FlowManga.
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => setMode('web')}
                        className="p-10 bg-black/20 hover:bg-white/5 border border-white/5 hover:border-purple-500/50 rounded-[40px] transition-all duration-300 group text-left relative overflow-hidden backdrop-blur-3xl shadow-cinematic"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
                          <Globe size={120} />
                        </div>
                        <div className="relative">
                          <div className="w-20 h-20 bg-purple-500/10 rounded-3xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 flex items-center justify-center mb-8 shadow-lg border border-purple-500/20">
                            <Globe size={40} className="text-purple-400 drop-shadow-md" />
                          </div>
                          <h3 className="font-black italic uppercase tracking-widest text-foreground text-3xl mb-4 group-hover:text-purple-400 transition-colors">Online Source</h3>
                          <p className="text-sm font-bold text-foreground-dim leading-relaxed tracking-wide max-w-[85%]">
                            Scrape MangaDex, WebNovel, or other supported digital sources using a direct URL.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {!isScraping && scrapedImages.length === 0 && chapterFeed.length === 0 && !isDownloading ? (
                        <form onSubmit={handleWebSubmit} className="space-y-6">
                          <div className="space-y-3">
                            <label htmlFor="import-source-url" className="text-xs font-black text-foreground-dim uppercase tracking-widest">Source URL</label>
                            <input
                                id="import-source-url"
                                type="text"
                                value={localUrl}
                                onChange={(e) => setLocalUrl(e.target.value)}
                                placeholder="Paste MangaDex link here..."
                                className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-xl text-foreground placeholder:text-foreground-dim focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium"
                            />
                            <p className="text-[10px] text-foreground-dim italic">Example: mangadex.org/title/uuid or /chapter/uuid</p>
                          </div>
                          
                          {error && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-start gap-3 text-red-400 text-sm bg-red-400/10 p-4 rounded-xl border border-red-400/20"
                              >
                                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                  <span>{error}</span>
                              </motion.div>
                          )}

                          <div className="flex gap-4 pt-2">
                              <button
                              type="button"
                              onClick={() => setMode('choose')}
                              className="flex-1 px-6 py-4 bg-surface text-foreground rounded-xl hover:bg-surface-raised border border-white/5 transition-all font-bold"
                              >
                              Back
                              </button>
                              <button
                              type="submit"
                              disabled={!localUrl.trim()}
                              className="flex-[2] px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-black uppercase tracking-widest text-sm"
                              >
                              Check Link
                              </button>
                          </div>
                        </form>
                    ) : (
                        <div className="space-y-8">
                            {isScraping && (
                                <div className="py-20 text-center space-y-6">
                                    <div className="relative inline-block">
                                      <Loader2 size={64} className="animate-spin text-blue-500" />
                                      <Globe size={24} className="absolute inset-0 m-auto text-foreground animate-pulse" />
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-xl font-black text-foreground italic tracking-tighter uppercase">Searching...</p>
                                      <p className="text-foreground-dim text-sm">Getting things ready...</p>
                                    </div>
                                </div>
                            )}
                            
                            {(scrapedImages.length > 0 || chapterFeed.length > 0) && !isDownloading && !isScraping && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Preview Card */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-6 relative">
                                      <div className="absolute top-4 right-4 px-3 py-1 bg-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest text-foreground shadow-lg">
                                        EST. {useScraperStore.getState().estimatedSize}
                                      </div>
                                      <div className="flex flex-col md:flex-row gap-6">
                                        {metadata?.coverUrl && (
                                          <div className="shrink-0 self-center md:self-start">
                                            <img 
                                              src={metadata.coverUrl} 
                                              alt="Cover"
                                              className="w-32 h-44 object-cover rounded-xl shadow-2xl border border-white/10"
                                              onError={(e) => {
                                                  // Try to proxy it if it fails natively (fixes WebNovel Cloudflare blocking <img> tags)
                                                  if (!e.currentTarget.src.startsWith("data:")) {
                                                      import("@tauri-apps/api/core").then(({ invoke }) => {
                                                          invoke("proxy_image", { url: metadata.coverUrl }).then(dataUri => {
                                                              e.currentTarget.src = dataUri as string;
                                                          }).catch(() => {});
                                                      });
                                                  }
                                              }}
                                            />
                                          </div>
                                        )}
                                        <div className="flex-1 space-y-3 min-w-0">
                                          <div>
                                            <h4 className="text-2xl font-black text-foreground tracking-tight line-clamp-2 leading-none mb-2 italic uppercase">
                                                {metadata?.title || 'Unknown Title'}
                                            </h4>
                                            <div className="flex flex-wrap gap-2 items-center mb-2">
                                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded uppercase tracking-widest border border-blue-500/30">
                                                {metadata?.source || 'MangaDex'}
                                              </span>
                                              {metadata?.author && (
                                                <span className="text-foreground-dim text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                                   <User size={12} className="text-blue-500" />
                                                   {metadata.author}
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                              {metadata?.tags?.slice(0, 6).map(tag => (
                                                <span key={tag} className="px-1.5 py-0.5 bg-white/5 text-foreground-dim text-[9px] font-bold rounded uppercase tracking-widest border border-white/5">
                                                  {tag}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                          
                                          {metadata?.description && (
                                            <div className="space-y-1">
                                              <p className={`text-foreground-dim text-[11px] leading-relaxed font-medium ${showFullDesc ? '' : 'line-clamp-2'}`}>
                                                {metadata.description}
                                              </p>
                                              <button 
                                                onClick={() => setShowFullDesc(!showFullDesc)}
                                                className="text-blue-400 text-[9px] font-black uppercase tracking-widest hover:underline flex items-center gap-1"
                                              >
                                                {showFullDesc ? 'Show Less' : 'Full Synopsis'}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Chapter Selector & Advanced Options */}
                                    {chapterFeed.length > 0 && (
                                      <div className="space-y-4">
                                        <div className="flex items-start gap-4 bg-blue-500/10 border border-blue-500/20 p-5 rounded-2xl text-blue-400">
                                          <AlertCircle size={24} className="shrink-0 mt-0.5" />
                                          <p className="text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                                            Note: Depending on the online source, downloading chapters may take significantly longer than others. Please be patient and allow time for completion.
                                          </p>
                                        </div>
                                        <div className="flex flex-col gap-4">
                                          <div className="flex items-center justify-between">
                                            <p className="text-xs font-black text-foreground-dim uppercase tracking-widest">Batch Selection</p>
                                            <div className="flex gap-2">
                                              <button 
                                                onClick={handleSelectAll}
                                                className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold text-foreground-dim hover:text-foreground transition-all"
                                              >
                                                Select All
                                              </button>
                                              {[5, 10, 50].map(n => (
                                                <button 
                                                  key={n}
                                                  onClick={() => handleSelectLatest(n)}
                                                  className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold text-foreground-dim hover:text-foreground transition-all"
                                                >
                                                  Latest {n}
                                                </button>
                                              ))}
                                              <button 
                                                onClick={() => handleSelectFirst(10)}
                                                className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold text-foreground-dim hover:text-foreground transition-all"
                                              >
                                                First 10
                                              </button>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-xl">
                                            <span className="text-[10px] font-black text-foreground-dim uppercase tracking-widest whitespace-nowrap">Chapter Range</span>
                                            <div className="flex items-center gap-2 flex-1">
                                              <input 
                                                type="number" 
                                                aria-label="First chapter in range"
                                                value={rangeFrom}
                                                onChange={(e) => setRangeFrom(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-foreground text-xs text-center"
                                                placeholder="From"
                                              />
                                              <span className="text-foreground-muted">to</span>
                                              <input 
                                                type="number" 
                                                aria-label="Last chapter in range"
                                                value={rangeTo}
                                                onChange={(e) => setRangeTo(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-foreground text-xs text-center"
                                                placeholder="To"
                                              />
                                              <button 
                                                onClick={() => handleSelectRange(parseFloat(rangeFrom), parseFloat(rangeTo))}
                                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase rounded-lg transition-all"
                                              >
                                                Apply
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 p-1">
                                          {chapterFeed.map((chapter, idx) => (
                                            <button
                                              key={`${chapter.id}-${idx}`}
                                              onClick={() => handleToggleChapter(chapter.id)}
                                              className={`p-3 rounded-xl border text-left transition-all relative ${
                                                selectedChapterKeys.includes(chapter.id)
                                                  ? 'bg-blue-600 border-blue-400 text-foreground shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                                                  : 'bg-black/20 border-white/5 text-foreground-dim hover:border-white/20'
                                              }`}
                                            >
                                              <div className="flex flex-col">
                                                <span className="text-xs font-black tracking-tight leading-none mb-1">
                                                  CH. {chapter.attributes.chapter || 'EXT'}
                                                </span>
                                                <span className="text-[10px] opacity-70 truncate">
                                                  {chapter.attributes.title || 'Untitled'}
                                                </span>
                                              </div>
                                              {selectedChapterKeys.includes(chapter.id) && (
                                                <CheckCircle size={12} className="absolute top-2 right-2" />
                                              )}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="space-y-4 pt-4">
                                      <button
                                        onClick={handleDownload}
                                        disabled={selectedChapterKeys.length === 0 && scrapedImages.length === 0}
                                        className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                      >
                                          <Download size={20} />
                                          <span>
                                            {selectedChapterKeys.length > 1 
                                              ? `Download ${selectedChapterKeys.length} Chapters` 
                                              : 'Start Download'}
                                          </span>
                                      </button>
                                      
                                      <div className="flex justify-center gap-6">
                                        <button onClick={reset} className="text-foreground-dim text-xs font-bold uppercase hover:text-foreground transition-colors">
                                            Start Over
                                        </button>
                                        <span className="text-foreground">|</span>
                                         <p className="text-[10px] text-foreground-muted font-medium">Auto-naming and tags enabled</p>
                                      </div>
                                    </div>
                                </div>
                            )}
                            
                            {isDownloading && (
                                <div className="py-12 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div className="space-y-1">
                                              <p className="text-xs font-black text-blue-400 uppercase tracking-widest">In Progress</p>
                                              <h3 className="text-2xl font-black text-foreground italic tracking-tighter uppercase leading-none">Downloading</h3>
                                            </div>
                                            <span className="text-4xl font-black text-foreground italic">{Math.round(progress)}%</span>
                                        </div>
                                        <div className="h-3 bg-surface rounded-full border border-white/5 overflow-hidden p-0.5">
                                            <motion.div 
                                              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                                              initial={{ width: 0 }}
                                              animate={{ width: `${progress}%` }}
                                              transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-foreground-dim font-bold uppercase tracking-widest">
                                          <span>Writing metadata...</span>
                                          <span>{failedCount} Failures</span>
                                        </div>
                                    </div>
                                    <p className="text-center text-sm text-foreground-dim italic">Please do not close the application during import.</p>
                                </div>
                            )}
                            
                            {progress === 100 && !isDownloading && (
                                <div className="py-12 text-center space-y-8 animate-in zoom-in-95 duration-500">
                                    <div className="relative inline-block">
                                      <div className={`w-24 h-24 rounded-full flex items-center justify-center ${failedCount > 0 ? 'bg-orange-500/10' : 'bg-green-500/10'}`}>
                                          {failedCount > 0 ? <AlertCircle size={48} className="text-orange-500" /> : <CheckCircle size={48} className="text-green-500" />}
                                      </div>
                                      <motion.div 
                                        className="absolute -inset-2 rounded-full border-2 border-green-500/20"
                                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                      />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-black text-foreground italic tracking-tighter uppercase">
                                          {failedCount > 0 ? 'Batch Incomplete' : 'Success'}
                                        </h3>
                                        <p className="text-foreground-dim font-medium">
                                            {failedCount > 0 
                                              ? `${failedCount} segments failed. Re-scrape may be required for missing pages.` 
                                              : 'Library updated. Content is now available for offline reading.'}
                                        </p>
                                    </div>
                                    
                                    <div className="flex gap-4 max-w-sm mx-auto">
                                        <button
                                            onClick={() => {
                                                if (downloadPath) {
                                                    import('@tauri-apps/plugin-shell').then(({ open }) => open(downloadPath));
                                                }
                                            }}
                                            className="flex-1 py-4 bg-surface border border-white/10 hover:bg-surface-raised text-foreground rounded-2xl transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest"
                                        >
                                            <FolderOpen size={16} />
                                            Explore
                                        </button>
                                         <button
                                            onClick={onClose}
                                            className="flex-1 py-4 bg-white hover:bg-neutral-200 text-black rounded-2xl transition-all text-xs font-black uppercase tracking-widest"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
