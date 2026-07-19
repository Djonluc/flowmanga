import React, { useEffect, useState, useMemo } from 'react';
import { getDb } from '../../services/db';
import { Play, Search, Trash2, Plus, Edit2, Copy, Save, X, Tag, Sparkles, Heart, User, Film, ArrowUpDown } from 'lucide-react';
import { useSlideshowStore } from '../useSlideshowStore';
import { useImageCollectionStore } from '../useImageCollectionStore';

export interface SmartQuery {
  and: string[];
  or: string[];
  exclude: string[];
  allowedMediaTypes?: ('image' | 'video' | 'gif')[];
}

interface Playlist {
  id: string;
  name: string;
  query: string; // Stored as JSON string of SmartQuery
  coverUrl?: string;
}

interface PlaylistsTabProps {
  onPlay: (query: string) => void;
}

interface TagInfo {
  tag: string;
  cleanTag: string;
  count: number;
  category: 'character' | 'series' | 'artist' | 'general';
}

export const PlaylistsTab: React.FC<PlaylistsTabProps> = ({ onPlay }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderState, setBuilderState] = useState<SmartQuery>({ and: [], or: [], exclude: [], allowedMediaTypes: ['image', 'video', 'gif'] });
  const [playlistName, setPlaylistName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Tag selector state
  const [tagSearchFilter, setTagSearchFilter] = useState("");
  
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [playlistSort, setPlaylistSort] = useState<'newest' | 'name' | 'matches'>('newest');
  
  const slideshow = useSlideshowStore();
  const { savedImages } = useImageCollectionStore();

  // Build comprehensive tag index from the user's library
  const tagIndex = useMemo<TagInfo[]>(() => {
    const counts: Record<string, number> = {};
    savedImages.forEach(img => {
      (img.tags || []).forEach(t => {
        if (!t.startsWith('rating:') && !t.startsWith('source:')) {
          counts[t] = (counts[t] || 0) + 1;
        }
      });
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => {
        let category: TagInfo['category'] = 'general';
        if (tag.startsWith('character:')) category = 'character';
        else if (tag.startsWith('series:') || tag.startsWith('copyright:')) category = 'series';
        else if (tag.startsWith('artist:')) category = 'artist';
        
        return {
          tag,
          cleanTag: tag.replace(/^(character|series|artist|copyright):/, '').replace(/_/g, ' '),
          count,
          category
        };
      });
  }, [savedImages]);

  // Related tags: given current AND tags, find co-occurring tags
  const relatedTags = useMemo<TagInfo[]>(() => {
    if (builderState.and.length === 0) return [];
    
    // Find images that match current AND tags
    const matchingImages = savedImages.filter(img => {
      const tags = (img.tags || []).map(t => t.toLowerCase());
      return builderState.and.every(t => tags.some(tag => tag.includes(t.toLowerCase())));
    });
    
    // Count co-occurring tags
    const coOccur: Record<string, number> = {};
    matchingImages.forEach(img => {
      (img.tags || []).forEach(t => {
        if (!t.startsWith('rating:') && !t.startsWith('source:')) {
          const clean = t.replace(/^(character|series|artist|copyright):/, '').replace(/_/g, ' ');
          // Skip tags already in the builder
          if (!builderState.and.some(a => clean.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(clean.toLowerCase()))) {
            coOccur[t] = (coOccur[t] || 0) + 1;
          }
        }
      });
    });
    
    return Object.entries(coOccur)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({
        tag,
        cleanTag: tag.replace(/^(character|series|artist|copyright):/, '').replace(/_/g, ' '),
        count,
        category: tag.startsWith('character:') ? 'character' as const 
          : (tag.startsWith('series:') || tag.startsWith('copyright:')) ? 'series' as const 
          : tag.startsWith('artist:') ? 'artist' as const 
          : 'general' as const
      }));
  }, [savedImages, builderState.and]);

  // Categorized tag groups
  const characterTags = useMemo(() => tagIndex.filter(t => t.category === 'character').slice(0, 20), [tagIndex]);
  const seriesTags = useMemo(() => tagIndex.filter(t => t.category === 'series').slice(0, 20), [tagIndex]);
  const artistTags = useMemo(() => tagIndex.filter(t => t.category === 'artist').slice(0, 15), [tagIndex]);
  const mostUsedTags = useMemo(() => tagIndex.slice(0, 20), [tagIndex]);

  // Filtered tags for search
  const filteredTags = useMemo(() => {
    if (!tagSearchFilter.trim()) return [];
    const q = tagSearchFilter.toLowerCase();
    return tagIndex.filter(t => t.cleanTag.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q)).slice(0, 20);
  }, [tagIndex, tagSearchFilter]);

  const loadPlaylists = async () => {
    try {
      const db = getDb();
      const rows = await db.select<Playlist[]>("SELECT * FROM FlowPlaylists ORDER BY createdAt DESC");
      setPlaylists(rows);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      if (!confirm("Delete this playlist?")) return;
      const db = getDb();
      await db.execute("DELETE FROM FlowPlaylists WHERE id = ?", [id]);
      await loadPlaylists();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} playlists?`)) return;
    try {
      const db = getDb();
      const placeholders = selectedIds.map(() => '?').join(',');
      await db.execute(`DELETE FROM FlowPlaylists WHERE id IN (${placeholders})`, selectedIds);
      setSelectedIds([]);
      setIsBulkMode(false);
      await loadPlaylists();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCleanUpEmpty = async () => {
    if (!confirm("Delete all playlists with 0 local matches?")) return;
    try {
      const db = getDb();
      let deletedCount = 0;
      for (const p of playlists) {
        const matchCount = countLocalMatches(p);
        if (matchCount === 0) {
          await db.execute("DELETE FROM FlowPlaylists WHERE id = ?", [p.id]);
          deletedCount++;
        }
      }
      if (deletedCount > 0) {
        alert(`Deleted ${deletedCount} empty playlists!`);
        await loadPlaylists();
      } else {
        alert("No empty playlists found.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangeCover = async (p: Playlist, e: React.MouseEvent) => {
    e.stopPropagation();
    const newCover = prompt("Enter image URL for playlist cover:", p.coverUrl || "");
    if (newCover !== null) {
      try {
        const db = getDb();
        await db.execute("UPDATE FlowPlaylists SET coverUrl = ? WHERE id = ?", [newCover.trim() || null, p.id]);
        await loadPlaylists();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const savePlaylist = async () => {
    if (!playlistName.trim()) return alert("Name required");
    try {
      const db = getDb();
      const id = editingId || crypto.randomUUID();
      const queryJson = JSON.stringify(builderState);
      
      await db.execute(
        "INSERT OR REPLACE INTO FlowPlaylists (id, name, query) VALUES (?, ?, ?)",
        [id, playlistName, queryJson]
      );
      
      setIsBuilderOpen(false);
      await loadPlaylists();
    } catch (e) {
      console.error(e);
    }
  };

  const parseQuery = (queryStr: string): SmartQuery => {
    try {
      const parsed = JSON.parse(queryStr);
      if (parsed.and || parsed.or || parsed.exclude) return parsed;
    } catch {
      // Legacy plain-text playlists are converted into an AND query below.
    }
    return { and: queryStr.split(' ').filter(Boolean), or: [], exclude: [], allowedMediaTypes: ['image', 'video', 'gif'] };
  };

  const stripPrefix = (t: string) => t.replace(/^(character|series|artist|copyright):/, '').replace(/_/g, ' ');

  const buildQueryString = (query: SmartQuery): string => {
    const parts = [...query.and.map(t => stripPrefix(t))];
    query.or.forEach(t => parts.push(`~${stripPrefix(t)}`));
    query.exclude.forEach(t => parts.push(`-${stripPrefix(t)}`));
    return parts.join(' ');
  };

  const handleDuplicate = async (p: Playlist) => {
    try {
      const db = getDb();
      await db.execute(
        "INSERT INTO FlowPlaylists (id, name, query) VALUES (?, ?, ?)",
        [crypto.randomUUID(), `${p.name} (Copy)`, p.query]
      );
      await loadPlaylists();
    } catch (error) {
      console.error('[PlaylistsTab] Failed to duplicate playlist:', error);
    }
  };

  const generateCuratedPlaylists = async () => {
    if (savedImages.length === 0) {
      return alert("You need to save some images first to generate playlists based on your library.");
    }
    setIsGenerating(true);
    try {
      const db = getDb();
      
      // Count all tag categories
      const charCounts: Record<string, number> = {};
      const seriesCounts: Record<string, number> = {};
      const artistCounts: Record<string, number> = {};
      const generalCounts: Record<string, number> = {};
      
      savedImages.forEach(img => {
        (img.tags || []).forEach(t => {
          const clean = t.replace(/^(character|series|artist|copyright):/, '').replace(/_/g, ' ');
          if (t.startsWith('character:')) charCounts[clean] = (charCounts[clean] || 0) + 1;
          else if (t.startsWith('series:') || t.startsWith('copyright:')) seriesCounts[clean] = (seriesCounts[clean] || 0) + 1;
          else if (t.startsWith('artist:')) artistCounts[clean] = (artistCounts[clean] || 0) + 1;
          else if (!t.startsWith('rating:') && !t.startsWith('source:') && !t.startsWith('meta:')) {
            generalCounts[clean] = (generalCounts[clean] || 0) + 1;
          }
        });
      });

      const topChars = Object.entries(charCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const topSeries = Object.entries(seriesCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const topArtists = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const topGeneral = Object.entries(generalCounts).sort((a, b) => b[1] - a[1]).filter(([, c]) => c >= 10).slice(0, 5);

      let generatedCount = 0;
      const tryCreate = async (name: string, queryTag: string) => {
        const query: SmartQuery = { and: [queryTag], or: [], exclude: [] };
        const queryStr = JSON.stringify(query);
        const exists = playlists.some(p => p.name === name);
        if (!exists) {
          await db.execute("INSERT INTO FlowPlaylists (id, name, query) VALUES (?, ?, ?)", [crypto.randomUUID(), name, queryStr]);
          generatedCount++;
        }
      };

      // Character playlists
      for (const [name, count] of topChars) {
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        await tryCreate(`🎭 ${displayName} (${count})`, name.replace(/ /g, '_'));
      }
      
      // Series playlists
      for (const [name, count] of topSeries) {
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        await tryCreate(`📺 ${displayName} (${count})`, name.replace(/ /g, '_'));
      }
      
      // Artist playlists
      for (const [name, count] of topArtists) {
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        await tryCreate(`🎨 ${displayName} (${count})`, name.replace(/ /g, '_'));
      }
      
      // Trait-based playlists
      for (const [name, count] of topGeneral) {
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        await tryCreate(`✨ ${displayName} (${count})`, name.replace(/ /g, '_'));
      }

      await loadPlaylists();
      if (generatedCount > 0) {
        alert(`Generated ${generatedCount} curated playlists based on your library!`);
      } else {
        alert("Playlists for your top tags already exist!");
      }
    } catch (e) {
      console.error(e);
    }
    setIsGenerating(false);
  };

  const handlePlaySlideshow = (p: Playlist) => {
    const q = parseQuery(p.query);
    const results = savedImages.filter(img => {
      // Check media type first
      const mediaType = img.mediaType || 'image';
      if (q.allowedMediaTypes && q.allowedMediaTypes.length > 0 && !q.allowedMediaTypes.includes(mediaType as any)) {
        return false;
      }

      const tags = (img.tags || []).map(t => t.toLowerCase());
      const matchesAnd = q.and.length === 0 || q.and.every(t => tags.some(tag => tag.includes(t.toLowerCase())));
      const matchesOr = q.or.length === 0 || q.or.some(t => tags.some(tag => tag.includes(t.toLowerCase())));
      const matchesExclude = q.exclude.some(t => tags.some(tag => tag.includes(t.toLowerCase())));
      return matchesAnd && matchesOr && !matchesExclude;
    });

    if (results.length > 0) {
      slideshow.start(0, results);
    } else {
      alert(`No local images match this playlist. (${savedImages.length} images scanned)`);
    }
  };

  const addTagToField = (tag: string) => {
    if (!activeTagField) return;
    const cleanTag = stripPrefix(tag);
    if (!builderState[activeTagField].includes(cleanTag)) {
      setBuilderState({ 
        ...builderState, 
        [activeTagField]: [...builderState[activeTagField], cleanTag] 
      });
    }
  };

  const removeTagFromField = (field: keyof SmartQuery, index: number) => {
    setBuilderState({
      ...builderState,
      [field]: builderState[field].filter((_, i) => i !== index)
    });
  };

  // Tag Chip Component
  const TagChip: React.FC<{ tag: string; field: keyof SmartQuery; index: number; color: string }> = ({ tag, field, index, color }) => (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${color}`}>
      {tag}
      <button onClick={() => removeTagFromField(field, index)} className="hover:text-white transition-colors">
        <X size={12} />
      </button>
    </span>
  );

  // Tag Suggestion Button  
  const TagButton: React.FC<{ info: TagInfo; onClick: () => void }> = ({ info, onClick }) => {
    const colorMap = {
      character: 'bg-green-500/10 hover:bg-green-500/20 text-green-300 border-green-500/20',
      series: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border-purple-500/20',
      artist: 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/20',
      general: 'bg-surface-raised hover:bg-white/10 text-foreground border-border-subtle'
    };
    return (
      <button 
        onClick={onClick}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${colorMap[info.category]}`}
      >
        {info.cleanTag}
        <span className="text-[10px] opacity-50">{info.count}</span>
      </button>
    );
  };

  const countLocalMatches = (playlist: Playlist): number => {
    const query = parseQuery(playlist.query);
    return savedImages.filter(image => {
      const mediaType = image.mediaType || 'image';
      if (query.allowedMediaTypes?.length && !query.allowedMediaTypes.includes(mediaType)) return false;
      const tags = (image.tags || []).map(tag => tag.toLowerCase());
      const matchesAll = query.and.length === 0 || query.and.every(term => tags.some(tag => tag.includes(term.toLowerCase())));
      const matchesAny = query.or.length === 0 || query.or.some(term => tags.some(tag => tag.includes(term.toLowerCase())));
      const excluded = query.exclude.some(term => tags.some(tag => tag.includes(term.toLowerCase())));
      return matchesAll && matchesAny && !excluded;
    }).length;
  };

  const visiblePlaylists = [...playlists]
    .filter(playlist => playlist.name.toLowerCase().includes(playlistSearch.trim().toLowerCase()))
    .sort((a, b) => {
      if (playlistSort === 'name') return a.name.localeCompare(b.name);
      if (playlistSort === 'matches') return countLocalMatches(b) - countLocalMatches(a);
      return 0;
    });

  return (
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto bg-background flex flex-col gap-6 relative">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-widest text-foreground">Smart Playlists</h2>
          <p className="text-foreground-muted text-sm mt-1">
            Dynamic collections that auto-update based on tags. Play locally or search online.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isBulkMode ? (
            <>
              <button 
                onClick={handleCleanUpEmpty}
                className="h-12 px-6 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 font-black text-sm uppercase tracking-widest rounded-xl transition-all"
              >
                Clean Empty Playlists
              </button>
              <button 
                onClick={handleBulkDelete}
                disabled={selectedIds.length === 0}
                className="h-12 px-6 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
              >
                Delete Selected ({selectedIds.length})
              </button>
              <button 
                onClick={() => { setIsBulkMode(false); setSelectedIds([]); }}
                className="h-12 px-6 bg-surface-raised hover:bg-surface-elevated border border-border-subtle text-foreground font-black text-sm uppercase tracking-widest rounded-xl transition-all"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setIsBulkMode(true)}
                className="h-12 px-4 bg-surface-raised hover:bg-surface-elevated border border-border-subtle text-foreground font-black text-sm uppercase tracking-widest rounded-xl transition-all"
                title="Bulk Edit"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={generateCuratedPlaylists}
                disabled={isGenerating}
                className="h-12 px-6 bg-surface-raised hover:bg-surface-elevated border border-border-subtle text-foreground font-black text-sm uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "✨ Auto-Generate"}
              </button>
              <button 
                onClick={() => {
                  setBuilderState({ and: [], or: [], exclude: [], allowedMediaTypes: ['image', 'video', 'gif'] });
                  setPlaylistName("");
                  setEditingId(null);
                  setActiveTagField(null);
                  setTagSearchFilter("");
                  setIsBuilderOpen(true);
                }}
                className="h-12 px-6 bg-accent hover:bg-accent-hover text-white font-black text-sm uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              >
                <Plus size={18} strokeWidth={3} /> Create Playlist
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface/60 p-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={16} />
          <input value={playlistSearch} onChange={event => setPlaylistSearch(event.target.value)} placeholder="Find a playlist…" className="h-11 w-full rounded-xl border border-border-subtle bg-black/20 pl-10 pr-10 text-sm text-foreground outline-none focus:border-accent" />
          {playlistSearch && <button onClick={() => setPlaylistSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground" aria-label="Clear playlist search"><X size={14} /></button>}
        </label>
        <label className="relative min-w-48">
          <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={15} />
          <select value={playlistSort} onChange={event => setPlaylistSort(event.target.value as typeof playlistSort)} className="h-11 w-full appearance-none rounded-xl border border-border-subtle bg-surface pl-10 pr-3 text-xs font-bold uppercase tracking-wider text-foreground outline-none focus:border-accent">
            <option value="newest">Recently created</option>
            <option value="name">Name A–Z</option>
            <option value="matches">Most matches</option>
          </select>
        </label>
        <div className="px-2 text-xs font-bold text-foreground-muted">{visiblePlaylists.length} of {playlists.length} playlists</div>
      </div>

      {visiblePlaylists.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-foreground-muted bg-surface/30 rounded-3xl border border-white/5">
          <div className="w-24 h-24 mb-6 rounded-full bg-white/5 flex items-center justify-center text-white/20">
            <Play size={48} />
          </div>
          <h3 className="text-xl font-black uppercase tracking-widest text-foreground mb-2">{playlistSearch ? 'No matching playlists' : 'No Playlists Yet'}</h3>
          <p className="text-sm font-medium opacity-60">{playlistSearch ? 'Try a different name.' : 'Create a smart playlist to auto-organize by tags.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visiblePlaylists.map(p => {
            const q = parseQuery(p.query);
            // Count matching local images
            const matchCount = countLocalMatches(p);
            
            const isSelected = selectedIds.includes(p.id);
            return (
              <div 
                key={p.id} 
                onClick={() => {
                  if (isBulkMode) {
                    setSelectedIds(prev => isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                  }
                }}
                className={`p-6 bg-surface border rounded-2xl flex flex-col gap-4 group transition-all relative overflow-hidden ${
                  isBulkMode && isSelected ? 'border-accent shadow-[0_0_20px_rgba(99,102,241,0.3)]' 
                  : isBulkMode ? 'border-border-subtle cursor-pointer hover:border-accent/50'
                  : 'border-border-subtle hover:border-accent'
                }`}
              >
                {!isBulkMode && <div className="absolute top-0 left-0 w-full h-1 bg-accent/50 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform z-10"></div>}
                
                {p.coverUrl && (
                  <div className="absolute inset-0 z-0">
                    <img src={p.coverUrl} className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity" />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-surface/40" />
                  </div>
                )}
                
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mt-0.5">{matchCount} local matches</p>
                  </div>
                  {!isBulkMode && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-md rounded-lg p-0.5">
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(p.id); setPlaylistName(p.name); setBuilderState(q); setActiveTagField(null); setIsBuilderOpen(true); }} className="p-2 text-foreground-muted hover:text-white hover:bg-white/10 rounded-lg" title="Edit"><Edit2 size={14} /></button>
                      <button onClick={(e) => handleChangeCover(p, e)} className="p-2 text-foreground-muted hover:text-white hover:bg-white/10 rounded-lg" title="Change Cover"><Film size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicate(p); }} className="p-2 text-foreground-muted hover:text-white hover:bg-white/10 rounded-lg" title="Duplicate"><Copy size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>

                {/* Tag chips display */}
                <div className="flex flex-wrap gap-1.5 relative z-10">
                  {q.and.map((t, i) => (
                    <span key={`and-${i}`} className="px-2 py-1 bg-green-500/10 text-green-300 border border-green-500/20 rounded-md text-[11px] font-bold">{stripPrefix(t)}</span>
                  ))}
                  {q.or.map((t, i) => (
                    <span key={`or-${i}`} className="px-2 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-md text-[11px] font-bold">~{stripPrefix(t)}</span>
                  ))}
                  {q.exclude.map((t, i) => (
                    <span key={`ex-${i}`} className="px-2 py-1 bg-red-500/10 text-red-300 border border-red-500/20 rounded-md text-[11px] font-bold">-{stripPrefix(t)}</span>
                  ))}
                </div>

                {!isBulkMode && (
                  <div className="flex items-center gap-2 mt-2 relative z-10">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handlePlaySlideshow(p); }}
                      className="flex-1 h-12 bg-accent hover:bg-accent-hover text-white font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                      <Play size={16} fill="currentColor" /> Slideshow
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onPlay(buildQueryString(q)); }}
                      className="flex-1 h-12 bg-surface-raised hover:bg-white/10 text-foreground font-black uppercase tracking-widest border border-border-subtle rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                      <Search size={16} /> Search Web
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Playlist Builder Modal */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border-subtle rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-elevated">
              <h3 className="text-xl font-black uppercase tracking-widest">{editingId ? 'Edit Playlist' : 'Create Playlist'}</h3>
              <button onClick={() => setIsBuilderOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20} /></button>
            </div>
            
            <div className="p-6 flex flex-col gap-5 overflow-y-auto">
              {/* Name */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-foreground-muted mb-2">Playlist Name</label>
                <input 
                  type="text" 
                  value={playlistName}
                  onChange={e => setPlaylistName(e.target.value)}
                  placeholder="e.g., Frieren Collection"
                  className="w-full bg-surface-raised border border-border-subtle rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              {/* Media Type Toggle */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-foreground-muted mb-2">Allowed Media Types</label>
                <div className="flex gap-2">
                  {(['image', 'video', 'gif'] as const).map(type => {
                    const isSelected = builderState.allowedMediaTypes?.includes(type) ?? true;
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          const current = builderState.allowedMediaTypes || ['image', 'video', 'gif'];
                          const next = isSelected 
                            ? current.filter(t => t !== type)
                            : [...current, type];
                          setBuilderState(s => ({ ...s, allowedMediaTypes: next }));
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                          isSelected 
                            ? 'bg-accent text-white border-accent' 
                            : 'bg-surface border-border-subtle text-foreground-muted hover:text-foreground'
                        } border`}
                      >
                        {type}s
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tag Rule Sections with Chips */}
              {(['and', 'or', 'exclude'] as const).map(field => {
                const labels = { and: 'Match ALL', or: 'Match ANY', exclude: 'Exclude' };
                const colors = { 
                  and: 'bg-green-500/10 text-green-300 border-green-500/20', 
                  or: 'bg-blue-500/10 text-blue-300 border-blue-500/20', 
                  exclude: 'bg-red-500/10 text-red-300 border-red-500/20' 
                };
                const borderColors = { and: 'border-green-500/30', or: 'border-blue-500/30', exclude: 'border-red-500/30' };
                
                return (
                  <div key={field}>
                    <label className="block text-xs font-black uppercase tracking-widest text-foreground-muted mb-2">
                      {labels[field]}
                    </label>
                    <div className={`min-h-[44px] p-2 rounded-xl border ${activeTagField === field ? borderColors[field] : 'border-border-subtle'} bg-black/20 flex flex-wrap items-center gap-2 cursor-text`}
                      onClick={() => setActiveTagField(field)}
                    >
                      {builderState[field].map((tag, i) => (
                        <TagChip key={`${field}-${i}`} tag={tag} field={field} index={i} color={colors[field]} />
                      ))}
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveTagField(activeTagField === field ? null : field); setTagSearchFilter(''); }}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                          activeTagField === field 
                            ? 'bg-accent/20 text-accent' 
                            : 'text-foreground-muted hover:text-foreground hover:bg-white/10'
                        }`}
                      >
                        <Plus size={12} /> Add Tag
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Tag Selector Panel (shown when a field is active) */}
              {activeTagField && (
                <div className="bg-surface-elevated border border-border-subtle rounded-2xl overflow-hidden">
                  <div className="p-3 border-b border-border-subtle bg-white/5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={14} />
                      <input
                        type="text"
                        value={tagSearchFilter}
                        onChange={e => setTagSearchFilter(e.target.value)}
                        placeholder="Search tags..."
                        autoFocus
                        className="w-full pl-9 pr-4 py-2 bg-black/30 border border-border-subtle rounded-lg text-sm text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 flex flex-col gap-4 max-h-[300px] overflow-y-auto">
                    {/* Search results */}
                    {tagSearchFilter && filteredTags.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-2 flex items-center gap-1"><Search size={10} /> Search Results</h4>
                        <div className="flex flex-wrap gap-2">
                          {filteredTags.map(info => (
                            <TagButton key={info.tag} info={info} onClick={() => addTagToField(info.tag)} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom tag entry */}
                    {tagSearchFilter && !filteredTags.some(t => t.cleanTag.toLowerCase() === tagSearchFilter.toLowerCase()) && (
                      <button
                        onClick={() => {
                          addTagToField(tagSearchFilter.trim());
                          setTagSearchFilter('');
                        }}
                        className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                      >
                        <Plus size={14} /> Add custom tag: "{tagSearchFilter}"
                      </button>
                    )}

                    {!tagSearchFilter && (
                      <>
                        {/* Related tags */}
                        {relatedTags.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-accent mb-2 flex items-center gap-1"><Sparkles size={10} /> Related to your selection</h4>
                            <div className="flex flex-wrap gap-2">
                              {relatedTags.map(info => (
                                <TagButton key={info.tag} info={info} onClick={() => addTagToField(info.tag)} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Most Used */}
                        {mostUsedTags.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-2 flex items-center gap-1"><Heart size={10} /> Most Used</h4>
                            <div className="flex flex-wrap gap-2">
                              {mostUsedTags.slice(0, 12).map(info => (
                                <TagButton key={info.tag} info={info} onClick={() => addTagToField(info.tag)} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Characters */}
                        {characterTags.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-2 flex items-center gap-1"><User size={10} /> Characters</h4>
                            <div className="flex flex-wrap gap-2">
                              {characterTags.map(info => (
                                <TagButton key={info.tag} info={info} onClick={() => addTagToField(info.tag)} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Series */}
                        {seriesTags.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2 flex items-center gap-1"><Film size={10} /> Series</h4>
                            <div className="flex flex-wrap gap-2">
                              {seriesTags.map(info => (
                                <TagButton key={info.tag} info={info} onClick={() => addTagToField(info.tag)} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Artists */}
                        {artistTags.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2 flex items-center gap-1"><Tag size={10} /> Artists</h4>
                            <div className="flex flex-wrap gap-2">
                              {artistTags.map(info => (
                                <TagButton key={info.tag} info={info} onClick={() => addTagToField(info.tag)} />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border-subtle bg-surface-elevated flex justify-end gap-3">
              <button onClick={() => setIsBuilderOpen(false)} className="px-6 py-3 font-bold text-foreground-muted hover:text-white transition-all uppercase tracking-widest text-sm">Cancel</button>
              <button onClick={savePlaylist} className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-black uppercase tracking-widest text-sm rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)]"><Save size={16} /> Save Playlist</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
