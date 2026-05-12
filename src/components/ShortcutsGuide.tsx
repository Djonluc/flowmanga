import { useSettingsStore } from '../stores/useSettingsStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

export const ShortcutsGuide = () => {
  const { isShortcutsOpen, toggleShortcuts } = useSettingsStore();

  return (
    <AnimatePresence>
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleShortcuts}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-surface border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                    <Keyboard size={20} />
                </div>
                <h2 className="text-xl font-bold text-foreground">Keyboard Shortcuts</h2>
              </div>
              <button 
                onClick={toggleShortcuts}
                className="p-1 rounded-full hover:bg-white/10 text-foreground-dim hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
                
                {/* Section: General */}
                <div>
                    <h3 className="text-xs font-bold text-foreground-dim uppercase tracking-wider mb-3">General</h3>
                    <div className="space-y-2">
                        <ShortcutRow keys={['H']} label="Toggle HUD (Immersive Mode)" />
                        <ShortcutRow keys={['F']} label="Toggle Fullscreen" />
                        <ShortcutRow keys={['A']} label="Toggle Auto-Scroll" />
                        <ShortcutRow keys={['L']} label="Toggle Grid / Shelf View" />
                        <ShortcutRow keys={['?']} label="Toggle This Guide" />
                    </div>
                </div>

                {/* Section: Reading Modes */}
                <div>
                    <h3 className="text-xs font-bold text-foreground-dim uppercase tracking-wider mb-3">Reading Modes</h3>
                    <div className="space-y-2">
                        <ShortcutRow keys={['V']} label="Vertical Mode" />
                        <ShortcutRow keys={['P']} label="Page Mode" />
                        <ShortcutRow keys={['S']} label="Slideshow Mode" />
                    </div>
                </div>

                 {/* Section: Navigation */}
                 <div>
                    <h3 className="text-xs font-bold text-foreground-dim uppercase tracking-wider mb-3">Navigation</h3>
                    <div className="space-y-2">
                        <ShortcutRow keys={['←', '→']} label="Next / Previous Page" />
                        <ShortcutRow keys={['Space']} label="Scroll / Next" />
                    </div>
                </div>

            </div>
            
            <div className="p-4 bg-white/5 text-center text-xs text-foreground-dim">
                Press <span className="text-foreground-muted font-bold">Esc</span> to close
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ShortcutRow = ({ keys, label }: { keys: string[], label: string }) => (
    <div className="flex items-center justify-between">
        <span className="text-foreground-muted text-sm">{label}</span>
        <div className="flex gap-1">
            {keys.map(k => (
                <kbd key={k} className="min-w-[24px] px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-foreground-muted text-xs font-mono font-bold text-center">
                    {k}
                </kbd>
            ))}
        </div>
    </div>
);
