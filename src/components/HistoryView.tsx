import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Play, BookOpen } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getDb } from '../services/db';
import { useReadingStore } from '../stores/useReadingStore';
import { useVideoStore } from '../stores/useVideoStore';

interface HistoryItem {
  id: string; // chapterId or videoId
  seriesId?: string; // for manga
  folderId?: string; // for video
  title: string;
  coverPath?: string;
  type: 'manga' | 'video';
  lastReadAt: string;
  progress: number; // page or seconds
  total: number; // total pages or duration
  filePath: string;
}

interface MangaHistoryRow {
  id: string;
  seriesId: string;
  chapterTitle: string;
  seriesTitle: string;
  coverPath?: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: string;
  filePath: string;
}

interface VideoHistoryRow {
  id: string;
  folderId: string;
  title: string;
  thumbnailPath?: string;
  lastPosition: number;
  duration: number;
  filePath: string;
}

export function HistoryView() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const { openFolder } = useReadingStore();
  const { playVideo, folders } = useVideoStore();

  async function loadHistory(): Promise<HistoryItem[]> {
    const db = getDb();
    
    // 1. Fetch Manga History
    const mangaHistory = await db.select<MangaHistoryRow[]>(`
      SELECT 
        rp.chapterId as id, 
        rp.seriesId, 
        c.title as chapterTitle, 
        s.title as seriesTitle, 
        s.coverPath, 
        rp.currentPage, 
        rp.totalPages, 
        rp.lastReadAt,
        c.filePath
      FROM ReadingProgress rp
      JOIN Chapters c ON rp.chapterId = c.id
      JOIN Series s ON rp.seriesId = s.id
      ORDER BY rp.lastReadAt DESC
      LIMIT 20
    `);

    // 2. Fetch Video History
    // We need to query Videos where lastPosition > 0, ordered by updated/created?
    // Our schema doesn't have 'lastReadAt' for videos explicitly, but we can assume 'updatedAt' or add it.
    // For now, let's just show videos with progress > 0.
    // Ideally we should have a 'History' table or 'lastPlayedAt' column.
    // Let's use what we have:
    const videoHistory = await db.select<VideoHistoryRow[]>(`
        SELECT 
            id, folderId, title, thumbnailPath, lastPosition, duration, filePath
        FROM Videos 
        WHERE lastPosition > 0 
        -- ORDER BY updatedAt DESC -- We don't have updatedAt trigger content update yet, but let's assume raw default for now
        LIMIT 20
    `);

    return [
        ...mangaHistory.map(m => ({
            id: m.id,
            seriesId: m.seriesId,
            title: `${m.seriesTitle} - ${m.chapterTitle}`,
            coverPath: m.coverPath,
            type: 'manga' as const,
            lastReadAt: m.lastReadAt,
            progress: m.currentPage,
            total: m.totalPages || 0,
            filePath: m.filePath
        })),
        ...videoHistory.map(v => ({
            id: v.id,
            folderId: v.folderId,
            title: v.title,
            coverPath: v.thumbnailPath, // or generate one
            type: 'video' as const,
            lastReadAt: new Date().toISOString(), // Mock date since we lack column
            progress: v.lastPosition,
            total: v.duration || 0,
            filePath: v.filePath
        }))
    ].sort((a, b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime());
  }

  useEffect(() => {
    let cancelled = false;

    void loadHistory().then((items) => {
      if (!cancelled) {
        setHistory(items);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = async (item: HistoryItem) => {
      if (item.type === 'manga') {
        // We need just the folder path of the chapter, usually parent of file
        // Current `filePath` in DB is the CHAPTER path (could be zip or folder)
        await openFolder(item.filePath, item.seriesId, item.id);
      } else {
         // Play Video
         const folder = folders.find(f => f.id === item.folderId);
         // Construct video object
         const video = {
             id: item.id,
             folderId: item.folderId!,
             filePath: item.filePath,
             title: item.title,
             duration: item.total,
             lastPosition: item.progress,
             thumbnailPath: item.coverPath
         };
         playVideo(video, folder); // Folder might be undefined if not loaded, handle gracefully?
      }
  };

  const getCoverSrc = (coverPath?: string) => {
    if (!coverPath) return '';
    return coverPath.startsWith('http') ? coverPath : convertFileSrc(coverPath);
  };

  return (
    <div className="h-full overflow-y-auto p-8 custom-scrollbar">
      <div className="flex items-center gap-4 mb-8">
        <Clock size={32} className="text-purple-500" />
        <h1 className="text-3xl font-bold text-white">History</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {history.map((item) => (
          <motion.div
            key={`${item.type}-${item.id}`}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-800/50 rounded-xl overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all cursor-pointer group"
            onClick={() => handleOpen(item)}
          >
            <div className="aspect-video bg-black relative">
               {item.coverPath ? (
                 <img src={getCoverSrc(item.coverPath)} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                    {item.type === 'manga' ? <BookOpen size={40} className="text-neutral-700" /> : <Play size={40} className="text-neutral-700" />}
                 </div>
               )}
               
               {/* Progress Bar */}
               <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-900">
                  <div 
                    className={`h-full ${item.type === 'video' ? 'bg-red-500' : 'bg-purple-500'}`} 
                    style={{ width: `${(item.progress / Math.max(item.total, 1)) * 100}%` }}
                  />
               </div>
               
               {/* Type Badge */}
               <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-bold uppercase text-white/80">
                   {item.type}
               </div>
            </div>
            
            <div className="p-4">
                <h3 className="text-white font-medium line-clamp-1 group-hover:text-purple-400 transition-colors">{item.title}</h3>
                <p className="text-neutral-400 text-sm mt-1">
                    {item.type === 'manga' ? `Page ${item.progress}` : `${Math.floor(item.progress / 60)}m watched`}
                </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
