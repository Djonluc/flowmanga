import { MangaCard } from './MangaCard';
import clsx from 'clsx';
import { FolderOpen } from 'lucide-react';

interface GridViewProps {
    items: any[];
    onOpenItem: (item: any) => void;
    onMenuClick?: (item: any, action?: 'rename' | 'delete' | 'tag', e?: React.MouseEvent) => void;
    density: 'compact' | 'comfortable' | 'cinematic';
    isSelectionMode?: boolean;
    selectedIds?: Set<string>;
}

export const GridView = ({ items, onOpenItem, onMenuClick, density, isSelectionMode, selectedIds }: GridViewProps) => {
    
    // Determine grid columns based on density
    const gridCols = {
        compact: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
        comfortable: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
        cinematic: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    }[density];

    const gap = {
        compact: "gap-4",
        comfortable: "gap-6",
        cinematic: "gap-8"
    }[density];

    if (items.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 text-foreground-dim">
                <FolderOpen size={48} className="mb-4 opacity-50" />
                <p>No items found.</p>
            </div>
        );
    }

    return (
        <div className={clsx(
            "p-8",
            "grid", gridCols, gap
        )}>
            {items.map((item, i) => (
                <MangaCard 
                    key={`${item.id || i}-${i}`} 
                    item={item} 
                    onClick={() => onOpenItem(item)}
                    onMenuClick={(e, action) => onMenuClick ? onMenuClick(item, action, e) : undefined}
                    density={density}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds?.has(item.id)}
                />
            ))}
            
            {/* Spacer for bottom scrolling */}
            <div className="h-32 col-span-full" />
        </div>
    );
};
