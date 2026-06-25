import { memo, useRef, useState, useEffect } from "react";
import { MangaCard } from "./MangaCard";
import { FolderOpen } from "lucide-react";
import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";

interface GridViewProps {
  items: any[];
  onOpenItem: (item: any) => void;
  onMenuClick?: (
    item: any,
    action?: "rename" | "delete" | "tag",
    e?: React.MouseEvent,
  ) => void;
  density: "compact" | "comfortable" | "cinematic";
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  children?: React.ReactNode;
}

const getColumnCount = (width: number, density: string) => {
  if (density === "compact") {
    if (width >= 1280) return 10;
    if (width >= 1024) return 8;
    if (width >= 768) return 6;
    if (width >= 640) return 4;
    return 3;
  } else if (density === "comfortable") {
    if (width >= 1280) return 6;
    if (width >= 1024) return 5;
    if (width >= 768) return 4;
    if (width >= 640) return 3;
    return 2;
  } else {
    // cinematic
    if (width >= 1024) return 4;
    if (width >= 768) return 3;
    if (width >= 640) return 2;
    return 1;
  }
};

const getGap = (density: string) => {
  if (density === "compact") return 16;
  if (density === "comfortable") return 24;
  return 32;
};

const Row = memo(
  ({
    index,
    style,
    items,
    cols,
    gap,
    itemWidth,
    onOpenItem,
    onMenuClick,
    density,
    isSelectionMode,
    selectedIds,
    externalChildren,
  }: any) => {
    // Render the extra row for external discoveries if it exists
    if (externalChildren && index === Math.ceil(items.length / cols)) {
      return <div style={style}>{externalChildren}</div>;
    }

    const startIndex = index * cols;
    const rowItems = items.slice(startIndex, startIndex + cols);

    return (
      <div
        style={{
          ...style,
          display: "flex",
          gap: `${gap}px`,
          padding: `0 32px`,
        }}
      >
        {rowItems.map((item: any, i: number) => (
          <div
            key={item.id || `${index}-${i}`}
            style={{ width: `${itemWidth}px` }}
          >
            <MangaCard
              item={item}
              onClick={() => onOpenItem(item)}
              onMenuClick={(e, action) =>
                onMenuClick ? onMenuClick(item, action, e) : undefined
              }
              density={density}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds?.has(item.id)}
            />
          </div>
        ))}
      </div>
    );
  },
);
Row.displayName = "Row";

export const GridView = ({
  items,
  onOpenItem,
  onMenuClick,
  density,
  isSelectionMode,
  selectedIds,
  children,
}: GridViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      // Ensure width is at least 1 so calculations don't divide by zero
      setSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-12 text-foreground-dim">
        <FolderOpen size={48} className="mb-4 opacity-50" />
        <p>No items found.</p>
      </div>
    );
  }

  const { width, height } = size;
  const cols = getColumnCount(width, density);
  const gap = getGap(density);
  const usableWidth = Math.max(0, width - 64); // 32px padding on each side
  const itemWidth = Math.max(0, (usableWidth - (cols - 1) * gap) / cols);

  let baseRowHeight = 0;
  if (density === "compact") {
    baseRowHeight = 96 + gap;
  } else {
    baseRowHeight = itemWidth * 1.5 + 60 + gap;
  }
  baseRowHeight = Math.max(100, baseRowHeight);

  const rowCount = Math.ceil(items.length / cols);
  const totalRowCount = children ? rowCount + 1 : rowCount;

  return (
    <div ref={containerRef} className="absolute inset-0">
      {width > 10 && height > 10 && (
        <List
          style={{ height, width }}
          rowCount={totalRowCount}
          rowHeight={(index) => {
            if (children && index === rowCount) {
              return 500;
            }
            return baseRowHeight;
          }}
          rowProps={{
            items,
            cols,
            gap,
            itemWidth,
            onOpenItem,
            onMenuClick,
            density,
            isSelectionMode,
            selectedIds,
            externalChildren: children,
          }}
          rowComponent={Row}
        />
      )}
    </div>
  );
};
