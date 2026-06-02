import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AutomationService } from '../services/AutomationService'; 
import { useLibraryStore } from './useLibraryStore';
import { toast } from '../components/Toast';

interface AutomationState {
    isEnabled: boolean;
    checkIntervalMinutes: number;
    lastCheckTime: number | null;
    isChecking: boolean;
    updateQueue: any[]; // List of series with updates found
    
    // Actions
    setEnabled: (enabled: boolean) => void;
    setCheckInterval: (mins: number) => void;
    checkForUpdates: () => Promise<void>;
    clearUpdates: () => void;
}

export const useAutomationStore = create<AutomationState>()(
    persist(
        (set, get) => ({
            isEnabled: true,
            checkIntervalMinutes: 60, // Default 1 hour
            lastCheckTime: null,
            isChecking: false,
            updateQueue: [],

            setEnabled: (enabled) => set({ isEnabled: enabled }),
            setCheckInterval: (mins) => set({ checkIntervalMinutes: mins }),

            checkForUpdates: async () => {
                if (get().isChecking) return;
                
                const { series } = useLibraryStore.getState();
                if (series.length === 0) return;

                set({ isChecking: true });
                console.log('[Automation] Starting background update check...');

                const updatesFound: any[] = [];
                
                try {
                    // We only check series that have a source and seriesUrl/mangaId
                    const checkableSeries = series.filter(s => s.seriesUrl || s.mangaId);
                    
                    for (const s of checkableSeries) {
                        if (!get().isEnabled) {
                            console.log('[Automation] Update check aborted because automation was disabled.');
                            break;
                        }
                        try {
                            // Check logic
                            const hasUpdate = await AutomationService.checkSeriesForUpdates(s);
                            if (hasUpdate) {
                                updatesFound.push(s);
                                console.log(`[Automation] Update found for: ${s.title}`);
                            }
                            // Stagger checks to avoid rate limiting and UI thread congestion
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } catch (e) {
                            console.warn(`[Automation] Failed to check ${s.title}:`, e);
                        }
                    }

                    if (updatesFound.length > 0) {
                        set({ updateQueue: [...get().updateQueue, ...updatesFound] });
                        toast.info(`Found updates for ${updatesFound.length} series!`, {
                            description: updatesFound.map(u => u.title).join(', ')
                        });
                    }

                    set({ lastCheckTime: Date.now() });
                } catch (e) {
                    console.error('[Automation] Batch check failed:', e);
                } finally {
                    set({ isChecking: false });
                }
            },

            clearUpdates: () => set({ updateQueue: [] }),
        }),
        {
            name: 'automation-storage',
            partialize: (state) => ({ 
                isEnabled: state.isEnabled, 
                checkIntervalMinutes: state.checkIntervalMinutes,
                lastCheckTime: state.lastCheckTime
            }),
        }
    )
);
