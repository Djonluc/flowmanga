import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { TagIntelligenceService, type UserInterest } from '../services/TagIntelligenceService';
import { getDb } from '../../services/db';
import { X, Pin, Plus } from 'lucide-react';

export const InterestManager = ({ onClose }: { onClose: () => void }) => {
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newType, setNewType] = useState<'dominant_tag' | 'supporting_tag' | 'artist' | 'character' | 'series'>('dominant_tag');

  const loadInterests = async () => {
    const data = await TagIntelligenceService.getInterests();
    setInterests(data);
  };

  useEffect(() => {
    loadInterests();
  }, []);

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    await TagIntelligenceService.togglePinInterest(id, !isPinned);
    loadInterests();
  };

  const handleRemove = async (id: string) => {
    const db = getDb();
    await db.execute("DELETE FROM UserInterests WHERE id = ?", [id]);
    loadInterests();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    const db = getDb();
    try {
      await db.execute(
        "INSERT INTO UserInterests (id, type, name, score, isPinned) VALUES (?, ?, ?, 100, 1)",
        [crypto.randomUUID(), newType, newTag.trim()]
      );
      setNewTag('');
      loadInterests();
    } catch (err) {
      console.error("Failed to add interest", err);
      // Could be a unique constraint failure, just update it
      await db.execute(
        "UPDATE UserInterests SET isPinned = 1 WHERE type = ? AND name = ?",
        [newType, newTag.trim()]
      );
      setNewTag('');
      loadInterests();
    }
  };

  const renderSection = (type: string, title: string) => {
    const items = interests.filter(i => i.type === type);
    return (
      <div className="mb-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground-muted mb-3">{title}</h3>
        {items.length === 0 ? (
          <p className="text-xs text-foreground-muted/50 italic">None yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-1 px-3 py-1 bg-surface border border-border-subtle rounded-lg text-sm group">
                <span className="font-bold">{item.name}</span>
                <button 
                  onClick={() => handleTogglePin(item.id, item.isPinned)}
                  className={`p-1 rounded-md transition-colors ${item.isPinned ? 'text-accent' : 'text-foreground-muted hover:text-white'}`}
                  title={item.isPinned ? 'Unpin' : 'Pin manually'}
                >
                  <Pin size={14} />
                </button>
                <button 
                  onClick={() => handleRemove(item.id)}
                  className="p-1 rounded-md text-red-500/50 hover:text-red-500 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="bg-background border border-border-subtle rounded-2xl w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border-subtle shrink-0">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest">Interest Manager</h2>
            <p className="text-sm text-foreground-muted mt-1">Pin your favorite tags to override the auto-generated recommendations.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-full text-foreground-muted hover:text-white transition-colors shrink-0">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-6 border-b border-border-subtle bg-surface/50 shrink-0">
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <select 
              value={newType} 
              onChange={(e) => setNewType(e.target.value as any)}
              className="h-10 px-4 rounded-lg bg-black/40 border border-border-subtle text-sm font-bold uppercase tracking-wider outline-none focus:border-accent"
            >
              <option value="dominant_tag">Dominant Tag</option>
              <option value="supporting_tag">Supporting Tag</option>
              <option value="artist">Artist</option>
              <option value="character">Character</option>
              <option value="series">Series</option>
            </select>
            <input 
              type="text" 
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="e.g. elf, fantasy, asuka..."
              className="flex-1 h-10 px-4 rounded-lg bg-black/40 border border-border-subtle text-sm outline-none focus:border-accent"
            />
            <button 
              type="submit"
              className="h-10 px-6 bg-accent hover:bg-accent-hover text-white font-black uppercase tracking-widest text-xs rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shrink-0"
              disabled={!newTag.trim()}
            >
              <Plus size={16} /> Add
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
          {renderSection('dominant_tag', 'Dominant Tags')}
          {renderSection('supporting_tag', 'Supporting Tags')}
          {renderSection('artist', 'Artists')}
          {renderSection('character', 'Characters')}
          {renderSection('series', 'Series')}
        </div>
      </div>
    </div>,
    document.body
  );
};
