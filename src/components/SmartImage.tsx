import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';

interface SmartImageProps {
    src: string;
    alt?: string;
    className?: string;
    style?: CSSProperties;
    onLoad?: () => void;
}

export const SmartImage = ({ src, alt, className, style, onLoad }: SmartImageProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const { brightness, contrast, saturation, autoCrop } = useSettingsStore(); 

    const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setIsVisible(true);
                if (cleanupTimeoutRef.current) {
                    clearTimeout(cleanupTimeoutRef.current);
                    cleanupTimeoutRef.current = null;
                }
            } else {
                // Delayed cleanup: Keep canvas in memory for 20s after leaving viewport
                // to prevent "flashing" if the user scrolls back quickly.
                cleanupTimeoutRef.current = setTimeout(() => {
                    setIsVisible(false);
                    const canvas = canvasRef.current;
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        ctx?.clearRect(0, 0, canvas.width, canvas.height);
                    }
                }, 20000);
            }
        }, { rootMargin: '2000px' });

        if (canvasRef.current) observer.observe(canvasRef.current);
        return () => {
            observer.disconnect();
            if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        
        const img = new Image();
        img.src = src;
        img.crossOrigin = "anonymous"; 

        img.onload = () => {
            setIsLoaded(true);
            renderImage(img);
            if (onLoad) onLoad();
        };
    }, [src, isVisible]);

    useEffect(() => {
        if (isLoaded && isVisible) {
            const img = new Image();
            img.src = src;
            img.crossOrigin = "anonymous";
            img.onload = () => renderImage(img);
        }
    }, [brightness, contrast, saturation, autoCrop, isLoaded, isVisible]);

    const renderImage = (img: HTMLImageElement) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

        if (autoCrop) {
            // calculated crop
            const crop = calculateCrop(img);
            sx = crop.x;
            sy = crop.y;
            sWidth = crop.width;
            sHeight = crop.height;
        }

        // Set dimensions to the CROP size (preserving resolution)
        canvas.width = sWidth;
        canvas.height = sHeight;

        // Apply filters
        // Default values: brightness 100%, contrast 100%, saturation 100%
        const b = brightness ?? 1; // 1 = 100%
        const c = contrast ?? 1;
        const s = saturation ?? 1;

        ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
        
        // Draw the cropped portion of the image onto the full canvas
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
    };

    const calculateCrop = (img: HTMLImageElement) => {
        // Create an offscreen canvas to analyze pixels
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { x: 0, y: 0, width: img.width, height: img.height };

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Helper to check if pixel is "same" as background (assumed top-left pixel)
        // Simple tolerance check - Increased for common scan aging
        const tolerance = 40; 
        const r0 = data[0], g0 = data[1], b0 = data[2];

        const isBackground = (r: number, g: number, b: number) => {
             const diff = Math.sqrt(
                Math.pow(r - r0, 2) + 
                Math.pow(g - g0, 2) + 
                Math.pow(b - b0, 2)
             );
             return diff < tolerance;
        };

        // Scan Top
        let top = 0;
        for (let y = 0; y < canvas.height; y++) {
            let rowHasContent = false;
            for (let x = 0; x < canvas.width; x++) {
                const i = (y * canvas.width + x) * 4;
                if (!isBackground(data[i], data[i+1], data[i+2])) {
                    rowHasContent = true;
                    break;
                }
            }
            if (rowHasContent) {
                top = y;
                break;
            }
        }

        // Scan Bottom
        let bottom = canvas.height;
        for (let y = canvas.height - 1; y >= 0; y--) {
            let rowHasContent = false;
            for (let x = 0; x < canvas.width; x++) {
                const i = (y * canvas.width + x) * 4;
                if (!isBackground(data[i], data[i+1], data[i+2])) {
                    rowHasContent = true;
                    break;
                }
            }
            if (rowHasContent) {
                bottom = y + 1;
                break;
            }
        }

        // Scan Left
        let left = 0;
        for (let x = 0; x < canvas.width; x++) {
            let colHasContent = false;
            for (let y = top; y < bottom; y++) {
                const i = (y * canvas.width + x) * 4;
                if (!isBackground(data[i], data[i+1], data[i+2])) {
                    colHasContent = true;
                    break;
                }
            }
            if (colHasContent) {
                left = x;
                break;
            }
        }

        // Scan Right
        let right = canvas.width;
        for (let x = canvas.width - 1; x >= 0; x--) {
            let colHasContent = false;
            for (let y = top; y < bottom; y++) {
                const i = (y * canvas.width + x) * 4;
                if (!isBackground(data[i], data[i+1], data[i+2])) {
                    colHasContent = true;
                    break;
                }
            }
            if (colHasContent) {
                right = x + 1;
                break;
            }
        }
        
        return {
            x: left,
            y: top,
            width: Math.max(1, right - left),
            height: Math.max(1, bottom - top)
        };
    };

    return (
        <canvas 
            ref={canvasRef} 
            className={className} 
            style={style}
            role="img" 
            aria-label={alt}
        />
    );
};
