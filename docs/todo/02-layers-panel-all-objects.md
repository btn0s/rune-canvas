# Layers Panel: Show All Object Types

## Priority: 🔴 Critical
## Difficulty: Easy
## Estimated Time: 45 min

## Problem

The layers panel currently only shows frames:

```typescript
// Canvas.tsx
<LayersPanel
  items={objects
    .filter((o) => o.type === "frame")  // ← Problem: excludes text and images
    .map((o) => ({
      id: o.id,
      name: o.name,
      parentId: o.parentId,
    }))}
```

Text and image objects are invisible in the tree, even when nested inside frames.

## Expected Behavior

- All object types (frame, text, image) appear in the layers tree
- Each type has a distinct icon
- Nested objects show under their parent frame
- Objects can be selected by clicking in the layers panel

## Implementation Plan

### 1. Update LayerItem interface

```typescript
// LayersPanel.tsx
interface LayerItem {
  id: string;
  name: string;
  parentId: string | null;
  type: "frame" | "text" | "image";  // Add type
}
```

### 2. Pass all objects from Canvas

```typescript
// Canvas.tsx
<LayersPanel
  items={objects.map((o) => ({
    id: o.id,
    name: o.name,
    parentId: o.parentId,
    type: o.type,
  }))}
  selectedIds={selectedIds}
  onSelect={select}
/>
```

### 3. Add type icons to LayerTreeItem

```typescript
// LayersPanel.tsx
import { Frame, Type, Image } from "lucide-react";

const TypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "frame":
      return <Frame className="w-3 h-3 text-zinc-500" />;
    case "text":
      return <Type className="w-3 h-3 text-zinc-500" />;
    case "image":
      return <Image className="w-3 h-3 text-zinc-500" />;
    default:
      return null;
  }
};
```

### 4. Update collapsed state to show icon

Currently collapsed state shows a small bar. Should show:
- Tiny type icon
- Selection state indicator

### 5. Update expanded state

Show icon next to name:
```tsx
{isHovered && (
  <>
    <TypeIcon type={item.type} />
    <span className={`text-xs whitespace-nowrap ml-1 ${...}`}>
      {item.name}
    </span>
  </>
)}
```

## Visual Design

**Collapsed (not hovered):**
```
─ (frame)
  ─ (text)
  ─ (image)
```

**Expanded (hovered):**
```
▼ 🔲 Frame 1
    T  Text 1
    🖼 Image 1
```

## Testing

- [ ] Frames appear in tree
- [ ] Text objects appear in tree
- [ ] Images appear in tree
- [ ] Nested text/images show under parent frame
- [ ] Selection syncs with canvas
- [ ] Correct icons display for each type

## Future Enhancements (separate tasks)

- Visibility toggle (eye icon)
- Lock toggle (lock icon)
- Drag to reorder
- Inline rename on double-click

## Files to Modify

- `src/components/LayersPanel.tsx`
- `src/components/Canvas.tsx`

