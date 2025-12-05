# Right-Click Context Menu

## Priority: 🔴 Critical
## Difficulty: Medium
## Estimated Time: 2 hours

## Problem

There is no right-click context menu. This is essential UX for any design tool.

## Expected Behavior

Right-clicking on:
- **Canvas (empty space)**: Paste, Paste here, Select all
- **Single object**: Cut, Copy, Paste, Duplicate, Delete, Rename, Frame selection, Send to back, Bring to front
- **Multiple objects**: Same as single, plus Group/Frame selection

## Implementation Plan

### 1. Install/use shadcn context-menu

Already have it at `src/components/ui/context-menu.tsx`

### 2. Create CanvasContextMenu component

```typescript
// src/components/CanvasContextMenu.tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface CanvasContextMenuProps {
  children: React.ReactNode;
  selectedIds: string[];
  onCopy: () => void;
  onPaste: () => void;
  onPasteHere: (point: Point) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onFrameSelection: () => void;
}
```

### 3. Menu structure

**Empty canvas click:**
```
Paste                    ⌘V
Paste here
─────────────────────────
Select all               ⌘A
```

**Object(s) selected:**
```
Cut                      ⌘X
Copy                     ⌘C
Paste                    ⌘V
Duplicate                ⌘D
─────────────────────────
Delete                   ⌫
─────────────────────────
Frame selection          ⌘⌥G
─────────────────────────
Bring to front           ]
Send to back             [
Bring forward            ⌘]
Send backward            ⌘[
```

### 4. Add missing actions to useCanvas

```typescript
// useCanvas.ts - Add these actions

const bringToFront = useCallback(() => {
  if (selectedIds.length === 0) return;
  pushHistory();
  setObjects(prev => {
    const selected = prev.filter(o => selectedIds.includes(o.id));
    const rest = prev.filter(o => !selectedIds.includes(o.id));
    return [...rest, ...selected];
  });
}, [selectedIds, pushHistory]);

const sendToBack = useCallback(() => {
  if (selectedIds.length === 0) return;
  pushHistory();
  setObjects(prev => {
    const selected = prev.filter(o => selectedIds.includes(o.id));
    const rest = prev.filter(o => !selectedIds.includes(o.id));
    return [...selected, ...rest];
  });
}, [selectedIds, pushHistory]);

const frameSelection = useCallback(() => {
  if (selectedIds.length === 0) return;
  pushHistory();
  
  // Get bounding box of selection
  const bounds = getSelectionBounds(objects, selectedIds);
  if (!bounds) return;
  
  // Create new frame at bounds
  const frameId = `frame-${Date.now()}`;
  const newFrame: FrameObject = {
    id: frameId,
    name: `Frame ${objectCounter.current++}`,
    type: "frame",
    parentId: null,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    // ... other frame defaults
  };
  
  // Reparent selected objects to new frame
  setObjects(prev => {
    const updated = prev.map(o => {
      if (selectedIds.includes(o.id)) {
        return {
          ...o,
          parentId: frameId,
          x: o.x - bounds.x,
          y: o.y - bounds.y,
        };
      }
      return o;
    });
    return [...updated, newFrame];
  });
  
  setSelectedIds([frameId]);
}, [selectedIds, objects, pushHistory]);

// Paste at specific position
const pasteAt = useCallback((position: Point) => {
  if (clipboard.current.length === 0) return;
  pushHistory();
  
  // Calculate offset from clipboard bounds to paste position
  const clipboardBounds = getSelectionBounds(clipboard.current, clipboard.current.map(o => o.id));
  const offsetX = position.x - (clipboardBounds?.x ?? 0);
  const offsetY = position.y - (clipboardBounds?.y ?? 0);
  
  const newObjects = duplicateTree(clipboard.current, { x: offsetX, y: offsetY }, false);
  setObjects(prev => [...prev, ...newObjects]);
  // ... select new objects
}, [pushHistory]);
```

### 5. Integrate with Canvas

```tsx
// Canvas.tsx
<ContextMenu>
  <ContextMenuTrigger asChild>
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-background"
      // ... existing props
    >
      {/* existing content */}
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    {selectedIds.length > 0 ? (
      <>
        <ContextMenuItem onClick={copySelected}>
          Copy <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        {/* ... more items */}
      </>
    ) : (
      <>
        <ContextMenuItem onClick={pasteClipboard}>
          Paste <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        {/* ... */}
      </>
    )}
  </ContextMenuContent>
</ContextMenu>
```

### 6. Handle right-click position

Store the canvas position where right-click occurred for "Paste here":

```typescript
const [contextMenuPoint, setContextMenuPoint] = useState<Point | null>(null);

const handleContextMenu = (e: React.MouseEvent) => {
  const rect = containerRef.current!.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  setContextMenuPoint(screenToCanvas(screenX, screenY));
};
```

## Keyboard Shortcuts to Add

- `]` - Bring to front
- `[` - Send to back
- `⌘]` - Bring forward
- `⌘[` - Send backward
- `⌘⌥G` - Frame selection

## Testing

- [ ] Right-click empty canvas shows paste menu
- [ ] Right-click object shows full menu
- [ ] All menu items work correctly
- [ ] Keyboard shortcuts match menu
- [ ] "Paste here" pastes at click location
- [ ] Frame selection creates frame around selected
- [ ] Z-order commands work

## Files to Modify

- `src/components/Canvas.tsx`
- `src/lib/useCanvas.ts`
- Create `src/components/CanvasContextMenu.tsx`

