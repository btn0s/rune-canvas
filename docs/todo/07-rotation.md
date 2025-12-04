# Object Rotation

## Priority: 🟠 High
## Difficulty: Hard
## Estimated Time: 4-6 hours

## Problem

Objects cannot be rotated. This is a fundamental feature in any design tool.

## Implementation Plan

### 1. Add rotation to BaseObject

```typescript
// types.ts
export interface BaseObject {
  // ... existing
  rotation: number; // degrees, 0-360
}
```

### 2. Update object creation

All object types start with `rotation: 0`.

### 3. Rotation rendering

```tsx
// Canvas.tsx - wrapper style
const wrapperStyle: React.CSSProperties = !obj.parentId
  ? {
      position: "absolute",
      left: 0,
      top: 0,
      transform: `translate(${obj.x}px, ${obj.y}px) rotate(${obj.rotation}deg)`,
      transformOrigin: "center center",
      opacity: obj.opacity,
    }
  : // ... nested styles also need rotation
```

### 4. Rotation handles

Add rotation handles outside corners of selection:

```typescript
// Canvas.tsx - draw function
// After drawing corner handles, draw rotation handles
if (selectionBounds) {
  const rotHandleDistance = 20; // pixels outside corner
  
  // Draw rotation handle indicator (small circle) at top-right corner
  const rotX = x + w + rotHandleDistance;
  const rotY = y - rotHandleDistance;
  
  ctx.beginPath();
  ctx.arc(rotX, rotY, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#3b82f6";
  ctx.stroke();
}
```

### 5. Rotation hit testing

```typescript
// Canvas.tsx
const hitTestRotationHandle = (screenX: number, screenY: number): boolean => {
  if (!selectionBounds) return false;
  // Calculate rotation handle position
  // Check if click is within rotation handle radius
};
```

### 6. Rotation interaction

```typescript
// New hook: useRotation.ts
export function useRotation(config: RotationConfig, actions: RotationActions) {
  const [isRotating, setIsRotating] = useState(false);
  const rotationStart = useRef<{
    angle: number;
    objectRotation: number;
    center: Point;
  } | null>(null);

  const startRotation = useCallback((canvasPoint: Point) => {
    const bounds = getSelectionBounds(objects, selectedIds);
    if (!bounds) return;
    
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    
    // Calculate initial angle from center to mouse
    const angle = Math.atan2(
      canvasPoint.y - center.y,
      canvasPoint.x - center.x
    ) * (180 / Math.PI);
    
    const obj = objects.find(o => o.id === selectedIds[0]);
    
    rotationStart.current = {
      angle,
      objectRotation: obj?.rotation ?? 0,
      center,
    };
    setIsRotating(true);
  }, [objects, selectedIds]);

  const updateRotation = useCallback((canvasPoint: Point, shiftKey = false) => {
    if (!isRotating || !rotationStart.current) return;
    
    const { angle: startAngle, objectRotation, center } = rotationStart.current;
    
    // Calculate current angle
    const currentAngle = Math.atan2(
      canvasPoint.y - center.y,
      canvasPoint.x - center.x
    ) * (180 / Math.PI);
    
    let deltaAngle = currentAngle - startAngle;
    let newRotation = objectRotation + deltaAngle;
    
    // Normalize to 0-360
    newRotation = ((newRotation % 360) + 360) % 360;
    
    // Shift: snap to 15° increments
    if (shiftKey) {
      newRotation = Math.round(newRotation / 15) * 15;
    }
    
    setObjects(prev => prev.map(o => {
      if (!selectedIds.includes(o.id)) return o;
      return { ...o, rotation: newRotation };
    }));
  }, [isRotating, selectedIds, setObjects]);

  const endRotation = useCallback(() => {
    setIsRotating(false);
    rotationStart.current = null;
  }, []);

  return { isRotating, startRotation, updateRotation, endRotation };
}
```

### 7. Cursor for rotation

```typescript
// Custom rotation cursor or CSS cursor
const cursor = isRotating
  ? "grabbing" // or custom rotation cursor
  : hoveredRotationHandle
  ? "grab" // or custom rotation cursor
  : // ... other cursors
```

### 8. Property panel input

```tsx
// PropertyPanel.tsx - Layout section
<NumberInput
  label="↻"
  value={selectedObject.rotation}
  onChange={(v) => onUpdate(selectedObject.id, { rotation: v % 360 })}
  suffix="°"
/>
```

### 9. Bounding box calculations with rotation

This is the hard part. When an object is rotated:
- Its bounding box for hit-testing changes
- Selection bounds need to account for rotation
- Snapping becomes more complex

```typescript
// geometry.ts
export function getRotatedBoundingBox(
  rect: Rect,
  rotation: number,
  center?: Point
): Rect {
  const cx = center?.x ?? rect.x + rect.width / 2;
  const cy = center?.y ?? rect.y + rect.height / 2;
  const rad = rotation * (Math.PI / 180);
  
  // Get corners
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  
  // Rotate corners
  const rotated = corners.map(p => ({
    x: cx + (p.x - cx) * Math.cos(rad) - (p.y - cy) * Math.sin(rad),
    y: cy + (p.x - cx) * Math.sin(rad) + (p.y - cy) * Math.cos(rad),
  }));
  
  // Find bounding box of rotated corners
  const xs = rotated.map(p => p.x);
  const ys = rotated.map(p => p.y);
  
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
```

### 10. Keyboard shortcut

- `R` while dragging rotation handle: reset to 0°

## Complexities

1. **Hit testing rotated objects**: Need to inverse-rotate the click point to test against unrotated bounds
2. **Resize handles on rotated objects**: Handles should stay at corners but drag direction is rotated
3. **Snapping with rotation**: May want to disable edge snapping for rotated objects
4. **Nested rotations**: Child rotation is relative to parent rotation

## Testing

- [ ] Objects can be rotated via handle
- [ ] Shift snaps to 15° increments
- [ ] Property panel shows/edits rotation
- [ ] Rotated objects render correctly
- [ ] Hit testing works on rotated objects
- [ ] Resize works on rotated objects
- [ ] Nested rotation works (child inherits parent rotation)
- [ ] Undo/redo works

## Files to Modify

- `src/lib/types.ts`
- `src/lib/geometry.ts`
- `src/lib/useCanvas.ts`
- `src/components/Canvas.tsx`
- `src/components/PropertyPanel.tsx`
- Create `src/lib/interactions/useRotation.ts`

