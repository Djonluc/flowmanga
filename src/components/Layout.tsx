import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useSettingsStore } from '../stores/useSettingsStore';
import { ToastContainer } from './Toast';
import { ShortcutsGuide } from './ShortcutsGuide';
import { ShortcutsManager } from './ShortcutsManager';
import { CommandPalette } from './CommandPalette';
import { DownloadPanel } from './DownloadPanel';
import { DownloadIndicator } from './DownloadIndicator';
import { SettingsModal } from './settings/SettingsModal';

interface LayoutProps {
    children: ReactNode;
    hideSidebar?: boolean;
}

export const Layout = ({ children, hideSidebar = false }: LayoutProps) => {
    const { theme } = useSettingsStore();

    return (
        <div 
            className="h-screen w-screen overflow-hidden bg-transparent text-foreground transition-colors duration-300 relative flex flex-row" 
            data-theme={theme}
        >
            {/* Global Systems */}
            <CommandPalette />
            <ShortcutsManager />
            <ShortcutsGuide />
            <ToastContainer />
            <DownloadPanel />
            <DownloadIndicator />
            <SettingsModal />

            {/* V3 Layout Roots */}
            
            {/* 1. Sidebar */}
            {!hideSidebar && <Sidebar />}

            {/* 2. Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
                <TopBar />
                
                <main className="flex-1 relative overflow-hidden bg-transparent pb-20 md:pb-0">
                    {children}
                </main>
            </div>
        </div>
    );
};
