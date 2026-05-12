import { type KemonoAlbum } from '../services/KemonoService';

const CACHE_KEY_PREFIX = 'flowmanga_discovery_';

export const discoveryCache = {
    set(category: string, albums: KemonoAlbum[]) {
        try {
            const data = JSON.stringify({
                timestamp: Date.now(),
                albums
            });
            localStorage.setItem(`${CACHE_KEY_PREFIX}${category}`, data);
        } catch (e) {
            console.warn('[DiscoveryCache] Failed to save cache:', e);
        }
    },

    get(category: string): KemonoAlbum[] | null {
        try {
            const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${category}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.albums || null;
        } catch (e) {
            return null;
        }
    }
};
