import { useSettingsStore } from "../stores/useSettingsStore";
import { useReadingStore } from "../stores/useReadingStore";
import { useModalStore } from "../stores/useModalStore";
import {
  Home,
  Library,
  Compass,
  Clock,
  Heart,
  Layers,
  Download,
  BarChart2,
  Settings,
  Zap,
  ChevronDown,
  Bell,
  FolderOpen,
  MousePointer2,
  Lock,
  SidebarClose,
  ExternalLink,
  CheckCircle2,
  User,
} from "lucide-react";
import { motion } from "framer-motion";
import { useDownloadStore } from "../stores/useDownloadStore";
import { useState, useEffect } from "react";
import { useLibraryStore } from "../stores/useLibraryStore";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { open as openShell } from "@tauri-apps/plugin-shell";
import clsx from "clsx";
import type { SidebarMode } from "../stores/useSettingsStore";
import { toast } from "./Toast";
import { MusicPlayer } from "./MusicPlayer";

export const Sidebar = () => {
  const {
    sidebarMode,
    setSidebarMode,
    activeView,
    setActiveView,
    isSettingsOpen,
    toggleSettings,
    toggleDownloadPanel,
    isScreenshotMode,
  } = useSettingsStore();
  const { openProfilePanel } = useModalStore();
  const { queue } = useDownloadStore();

  const [isHovered, setIsHovered] = useState(false);
  const [currentlyReading, setCurrentlyReading] = useState<any>(null);
  const { series } = useLibraryStore();

  useEffect(() => {
    const loadRecentHistory = async () => {
      try {
        const { getDb } = await import("../services/db");
        const db = getDb();
        const history = await db.select<any[]>(`
                    SELECT rp.*, c.title, c.chapterNumber, s.coverPath as cover, c.filePath, s.title as seriesTitle
                    FROM ReadingProgress rp
                    JOIN Chapters c ON rp.chapterId = c.id
                    JOIN Series s ON rp.seriesId = s.id
                    ORDER BY rp.lastReadAt DESC
                    LIMIT 1
                `);

        if (history.length > 0) {
          const item = history[0];
          if (!item.totalPages || item.currentPage < item.totalPages) {
            setCurrentlyReading(item);
          }
        }
      } catch (e) {
        console.error("Sidebar: Failed to load recent history", e);
      }
    };

    loadRecentHistory();
    const interval = setInterval(loadRecentHistory, 10000);
    return () => clearInterval(interval);
  }, []);

    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isExpanded = (sidebarMode === "expanded" || (sidebarMode === "hover" && isHovered)) && windowWidth > 1024;

  const navItems = [
    { icon: <Home size={20} />, label: "Home", view: "home" as const },
    { icon: <Library size={20} />, label: "Library", view: "library" as const },
    { icon: <Compass size={20} />, label: "Discover", view: "discover" as const },
    {
      icon: <Download size={20} />,
      label: "Downloads",
      view: "downloads" as const,
    },
    { icon: <Clock size={20} />, label: "History", view: "history" as const },
    {
      icon: <Heart size={20} />,
      label: "Favorites",
      view: "favorites" as const,
    },
    {
      icon: <Layers size={20} />,
      label: "Collections",
      view: "collections" as const,
    },
    {
      icon: <BarChart2 size={20} />,
      label: "Statistics",
      view: "stats" as const,
    },
    {
      icon: <Settings size={20} />,
      label: "Settings",
      view: "settings" as const,
    },
  ];

  const cycleMode = () => {
    const modes: SidebarMode[] = ["expanded", "hover", "collapsed"];
    const currentIdx = modes.indexOf(sidebarMode);
    const nextIdx = (currentIdx + 1) % modes.length;
    setSidebarMode(modes[nextIdx]);
  };

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={false}
      animate={{ width: isExpanded ? 220 : 68 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={clsx(
        "flex-col z-50 relative group flex-shrink-0 transition-all duration-700 ease-in-out",
        "m-2 md:m-4 rounded-2xl md:rounded-[32px] bg-surface glass-panel shadow-cinematic overflow-hidden border border-border-subtle",
        isScreenshotMode
          ? "flex h-full"
          : "flex h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)]",
      )}
    >
      {/* Logo */}
      <div className="h-16 md:h-20 flex items-center px-4 md:px-6 mb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-[12px] md:rounded-[14px] bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-[0_8px_16px_rgba(99,102,241,0.3)] flex-shrink-0">
            <Zap
              size={18}
              fill="currentColor"
              className="drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]"
            />
          </div>
          <motion.div
            animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -10 }}
            className="flex flex-col whitespace-nowrap"
          >
            <span className="font-bold text-lg tracking-tight text-foreground leading-none">
              FlowManga
            </span>
          </motion.div>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 flex flex-col gap-2 px-3 overflow-y-auto no-scrollbar py-2">
        {navItems.map((item) => (
          <NavButton
            key={item.view}
            icon={item.icon}
            label={item.label}
            expanded={isExpanded}
            active={activeView === item.view}
            onClick={() => {
              if (item.view === "settings") toggleSettings();
              else {
                useReadingStore.getState().reset();
                setActiveView(item.view);
              }
            }}
          />
        ))}
      </div>

      {/* Space for future stats or pinned items */}
      <div className="flex-1" />

      {/* Profile Section - Temporarily Hidden until fully implemented */}
      {/* 
      <div className="p-4 border-t border-white/5 bg-white/[0.03]">
        <div
          onClick={() => openProfilePanel()}
          className={clsx(
            "flex items-center gap-3 p-2.5 rounded-2xl transition-all hover:bg-white/5 cursor-pointer group/profile",
            !isExpanded && "justify-center",
          )}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-500/20 group-hover/profile:border-indigo-500/50 flex-shrink-0 bg-surface flex items-center justify-center transition-all shadow-lg">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=VoidWalker"
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <User size={18} className="text-foreground-muted" />
          </div>
          {isExpanded && (
            <div className="flex-1 min-w-0 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground/90 text-sm font-bold truncate tracking-tight group-hover/profile:text-foreground transition-colors">
                    VoidWalker
                  </span>
                </div>
                <span className="text-foreground-dim text-[9px] font-black uppercase tracking-widest mt-0.5 opacity-60">
                  Master Profile
                </span>
              </div>
              <ChevronDown size={16} className="text-foreground-dim group-hover/profile:text-foreground transition-colors" />
            </div>
          )}
        </div>
      </div> 
      */}
      <MusicPlayer isExpanded={isExpanded} />
    </motion.div>
  );
};

const NavButton = ({ icon, label, active, onClick, expanded, badge }: any) => (
  <button
    onClick={onClick}
    className={clsx(
      "group relative flex items-center h-12 w-full rounded-2xl transition-all duration-300 outline-none",
      active
        ? "bg-accent-soft text-accent shadow-lg"
        : "text-foreground-dim hover:text-foreground hover:bg-surface-elevated",
    )}
  >
    {active && (
      <motion.div
        layoutId="activeStrip"
        className="absolute left-0 top-3 bottom-3 w-1.5 bg-accent rounded-r-full shadow-[0_0_15px_var(--color-accent-glow)]"
      />
    )}
    <div className={clsx(
        "w-[64px] flex items-center justify-center flex-shrink-0 transition-transform duration-300",
        active ? "scale-110 text-accent" : "group-hover:scale-110"
    )}>
      {icon}
    </div>
    <motion.span
      animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -10 }}
      className={clsx(
        "font-bold text-sm whitespace-nowrap tracking-tight transition-colors",
        !expanded && "hidden",
        active ? "text-foreground" : "text-foreground-muted group-hover:text-foreground"
      )}
    >
      {label}
    </motion.span>
    {badge && expanded && (
      <span className="ml-auto mr-4 bg-indigo-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-lg shadow-indigo-500/20 animate-pulse">
        {badge}
      </span>
    )}
  </button>
);
