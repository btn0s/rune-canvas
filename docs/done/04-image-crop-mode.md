# Image Crop Mode (Meta + Resize)

## Priority: 🔴 Critical
## Difficulty: Medium
## Estimated Time: 2 hours

## Problem

Images can only be resized, not cropped. In Figma, holding Meta/Cmd while resizing an image crops it instead of scaling.

## Expected Behavior

1. Select an image
2. Hold Meta/Cmd
3. Drag a resize handle
4. The image's visible area changes (crop) rather than the image scaling

## Implementation Plan

### 1. Update ImageObject type

```typescript
// types.ts
export interface ImageObject extends BaseObject {
  type: "image";
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  
  // Crop state - defines which portion of the image is visible
  // Values are in image pixels (0 to naturalWidth/Height)
  cropX: number;      // Left edge of visible area
  cropY: number;      // Top edge of visible area
  cropWidth: number;  // Width of visible area
  cropHeight: number; // Height of visible area
}
```

### 2. Initialize crop to full image

```typescript
// useCanvas.ts - addImage
const newImage: ImageObject = {
  // ... existing props
  cropX: 0,
  cropY: 0,
  cropWidth: naturalWidth,
  cropHeight: naturalHeight,
};
```

### 3. Update image rendering

```tsx
// Canvas.tsx - image rendering
{obj.type === "image" && (
  <div
    style={{
      width: obj.width,
      height: obj.height,
      overflow: "hidden",
      position: "relative",
    }}
  >
    <img
      src={(obj as ImageObject).src}
      alt={obj.name}
      draggable={false}
      style={{
        position: "absolute",
        // Calculate scale from crop to display size
        width: obj.width * ((obj as ImageObject).naturalWidth / (obj as ImageObject).cropWidth),
        height: obj.height * ((obj as ImageObject).naturalHeight / (obj as ImageObject).cropHeight),
        // Offset based on crop position
        left: -(obj as ImageObject).cropX * (obj.width / (obj as ImageObject).cropWidth),
        top: -(obj as ImageObject).cropY * (obj.height / (obj as ImageObject).cropHeight),
        maxWidth: "unset",
      }}
    />
  </div>
)}
```

### 4. Update useResize to handle crop mode

```typescript
// useResize.ts

const updateResize = useCallback(
  (canvasPoint: Point, shiftKey = false, altKey = false, metaKey = false) => {
    // ... existing code ...
    
    // Check if we're in crop mode (meta key + resizing an image)
    const selectedObj = objects.find(o => o.id === selectedIds[0]);
    const isCropMode = metaKey && selectedIds.length === 1 && selectedObj?.type === "image";
    
    if (isCropMode) {
      // Crop logic instead of resize
      const img = selectedObj as ImageObject;
      
      // Calculate how the crop should change based on handle and delta
      let newCropX = img.cropX;
      let newCropY = img.cropY;
      let newCropWidth = img.cropWidth;
      let newCropHeight = img.cropHeight;
      
      // Scale factors: how many image pixels per display pixel
      const scaleX = img.cropWidth / img.width;
      const scaleY = img.cropHeight / img.height;
      
      // Convert display delta to image pixel delta
      const imageDx = dx * scaleX;
      const imageDy = dy * scaleY;
      
      if (handle.includes("w")) {
        newCropX = Math.max(0, img.cropX + imageDx);
        newCropWidth = Math.min(img.naturalWidth - newCropX, img.cropWidth - imageDx);
      }
      if (handle.includes("e")) {
        newCropWidth = Math.min(img.naturalWidth - img.cropX, img.cropWidth + imageDx);
      }
      if (handle.includes("n")) {
        newCropY = Math.max(0, img.cropY + imageDy);
        newCropHeight = Math.min(img.naturalHeight - newCropY, img.cropHeight - imageDy);
      }
      if (handle.includes("s")) {
        newCropHeight = Math.min(img.naturalHeight - img.cropY, img.cropHeight + imageDy);
      }
      
      // Update object with new crop (keep display size the same!)
      setObjects(prev => prev.map(o => {
        if (o.id !== selectedObj.id) return o;
        return {
          ...o,
          cropX: newCropX,
          cropY: newCropY,
          cropWidth: newCropWidth,
          cropHeight: newCropHeight,
        };
      }));
      
      return; // Don't do normal resize
    }
    
    // ... rest of normal resize logic
  },
  [/* deps */]
);
```

### 5. Pass metaKey from Canvas

```typescript
// Canvas.tsx - handleMouseMove
} else if (isResizing) {
  updateResize(canvasPoint, e.shiftKey, e.altKey, e.metaKey);
}
```

### 6. Visual feedback for crop mode

When Meta is held over an image's resize handles, show a different cursor or overlay:

```typescript
// Canvas.tsx
const cursor = isPanning
  ? "grabbing"
  : isResizing && metaHeld && selectedObjects[0]?.type === "image"
  ? "crosshair" // or custom crop cursor
  : isResizing
  ? getHandleCursor(hoveredHandle)
  // ... rest
```

### 7. Add crop controls to property panel

```tsx
// PropertyPanel.tsx - for images
{selectedObject.type === "image" && (
  <div className="flex flex-col gap-2">
    <SectionLabel>Crop</SectionLabel>
    <div className="grid grid-cols-2 gap-1.5">
      <NumberInput
        label="X"
        value={(selectedObject as ImageObject).cropX}
        onChange={(v) => onUpdate(selectedObject.id, { cropX: v })}
      />
      <NumberInput
        label="Y"
        value={(selectedObject as ImageObject).cropY}
        onChange={(v) => onUpdate(selectedObject.id, { cropY: v })}
      />
      <NumberInput
        label="W"
        value={(selectedObject as ImageObject).cropWidth}
        onChange={(v) => onUpdate(selectedObject.id, { cropWidth: v })}
      />
      <NumberInput
        label="H"
        value={(selectedObject as ImageObject).cropHeight}
        onChange={(v) => onUpdate(selectedObject.id, { cropHeight: v })}
      />
    </div>
    <PropertyButton
      onClick={() => onUpdate(selectedObject.id, {
        cropX: 0,
        cropY: 0,
        cropWidth: (selectedObject as ImageObject).naturalWidth,
        cropHeight: (selectedObject as ImageObject).naturalHeight,
      })}
    >
      Reset crop
    </PropertyButton>
  </div>
)}
```

## Double-Click to Enter Crop Mode (Future)

Figma also supports double-clicking an image to enter a dedicated crop mode where:
- The full image is shown dimmed
- The crop area is shown bright
- You can drag the crop area around
- Click outside to exit

This is a nice-to-have for later.

## Testing

- [ ] New images have full crop (cropX/Y = 0, cropWidth/Height = natural)
- [ ] Meta + resize changes crop, not size
- [ ] Normal resize still works (scales image + crop together)
- [ ] Crop respects image bounds (can't crop outside image)
- [ ] Property panel shows crop values
- [ ] Reset crop button works
- [ ] Undo/redo works with crop changes

## Files to Modify

- `src/lib/types.ts`
- `src/lib/useCanvas.ts`
- `src/lib/interactions/useResize.ts`
- `src/components/Canvas.tsx`
- `src/components/PropertyPanel.tsx`

