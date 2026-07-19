import React, { useEffect, useState, useMemo } from 'react';
import { useImageCollectionStore } from '../useImageCollectionStore';
import { MasonryGrid } from './MasonryGrid';
import { Folder, Plus, Trash2, ChevronRight, Image as ImageIcon, LayoutGrid, Edit2, X, Save, Play, Settings, Heart, Clock, FolderOpen, Sparkles, Search, ArrowUpDown, CheckSquare } from 'lucide-react';
import { useSlideshowStore } from '../useSlideshowStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { federator } from '../SearchFederator';
import { getDb } from '../../services/db';
import type { PlatformImage } from '../types';

interface MyCollectionTabProps {
  onImageClick?: (image: PlatformImage, index: number, imagesContext: PlatformImage[]) => void;
  onImageDoubleClick?: (image: PlatformImage, index: number, imagesContext: PlatformImage[]) => void;
}

type CollectionView = 'all' | 'folders' | 'favorites' | 'recent' | 'uncategorized';

export const MyCollectionTab: React.FC<MyCollectionTabProps> = ({ onImageClick, onImageDoubleClick }) => {
  const { folders, savedImages, loadFolders, loadSavedImages, createFolder, updateFolder, deleteFolder, autoOrganizeMode, setAutoOrganizeMode, refreshAllMetadata, retroOrganizeLibrary, batchSaveImages, isLoading } = useImageCollectionStore();
  const slideshow = useSlideshowStore();
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<CollectionView>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [showFolderRules, setShowFolderRules] = useState(false);
  const [editingRules, setEditingRules] = useState({ primary: '', include: '', exclude: '', name: '', description: '' });
  const [isRearrangeMode, setIsRearrangeMode] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'title' | 'source'>('newest');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [recentCutoff] = useState(() => Date.now() - (7 * 24 * 60 * 60 * 1000));
  
  const [recommendations, setRecommendations] = useState<PlatformImage[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [favoriteTags, setFavoriteTags] = useState<string[]>([]);

  // Load favorite tags for the Favorites view
  useEffect(() => {
    const loadFavs = async () => {
      try {
        const db = getDb();
        const favs = await db.select<{tag: string}[]>("SELECT tag FROM FavoriteTags ORDER BY usageCount DESC");
        setFavoriteTags(favs.map(f => f.tag));
      } catch (error) {
        console.warn('[MyCollectionTab] Failed to load favorite tags:', error);
      }
    };
    loadFavs();
  }, []);

  useEffect(() => {
    loadFolders();
    // When viewing a specific folder, load only that folder's images
    if (activeFolderId) {
      loadSavedImages(activeFolderId);
    } else {
      // Load ALL images for the main views
      loadSavedImages(null);
    }
    
    // Load recommendations for active folder
    if (activeFolderId) {
      const activeFolder = folders.find(f => f.id === activeFolderId);
      if (activeFolder && activeFolder.query) {
        try {
          const parsed = JSON.parse(activeFolder.query);
          if (parsed && parsed.and && parsed.and.length > 0) {
            setIsLoadingRecs(true);
            // Strip prefixes for provider search
            const cleanTags = parsed.and.map((t: string) => t.replace(/^(character|series|artist|copyright):/, '').replace(/_/g, ' '));
            const rawQuery = cleanTags.join(' ');
            
            federator.search({ raw: rawQuery, positiveTags: cleanTags, negativeTags: parsed.exclude || [], predicates: {} }, 1)
              .then(results => {
                const newResults = results.filter(r => !savedImages.some(s => s.id === r.id));
                setRecommendations(newResults.slice(0, 20));
              })
              .catch(e => console.error("Rec error", e))
              .finally(() => setIsLoadingRecs(false));
          } else {
            setRecommendations([]);
          }
        } catch {
          setRecommendations([]);
        }
      } else {
        setRecommendations([]);
      }
    } else {
      setRecommendations([]);
    }
  }, [activeFolderId]);

  const handleCreateFolder = () => {
    const name = prompt("Enter folder name:");
    if (name) createFolder(name);
  };

  const handleRenameFolder = (e: React.MouseEvent, folder: any) => {
    e.stopPropagation();
    const newName = prompt('Enter new name:', folder.name);
    if (newName && newName.trim()) {
      updateFolder(folder.id, { name: newName.trim() });
    }
  };

  const handleChangeCover = (e: React.MouseEvent, folder: any) => {
    e.stopPropagation();
    const newCover = prompt('Enter new image URL for cover:', folder.coverUrl || '');
    if (newCover !== null) {
      updateFolder(folder.id, { coverUrl: newCover.trim() || null });
    }
  };

  const handleMergeFolder = async (e: React.MouseEvent, folder: any) => {
    e.stopPropagation();
    const targetName = prompt(`Merge all contents of "${folder.name}" INTO which folder name?`);
    if (targetName) {
      const target = folders.find(f => f.name.toLowerCase() === targetName.toLowerCase());
      if (target && target.id !== folder.id) {
        const db = getDb();
        await db.execute("UPDATE FlowSavedImages SET folderId = ? WHERE folderId = ?", [target.id, folder.id]);
        await deleteFolder(folder.id);
        loadSavedImages(null);
        alert('Merged successfully!');
      } else {
        alert('Target folder not found or is the same folder.');
      }
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent, folder: any) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${folder.name}"? Images will NOT be deleted, they will just be uncategorized.`)) {
      await deleteFolder(folder.id);
    }
  };

  // Filtered images based on the active view
  const displayImages = useMemo(() => {
    if (activeFolderId) return savedImages; // Already filtered by folder via loadSavedImages

    switch (activeView) {
      case 'all':
        return savedImages;
      case 'uncategorized':
        return savedImages.filter(img => !img.folderId);
      case 'favorites':
        return savedImages.filter(img => {
          const tags = (img.tags || []).map(t => t.toLowerCase());
          return favoriteTags.some(fav => tags.some(tag => tag.includes(fav.toLowerCase())));
        });
      case 'recent': {
        return savedImages.filter(img => img.createdAt > recentCutoff);
      }
      default:
        return savedImages;
    }
  }, [savedImages, activeView, activeFolderId, favoriteTags, recentCutoff]);

  const { globalMediaFilter } = useSettingsStore();
  const filteredDisplayImages = useMemo(() => {
    const query = collectionSearch.trim().toLowerCase();
    const filtered = displayImages.filter(img => {
      if (globalMediaFilter !== 'all' && img.mediaType !== globalMediaFilter) return false;
      if (!query) return true;
      return [img.title, img.providerId, img.source, ...(img.tags || [])]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    });
    return [...filtered].sort((a, b) => {
      if (sortMode === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortMode === 'title') return (a.title || a.sourceId).localeCompare(b.title || b.sourceId);
      if (sortMode === 'source') return a.providerId.localeCompare(b.providerId);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [displayImages, globalMediaFilter, collectionSearch, sortMode]);

  // Calculate folder stats efficiently
  const folderStats = useMemo(() => {
    const stats: Record<string, { count: number; lastUpdated: string; firstImage: string | null }> = {};
    for (const folder of folders) {
      const folderImages = savedImages.filter(img => img.folderId === folder.id);
      stats[folder.id] = {
        count: folderImages.length,
        lastUpdated: folderImages[0] ? new Date(folderImages[0].createdAt).toLocaleDateString() : 'Never',
        firstImage: folderImages[0] ? (folderImages[0].thumbnailUrl || folderImages[0].sampleUrl || folderImages[0].fullUrl) : null
      };
    }
    return stats;
  }, [folders, savedImages]);
  const visibleFolders = useMemo(() => {
    const query = collectionSearch.trim().toLowerCase();
    if (!query) return folders;
    return folders.filter(folder => `${folder.name} ${folder.description || ''}`.toLowerCase().includes(query));
  }, [folders, collectionSearch]);

  const handleStartSlideshow = () => {
    if (filteredDisplayImages.length === 0) {
      alert("No images to play in slideshow.");
      return;
    }
    slideshow.start(0, filteredDisplayImages);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const moveSelectedToFolder = async (folderId: string | null) => {
    if (selectedIds.size === 0) return;
    const db = getDb();
    for (const id of selectedIds) {
      await db.execute("UPDATE FlowSavedImages SET folderId = ? WHERE id = ?", [folderId, id]);
    }
    setSelectedIds(new Set());
    await loadSavedImages(activeFolderId);
    await loadFolders();
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0 || !confirm(`Remove ${selectedIds.size} selected item(s) from My Collection? Downloaded files will not be deleted.`)) return;
    const db = getDb();
    for (const id of selectedIds) await db.execute("DELETE FROM FlowSavedImages WHERE id = ?", [id]);
    setSelectedIds(new Set());
    await loadSavedImages(activeFolderId);
    await loadFolders();
  };

  return (
    <div className="w-full h-full flex flex-col relative bg-background overflow-hidden">
      {/* Compact Header */}
      <div className="flex-none flex flex-col bg-surface-elevated/80 backdrop-blur-xl z-20 border-b border-border-subtle">
        <div className="px-4 py-2 flex items-center justify-between">
          {/* Left: Breadcrumb */}
          <div className="flex items-center gap-3">
            <button onClick={() => { setActiveFolderId(null); setActiveView('all'); }} className="text-foreground hover:text-accent transition-colors flex items-center gap-2 font-black uppercase tracking-widest text-sm">
              <LayoutGrid size={16} /> Collection
            </button>
            {activeFolderId && (
              <>
                <ChevronRight size={12} className="text-white/20" />
                <span className="text-accent font-black uppercase tracking-widest text-sm">{folders.find(f => f.id === activeFolderId)?.name}</span>
              </>
            )}
            <div className="w-px h-4 bg-border-subtle mx-1" />
            <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest">
              {filteredDisplayImages.length} images
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Slideshow Button */}
            <button 
              onClick={handleStartSlideshow}
              disabled={filteredDisplayImages.length === 0}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Play size={12} fill="currentColor" /> Slideshow
            </button>

            <button
              onClick={() => { setSelectionMode(value => !value); setSelectedIds(new Set()); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border transition-all ${selectionMode ? 'border-accent bg-accent text-white' : 'border-border-subtle bg-surface text-foreground-muted hover:text-foreground'}`}
            >
              <CheckSquare size={12} /> {selectionMode ? 'Done' : 'Select'}
            </button>

            <button 
              onClick={() => setIsRearrangeMode(!isRearrangeMode)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${isRearrangeMode ? 'bg-accent text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-surface hover:bg-surface-raised border border-border-subtle text-foreground-muted hover:text-foreground'}`}
            >
              <LayoutGrid size={12} /> {isRearrangeMode ? 'Rearranging...' : 'Rearrange Mode'}
            </button>

            {/* Folder-specific actions */}
            {activeFolderId && (
              <>
                <button 
                  onClick={() => {
                    const f = folders.find(f => f.id === activeFolderId);
                    if (f) {
                      let parsed = { and: [] as string[], or: [] as string[], exclude: [] as string[] };
                      if (f.query) {
                        try {
                          parsed = JSON.parse(f.query);
                        } catch (error) {
                          console.warn('[MyCollectionTab] Ignored invalid folder query:', error);
                        }
                      }
                      setEditingRules({
                        primary: parsed.and[0] || '',
                        include: (parsed.or || []).join(' '),
                        exclude: (parsed.exclude || []).join(' '),
                        name: f.name,
                        description: f.description || ''
                      });
                      setShowFolderRules(true);
                    }
                  }}
                  className="px-2 py-1.5 bg-surface hover:bg-surface-raised border border-border-subtle rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-all"
                >
                  <Edit2 size={10} /> Edit
                </button>
                <button 
                  onClick={() => {
                    if (confirm("Delete this folder? Images will not be deleted, just removed from the folder.")) {
                      deleteFolder(activeFolderId);
                      setActiveFolderId(null);
                    }
                  }}
                  className="px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-all"
                >
                  <Trash2 size={10} />
                </button>
              </>
            )}

            {/* Settings Gear (only on main collection view) */}
            {!activeFolderId && (
              <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="px-3 py-1.5 text-foreground-muted hover:text-accent border border-border-subtle bg-surface rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest"
                >
                  <Settings size={13} /> Manage
                </button>
                {showSettings && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-black border border-border-subtle rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-foreground-muted border-b border-border-subtle bg-white/5">Settings</div>
                    
                    <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-foreground-muted bg-white/3">Auto-Organization</div>
                    {["disabled", "series_only", "character_only", "series_character"].map(mode => (
                      <button 
                        key={mode}
                        onClick={() => { setAutoOrganizeMode(mode as any); setShowSettings(false); }}
                        className={`text-left px-4 py-2 text-xs font-bold tracking-wider hover:bg-white/10 transition-all ${autoOrganizeMode === mode ? 'text-accent' : 'text-foreground'}`}
                      >
                        {mode.replace('_', ' ')}
                      </button>
                    ))}
                    
                    {autoOrganizeMode !== 'disabled' && (
                      <div className="border-t border-border-subtle">
                        <button
                          onClick={async () => {
                            setShowSettings(false);
                            const report = await retroOrganizeLibrary();
                            if (report) {
                              alert(`Auto-Organization Complete\n\n• ${report.scanned} Images Scanned\n• ${report.created} Folders Created\n• ${report.assigned} Images Assigned\n• ${report.skipped} Already Organized`);
                            }
                          }}
                          disabled={isLoading}
                          className="w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-accent hover:bg-accent/10 transition-all disabled:opacity-50"
                        >
                          {isLoading ? "Organizing..." : "Run Auto-Org Now"}
                        </button>
                      </div>
                    )}

                    <div className="border-t border-border-subtle">
                      <button
                        onClick={async () => {
                          setShowSettings(false);
                          if (confirm("This will fetch updated tags for all downloaded images. It may take some time. Proceed?")) {
                            await refreshAllMetadata();
                            alert("Finished updating metadata for your collection!");
                          }
                        }}
                        disabled={isLoading}
                        className="w-full text-left px-4 py-2 text-xs font-bold uppercase tracking-wider text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-50"
                      >
                        {isLoading ? "Refreshing..." : "Refresh All Meta"}
                      </button>
                    </div>

                    <div className="border-t border-border-subtle">
                      <button
                        onClick={() => { setShowSettings(false); handleCreateFolder(); }}
                        className="w-full text-left px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-white/10 transition-all flex items-center gap-2"
                      >
                        <Plus size={12} /> New Folder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sub-Navigation Pills (only when not inside a folder) */}
        {!activeFolderId && (
          <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {([
              { id: 'all' as CollectionView, label: `All Images`, icon: <LayoutGrid size={12} />, count: savedImages.length },
              { id: 'folders' as CollectionView, label: 'Folders', icon: <FolderOpen size={12} />, count: folders.length },
              { id: 'favorites' as CollectionView, label: 'Favorite Tags', icon: <Heart size={12} /> },
              { id: 'recent' as CollectionView, label: 'Recent', icon: <Clock size={12} /> },
              { id: 'uncategorized' as CollectionView, label: 'Uncategorized', icon: <Sparkles size={12} /> },
            ]).map(pill => (
              <button
                key={pill.id}
                onClick={() => setActiveView(pill.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all border ${
                  activeView === pill.id 
                    ? 'bg-accent/20 text-accent border-accent/30' 
                    : 'bg-surface hover:bg-surface-raised text-foreground-muted hover:text-foreground border-border-subtle'
                }`}
              >
                {pill.icon}
                {pill.label}
                {pill.count !== undefined && <span className="text-[9px] opacity-60">({pill.count})</span>}
              </button>
            ))}
          </div>
        )}

        <div className="px-4 pb-3 flex flex-col sm:flex-row gap-2">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={15} />
            <input
              value={collectionSearch}
              onChange={event => setCollectionSearch(event.target.value)}
              placeholder={activeFolderId ? "Search this folder…" : "Search titles, tags, and sources…"}
              className="h-10 w-full rounded-xl border border-border-subtle bg-black/20 pl-9 pr-9 text-sm text-foreground outline-none focus:border-accent"
            />
            {collectionSearch && <button onClick={() => setCollectionSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground" aria-label="Clear collection search"><X size={14} /></button>}
          </label>
          <label className="relative min-w-44">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={14} />
            <select value={sortMode} onChange={event => setSortMode(event.target.value as typeof sortMode)} className="h-10 w-full appearance-none rounded-xl border border-border-subtle bg-surface pl-9 pr-3 text-xs font-bold uppercase tracking-wider text-foreground outline-none focus:border-accent">
              <option value="newest">Newest saved</option>
              <option value="oldest">Oldest saved</option>
              <option value="title">Title A–Z</option>
              <option value="source">Source</option>
            </select>
          </label>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative bg-background">
        {/* Folders View */}
        {!activeFolderId && activeView === 'folders' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground/80 flex items-center gap-2">
                <Folder className="text-accent" size={16} /> Your Folders
              </h3>
              <button 
                onClick={handleCreateFolder}
                className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
              >
                <Plus size={12} strokeWidth={3} /> New Folder
              </button>
            </div>
            {visibleFolders.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {visibleFolders.map(folder => {
                  const stats = folderStats[folder.id] || { count: 0, lastUpdated: 'Never', firstImage: null };
                  return (
                    <div key={folder.id} className="group relative">
                      <button
                        onClick={() => setActiveFolderId(folder.id)}
                        className="w-full relative aspect-[4/3] rounded-xl overflow-hidden border border-border-subtle bg-surface-raised hover:border-accent/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all flex flex-col justify-end text-left"
                      >
                        {folder.coverUrl || stats.firstImage ? (
                          <div className="absolute inset-0">
                            <img 
                              src={folder.coverUrl || stats.firstImage} 
                              onError={(e) => {
                                if (e.currentTarget.src !== stats.firstImage && stats.firstImage) {
                                  e.currentTarget.src = stats.firstImage;
                                } else {
                                  e.currentTarget.style.display = 'none';
                                  const fallbackEl = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                                  if (fallbackEl) fallbackEl.classList.remove('hidden');
                                }
                              }}
                              className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500 group-hover:scale-105" 
                            />
                            <div className="fallback-icon absolute inset-0 bg-gradient-to-br from-surface to-background hidden flex items-center justify-center">
                              <Folder size={32} className="text-white/10" />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-surface to-background flex items-center justify-center">
                            <Folder size={32} className="text-white/10" />
                          </div>
                        )}
                        <div className="relative z-10 p-3 flex flex-col pointer-events-none">
                          <h4 className="text-sm font-black uppercase tracking-wider text-white line-clamp-1 group-hover:text-accent transition-colors">
                            {folder.name}
                          </h4>
                          <div className="flex justify-between items-end mt-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                            <p className="text-[10px] font-bold text-white uppercase tracking-widest">
                              {stats.count} Images
                            </p>
                            <p className="text-[9px] font-medium text-white/70">
                              {stats.lastUpdated}
                            </p>
                          </div>
                        </div>
                      </button>

                      {/* Folder Menu Overlay */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-20">
                        <button onClick={(e) => handleRenameFolder(e, folder)} className="p-1.5 bg-black/60 hover:bg-black backdrop-blur-sm text-white rounded-md transition-colors" title="Rename Folder"><Edit2 size={12} /></button>
                        <button onClick={(e) => handleChangeCover(e, folder)} className="p-1.5 bg-black/60 hover:bg-black backdrop-blur-sm text-white rounded-md transition-colors" title="Change Cover"><ImageIcon size={12} /></button>
                        <button onClick={(e) => handleMergeFolder(e, folder)} className="p-1.5 bg-black/60 hover:bg-black backdrop-blur-sm text-white rounded-md transition-colors" title="Merge Folder"><FolderOpen size={12} /></button>
                        <button onClick={(e) => handleDeleteFolder(e, folder)} className="p-1.5 bg-red-500/80 hover:bg-red-500 backdrop-blur-sm text-white rounded-md transition-colors" title="Delete Folder"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-foreground-muted">
                <Folder size={48} className="mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest">{collectionSearch ? 'No matching folders' : 'No folders yet'}</p>
                <p className="text-sm mt-2 opacity-60">{collectionSearch ? 'Try a different folder name.' : 'Create a folder or run Auto-Organization from Manage.'}</p>
              </div>
            )}
          </div>
        )}

        {/* Image Grid Views (All, Favorites, Recent, Uncategorized, or Folder contents) */}
        {(activeView !== 'folders' || activeFolderId) && (
          <div className="flex flex-col p-4 gap-4">
            {!activeFolderId && activeView === 'favorites' && (
              <div className="flex flex-col gap-1 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-black text-rose-300"><Heart size={15} fill="currentColor" /> Images matching your favorite tags</h3>
                <p className="text-xs text-foreground-muted">This view follows the tags you starred while browsing. Saving an individual card adds it to All Images; starring a tag controls this personalized view.</p>
              </div>
            )}
            {/* Recommendations Panel (only in folder view) */}
            {activeFolderId && (recommendations.length > 0 || isLoadingRecs) && (
              <div className="p-4 bg-surface-elevated border border-border-subtle rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                    <Sparkles size={14} /> {recommendations.length > 0 ? `${recommendations.length} Recommended Additions` : 'Finding Recommendations...'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {isLoadingRecs && <span className="text-[10px] text-foreground-muted animate-pulse">Searching online...</span>}
                    {recommendations.length > 0 && activeFolderId && (
                      <button
                        onClick={async () => {
                          if (!activeFolderId) return;
                          const count = await batchSaveImages(recommendations, activeFolderId);
                          if (count > 0) {
                            setRecommendations([]);
                            alert(`Added ${count} images to this album!`);
                          }
                        }}
                        className="px-3 py-1 bg-accent hover:bg-accent-hover text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all"
                      >
                        <Plus size={10} /> Add All ({recommendations.length})
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {recommendations.map((img, idx) => (
                    <button 
                      key={img.id}
                      onClick={() => {
                        if (onImageClick) onImageClick(img, idx, recommendations);
                      }}
                      className="flex-none w-[100px] h-[140px] rounded-xl overflow-hidden border border-border-subtle bg-surface hover:border-accent hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all group relative"
                    >
                      <img src={img.sampleUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Plus className="text-white drop-shadow-md" size={24} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Image Grid */}
            <div className="flex-1 relative min-h-[400px]">
              {selectionMode && filteredDisplayImages.length > 0 && (
                <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3">
                  <span className="mr-2 text-xs font-bold">{selectedIds.size} selected</span>
                  <button onClick={() => setSelectedIds(new Set(filteredDisplayImages.map(image => image.id)))} className="rounded-lg bg-surface px-3 py-1.5 text-[10px] font-black uppercase">Select visible</button>
                  <button onClick={() => setSelectedIds(new Set())} className="rounded-lg bg-surface px-3 py-1.5 text-[10px] font-black uppercase">Clear</button>
                  <select
                    aria-label="Move selected items to folder"
                    disabled={selectedIds.size === 0}
                    defaultValue=""
                    onChange={event => { if (event.target.value) void moveSelectedToFolder(event.target.value === '__none__' ? null : event.target.value); event.currentTarget.value = ''; }}
                    className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-[10px] font-black uppercase disabled:opacity-40"
                  >
                    <option value="" disabled>Move to…</option>
                    <option value="__none__">Uncategorized</option>
                    {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                  </select>
                  <button disabled={selectedIds.size === 0} onClick={() => void deleteSelected()} className="ml-auto flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-1.5 text-[10px] font-black uppercase text-red-400 disabled:opacity-40"><Trash2 size={11} /> Remove</button>
                </div>
              )}
              {filteredDisplayImages.length > 0 ? (
                <MasonryGrid 
                  images={filteredDisplayImages} 
                  columns={5} 
                  onImageClick={(img, idx) => onImageClick?.(img, idx, filteredDisplayImages)}
                  onImageDoubleClick={(img, idx) => onImageDoubleClick?.(img, idx, filteredDisplayImages)}
                  onReorder={isRearrangeMode ? (draggedId, dropId) => {
                    useImageCollectionStore.getState().reorderImage(draggedId, dropId);
                  } : undefined}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onToggleSelection={image => toggleSelected(image.id)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-foreground-muted">
                  <div className="w-20 h-20 mb-4 rounded-full bg-white/5 flex items-center justify-center text-white/15">
                    <ImageIcon size={40} />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-widest text-foreground mb-1">
                    {activeFolderId ? 'Empty Album' : activeView === 'favorites' ? 'No Favorites Yet' : activeView === 'recent' ? 'Nothing Recent' : activeView === 'uncategorized' ? 'All Organized!' : 'No Images'}
                  </h3>
                  <p className="text-sm font-medium opacity-60">
                    {activeFolderId ? 'Edit the album rules to auto-fill or save images here.' 
                     : activeView === 'favorites' ? 'Star some tags to see matching images here.'
                     : activeView === 'recent' ? 'No images were added in the last 7 days.'
                     : activeView === 'uncategorized' ? 'All your images are organized into folders.'
                     : 'Start browsing and save images to build your collection.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Album Settings Modal */}
      {showFolderRules && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-surface-elevated border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-white/5">
              <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Edit2 size={16} className="text-accent" /> Album Settings
              </h3>
              <button onClick={() => setShowFolderRules(false)} className="text-foreground-muted hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-2">Album Name</label>
                <input 
                  type="text" 
                  value={editingRules.name}
                  onChange={e => setEditingRules({ ...editingRules, name: e.target.value })}
                  placeholder="Album name"
                  className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-2">Description</label>
                <textarea 
                  value={editingRules.description}
                  onChange={e => setEditingRules({ ...editingRules, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-accent mb-2">Primary Tag (Required)</label>
                <input 
                  type="text" 
                  value={editingRules.primary}
                  onChange={e => setEditingRules({ ...editingRules, primary: e.target.value })}
                  placeholder="e.g., frieren"
                  className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-foreground-muted mb-2">Include Any Of (Optional, space-separated)</label>
                <input 
                  type="text" 
                  value={editingRules.include}
                  onChange={e => setEditingRules({ ...editingRules, include: e.target.value })}
                  placeholder="e.g., magic staff"
                  className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Exclude Tags (space-separated)</label>
                <input 
                  type="text" 
                  value={editingRules.exclude}
                  onChange={e => setEditingRules({ ...editingRules, exclude: e.target.value })}
                  placeholder="e.g., concept sketch"
                  className="w-full bg-surface border border-border-subtle rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-red-500/50"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border-subtle flex justify-end gap-3 bg-black/20">
              <button onClick={() => setShowFolderRules(false)} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-foreground-muted hover:text-white transition-colors">Cancel</button>
              <button 
                onClick={async () => {
                  if (!activeFolderId) return;
                  
                  // Update name and description
                  const updates: any = { 
                    name: editingRules.name || 'Untitled',
                    description: editingRules.description || null 
                  };
                  
                  // Build query if primary tag provided
                  if (editingRules.primary.trim()) {
                    const queryObj = {
                      and: [editingRules.primary.trim()],
                      or: editingRules.include.split(' ').filter(Boolean),
                      exclude: editingRules.exclude.split(' ').filter(Boolean)
                    };
                    updates.query = JSON.stringify(queryObj);
                    
                    // Evaluate local library against rules using substring matching
                    const db = getDb();
                    const allImages = await db.select<any[]>("SELECT * FROM FlowSavedImages");
                    let updatedCount = 0;
                    for (const row of allImages) {
                      const tags: string[] = row.tags ? JSON.parse(row.tags) : [];
                      const tagsLower = tags.map(t => t.toLowerCase());
                      const matchesAnd = queryObj.and.every(t => tagsLower.some(tag => tag.includes(t.toLowerCase())));
                      const matchesOr = queryObj.or.length === 0 || queryObj.or.some(t => tagsLower.some(tag => tag.includes(t.toLowerCase())));
                      const matchesExclude = queryObj.exclude.some(t => tagsLower.some(tag => tag.includes(t.toLowerCase())));
                      
                      if (matchesAnd && matchesOr && !matchesExclude) {
                        if (row.folderId !== activeFolderId) {
                          await db.execute("UPDATE FlowSavedImages SET folderId = ? WHERE id = ?", [activeFolderId, row.id]);
                          updatedCount++;
                        }
                      } else if (row.folderId === activeFolderId) {
                        await db.execute("UPDATE FlowSavedImages SET folderId = NULL WHERE id = ?", [row.id]);
                      }
                    }
                    
                    await loadSavedImages(activeFolderId);
                    if (updatedCount > 0) {
                      // Update cover to the first matching image
                      const firstImg = await db.select<any[]>("SELECT sampleUrl FROM FlowSavedImages WHERE folderId = ? LIMIT 1", [activeFolderId]);
                      if (firstImg.length > 0) {
                        updates.coverUrl = firstImg[0].sampleUrl;
                      }
                    }
                  }
                  
                  await updateFolder(activeFolderId, updates);
                  setShowFolderRules(false);
                  if (editingRules.primary.trim()) {
                    alert(`Album updated! Rules applied to your library.`);
                  }
                }} 
                className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg"
              >
                <Save size={14} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
