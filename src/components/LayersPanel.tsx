import { useState, useEffect, useRef } from "react";
import { ChevronRight, Frame, Type, Image } from "lucide-react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { SidebarMode } from "@/lib/types";

interface LayerItem {
  id: string;
  name: string;
  parentId: string | null;
  type: "frame" | "text" | "image";
}

// Icon component for layer type
function LayerTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const iconClass = className || "w-3 h-3 text-zinc-500 shrink-0";
  switch (type) {
    case "frame":
      return <Frame className={iconClass} />;
    case "text":
      return <Type className={iconClass} />;
    case "image":
      return <Image className={iconClass} />;
    default:
      return null;
  }
}

interface LayersPanelProps {
  items: LayerItem[];
  selectedIds: string[];
  onSelect: (ids: string[] | null, addToSelection?: boolean) => void;
  onHoverLayer?: (id: string | null) => void;
  sidebarMode: SidebarMode;
}

// Get children of a parent item (in reverse z-order - highest first)
function getChildren(items: LayerItem[], parentId: string): LayerItem[] {
  return [...items.filter((item) => item.parentId === parentId)].reverse();
}

// =============================================================================
// Layer Tree Item - renders a single layer with its children
// =============================================================================

function LayerTreeItem({
  item,
  items,
  depth,
  selectedIds,
  animatedIds,
  onSelect,
  onHoverLayer,
}: {
  item: LayerItem;
  items: LayerItem[];
  depth: number;
  selectedIds: string[];
  animatedIds: Set<string>;
  onSelect: (ids: string[] | null, addToSelection?: boolean) => void;
  onHoverLayer?: (id: string | null) => void;
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

  const handleMouseEnter = () => {
    onHoverLayer?.(item.id);
  };

  const handleMouseLeave = () => {
    onHoverLayer?.(null);
  };

  const rowContent = (
    <div
      className={`flex items-center h-7 cursor-pointer rounded-sm transition-colors ${
        isSelected
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
      style={{
        paddingLeft: depth * 12 + (hasKids ? 0 : 16),
        opacity: isNew ? 0 : 1,
        transform: isNew ? "translateX(-10px)" : "translateX(0)",
        animation: isNew ? "slideIn 300ms ease-out forwards" : undefined,
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Chevron for expandable items */}
      {hasKids && (
        <button
          className="w-4 h-7 flex items-center justify-center shrink-0 hover:text-foreground"
          onClick={handleChevronClick}
        >
          <ChevronRight
            className={`w-3 h-3 transition-transform duration-150 ${
              isOpen ? "rotate-90" : ""
            }`}
          />
        </button>
      )}

      {/* Icon */}
      <span className="w-4 h-7 flex items-center justify-center shrink-0">
        <LayerTypeIcon type={item.type} className="w-3 h-3" />
      </span>

      {/* Name */}
      <span className="text-xs truncate ml-1.5 pr-2">{item.name}</span>
    </div>
  );

  if (!hasKids) {
    return rowContent;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {rowContent}
      <CollapsibleContent>
        {children.map((child) => (
          <LayerTreeItem
            key={child.id}
            item={child}
            items={items}
            depth={depth + 1}
            selectedIds={selectedIds}
            animatedIds={animatedIds}
            onSelect={onSelect}
            onHoverLayer={onHoverLayer}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// Collapsed Indicator - minimal 2px bars for hide mode
// =============================================================================

function CollapsedIndicator({
  item,
  items,
  depth,
  selectedIds,
}: {
  item: LayerItem;
  items: LayerItem[];
  depth: number;
  selectedIds: string[];
}) {
  const isSelected = selectedIds.includes(item.id);
  const children = getChildren(items, item.id);

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div
        className={`h-[2px] rounded-full ${
          isSelected ? "bg-blue-400/70" : "bg-zinc-600"
        }`}
        style={{
          width: depth > 0 ? 12 : 20,
          marginRight: depth > 0 ? (depth - 1) * 4 : 0,
        }}
      />
      {children.map((child) => (
        <CollapsedIndicator
          key={child.id}
          item={child}
          items={items}
          depth={depth + 1}
          selectedIds={selectedIds}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Main LayersPanel Component
// =============================================================================

export function LayersPanel({
  items,
  selectedIds,
  onSelect,
  onHoverLayer,
  sidebarMode,
}: LayersPanelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const prevItemIds = useRef<Set<string>>(new Set());

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

  const isEmpty = items.length === 0;

  // Empty state content
  const emptyContent = (
    <span className="text-xs text-muted-foreground">No layers</span>
  );

  // ==========================================================================
  // SHOW MODE - Full height sidebar, always visible
  // ==========================================================================
  if (sidebarMode === "show") {
    return (
      <div
        className="absolute left-0 top-0 bottom-0 w-56 bg-card border-r border-border select-none flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseLeave={() => onHoverLayer?.(null)}
      >
        <div className="p-3 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">
            Layers
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-1.5 py-1">
          {isEmpty ? (
            <div className="px-1.5">{emptyContent}</div>
          ) : (
            <div className="flex flex-col">
              {rootItems.map((item) => (
                <LayerTreeItem
                  key={item.id}
                  item={item}
                  items={items}
                  depth={0}
                  selectedIds={selectedIds}
                  animatedIds={animatedIds}
                  onSelect={onSelect}
                  onHoverLayer={onHoverLayer}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // HIDE MODE - Hover-based with slide-in animation
  // ==========================================================================

  return (
    <>
      {/* Hover trigger zone with collapsed indicator */}
      <div
        className="absolute left-4 top-1/2 -translate-y-1/2 select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
      >
        {/* Collapsed indicator - layer bars (will be replaced with icon) */}
        <div
          className="flex flex-col items-end gap-0.5 p-2 transition-opacity duration-200"
          style={{ opacity: isHovered ? 0 : 1 }}
        >
          {isEmpty ? (
            <div className="h-[2px] w-4 rounded-full bg-zinc-600" />
          ) : (
            rootItems.map((item) => (
              <CollapsedIndicator
                key={item.id}
                item={item}
                items={items}
                depth={0}
                selectedIds={selectedIds}
              />
            ))
          )}
        </div>
      </div>

      {/* Panel - completely separate, slides in from left */}
      <div
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-card border border-border rounded-md p-3 select-none transition-all duration-200 ease-out"
        style={{
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? "translateX(0)" : "translateX(-8px)",
          pointerEvents: isHovered ? "auto" : "none",
          minWidth: 160,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          onHoverLayer?.(null); // Clear hover when leaving panel
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
      >
        {isEmpty ? (
          emptyContent
        ) : (
          <div className="flex flex-col">
            {rootItems.map((item) => (
              <LayerTreeItem
                key={item.id}
                item={item}
                items={items}
                depth={0}
                selectedIds={selectedIds}
                animatedIds={animatedIds}
                onSelect={onSelect}
                onHoverLayer={onHoverLayer}
              />
            ))}
          </div>
        )}
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
    </>
  );
}
