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
    const interval = setInterval(loadRecentHistory, 60000); // Reduced from 10s to 60s
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
      label: "Image Collections",
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
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-[12px] md:rounded-[14px] flex items-center justify-center flex-shrink-0 bg-transparent overflow-hidden drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]">
            <img src="/logo.png" alt="FlowManga" className="w-full h-full object-contain scale-[1.35]" />
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
