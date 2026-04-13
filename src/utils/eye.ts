/**
 * "Eye of the Reader" - Dominant Color Extraction Utility
 * Extracts a "mood" color from an image to power the adaptive UI.
 */

export interface MoodColor {
    r: number;
    g: number;
    b: number;
    hex: string;
}

export const extractMoodColor = (img: HTMLImageElement): MoodColor | null => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Use a small sampling size for performance
    const sampleSize = 50;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imageData.data;

    // Sampling Strategy: 10x10 Grid
    const step = Math.floor(sampleSize / 10);
    const colorCounts: Record<string, { r: number, g: number, b: number, count: number, vibrancy: number }> = {};

    for (let y = 0; y < sampleSize; y += step) {
        for (let x = 0; x < sampleSize; x += step) {
            const i = (y * sampleSize + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Filter out neutral colors (pure whites, blacks, grays)
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const diff = max - min;
            
            // Neutrals have very low difference between R, G, B
            const isNeutral = diff < 20 || (max > 245) || (max < 15);
            if (isNeutral) continue;

            const key = `${Math.floor(r/10)*10},${Math.floor(g/10)*10},${Math.floor(b/10)*10}`;
            if (!colorCounts[key]) {
                colorCounts[key] = { r, g, b, count: 1, vibrancy: diff };
            } else {
                colorCounts[key].count++;
            }
        }
    }

    const candidates = Object.values(colorCounts);
    if (candidates.length === 0) {
        // Fallback to top-left if everything is neutral (e.g. pure white page)
        return { r: data[0], g: data[1], b: data[2], hex: '#000000' };
    }

    // Sort by a combination of frequency and vibrancy
    candidates.sort((a, b) => (b.count * b.vibrancy) - (a.count * a.vibrancy));
    
    const best = candidates[0];
    const toHex = (c: number) => c.toString(16).padStart(2, '0');
    
    return {
        r: best.r,
        g: best.g,
        b: best.b,
        hex: `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`
    };
};
