import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

import { useSettingsStore } from '../stores/useSettingsStore';
import { useModalStore } from '../stores/useModalStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { ToastContainer } from './Toast';
import { ShortcutsGuide } from './ShortcutsGuide';
import { ShortcutsManager } from './ShortcutsManager';
import { CommandPalette } from './CommandPalette';
import { DownloadPanel } from './DownloadPanel';
import { DownloadIndicator } from './DownloadIndicator';
import { SettingsModal } from './settings/SettingsModal';
import { QuickViewModal } from './settings/QuickViewModal';

// V3 Modals
import { ImportModal } from './ImportModal';
import { TagManagerModal } from './library/TagManagerModal';
import { InputModal } from './InputModal';
import { DeleteConfirmModal } from './library/DeleteConfirmModal';
import { FilterModal } from './modals/FilterModal';
import { NotificationCenter } from './modals/NotificationCenter';
import { ProfilePanel } from './modals/ProfilePanel';

interface LayoutProps {
    children: ReactNode;
    hideSidebar?: boolean;
}

export const Layout = ({ children, hideSidebar = false }: LayoutProps) => {
    const { theme } = useSettingsStore();
    const { 
        isImportModalOpen, closeImportModal,
        isTagManagerOpen, tagManagerSeriesId, tagManagerInitialTags, closeTagManager,
        isInputModalOpen, inputModalConfig, closeInputModal,
        isDeleteModalOpen, deleteModalConfig, closeDeleteModal
    } = useModalStore();

    const { deleteSeries, addMangaFolder } = useLibraryStore();

    const handleImportFolder = async () => {
        const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
        const selected = await openDialog({ directory: true, multiple: false });
        if (selected && typeof selected === 'string') {
            try {
                await addMangaFolder(selected);
            } catch (err) {
                console.error('[Layout] Failed to add folder:', err);
            }
        }
    };

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
            <QuickViewModal />

            {/* V3 Modals Managed by useModalStore */}
            <ImportModal 
                isOpen={isImportModalOpen} 
                onClose={closeImportModal} 
                onImportFolder={handleImportFolder} 
                onImportWeb={(url) => {}} 
            />

            {tagManagerSeriesId && (
                <TagManagerModal 
                    isOpen={isTagManagerOpen}
                    seriesId={tagManagerSeriesId}
                    initialTags={tagManagerInitialTags}
                    onClose={closeTagManager}
                />
            )}

            {inputModalConfig && (
                <InputModal 
                    isOpen={isInputModalOpen}
                    title={inputModalConfig.title}
                    placeholder={inputModalConfig.placeholder}
                    description={inputModalConfig.description}
                    onClose={closeInputModal}
                    onSubmit={inputModalConfig.onSubmit}
                />
            )}

            {deleteModalConfig && (
                <DeleteConfirmModal 
                    isOpen={isDeleteModalOpen}
                    title={deleteModalConfig.title}
                    itemCount={deleteModalConfig.count}
                    isSeries={deleteModalConfig.isSeries}
                    onClose={closeDeleteModal}
                    onConfirm={async (deleteFiles) => {
                        await deleteSeries(deleteModalConfig.id, deleteModalConfig.path, deleteFiles);
                        closeDeleteModal();
                    }}
                />
            )}

            <FilterModal />
            <NotificationCenter />
            <ProfilePanel />

            {/* 1. Sidebar */}
            {!hideSidebar && <Sidebar />}

            {/* 2. Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-[calc(100vh-2rem)] my-4 mr-4 rounded-[32px] glass-panel shadow-cinematic overflow-hidden relative">
                <TopBar />
                
                <main className="flex-1 relative overflow-hidden bg-transparent">
                    {children}
                </main>
            </div>

            {/* 3. Bottom Player Bar */}

        </div>
    );
};
