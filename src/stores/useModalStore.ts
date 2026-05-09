import { create } from 'zustand';

interface InputModalConfig {
    title: string;
    placeholder?: string;
    description?: string;
    initialValue?: string;
    onSubmit: (value: string) => void;
}

interface DeleteModalConfig {
    id: string;
    path: string;
    title: string;
    count: number;
    isSeries: boolean;
}

interface ModalState {
    // Import Modal
    isImportModalOpen: boolean;
    openImportModal: (url?: string) => void;
    closeImportModal: () => void;

    // Tag Manager Modal
    isTagManagerOpen: boolean;
    tagManagerSeriesId: string | null;
    tagManagerInitialTags: string[];
    openTagManager: (seriesId: string, tags: string[]) => void;
    closeTagManager: () => void;

    // Input Modal
    isInputModalOpen: boolean;
    inputModalConfig: InputModalConfig | null;
    openInputModal: (config: InputModalConfig) => void;
    closeInputModal: () => void;

    // Delete Modal
    isDeleteModalOpen: boolean;
    deleteModalConfig: DeleteModalConfig | null;
    openDeleteModal: (config: DeleteModalConfig) => void;
    closeDeleteModal: () => void;

    // Quick View Modal
    quickViewItem: any | null;
    openQuickView: (item: any) => void;
    closeQuickView: () => void;

    // Filter Modal
    isFilterModalOpen: boolean;
    openFilterModal: () => void;
    closeFilterModal: () => void;

    // Notification Center
    isNotificationCenterOpen: boolean;
    openNotificationCenter: () => void;
    closeNotificationCenter: () => void;

    // Profile Panel
    isProfilePanelOpen: boolean;
    openProfilePanel: () => void;
    closeProfilePanel: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
    // Import Modal
    isImportModalOpen: false,
    openImportModal: (url) => {
        if (url) {
            // Optional: set URL in ScraperStore if needed, 
            // but the modal usually handles its own URL state or takes it from ScraperStore
        }
        set({ isImportModalOpen: true });
    },
    closeImportModal: () => set({ isImportModalOpen: false }),

    // Tag Manager Modal
    isTagManagerOpen: false,
    tagManagerSeriesId: null,
    tagManagerInitialTags: [],
    openTagManager: (seriesId, tags) => set({ 
        isTagManagerOpen: true, 
        tagManagerSeriesId: seriesId, 
        tagManagerInitialTags: tags 
    }),
    closeTagManager: () => set({ isTagManagerOpen: false, tagManagerSeriesId: null, tagManagerInitialTags: [] }),

    // Input Modal
    isInputModalOpen: false,
    inputModalConfig: null,
    openInputModal: (config) => set({ isInputModalOpen: true, inputModalConfig: config }),
    closeInputModal: () => set({ isInputModalOpen: false, inputModalConfig: null }),

    // Delete Modal
    isDeleteModalOpen: false,
    deleteModalConfig: null,
    openDeleteModal: (config) => set({ isDeleteModalOpen: true, deleteModalConfig: config }),
    closeDeleteModal: () => set({ isDeleteModalOpen: false, deleteModalConfig: null }),

    // Quick View Modal
    quickViewItem: null,
    openQuickView: (item) => set({ quickViewItem: item }),
    closeQuickView: () => set({ quickViewItem: null }),

    // Filter Modal
    isFilterModalOpen: false,
    openFilterModal: () => set({ isFilterModalOpen: true }),
    closeFilterModal: () => set({ isFilterModalOpen: false }),

    // Notification Center
    isNotificationCenterOpen: false,
    openNotificationCenter: () => set({ isNotificationCenterOpen: true }),
    closeNotificationCenter: () => set({ isNotificationCenterOpen: false }),

    // Profile Panel
    isProfilePanelOpen: false,
    openProfilePanel: () => set({ isProfilePanelOpen: true }),
    closeProfilePanel: () => set({ isProfilePanelOpen: false }),
}));
