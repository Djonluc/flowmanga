import { memo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useProxiedImage } from "../../hooks/useProxiedImage";
import { List } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";

const ProxiedShelfImage = ({
  src,
  className,
  alt,
}: {
  src: string;
  className?: string;
  alt?: string;
}) => {
  const { src: proxiedSrc, handleError } = useProxiedImage(src);
  return (
    <img
      src={proxiedSrc}
      className={className}
      alt={alt}
      onError={() => handleError()}
    />
  );
};

interface ShelfViewProps {
  allSeries: any[];
  onOpenItem: (item: any) => void;
  children?: React.ReactNode;
}

const Book = memo(({ item, onClick }: { item: any; onClick: () => void }) => {
  const isSeries = "books" in item;
  const coverSrc = item?.cover
    ? item.cover.startsWith("http")
      ? item.cover
      : convertFileSrc(item.cover)
    : null;

  return (
    <motion.div
      className="relative cursor-pointer group"
      whileHover={{
        z: 50,
        rotateY: -15,
        scale: 1.1,
        y: -10,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
      style={{
        transformStyle: "preserve-3d",
        width: "140px",
        aspectRatio: "2/3",
      }}
    >
      {/* 3D Book Container */}
      <div
        className="w-full h-full relative"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front Cover */}
        <div
          className={clsx(
            "absolute inset-0 z-10 bg-surface rounded-sm overflow-hidden shadow-premium border",
            isSeries ? "border-accent/40" : "border-border-subtle",
          )}
        >
          {coverSrc ? (
            <ProxiedShelfImage
              src={coverSrc}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-foreground-dim bg-surface-elevated">
              <span className="text-xs p-2 text-center font-bold uppercase opacity-30">
                {item.title}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-tr from-background/60 via-transparent to-foreground/10" />

          {isSeries ? (
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-accent text-white text-[10px] font-bold rounded shadow-accent-glow">
              {item.books?.length || 0}
            </div>
          ) : item.meta?.chapter ? (
            <div className="absolute top-2 right-2 px-2 py-0.5 bg-background border border-border-subtle text-foreground text-[10px] font-bold rounded">
              CH {item.meta.chapter}
            </div>
          ) : null}

          {/* Progress Bar */}
          {!isSeries && item.progress && item.progress.totalPages > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-background/40 backdrop-blur-sm">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${(item.progress.currentPage / (item.progress.totalPages - 1)) * 100}%`,
                }}
                className="h-full bg-accent shadow-accent-glow"
              />
            </div>
          )}
        </div>

        {/* Book Spine (3D Depth) */}
        <div
          className={clsx(
            "absolute top-0 bottom-0 -left-4 w-4 brightness-75 rounded-l-sm shadow-inner",
            isSeries ? "bg-accent" : "bg-surface-raised",
          )}
          style={{
            transform: "rotateY(-90deg)",
            transformOrigin: "right",
            boxShadow: "inset -5px 0 10px rgba(0,0,0,0.2)",
          }}
        />

        {/* Pages Side (Right) */}
        <div
          className="absolute top-1 bottom-1 -right-1 w-1 bg-foreground/80"
          style={{
            transform: "rotateY(90deg)",
            transformOrigin: "left",
          }}
        />
      </div>

      {/* Title Tooltip on Hover */}
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-surface-raised backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none border border-border-subtle shadow-cinematic">
        {item.title}
      </div>
    </motion.div>
  );
});
Book.displayName = "Book";

const ShelfRow = memo(
  ({ index, style, shelves, onOpenItem, externalChildren }: any) => {
    if (externalChildren && index === shelves.length) {
      return <div style={style}>{externalChildren}</div>;
    }

    const shelf = shelves[index];

    return (
      <div style={style}>
        <div className="relative h-full flex flex-col justify-end pb-8">
          {/* Shelf Stand (3D Effect) */}
          <div
            className="absolute bottom-4 left-0 right-0 h-6 bg-gradient-to-b from-surface-raised to-surface border-t border-border-subtle rounded shadow-elevated"
            style={{ transform: "rotateX(45deg)", transformOrigin: "bottom" }}
          />
          <div className="absolute bottom-0 left-4 right-4 h-4 bg-background/20 blur-md rounded-full shadow-2xl" />

          <div className="flex justify-start gap-8 items-end px-4 relative z-10">
            {shelf.map((item: any, itemIdx: number) => (
              <Book
                key={`${item.id || item.path}-${index}-${itemIdx}`}
                item={item}
                onClick={() => onOpenItem(item)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  },
);
ShelfRow.displayName = "ShelfRow";

export const ShelfView = ({
  allSeries,
  onOpenItem,
  children,
}: ShelfViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Group items into rows (shelves). Calculate shelf size based on width, but shelf uses a fixed width usually.
  // Let's stick to 6 for consistency with previous implementation.
  const shelfSize = 6;
  const shelves = [];
  for (let i = 0; i < allSeries.length; i += shelfSize) {
    shelves.push(allSeries.slice(i, i + shelfSize));
  }

  // 210px for book height + 96px for gap + padding = ~340px
  const ROW_HEIGHT = 340;
  const { width, height } = size;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 px-8"
      style={{ perspective: "1000px" }}
    >
      {width > 10 && height > 10 && (
        <List
          style={{ height, width }}
          rowCount={children ? shelves.length + 1 : shelves.length}
          rowHeight={(index) => {
            if (children && index === shelves.length) return 500; // Extra space for external discoveries
            return ROW_HEIGHT;
          }}
          rowProps={{
            shelves,
            onOpenItem,
            externalChildren: children,
          }}
          rowComponent={ShelfRow}
        />
      )}
    </div>
  );
};
