import { Transform } from "../lib/types";
import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  debug?: boolean;
}

// Get children of a parent item (in reverse z-order - highest first)
function getChildren(items: LayerItem[], parentId: string): LayerItem[] {
  return [...items.filter((item) => item.parentId === parentId)].reverse();
}

function LayerTreeItem({
  item,
  items,
  depth,
  isHovered,
  selectedIds,
  animatedIds,
  onSelect,
}: {
  item: LayerItem;
  items: LayerItem[];
  depth: number;
  isHovered: boolean;
  selectedIds: string[];
  animatedIds: Set<string>;
  onSelect: (ids: string[] | null, addToSelection?: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = selectedIds.includes(item.id);
  const isNew = animatedIds.has(item.id);
  const children = getChildren(items, item.id);
  const hasKids = children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      onSelect([item.id], true);
    } else {
      onSelect([item.id]);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  if (!hasKids) {
    return (
      <div
        className={`
          relative flex items-center cursor-pointer transition-all duration-300 ease-out
          ${isHovered ? "hover:bg-zinc-700/50 rounded" : "justify-end"}
        `}
        style={{
          height: isHovered ? 24 : 2,
          opacity: isNew ? 0 : 1,
          transform: isNew ? "translateX(-10px)" : "translateX(0)",
          animation: isNew ? "slideIn 300ms ease-out forwards" : undefined,
          paddingLeft: isHovered ? 8 + depth * 16 : 0,
          paddingRight: isHovered ? 8 : depth > 0 ? (depth - 1) * 4 : 0,
          width: isHovered ? "auto" : 24,
        }}
        onClick={handleClick}
      >
        {!isHovered && (
          <div
            className={`h-[2px] rounded-full ${
              isSelected ? "bg-blue-400/70" : "bg-zinc-600"
            }`}
            style={{ width: depth > 0 ? 12 : 20 }}
          />
        )}
        {isHovered && (
          <span
            className={`text-xs whitespace-nowrap ${
              isSelected ? "text-blue-400" : "text-zinc-500"
            }`}
          >
            {item.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={`
          relative flex items-center cursor-pointer transition-all duration-300 ease-out
          ${isHovered ? "hover:bg-zinc-700/50 rounded" : "justify-end"}
        `}
        style={{
          height: isHovered ? 24 : 2,
          opacity: isNew ? 0 : 1,
          transform: isNew ? "translateX(-10px)" : "translateX(0)",
          animation: isNew ? "slideIn 300ms ease-out forwards" : undefined,
          paddingLeft: isHovered ? 8 + depth * 16 : 0,
          paddingRight: isHovered ? 8 : depth > 0 ? (depth - 1) * 4 : 0,
          width: isHovered ? "auto" : 24,
        }}
        onClick={handleClick}
      >
        {!isHovered && (
          <div
            className={`h-[2px] rounded-full ${
              isSelected ? "bg-blue-400/70" : "bg-zinc-600"
            }`}
            style={{ width: depth > 0 ? 12 : 20 }}
          />
        )}
        {isHovered && (
          <>
            <CollapsibleTrigger asChild onClick={handleChevronClick}>
              <button className="p-0.5 -ml-1 mr-1 hover:bg-zinc-600/50 rounded transition-colors">
                <ChevronRight
                  className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            <span
              className={`text-xs whitespace-nowrap ${
                isSelected ? "text-blue-400" : "text-zinc-500"
              }`}
            >
              {item.name}
            </span>
          </>
        )}
      </div>
      <CollapsibleContent>
        <div
          className={`flex flex-col ${!isHovered ? "items-end" : ""}`}
          style={{ gap: isHovered ? 4 : 2, paddingTop: isHovered ? 4 : 2 }}
        >
          {children.map((child) => (
            <LayerTreeItem
              key={child.id}
              item={child}
              items={items}
              depth={depth + 1}
              isHovered={isHovered}
              selectedIds={selectedIds}
              animatedIds={animatedIds}
              onSelect={onSelect}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function LayersPanel({
  items,
  selectedIds,
  transform,
  containerRef,
  onSelect,
  debug = false,
}: LayersPanelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const [isOverlapping, setIsOverlapping] = useState(false);
  const [minHeight, setMinHeight] = useState<number>(0);
  const prevItemIds = useRef<Set<string>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Check if panel overlaps with any item
  const checkOverlap = useCallback(() => {
    setIsOverlapping(items.length > 0);
  }, [items]);

  useEffect(() => {
    checkOverlap();
  }, [checkOverlap]);

  // Track and lock height while hovered using RAF for performance
  useEffect(() => {
    if (!isHovered) {
      setMinHeight(0);
      return;
    }

    let rafId: number;
    let isRunning = true;

    const measureHeight = () => {
      if (!isRunning) return;

      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setMinHeight((prev) => Math.max(prev, rect.height));
      }

      rafId = requestAnimationFrame(measureHeight);
    };

    // Start RAF loop
    rafId = requestAnimationFrame(measureHeight);

    return () => {
      isRunning = false;
      cancelAnimationFrame(rafId);
    };
  }, [isHovered]);

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

  // Get root items (in reverse z-order - highest first)
  const rootItems = [
    ...items.filter((item) => item.parentId === null),
  ].reverse();
  const showGlassyBg = isHovered && isOverlapping;

  return (
    <div
      ref={wrapperRef}
      className="absolute left-4 top-1/2 -translate-y-1/2 select-none flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      style={{
        // Use min-height to prevent shrinking while hovered
        minHeight: isHovered && minHeight > 0 ? minHeight : undefined,
      }}
    >
      {/* Debug hitbox visualization */}
      {debug && (
        <div
          className="absolute border-2 border-dashed border-red-500/50 bg-red-500/10 pointer-events-none rounded"
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      )}
      <div
        ref={contentRef}
        className={`
          flex flex-col transition-all duration-200 rounded-lg p-3
          ${showGlassyBg ? "bg-zinc-900/70 backdrop-blur-sm" : ""}
          ${!isHovered ? "items-end" : ""}
        `}
        style={{ gap: isHovered ? 4 : 2 }}
      >
        {rootItems.map((item) => (
          <LayerTreeItem
            key={item.id}
            item={item}
            items={items}
            depth={0}
            isHovered={isHovered}
            selectedIds={selectedIds}
            animatedIds={animatedIds}
            onSelect={onSelect}
          />
        ))}
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
