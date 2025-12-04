# Distribute Objects / Even Spacing

## Priority: 🟡 Medium
## Difficulty: Easy
## Estimated Time: 1 hour

## Problem

Currently have alignment (left, right, top, bottom, center H/V) but no distribution.

Distribution evenly spaces objects so gaps between them are equal.

## Implementation Plan

### 1. Add distribute functions to useCanvas

```typescript
// useCanvas.ts

const distributeHorizontal = useCallback(() => {
  if (selectedIds.length < 3) return; // Need at least 3 objects
  
  pushHistory();
  const selected = objects.filter(o => selectedIds.includes(o.id));
  
  // Sort by x position
  const sorted = [...selected].sort((a, b) => {
    const aPos = getCanvasPosition(a, objects);
    const bPos = getCanvasPosition(b, objects);
    return aPos.x - bPos.x;
  });
  
  // Calculate total width and spacing
  const positions = sorted.map(o => ({
    ...o,
    canvasPos: getCanvasPosition(o, objects),
  }));
  
  const leftmost = positions[0].canvasPos.x;
  const rightmost = positions[positions.length - 1].canvasPos.x + positions[positions.length - 1].width;
  const totalObjectWidth = positions.reduce((sum, p) => sum + p.width, 0);
  const totalSpace = rightmost - leftmost - totalObjectWidth;
  const gapCount = positions.length - 1;
  const gap = totalSpace / gapCount;
  
  // Position objects with even gaps
  let currentX = leftmost;
  setObjects(prev => prev.map(o => {
    const idx = sorted.findIndex(s => s.id === o.id);
    if (idx === -1) return o;
    
    const canvasPos = getCanvasPosition(o, prev);
    const targetX = idx === 0 ? leftmost : currentX;
    
    if (idx > 0) {
      currentX = targetX + o.width + gap;
    } else {
      currentX = leftmost + sorted[0].width + gap;
    }
    
    // Convert back to relative if has parent
    if (o.parentId) {
      const parent = prev.find(p => p.id === o.parentId);
      if (parent) {
        const parentPos = getCanvasPosition(parent, prev);
        return { ...o, x: targetX - parentPos.x };
      }
    }
    
    return { ...o, x: targetX };
  }));
}, [selectedIds, objects, pushHistory]);

const distributeVertical = useCallback(() => {
  if (selectedIds.length < 3) return;
  
  pushHistory();
  const selected = objects.filter(o => selectedIds.includes(o.id));
  
  // Sort by y position
  const sorted = [...selected].sort((a, b) => {
    const aPos = getCanvasPosition(a, objects);
    const bPos = getCanvasPosition(b, objects);
    return aPos.y - bPos.y;
  });
  
  // Calculate total height and spacing
  const positions = sorted.map(o => ({
    ...o,
    canvasPos: getCanvasPosition(o, objects),
  }));
  
  const topmost = positions[0].canvasPos.y;
  const bottommost = positions[positions.length - 1].canvasPos.y + positions[positions.length - 1].height;
  const totalObjectHeight = positions.reduce((sum, p) => sum + p.height, 0);
  const totalSpace = bottommost - topmost - totalObjectHeight;
  const gapCount = positions.length - 1;
  const gap = totalSpace / gapCount;
  
  // Position objects with even gaps
  let currentY = topmost;
  setObjects(prev => prev.map(o => {
    const idx = sorted.findIndex(s => s.id === o.id);
    if (idx === -1) return o;
    
    const targetY = idx === 0 ? topmost : currentY;
    
    if (idx > 0) {
      currentY = targetY + o.height + gap;
    } else {
      currentY = topmost + sorted[0].height + gap;
    }
    
    // Convert back to relative if has parent
    if (o.parentId) {
      const parent = prev.find(p => p.id === o.parentId);
      if (parent) {
        const parentPos = getCanvasPosition(parent, prev);
        return { ...o, y: targetY - parentPos.y };
      }
    }
    
    return { ...o, y: targetY };
  }));
}, [selectedIds, objects, pushHistory]);
```

### 2. Add keyboard shortcuts

```typescript
// Canvas.tsx - shortcuts array
{ 
  code: "KeyH", 
  modifiers: { alt: true, shift: true }, 
  action: distributeHorizontal,
  when: () => selectedIds.length >= 3,
},
{ 
  code: "KeyV", 
  modifiers: { alt: true, shift: true }, 
  action: distributeVertical,
  when: () => selectedIds.length >= 3,
},
```

### 3. Add to context menu

```tsx
// In context menu, when multiple objects selected
{selectedIds.length >= 3 && (
  <>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={distributeHorizontal}>
      Distribute horizontally
    </ContextMenuItem>
    <ContextMenuItem onClick={distributeVertical}>
      Distribute vertically
    </ContextMenuItem>
  </>
)}
```

### 4. Optional: Tidy Up

"Tidy up" snaps objects to a grid alignment based on their current approximate positions.

```typescript
const tidyUp = useCallback(() => {
  if (selectedIds.length < 2) return;
  
  pushHistory();
  const gridSize = 8; // Snap to 8px grid
  
  setObjects(prev => prev.map(o => {
    if (!selectedIds.includes(o.id)) return o;
    
    const canvasPos = getCanvasPosition(o, prev);
    const snappedX = Math.round(canvasPos.x / gridSize) * gridSize;
    const snappedY = Math.round(canvasPos.y / gridSize) * gridSize;
    
    if (o.parentId) {
      const parent = prev.find(p => p.id === o.parentId);
      if (parent) {
        const parentPos = getCanvasPosition(parent, prev);
        return { 
          ...o, 
          x: snappedX - parentPos.x, 
          y: snappedY - parentPos.y 
        };
      }
    }
    
    return { ...o, x: snappedX, y: snappedY };
  }));
}, [selectedIds, pushHistory]);
```

## Testing

- [ ] Distribute horizontal with 3+ objects evens spacing
- [ ] Distribute vertical with 3+ objects evens spacing
- [ ] Works with objects of different sizes
- [ ] Works with nested objects
- [ ] Undo/redo works
- [ ] Keyboard shortcuts work

## Files to Modify

- `src/lib/useCanvas.ts`
- `src/components/Canvas.tsx` (shortcuts)

