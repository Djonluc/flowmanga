import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tag, Globe, CheckCircle2, Layers } from "lucide-react";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import clsx from "clsx";

interface LibraryFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allTags: string[];
}

export const LibraryFilterDrawer: React.FC<LibraryFilterDrawerProps> = ({ isOpen, onClose, allTags }) => {
  const {
    filterTags,
    toggleFilterTag,
    filterSource,
    setFilterSource,
    filterStatus,
    setFilterStatus,
    clearFilterTags,
    series
  } = useLibraryStore();

  const { showAdultContent } = useSettingsStore();

  // Extract unique sources
  const allSources = Array.from(new Set(series.map(s => s.source))).filter(Boolean);

  const statuses = [
    { id: 'unread', label: 'Unread' },
    { id: 'reading', label: 'Reading' },
    { id: 'completed', label: 'Completed' }
  ] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-4 top-4 bottom-4 w-96 bg-surface-elevated border border-border-strong rounded-[32px] z-50 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-border-subtle shrink-0">
              <h3 className="text-xl font-black text-foreground uppercase tracking-widest">
                Filters
              </h3>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-surface-raised text-foreground-dim hover:text-foreground transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8">
              {/* Reading Status */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Status</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statuses.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setFilterStatus(filterStatus === s.id ? null : s.id)}
                      className={clsx(
                        "px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide border transition-all",
                        filterStatus === s.id 
                          ? "bg-emerald-500 text-white border-emerald-500" 
                          : "bg-surface text-foreground-dim border-border-subtle hover:text-foreground hover:bg-surface-raised"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sources */}
              {allSources.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Source</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <select
                      value={filterSource || ""}
                      onChange={(e) => setFilterSource(e.target.value || null)}
                      className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-xs font-semibold text-foreground focus:outline-none focus:border-accent"
                    >
                      <option value="">All Sources</option>
                      {allSources.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                    <Tag size={14} className="text-accent" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Tags</span>
                    </div>
                    {filterTags.length > 0 && (
                        <button onClick={clearFilterTags} className="text-[10px] font-black uppercase text-red-400 hover:text-red-300">
                            Clear
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleFilterTag(tag)}
                      className={clsx(
                        "px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-tight border transition-all",
                        filterTags.includes(tag)
                          ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                          : "bg-surface border-border-subtle text-foreground-muted hover:text-foreground hover:bg-surface-raised hover:border-accent/30"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                  {allTags.length === 0 && (
                    <span className="text-[10px] text-foreground-dim font-medium">
                      No tags available
                    </span>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
