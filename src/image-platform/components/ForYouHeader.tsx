import React, { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Settings2 } from 'lucide-react';
import { TagIntelligenceService, type UserInterest } from '../services/TagIntelligenceService';
import { useImageEngineStore } from '../useImageEngineStore';
import { InterestManager } from './InterestManager';

const CollapsibleRow = ({ title, items, onClickItem }: { title: string, items: UserInterest[], onClickItem: (name: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 mb-2">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-foreground-muted hover:text-foreground font-black uppercase tracking-widest text-xs transition-colors text-left py-1"
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>

      {isExpanded && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-1 animate-fade-in pl-5">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => onClickItem(item.name)}
              className="shrink-0 px-3 py-1 rounded-full bg-surface hover:bg-accent/20 border border-border-subtle hover:border-accent text-xs font-bold text-foreground transition-all flex items-center justify-center"
            >
              #{item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ForYouHeader = () => {
  const store = useImageEngineStore();
  const [showManager, setShowManager] = useState(false);
  const [isGlobalExpanded, setIsGlobalExpanded] = useState(false);
  const [dominantTags, setDominantTags] = useState<UserInterest[]>([]);
  const [supportingTags, setSupportingTags] = useState<UserInterest[]>([]);
  const [artists, setArtists] = useState<UserInterest[]>([]);
  const [characters, setCharacters] = useState<UserInterest[]>([]);
  const [series, setSeries] = useState<UserInterest[]>([]);

  useEffect(() => {
    const loadInterests = async () => {
      const dom = await TagIntelligenceService.getInterests('dominant_tag');
      const sup = await TagIntelligenceService.getInterests('supporting_tag');
      const art = await TagIntelligenceService.getInterests('artist');
      const chars = await TagIntelligenceService.getInterests('character');
      const ser = await TagIntelligenceService.getInterests('series');

      setDominantTags(dom);
      setSupportingTags(sup);
      setArtists(art);
      setCharacters(chars);
      setSeries(ser);
    };
    loadInterests();
  }, []);

  const handleSearch = (query: string) => {
    useImageEngineStore.setState({ fetchMode: 'search' });
    store.search(query);
  };

  const allTags = [...dominantTags, ...supportingTags];

  if (allTags.length === 0 && artists.length === 0 && characters.length === 0 && series.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0 w-full px-6 py-4 bg-background z-10 border-b border-border-subtle">
      <div className="flex items-center justify-between mb-2">
        <button 
          onClick={() => setIsGlobalExpanded(!isGlobalExpanded)}
          className="flex items-center gap-2 text-xl font-black uppercase tracking-widest text-white hover:text-accent transition-colors"
        >
          {isGlobalExpanded ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
          For You Recommendations
        </button>
        <button 
          onClick={() => setShowManager(true)}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-border-subtle hover:border-accent text-xs font-bold uppercase tracking-widest text-foreground transition-all"
        >
          <Settings2 size={14} /> Manage Interests
        </button>
      </div>
      
      {isGlobalExpanded && (
        <div className="animate-fade-in pl-8 mt-2">
          <CollapsibleRow title="Recommended Tags" items={allTags} onClickItem={handleSearch} />
          <CollapsibleRow title="Recommended Artists" items={artists} onClickItem={handleSearch} />
          <CollapsibleRow title="Recommended Characters" items={characters} onClickItem={handleSearch} />
          <CollapsibleRow title="Recommended Series" items={series} onClickItem={handleSearch} />
        </div>
      )}

      {showManager && (
        <InterestManager onClose={() => {
          setShowManager(false);
          // Re-load interests when the manager closes
          TagIntelligenceService.getInterests('dominant_tag').then(setDominantTags);
          TagIntelligenceService.getInterests('supporting_tag').then(setSupportingTags);
          TagIntelligenceService.getInterests('artist').then(setArtists);
          TagIntelligenceService.getInterests('character').then(setCharacters);
          TagIntelligenceService.getInterests('series').then(setSeries);
        }} />
      )}
    </div>
  );
};
