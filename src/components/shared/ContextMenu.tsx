import React from 'react';
import { motion } from 'framer-motion';
import { Tag, Edit2, Sparkles, Trash2, Share2, ExternalLink, Download } from 'lucide-react';
import clsx from 'clsx';

interface ContextMenuProps {
  activeMenu: { x: number; y: number; item: any } | null;
  onAction: (action: string, item: any) => void;
  onClose: () => void;
  mode?: 'library' | 'discovery';
}

export const ContextMenu = ({
  activeMenu,
  onAction,
  onClose,
  mode = 'discovery',
}: ContextMenuProps) => {
  if (!activeMenu) return null;

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        style={{ left: activeMenu.x, top: activeMenu.y }}
        className="absolute bg-[#0f0f11]/95 border border-white/10 rounded-[24px] shadow-[0_32px_64px_rgba(0,0,0,0.6)] py-3 min-w-[220px] backdrop-blur-2xl"
      >
        {mode === 'library' ? (
          <>
            <MenuButton
              icon={<Tag size={16} className="text-indigo-400" />}
              label="Manage Tags"
              onClick={() => onAction("tag", activeMenu.item)}
            />
            <MenuButton
              icon={<Edit2 size={16} className="text-indigo-400" />}
              label="Rename Series"
              onClick={() => onAction("rename", activeMenu.item)}
            />
            <MenuButton
              icon={<Sparkles size={16} className="text-indigo-400" />}
              label="Refresh Info"
              onClick={() => onAction("refresh", activeMenu.item)}
            />
            <div className="h-px bg-white/5 my-2 mx-3" />
            <MenuButton
              icon={<Trash2 size={16} className="text-red-500" />}
              label="Delete Forever"
              onClick={() => onAction("delete", activeMenu.item)}
              danger
            />
          </>
        ) : (
          <>
            <MenuButton
              icon={<ExternalLink size={16} className="text-indigo-400" />}
              label="Quick View"
              onClick={() => onAction("view", activeMenu.item)}
            />
            <MenuButton
              icon={<Share2 size={16} className="text-indigo-400" />}
              label="Copy Link"
              onClick={() => onAction("share", activeMenu.item)}
            />
             <MenuButton
              icon={<Sparkles size={16} className="text-indigo-400" />}
              label="Similar Titles"
              onClick={() => onAction("similar", activeMenu.item)}
            />
             <div className="h-px bg-white/5 my-2 mx-3" />
             <MenuButton
               icon={<Download size={16} className="text-blue-500" />}
               label="Initialize Download"
               onClick={() => onAction("download", activeMenu.item)}
             />
          </>
        )}
      </motion.div>
    </div>
  );
};

const MenuButton = ({ icon, label, onClick, danger }: any) => (
  <button
    onClick={(e) => {
        e.stopPropagation();
        onClick();
    }}
    className={clsx(
      "w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest flex items-center gap-4 transition-all",
      danger
        ? "text-red-500 hover:bg-red-500/10"
        : "text-foreground/80 hover:text-foreground hover:bg-white/5",
    )}
  >
    {icon}
    {label}
  </button>
);
