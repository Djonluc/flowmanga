import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

import { useSettingsStore } from '../stores/useSettingsStore';
import { useModalStore } from '../stores/useModalStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useReadingStore } from '../stores/useReadingStore';
import clsx from 'clsx';
import { ToastContainer } from './Toast';
import { ShortcutsGuide } from './ShortcutsGuide';
import { ShortcutsManager } from './ShortcutsManager';
import { CommandPalette } from './CommandPalette';
import { DownloadPanel } from './DownloadPanel';
import { DownloadIndicator } from './DownloadIndicator';
import { AutomationManager } from './AutomationManager';
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
import { ErrorBoundary } from './shared/ErrorBoundary';
import { ImageViewer } from './gallery/ImageViewer';
import { SlideshowPlayer } from './gallery/SlideshowPlayer';

interface LayoutProps {
    children: ReactNode;
    hideSidebar?: boolean;
}

export const Layout = ({ children, hideSidebar = false }: LayoutProps) => {
    const { 
        theme, 
        isScreenshotMode, 
        zoomScale, 
        activeView 
    } = useSettingsStore();
    
    const { 
        isImportModalOpen, closeImportModal,
        isTagManagerOpen, tagManagerSeriesId, tagManagerInitialTags, closeTagManager,
        isInputModalOpen, inputModalConfig, closeInputModal,
        isDeleteModalOpen, deleteModalConfig, closeDeleteModal
    } = useModalStore();

    const { deleteSeries, addMangaFolder } = useLibraryStore();
    const { images, currentPageIndex } = useReadingStore();

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

    // Calculate effective hide sidebar logic
    const shouldHideSidebar = hideSidebar || images.length > 0;

    return (
        <div 
            id="flowmanga-layout-root"
            className={clsx(
                "w-screen text-foreground transition-colors duration-500 relative flex flex-row",
                images.length === 0 ? "bg-background" : "bg-transparent",
                isScreenshotMode ? "h-auto min-h-screen overflow-visible" : "h-screen overflow-hidden"
            )}
            data-theme={theme}
        >
            {/* Global Services & Master Controllers */}
            <CommandPalette />
            <ShortcutsManager />
            <ShortcutsGuide />
            <ToastContainer />
            <DownloadPanel />
            <DownloadIndicator />
            <AutomationManager />
            <SettingsModal />
            <QuickViewModal />

            {/* V3 Modals */}
            <ImportModal 
                isOpen={isImportModalOpen} 
                onClose={closeImportModal} 
                onImportFolder={handleImportFolder} 
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
                    initialValue={inputModalConfig.initialValue}
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
                        const targetId = deleteModalConfig.id;
                        await deleteSeries(targetId, deleteModalConfig.path, deleteFiles);
                        if (useLibraryStore.getState().selectedSeriesId === targetId) {
                            useLibraryStore.getState().setSelectedSeriesId(null);
                        }
                        closeDeleteModal();
                    }}
                />
            )}

            <FilterModal />
            <NotificationCenter />
            <ProfilePanel />

            {/* Core Application Structure */}
            {!shouldHideSidebar && <Sidebar />}

            <main 
                id="main-viewport"
                className={clsx(
                    "flex-1 flex flex-col min-w-0 transition-all duration-700 ease-in-out relative origin-top-left",
                    !shouldHideSidebar && "my-2 mr-2 md:my-4 md:mr-4 rounded-2xl md:rounded-[32px] bg-surface glass-panel shadow-cinematic overflow-hidden"
                )}
                style={{ 
                    // Native zoom is handled at the window level in App.tsx
                }}
            >
                {!shouldHideSidebar && <TopBar />}
                
                <div 
                    className={clsx(
                        "flex-1 relative bg-transparent",
                        !isScreenshotMode && "overflow-hidden"
                    )}
                >
                    <ErrorBoundary key={activeView}>
                        {children}
                    </ErrorBoundary>
                </div>
            </main>

            {/* Gallery Ecosystem Overlays */}
            <ImageViewer />
            <SlideshowPlayer />
        </div>
    );
};
