import { useEffect, useRef } from 'react';
import { useAutomationStore } from '../stores/useAutomationStore';

export const AutomationManager = () => {
    const { isEnabled, checkIntervalMinutes, checkForUpdates, lastCheckTime } = useAutomationStore();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isEnabled) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        // Logic to determine when to run the next check
        const runCheckIfNeeded = async () => {
            const now = Date.now();
            const intervalMs = checkIntervalMinutes * 60 * 1000;
            const timeSinceLast = lastCheckTime ? now - lastCheckTime : Infinity;

            if (timeSinceLast >= intervalMs) {
                await checkForUpdates();
            }
        };

        // Initial check on mount/enable
        runCheckIfNeeded();

        // Setup interval (check every minute if we need to run the full update check)
        timerRef.current = setInterval(runCheckIfNeeded, 60000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isEnabled, checkIntervalMinutes, lastCheckTime, checkForUpdates]);

    return null; // Logic only component
};
