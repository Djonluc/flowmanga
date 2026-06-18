import React, { useEffect, useState } from 'react';
import { getDb } from '../../services/db';
import { Play, Search, Trash2 } from 'lucide-react';

interface Playlist {
  id: string;
  name: string;
  query: string;
}

interface PlaylistsTabProps {
  onPlay: (query: string) => void;
}

export const PlaylistsTab: React.FC<PlaylistsTabProps> = ({ onPlay }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

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
      const db = getDb();
      await db.execute("DELETE FROM FlowPlaylists WHERE id = ?", [id]);
      await loadPlaylists();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-full h-full p-8 overflow-y-auto bg-background flex flex-col gap-6">
      <h2 className="text-2xl font-black uppercase tracking-widest text-foreground">Smart Playlists</h2>
      <p className="text-foreground-muted">
        Smart playlists save your complex search queries and auto-update dynamically whenever you play them.
      </p>

      {playlists.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-foreground-muted font-bold uppercase tracking-widest">
          No playlists saved. Try searching and hitting "Save Playlist".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map(p => (
            <div key={p.id} className="p-6 bg-surface border border-border-subtle rounded-2xl flex flex-col gap-4 group hover:border-accent transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-accent/50 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform"></div>
              
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                <button onClick={() => handleDelete(p.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm text-foreground-muted bg-black/20 p-3 rounded-lg">
                <Search size={14} className="text-accent shrink-0" />
                <span className="truncate">{p.query}</span>
              </div>

              <button 
                onClick={() => onPlay(p.query)}
                className="mt-2 h-12 bg-accent/10 hover:bg-accent/20 text-accent font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Play size={16} fill="currentColor" /> Play Channel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
