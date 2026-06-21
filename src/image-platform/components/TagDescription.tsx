import React, { useEffect, useState } from 'react';
import { TagWikiService } from '../../services/TagWikiService';
import type { TagWiki } from '../../services/TagWikiService';
import { BookOpen, Loader2 } from 'lucide-react';

export const TagDescription: React.FC<{ query: string }> = ({ query }) => {
  const [wiki, setWiki] = useState<TagWiki | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!query) {
      setWiki(null);
      return;
    }

    // Try to fetch wiki for the first valid tag
    const tags = query.split(' ').filter(t => t.trim().length > 0 && !t.startsWith('-') && !t.includes(':'));
    const primaryTag = tags[0];

    if (!primaryTag) {
      setWiki(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setWiki(null);
    setIsExpanded(false);

    TagWikiService.fetchDescription(primaryTag).then(res => {
      if (isMounted) {
        setWiki(res);
        setLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [query]);

  if (!loading && !wiki) return null;

  return (
    <div className="w-full bg-surface-elevated border border-border-subtle rounded-xl p-6 mb-6 shadow-md transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-accent/20 rounded-lg">
          <BookOpen size={20} className="text-accent" />
        </div>
        <h3 className="text-xl font-black text-foreground capitalize">
          {wiki ? wiki.title.replace(/_/g, ' ') : query}
        </h3>
        {loading && <Loader2 size={16} className="animate-spin text-foreground-muted ml-2" />}
      </div>
      
      {wiki && (
        <div className="relative">
          <div 
            className={`text-sm text-foreground-muted leading-relaxed tag-tooltip-html ${!isExpanded ? 'line-clamp-4' : ''}`}
            dangerouslySetInnerHTML={{ __html: wiki.parsedBody }}
          />
          {wiki.body.length > 300 && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-3 text-xs font-black uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
            >
              {isExpanded ? 'Show Less' : 'Read Full Description'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
