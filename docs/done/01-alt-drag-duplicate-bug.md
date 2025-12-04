# Alt-Drag Duplicate Bug Fix

## Priority: 🔴 Critical
## Difficulty: Easy
## Estimated Time: 30 min

## Problem

When dragging an object and THEN pressing Alt, it should switch to duplicate mode (creating a copy and dragging that instead). Currently, Alt is only checked at mousedown.

## Current Behavior

```typescript
// Canvas.tsx - handleMouseDown
if (e.altKey) {
  startDuplicateDrag(objectId, canvasPoint);
} else {
  startDrag(objectId, canvasPoint, e.shiftKey);
}
```

Alt is checked once at the start. If you begin a normal drag and press Alt mid-drag, nothing happens.

## Expected Behavior (Figma)

1. Start dragging an object normally
2. Press Alt while dragging → object snaps back, a duplicate is created at original position, and you continue dragging the duplicate
3. Release Alt while still dragging → the duplicate should remain (Figma keeps it)

## Implementation Plan

### 1. Pass altKey to updateDrag

```typescript
// useDrag.ts - updateDrag signature
const updateDrag = useCallback(
  (canvasPoint: Point, shiftKey = false, altKey = false) => {
```

### 2. Track duplicate state

```typescript
// Add to useDrag refs
const isDuplicateMode = useRef(false);
const originalObjectPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
```

### 3. Handle Alt transition in updateDrag

```typescript
// In updateDrag, after movement check
if (altKey && !isDuplicateMode.current && didDrag.current) {
  // Transition to duplicate mode
  isDuplicateMode.current = true;
  
  // Store original positions
  const selected = objects.filter(o => selectedIds.includes(o.id));
  selected.forEach(o => {
    originalObjectPositions.current.set(o.id, { x: o.x, y: o.y });
  });
  
  // Create duplicates
  const descendants = getDescendants(selectedIds, objects);
  const allToDupe = [...selected, ...descendants];
  const newObjects = duplicateTree(allToDupe, { x: 0, y: 0 }, true);
  
  // Add new objects
  setObjects(prev => [...prev, ...newObjects]);
  
  // Reset original objects to their starting positions
  setObjects(prev => prev.map(o => {
    const orig = originalObjectPositions.current.get(o.id);
    if (orig) return { ...o, x: orig.x, y: orig.y };
    return o;
  }));
  
  // Select new objects and update drag refs
  const newRootIds = newObjects.filter(o => !o.parentId || !newObjects.some(c => c.id === o.parentId)).map(o => o.id);
  setSelectedIds(newRootIds);
  
  // Update drag tracking to use new objects
  dragObjectsStart.current = newObjects.filter(o => newRootIds.includes(o.id)).map(o => ({
    id: o.id,
    x: o.x,
    y: o.y,
  }));
}
```

### 4. Update Canvas.tsx to pass altKey

```typescript
// handleMouseMove
} else if (isDragging) {
  updateDrag(canvasPoint, e.shiftKey, e.altKey);
}
```

### 5. Reset duplicate mode on endDrag

```typescript
// In endDrag
isDuplicateMode.current = false;
originalObjectPositions.current.clear();
```

## Testing

- [ ] Start drag, press Alt mid-drag → duplicate created
- [ ] Release Alt, continue dragging → duplicate remains
- [ ] Alt+click from start still works
- [ ] Works with multi-selection
- [ ] Works with nested objects
- [ ] Undo restores to pre-duplicate state

## Files to Modify

- `src/lib/interactions/useDrag.ts`
- `src/components/Canvas.tsx`

