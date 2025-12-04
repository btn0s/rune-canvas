# Layers Panel: Advanced Features

## Priority: 🟡 Medium
## Difficulty: Medium
## Estimated Time: 3-4 hours

## Prerequisites

- [x] Basic layers panel exists
- [ ] #02 - Layers panel shows all objects (complete this first)

## Features to Add

### 1. Visibility Toggle (Eye Icon)

Each layer should have an eye icon to toggle visibility.

```typescript
// types.ts - add to BaseObject
visible: boolean; // defaults to true
```

```tsx
// LayersPanel.tsx
<IconButton
  onClick={(e) => {
    e.stopPropagation();
    onToggleVisibility(item.id);
  }}
>
  {item.visible ? <Eye size={12} /> : <EyeOff size={12} />}
</IconButton>
```

### 2. Lock Toggle (Lock Icon)

Locked objects can't be selected or moved.

```typescript
// types.ts - add to BaseObject
locked: boolean; // defaults to false
```

Update hit testing to skip locked objects:
```typescript
// Canvas.tsx - hitTestObject
const hitTestObject = (canvasX, canvasY) => {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (obj.locked) continue; // Skip locked objects
    // ... rest of hit test
  }
};
```

### 3. Drag to Reorder

Allow dragging layers to change z-order and reparenting.

```tsx
// LayersPanel.tsx
import { useSortable } from "@dnd-kit/sortable";

function DraggableLayerItem({ item, ... }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      {/* Layer content */}
    </div>
  );
}
```

Reorder handler:
```typescript
// useCanvas.ts
const reorderObjects = useCallback((activeId: string, overId: string, position: "before" | "after" | "inside") => {
  pushHistory();
  setObjects(prev => {
    const activeIndex = prev.findIndex(o => o.id === activeId);
    const overIndex = prev.findIndex(o => o.id === overId);
    
    if (position === "inside") {
      // Reparent: make active a child of over
      return prev.map(o => 
        o.id === activeId ? { ...o, parentId: overId } : o
      );
    }
    
    // Reorder: move active before/after over
    const newObjects = [...prev];
    const [removed] = newObjects.splice(activeIndex, 1);
    const targetIndex = position === "before" ? overIndex : overIndex + 1;
    newObjects.splice(activeIndex < overIndex ? targetIndex - 1 : targetIndex, 0, removed);
    
    return newObjects;
  });
}, [pushHistory]);
```

### 4. Inline Rename

Double-click layer name to edit.

```tsx
// LayersPanel.tsx
const [editingId, setEditingId] = useState<string | null>(null);

// In LayerTreeItem
{editingId === item.id ? (
  <input
    autoFocus
    defaultValue={item.name}
    onBlur={(e) => {
      onRename(item.id, e.target.value);
      setEditingId(null);
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        onRename(item.id, e.currentTarget.value);
        setEditingId(null);
      }
      if (e.key === "Escape") {
        setEditingId(null);
      }
    }}
    className="bg-transparent border border-blue-500 rounded px-1 text-xs"
  />
) : (
  <span onDoubleClick={() => setEditingId(item.id)}>
    {item.name}
  </span>
)}
```

### 5. Multi-Select in Panel

Shift+click for range select, Cmd+click for toggle.

```typescript
// LayersPanel.tsx
const handleClick = (e: React.MouseEvent, itemId: string) => {
  if (e.shiftKey && selectedIds.length > 0) {
    // Range select: select all items between last selected and clicked
    const allIds = flattenTree(items).map(i => i.id);
    const lastIndex = allIds.indexOf(selectedIds[selectedIds.length - 1]);
    const clickIndex = allIds.indexOf(itemId);
    const [start, end] = [Math.min(lastIndex, clickIndex), Math.max(lastIndex, clickIndex)];
    const rangeIds = allIds.slice(start, end + 1);
    onSelect(rangeIds);
  } else if (e.metaKey || e.ctrlKey) {
    // Toggle select
    onSelect([itemId], true);
  } else {
    onSelect([itemId]);
  }
};
```

### 6. Context Menu in Layers Panel

Right-click on layer for options.

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    <LayerTreeItem ... />
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={() => onRename(item.id)}>
      Rename
    </ContextMenuItem>
    <ContextMenuItem onClick={() => onDuplicate(item.id)}>
      Duplicate
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={() => onDelete(item.id)}>
      Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

## Testing

- [ ] Eye icon toggles visibility
- [ ] Hidden objects don't render on canvas
- [ ] Lock icon prevents selection/movement
- [ ] Drag reorders layers (z-order)
- [ ] Drag into frame reparents
- [ ] Double-click enables rename
- [ ] Enter confirms rename
- [ ] Escape cancels rename
- [ ] Shift+click range selects
- [ ] Cmd+click toggle selects
- [ ] Right-click shows context menu

## Files to Modify

- `src/lib/types.ts`
- `src/components/LayersPanel.tsx`
- `src/components/Canvas.tsx` (hit testing, visibility)
- `src/lib/useCanvas.ts` (reorder, rename actions)

