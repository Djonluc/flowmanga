import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder?: string;
  description?: string;
  initialValue?: string;
}

export function InputModal({ isOpen, onClose, onSubmit, title, placeholder, description, initialValue }: InputModalProps) {
  const [value, setValue] = useState(initialValue || '');

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue || '');
    }
  }, [isOpen, initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
      onClose();
    }
  };

  const handleClose = () => {
    setValue('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface border border-white/10 rounded-xl shadow-2xl w-full max-w-md mx-4 pointer-events-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-bold text-foreground">{title}</h2>
                <button
                  onClick={handleClose}
                  className="text-foreground-dim hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {description && (
                  <p className="text-sm text-foreground-dim">{description}</p>
                )}
                
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-4 py-3 bg-surface-raised border border-white/10 rounded-lg text-foreground placeholder:text-foreground-dim focus:outline-none focus:border-blue-500 transition-colors"
                />

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 bg-surface-raised text-foreground rounded-lg hover:bg-surface-raised transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!value.trim()}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
