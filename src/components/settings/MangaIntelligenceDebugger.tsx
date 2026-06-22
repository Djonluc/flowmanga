import React, { useState, useEffect } from 'react';
import { MangaIntelligenceService } from '../../services/manga-intelligence/MangaIntelligenceService';
import { ScraperService } from '../../services/ScraperService';
import type { SmartRecommendation } from '../../services/manga-intelligence/types';
import { getDb } from '../../services/db';
import { Brain, Database, RefreshCw, Zap, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

export const MangaIntelligenceDebugger: React.FC = () => {
  const [currentRecs, setCurrentRecs] = useState<any[]>([]);
  const [smartRecs, setSmartRecs] = useState<SmartRecommendation[]>([]);
  const [isMapping, setIsMapping] = useState(false);
  const [loading, setLoading] = useState(false);

  const [profiles, setProfiles] = useState<{type: string, name: string, weight: number}[]>([]);

  const loadProfiles = async () => {
    const db = getDb();
    const p = await db.select<{type: string, name: string, weight: number}[]>(
      "SELECT type, name, weight FROM MangaInterestProfiles ORDER BY weight DESC"
    );
    setProfiles(p);
  };

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      // 1. Fetch current personalized recs (which is just trending currently)
      const current = await ScraperService.getPersonalizedRecommendations(24, false, 'manga');
      setCurrentRecs(current);

      // 2. Score them using Manga Intelligence
      const smart = await MangaIntelligenceService.getSmartRecommendations(current);
      setSmartRecs(smart);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleMapData = async () => {
    setIsMapping(true);
    await MangaIntelligenceService.mapHistoricalData();
    await loadProfiles();
    await loadRecommendations();
    setIsMapping(false);
  };

  useEffect(() => {
    loadProfiles();
    loadRecommendations();
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-12 w-full max-w-7xl mx-auto">
      {/* Header Area */}
      <div className="flex items-center justify-between mb-2">
          <div>
              <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter flex items-center gap-3">
                  <Brain className="text-purple-500" />
                  Manga Intelligence Engine
              </h2>
              <p className="text-foreground-dim font-bold tracking-wide mt-1">
                  Debug and observe the real-time scoring of your personalized recommendations.
              </p>
          </div>
      </div>

      {/* Explanatory Note */}
      <div className="glass-panel p-6 rounded-[32px] border border-purple-500/30 bg-purple-500/5 relative overflow-hidden flex flex-col gap-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-4">
              <h3 className="text-purple-300 font-black uppercase tracking-widest text-sm">How it works</h3>
              <p className="text-purple-100/70 text-sm leading-relaxed max-w-4xl font-medium">
                  The Intelligence Engine operates completely locally. It scans your reading history, favorites, and collections to construct <strong className="text-purple-300">Interest Profiles</strong>. 
                  When discovering new content, it intercepts raw trending feeds from your active sources, cross-references tags and genres against your profiles, and <strong className="text-purple-300">re-scores</strong> them to push content you're likely to enjoy to the top.
              </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-purple-500/20">
              <div className="flex flex-col gap-2">
                  <h4 className="text-purple-300 font-black uppercase tracking-widest text-[10px]">How do I feed the engine?</h4>
                  <p className="text-purple-100/60 text-xs leading-relaxed font-medium">
                      To build stronger recommendations, simply use the app! <br/>
                      1. Add manga to your <strong>Library</strong>.<br/>
                      2. Tap the <strong>Heart Icon</strong> on any manga card to mark it as a Favorite.<br/>
                      3. Read chapters to build your history.<br/>
                      The engine will automatically map these tags to build your Interest Profiles.
                  </p>
              </div>
              <div className="flex flex-col gap-2">
                  <h4 className="text-purple-300 font-black uppercase tracking-widest text-[10px]">Why are so many things labeled "NEW"?</h4>
                  <p className="text-purple-100/60 text-xs leading-relaxed font-medium">
                      The <span className="px-1.5 py-0.5 rounded bg-accent text-white font-black text-[8px] mx-1">NEW</span> badge appears on any manga that was added to your library or updated within the <strong>last 3 days</strong>. If you recently bulk-downloaded or imported a large collection, they will all appear as "New" until the 3-day window passes.
                  </p>
              </div>
          </div>
      </div>

      {/* Controls & Profiles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-[32px] border border-border-subtle flex flex-col gap-4 justify-center">
              <button
                  className="w-full py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                  onClick={handleMapData}
                  disabled={isMapping || loading}
              >
                  {isMapping ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                  {isMapping ? "Mapping..." : "1. Re-Map Historical Data"}
              </button>
              <button
                  className="w-full py-4 bg-surface-elevated hover:bg-white/10 text-foreground border border-border-subtle rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  onClick={loadRecommendations}
                  disabled={loading}
              >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                  {loading ? "Loading..." : "2. Refresh Recommendations"}
              </button>
          </div>

          <div className="glass-panel p-6 rounded-[32px] border border-border-subtle lg:col-span-2">
              <h3 className="text-foreground font-black uppercase tracking-widest text-xs mb-4">Inferred Profiles</h3>
              <div className="flex flex-wrap gap-2">
                  {profiles.length === 0 && <span className="text-foreground-muted text-xs font-bold italic">No profiles generated yet. Click 'Re-Map Historical Data'.</span>}
                  {profiles.map((p, i) => (
                      <span key={i} className={clsx(
                          "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border",
                          p.type === 'dominant' ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-white/5 border-white/10 text-foreground-dim"
                      )}>
                          {p.name} ({p.weight})
                      </span>
                  ))}
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
          
          {/* Current System */}
          <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                  <TrendingUp className="text-red-400" size={20} />
                  <h2 className="text-xl font-black text-foreground uppercase tracking-tighter">Raw Provider Feed</h2>
              </div>
              <div className="space-y-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2">
                  {currentRecs.map((manga, i) => (
                      <div key={i} className="flex gap-4 glass-panel p-4 rounded-2xl border border-red-500/10 hover:border-red-500/30 transition-colors">
                          <img src={manga.coverUrl} className="w-16 h-24 object-cover rounded-xl shadow-md" alt={manga.title} />
                          <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-foreground line-clamp-1 text-sm">{manga.title}</h3>
                              <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mt-1">Unranked (0 pts)</p>
                              <p className="text-[10px] text-foreground-dim font-medium mt-2 line-clamp-2 leading-relaxed">{manga.tags?.join(", ")}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          {/* New System */}
          <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                  <Brain className="text-emerald-400" size={20} />
                  <h2 className="text-xl font-black text-foreground uppercase tracking-tighter">Smart Recommendations</h2>
              </div>
              <div className="space-y-4 max-h-[800px] overflow-y-auto custom-scrollbar pr-2">
                  {smartRecs.map((rec, i) => (
                      <div key={i} className="flex gap-4 glass-panel p-4 rounded-2xl border border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all">
                          <img src={rec.item.coverUrl} className="w-16 h-24 object-cover rounded-xl shadow-md" alt={rec.item.title} />
                          <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-4">
                                  <h3 className="font-bold text-foreground line-clamp-1 text-sm">{rec.item.title}</h3>
                                  <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] px-2 py-1 rounded-md font-black uppercase tracking-widest flex-shrink-0">
                                      +{rec.score} pts
                                  </span>
                              </div>
                              
                              <div className="mt-3 space-y-1.5">
                                  {rec.matchReasons.length === 0 && (
                                      <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest">No interests matched</p>
                                  )}
                                  {rec.matchReasons.map((reason, ri) => (
                                      <div key={ri} className="flex items-start gap-1.5">
                                          <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                                          <p className="text-[10px] font-bold text-emerald-400 leading-tight">{reason}</p>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

      </div>
    </div>
  );
};
