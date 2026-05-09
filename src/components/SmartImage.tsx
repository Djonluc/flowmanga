import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

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

    function calculateCrop(img: HTMLImageElement) {
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
    }

    function renderImage(img: HTMLImageElement) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

        if (autoCrop) {
            const crop = calculateCrop(img);
            sx = crop.x;
            sy = crop.y;
            sWidth = crop.width;
            sHeight = crop.height;
        }

        canvas.width = sWidth;
        canvas.height = sHeight;

        const b = brightness ?? 1;
        const c = contrast ?? 1;
        const s = saturation ?? 1;

        ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
    }

    const needsCanvas = brightness !== 1 || contrast !== 1 || saturation !== 1 || autoCrop;
    const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setIsVisible(true);
                if (cleanupTimeoutRef.current) {
                    clearTimeout(cleanupTimeoutRef.current);
                    cleanupTimeoutRef.current = null;
                }
            } else {
                // Delayed cleanup: Keep in memory for 10s after leaving viewport
                cleanupTimeoutRef.current = setTimeout(() => {
                    setIsVisible(false);
                    setIsLoaded(false);
                    setImgElement(null);
                    const canvas = canvasRef.current;
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        ctx?.clearRect(0, 0, canvas.width, canvas.height);
                        // Force resize to 1x1 to free memory
                        canvas.width = 1;
                        canvas.height = 1;
                    }
                }, 10000);
            }
        }, { rootMargin: '1000px' });

        const target = canvasRef.current || document.getElementById(`img-${src}`);
        if (target) observer.observe(target);
        return () => {
            observer.disconnect();
            if (cleanupTimeoutRef.current) clearTimeout(cleanupTimeoutRef.current);
        };
    }, [src, needsCanvas]);

    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        if (!isVisible || hasError || isLoaded) return;
        
        const img = new Image();
        img.src = src;
        img.crossOrigin = "anonymous"; 

        img.onload = () => {
            setIsLoaded(true);
            setImgElement(img);
            if (needsCanvas) {
                renderImage(img);
            }
            if (onLoad) onLoad();
        };

        img.onerror = () => {
            console.error(`[SmartImage] Failed to load: ${src}`);
            setHasError(true);
        };
    }, [src, isVisible, hasError, needsCanvas]);

    useEffect(() => {
        if (isLoaded && isVisible && !hasError && needsCanvas && imgElement) {
            renderImage(imgElement);
        }
    }, [brightness, contrast, saturation, autoCrop, isLoaded, isVisible, hasError, needsCanvas, imgElement]);

    if (hasError) {
        return (
            <div 
                className={clsx(className, "flex flex-col items-center justify-center bg-[#0a0a0b] border border-white/5 rounded-2xl gap-4 p-8")}
                style={{ ...style, minHeight: '400px' }}
            >
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                    <AlertTriangle size={32} />
                </div>
                <div className="text-center">
                    <p className="text-white font-black uppercase italic tracking-tighter text-lg">Page Load Failed</p>
                    <p className="text-neutral-500 text-xs mt-1 max-w-[200px]">The image file could not be read or is missing from disk.</p>
                </div>
                <button 
                    onClick={() => setHasError(false)}
                    className="mt-2 px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/10"
                >
                    Retry Loading
                </button>
            </div>
        );
    }

    if (!needsCanvas) {
        return (
            <img 
                id={`img-${src}`}
                src={isVisible ? src : ''} 
                alt={alt} 
                className={clsx(className, !isLoaded && "opacity-0")}
                style={{ ...style, transition: 'opacity 0.5s ease-in-out' }}
                onLoad={() => setIsLoaded(true)}
                loading="lazy"
            />
        );
    }

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
