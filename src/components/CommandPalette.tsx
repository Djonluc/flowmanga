import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, Film, Settings, Monitor, ArrowRight, MousePointer2, Layout as LayoutIcon, Play, Activity, History, Home, PlusCircle } from 'lucide-react';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useVideoStore } from '../stores/useVideoStore';
import { useReadingStore } from '../stores/useReadingStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useReaderStore } from '../stores/useReaderStore';

interface SearchResult {
    id: string;
    title: string;
    type: 'manga' | 'video' | 'setting' | 'action' | 'navigation';
    subtitle?: string;
    icon: React.ReactNode;
    action: () => void;
}

export const CommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const { series, setSelectedSeriesId, setSearchQuery, clearFilterTags, toggleFilterTag } = useLibraryStore();
    const { folders: videoFolders } = useVideoStore();
    const { openFolder } = useReadingStore();
    const { setTheme, toggleFullScreenAction, setActiveView } = useSettingsStore();
    const { setAutoScroll, setMode: setReaderMode } = useReaderStore();

    // Toggle logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Reset when closed
    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Aggregate Results
    const results = useMemo(() => {
        const lowerQuery = query.toLowerCase();
        const searchResults: SearchResult[] = [];

        // 1. Navigation
        const views = [
            { id: 'nav-home', title: 'Go to Home', icon: <Home size={16} />, action: () => setActiveView('home') },
            { id: 'nav-library', title: 'Go to Library', icon: <BookOpen size={16} />, action: () => setActiveView('library') },
            { id: 'nav-videos', title: 'Go to Videos', icon: <Film size={16} />, action: () => setActiveView('videos') },
            { id: 'nav-history', title: 'Go to History', icon: <History size={16} />, action: () => setActiveView('history') },
            { id: 'nav-stats', title: 'Go to Stats', icon: <Activity size={16} />, action: () => setActiveView('stats') },
        ];

        views.forEach(v => {
            if (v.title.toLowerCase().includes(lowerQuery)) {
                searchResults.push({ ...v, type: 'navigation', action: () => { v.action(); setIsOpen(false); } });
            }
        });

        // 2. Reader Controls (If in Reader)
        if (useReadingStore.getState().images.length > 0) {
            const readerActions = [
                { id: 'act-scroll', title: 'Toggle Auto-Scroll', icon: <MousePointer2 size={16} />, action: () => setAutoScroll(!useReaderStore.getState().autoScroll) },
                { id: 'act-vertical', title: 'Switch to Vertical Mode', icon: <LayoutIcon size={16} />, action: () => setReaderMode('vertical') },
                { id: 'act-single', title: 'Switch to Single Page', icon: <LayoutIcon size={16} />, action: () => setReaderMode('single') },
                { id: 'act-slideshow', title: 'Switch to Slideshow', icon: <Play size={16} />, action: () => setReaderMode('slideshow') },
            ];

            readerActions.forEach(a => {
                if (a.title.toLowerCase().includes(lowerQuery)) {
                    searchResults.push({ ...a, type: 'action', action: () => { a.action(); setIsOpen(false); } });
                }
            });
        }

        // 3. Manga & Chapters
        series.forEach(s => {
            // Search Series Title
            if (s.title.toLowerCase().includes(lowerQuery)) {
                searchResults.push({
                    id: `manga-${s.id}`,
                    title: s.title,
                    type: 'manga',
                    subtitle: `${s.books.length} VOLUMES`,
                    icon: <BookOpen size={16} className="text-blue-400" />,
                    action: () => {
                        setSelectedSeriesId(s.id);
                        setSearchQuery('');
                        setActiveView('library');
                        setIsOpen(false);
                    } 
                });
            }

            // Search Books/Chapters in Series
            s.books.forEach(book => {
                if (book.title.toLowerCase().includes(lowerQuery)) {
                    searchResults.push({
                        id: `book-${book.id}`,
                        title: book.title,
                        type: 'manga',
                        subtitle: `Chapter in ${s.title}`,
                        icon: <PlusCircle size={14} className="text-blue-500" />,
                        action: () => {
                            openFolder(book.path, s.id, book.id);
                            setIsOpen(false);
                        }
                    });
                }
            });

            // Search Tags
            if (s.tags) {
                s.tags.forEach(tag => {
                    if (tag.toLowerCase().includes(lowerQuery)) {
                        const tagId = `tag-${tag.toLowerCase()}`;
                        if (!searchResults.find(r => r.id === tagId)) {
                            searchResults.push({
                                id: tagId,
                                title: `Tag: ${tag}`,
                                type: 'navigation',
                                subtitle: 'Filter Library by Tag',
                                icon: <Activity size={16} className="text-purple-400" />,
                                action: () => {
                                    setSelectedSeriesId(null);
                                    setSearchQuery('');
                                    clearFilterTags();
                                    toggleFilterTag(tag);
                                    setActiveView('library');
                                    setIsOpen(false);
                                }
                            });
                        }
                    }
                });
            }
        });

        // 4. Videos
        videoFolders.forEach(folder => {
            folder.videos.forEach(v => {
                if (v.title.toLowerCase().includes(lowerQuery)) {
                    searchResults.push({
                        id: `video-${v.id}`,
                        title: v.title,
                        type: 'video',
                        subtitle: folder.name,
                        icon: <Film size={16} className="text-purple-400" />,
                        action: () => {
                             useVideoStore.getState().playVideo(v, folder);
                             setIsOpen(false);
                        }
                    });
                }
            });
        });

        // 5. Settings / Actions
        if ('dark mode'.includes(lowerQuery)) {
            searchResults.push({ id: 'cmd-dark', title: 'Theme: Dark', type: 'setting', icon: <Settings size={16} />, action: () => { setTheme('dark'); setIsOpen(false); }});
        }
        if ('light mode'.includes(lowerQuery)) {
             searchResults.push({ id: 'cmd-light', title: 'Theme: Light', type: 'setting', icon: <Settings size={16} />, action: () => { setTheme('light'); setIsOpen(false); }});
        }
        if ('fullscreen'.includes(lowerQuery)) {
             searchResults.push({ id: 'cmd-full', title: 'Toggle Fullscreen', type: 'setting', icon: <Monitor size={16} />, action: () => { toggleFullScreenAction(); setIsOpen(false); }});
        }

        return searchResults.slice(0, 10); // Limit results
    }, [
        query,
        series,
        videoFolders,
        openFolder,
        setActiveView,
        setAutoScroll,
        setReaderMode,
        setSelectedSeriesId,
        setSearchQuery,
        clearFilterTags,
        toggleFilterTag,
        setTheme,
        toggleFullScreenAction
    ]);

    // Keyboard Navigation
    useEffect(() => {
        const handleNav = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (results[selectedIndex]) {
                    results[selectedIndex].action();
                }
            }
        };

        window.addEventListener('keydown', handleNav);
        return () => window.removeEventListener('keydown', handleNav);
    }, [isOpen, results, selectedIndex]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -4 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[101] bg-surface border border-white/10 rounded-2xl shadow-[0_32px_128px_rgba(0,0,0,1)] overflow-hidden flex flex-col"
                    >
                        {/* Input */}
                        <div className="flex items-center px-6 py-6 border-b border-white/5 gap-4">
                            <Search className="text-foreground/20" size={24} />
                            <input 
                                type="text"
                                aria-label="Search library and commands"
                                placeholder="Search library, commands..."
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                                className="flex-1 bg-transparent border-none outline-none text-xl text-foreground placeholder:text-foreground-muted font-bold"
                            />
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-foreground-dim font-black uppercase tracking-tighter">
                                <CommandIcon />
                                <span>K</span>
                            </div>
                        </div>

                        {/* Results */}
                        <div className="max-h-[50vh] overflow-y-auto p-2">
                            {results.length > 0 ? (
                                results.map((result, index) => (
                                    <button
                                        type="button"
                                        key={result.id}
                                        onClick={result.action}
                                        className={`
                                            flex items-center gap-4 px-4 py-4 rounded-xl cursor-pointer transition-all duration-200
                                            ${index === selectedIndex ? 'bg-accent text-white shadow-lg' : 'text-foreground-dim hover:bg-white/5 hover:text-foreground'}
                                        `}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <div className={`p-2.5 rounded-xl ${index === selectedIndex ? 'bg-white/20' : 'bg-white/5'}`}>
                                            {result.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm truncate uppercase tracking-wide">{result.title}</div>
                                            {result.subtitle && <div className={`text-[10px] font-black uppercase tracking-widest mt-0.5 truncate ${index === selectedIndex ? 'text-foreground/60' : 'text-foreground-muted'}`}>{result.subtitle}</div>}
                                        </div>
                                        {index === selectedIndex && (
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter opacity-40">
                                                <span>Execute</span>
                                                <ArrowRight size={14} />
                                            </div>
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className="p-12 text-center">
                                    <div className="p-4 rounded-full bg-white/5 inline-block mb-4">
                                        <Search size={32} className="text-foreground-muted" />
                                    </div>
                                    <div className="text-sm font-bold text-foreground-dim uppercase tracking-widest">
                                        {query ? 'No matches found' : 'Type to search everything'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

const CommandIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>
    </svg>
);
