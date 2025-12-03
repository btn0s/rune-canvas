import { Transform } from "../lib/types";
import { useState, useEffect, useRef, useCallback } from "react";

interface LayerItem {
  id: string;
  name: string;
  parentId: string | null;
}

interface LayersPanelProps {
  items: LayerItem[];
  selectedIds: string[];
  transform: Transform;
  containerRef: React.RefObject<HTMLDivElement>;
  onSelect: (ids: string[] | null, addToSelection?: boolean) => void;
}

export function LayersPanel({
  items,
  selectedIds,
  transform,
  containerRef,
  onSelect,
}: LayersPanelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const [isOverlapping, setIsOverlapping] = useState(false);
  const prevItemIds = useRef<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Check if panel overlaps with any item
  const checkOverlap = useCallback(() => {
    if (!panelRef.current || !containerRef.current) return;

    const panelRect = panelRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const panelInCanvas = {
      x: (panelRect.left - containerRect.left - transform.x) / transform.scale,
      y: (panelRect.top - containerRect.top - transform.y) / transform.scale,
      width: panelRect.width / transform.scale,
      height: panelRect.height / transform.scale,
    };

    setIsOverlapping(items.length > 0);
  }, [items, transform, containerRef]);

  useEffect(() => {
    checkOverlap();
  }, [checkOverlap]);

  // Track new items for animation
  useEffect(() => {
    const currentIds = new Set(items.map((f) => f.id));
    const newIds = items
      .filter((f) => !prevItemIds.current.has(f.id))
      .map((f) => f.id);

    if (newIds.length > 0) {
      setAnimatedIds((prev) => new Set([...prev, ...newIds]));

      setTimeout(() => {
        setAnimatedIds((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 300);
    }

    prevItemIds.current = currentIds;
  }, [items]);

  // Build tree structure in z-index order (highest z-index first, children under parent)
  const buildTree = (
    allItems: LayerItem[],
    parentId: string | null = null
  ): LayerItem[] => {
    // Get siblings at this level, keep original array order (z-index)
    const siblings = allItems.filter((item) => item.parentId === parentId);
    // Reverse to show highest z-index (last in array) first
    const reversedSiblings = [...siblings].reverse();

    // For each sibling, add it followed by its children
    return reversedSiblings.flatMap((item) => [
      item,
      ...buildTree(allItems, item.id),
    ]);
  };

  // Get nesting depth
  const getDepth = (item: LayerItem): number => {
    let depth = 0;
    let currentParentId = item.parentId;
    while (currentParentId) {
      depth++;
      const parent = items.find((i) => i.id === currentParentId);
      currentParentId = parent?.parentId ?? null;
    }
    return depth;
  };

  const treeItems = buildTree(items);
  const showGlassyBg = isHovered && isOverlapping;

  return (
    <div
      ref={panelRef}
      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 -m-3 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div
        className={`
          flex flex-col transition-all duration-200 rounded-lg
          ${showGlassyBg ? "bg-zinc-900/70 backdrop-blur-sm p-2 -m-2" : ""}
        `}
        style={{
          gap: isHovered ? 4 : 3,
        }}
      >
        {treeItems.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          const isNew = animatedIds.has(item.id);
          const depth = getDepth(item);

          return (
            <div
              key={item.id}
              className={`
                relative flex items-center cursor-pointer transition-all duration-300 ease-out
                ${isHovered ? "hover:bg-zinc-700/50 rounded px-2" : ""}
              `}
              style={{
                height: isHovered ? 24 : 2,
                opacity: isNew ? 0 : 1,
                transform: isNew ? "translateX(-10px)" : "translateX(0)",
                animation: isNew
                  ? "slideIn 300ms ease-out forwards"
                  : undefined,
                paddingLeft: isHovered ? 8 + depth * 12 : depth * 4,
              }}
              onClick={(e) => {
                if (e.shiftKey) {
                  onSelect([item.id], true);
                } else {
                  onSelect([item.id]);
                }
              }}
            >
              {/* Collapsed line - width varies by depth */}
              {!isHovered && (
                <div
                  className={`
                    h-[2px] rounded-full
                    ${isSelected ? "bg-blue-400/70" : "bg-zinc-600"}
                  `}
                  style={{
                    width: depth > 0 ? 12 : 20,
                  }}
                />
              )}
              {/* Expanded name */}
              {isHovered && (
                <span
                  className={`
                    text-xs whitespace-nowrap
                    ${isSelected ? "text-blue-400" : "text-zinc-500"}
                  `}
                >
                  {item.name}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
