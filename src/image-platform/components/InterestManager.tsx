import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TagIntelligenceService, type UserInterest } from '../services/TagIntelligenceService';
import { getDb } from '../../services/db';
import { X, Pin, Plus, Trash2, Clock, Loader2, Info } from 'lucide-react';
import { useGalleryStore } from '../../stores/useGalleryStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useImageEngineStore } from '../useImageEngineStore';

type TagType = 'dominant_tag' | 'supporting_tag' | 'artist' | 'character' | 'series' | 'blocked_tag';

export const InterestManager = ({ onClose }: { onClose: () => void }) => {
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const { blockedTags, blockTag, unblockTag, clearBlockedTags, clearViewHistory } = useGalleryStore();
  const { forYouQualityMode, setForYouQualityMode } = useSettingsStore();

  // Autocomplete State per input
  const [activeInputType, setActiveInputType] = useState<TagType | null>(null);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const suggestionsTimeoutRef = useRef<NodeJS.Timeout>();

  const loadInterests = async () => {
    const data = await TagIntelligenceService.getInterests();
    setInterests(data);
  };

  const handleQualityChange = (mode: 'broad' | 'strict') => {
    setForYouQualityMode(mode);
    void useImageEngineStore.getState().fetchCurated(true);
  };

  useEffect(() => {
    loadInterests();
  }, []);

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    await TagIntelligenceService.togglePinInterest(id, !isPinned);
    loadInterests();
    void useImageEngineStore.getState().fetchCurated(true);
  };

  const handleRemove = async (id: string) => {
    const db = getDb();
    await db.execute("DELETE FROM UserInterests WHERE id = ?", [id]);
    loadInterests();
    void useImageEngineStore.getState().fetchCurated(true);
  };

  const handleMassWipe = async (type: string) => {
    if (!confirm(`Are you sure you want to mass wipe all tags in this category?`)) return;
    
    if (type === 'blocked_tag') {
      await clearBlockedTags();
      void useImageEngineStore.getState().fetchCurated(true);
      return;
    }

    const db = getDb();
    await db.execute("DELETE FROM UserInterests WHERE type = ?", [type]);
    loadInterests();
    void useImageEngineStore.getState().fetchCurated(true);
  };

  const handleTagChange = (type: TagType, val: string) => {
    setTagInputs(prev => ({ ...prev, [type]: val }));
    setActiveInputType(type);

    if (suggestionsTimeoutRef.current) clearTimeout(suggestionsTimeoutRef.current);
    
    if (val.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setIsFetchingSuggestions(true);
    suggestionsTimeoutRef.current = setTimeout(async () => {
      try {
        const { federator } = await import('../SearchFederator');
        const results = await federator.autocompleteTags(val);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 400);
  };

  const handleAdd = async (type: TagType, tag: string) => {
    if (!tag.trim()) return;

    if (type === 'blocked_tag') {
      await blockTag(tag.trim());
      setTagInputs(prev => ({ ...prev, [type]: '' }));
      setSuggestions([]);
      setActiveInputType(null);
      return;
    }

    const db = getDb();
    try {
      await db.execute(
        "INSERT INTO UserInterests (id, type, name, score, isPinned) VALUES (?, ?, ?, 100, 1)",
        [crypto.randomUUID(), type, tag.trim()]
      );
    } catch (err) {
      console.error("Failed to add interest", err);
      // Could be a unique constraint failure, just update it
      await db.execute(
        "UPDATE UserInterests SET isPinned = 1 WHERE type = ? AND name = ?",
        [type, tag.trim()]
      );
    }
    
    setTagInputs(prev => ({ ...prev, [type]: '' }));
    setSuggestions([]);
    setActiveInputType(null);
    loadInterests();
    void useImageEngineStore.getState().fetchCurated(true);
  };

  const renderCard = (
    type: TagType, 
    title: string, 
    description: string, 
    items: { id: string; name: string; isPinned: boolean }[],
    isBlockedType = false
  ) => {
    const val = tagInputs[type] || '';
    const isAutocompleteActive = activeInputType === type && suggestions.length > 0 && val.length > 0;
    
    return (
      <div className={`bg-surface/50 border rounded-xl p-4 sm:p-5 flex flex-col shadow-sm ${isBlockedType ? 'border-red-500/30' : 'border-border-subtle'}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className={`font-black uppercase tracking-widest text-sm ${isBlockedType ? 'text-red-500' : 'text-foreground'}`}>
              {title}
            </h3>
            <p className="text-xs text-foreground-muted mt-1 leading-relaxed max-w-[90%]">
              {description}
            </p>
          </div>
          {items.length > 0 && (
            <button 
              onClick={() => handleMassWipe(type)}
              className="p-2 rounded-lg text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Wipe Category"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Input Box */}
        <div className="mt-4 flex gap-2 relative">
          <div className="relative flex-1">
            <input 
              type="text" 
              value={val}
              onChange={(e) => handleTagChange(type, e.target.value)}
              onFocus={() => setActiveInputType(type)}
              placeholder="Type to add a tag..."
              className={`w-full h-10 px-4 rounded-lg bg-black/40 border text-sm outline-none ${isBlockedType ? 'focus:border-red-500 border-red-500/20' : 'focus:border-indigo-500 border-border-subtle'}`}
            />
            {isFetchingSuggestions && activeInputType === type && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 size={16} className="animate-spin text-foreground-muted" />
              </div>
            )}
            
            {/* Autocomplete Dropdown */}
            {isAutocompleteActive && (
              <div className="absolute z-[100] top-full mt-2 w-full bg-black border border-border-subtle rounded-xl shadow-2xl overflow-hidden animate-fade-in pointer-events-auto max-h-48 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleAdd(type, suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-white/10 transition-colors text-sm font-medium border-b border-white/5 last:border-0 truncate bg-black"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={() => handleAdd(type, val)}
            disabled={!val.trim()}
            className={`h-10 px-4 text-white font-black uppercase tracking-widest text-xs rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shrink-0 ${isBlockedType ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
          >
            <Plus size={16} /> Add
          </button>
        </div>

        {/* Tag List */}
        <div className="mt-4 flex flex-wrap gap-2">
          {items.length === 0 ? (
            <p className="text-xs text-foreground-muted/50 italic py-2">No tags added yet.</p>
          ) : (
            items.map(item => (
              <div key={item.id || item.name} className={`flex items-center gap-1 px-3 py-1 border rounded-lg text-sm group ${isBlockedType ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-surface border-border-subtle'}`}>
                <button 
                  onClick={() => isBlockedType ? unblockTag(item.name) : handleRemove(item.id)}
                  className="p-1 rounded-md text-red-500/50 hover:text-red-500 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  <X size={14} />
                </button>
                <span className="font-bold">{item.name}</span>
                {!isBlockedType && (
                  <button 
                    onClick={() => handleTogglePin(item.id, item.isPinned)}
                    className={`p-1 rounded-md transition-colors ${item.isPinned ? 'text-indigo-400' : 'text-foreground-muted hover:text-white'}`}
                    title={item.isPinned ? 'Unpin' : 'Pin manually'}
                  >
                    <Pin size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center p-4 sm:p-6 overflow-hidden items-start pt-10 sm:pt-20">
      <div className="bg-background border border-border-subtle rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border-subtle shrink-0">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-foreground">Interest Manager</h2>
            <p className="text-sm text-foreground-muted mt-1">Configure exactly what the recommendation engine looks for when curating your feed.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-full text-foreground-muted hover:text-white transition-colors shrink-0">
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 space-y-6">
          {/* Global Controls Banner */}
          <div className="p-4 sm:p-5 border border-indigo-500/20 rounded-xl bg-indigo-500/5 flex flex-col gap-4 shrink-0 shadow-sm">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 mt-0.5">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-foreground">Recommendation Quality</h3>
                  <p className="text-xs text-foreground-muted mt-1 leading-relaxed max-w-md">
                    Broad keeps strong secondary matches and discovery in the mix. Strict only keeps images that match a core interest.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-surface border border-border-subtle shrink-0" role="group" aria-label="Recommendation quality">
                {(['broad', 'strict'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleQualityChange(mode)}
                    aria-pressed={forYouQualityMode === mode}
                    className={`px-3 py-2 rounded-md font-bold text-xs uppercase tracking-widest transition-all ${
                      forYouQualityMode === mode
                        ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.35)]'
                        : 'text-foreground-muted hover:text-foreground'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-surface-elevated border border-border-subtle rounded-xl p-4 mt-2">
              <h4 className="text-xs font-black uppercase tracking-widest text-foreground mb-1">💡 Pro-Tip: Smart Root Matching</h4>
              <p className="text-xs text-foreground-muted leading-relaxed">
                You do not need to add every single variation of a tag. The engine uses <strong>Smart Root Matching</strong>. 
                For example, if you add the tag <span className="text-purple-400 font-bold">poke</span>, the engine will automatically match 
                <span className="text-purple-400 font-bold px-1">pokemon</span>, 
                <span className="text-purple-400 font-bold px-1">pokemon_sun</span>, and 
                <span className="text-purple-400 font-bold px-1">pokemon_moon</span>. 
                Add short root words to cast a wide net!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderCard(
              'dominant_tag',
              'Core Interests (Dominant)',
              'Tags here get massive priority. If Strict Mode is on, images MUST contain one of these to appear in your feed.',
              interests.filter(i => i.type === 'dominant_tag')
            )}
            
            {renderCard(
              'supporting_tag',
              'Secondary Interests',
              'Tags here act as bonuses. They help refine your feed and boost images that also match your Core Interests.',
              interests.filter(i => i.type === 'supporting_tag')
            )}

            {renderCard(
              'artist',
              'Favorite Artists',
              'Boosts images created by these specific artists.',
              interests.filter(i => i.type === 'artist')
            )}

            {renderCard(
              'character',
              'Favorite Characters',
              'Boosts images containing these specific characters.',
              interests.filter(i => i.type === 'character')
            )}
            
            {renderCard(
              'series',
              'Favorite Series',
              'Boosts images from these specific franchises.',
              interests.filter(i => i.type === 'series')
            )}

            {renderCard(
              'blocked_tag',
              'Blacklist (Blocked)',
              'Tags you absolutely never want to see anywhere in the app.',
              blockedTags.map(t => ({ id: t, name: t, isPinned: true })),
              true
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 shrink-0 flex justify-between items-center bg-surface/30 border-t border-border-subtle">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock size={16} className="text-indigo-400" />
              Browsing History
            </h3>
            <p className="text-xs text-foreground-muted mt-1">Clear your tracked history used for dynamic recommendations.</p>
          </div>
          <button 
            onClick={() => {
              if (confirm("Are you sure you want to wipe all view history?")) {
                clearViewHistory();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all text-sm font-bold"
          >
            <Trash2 size={16} />
            Wipe History
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
