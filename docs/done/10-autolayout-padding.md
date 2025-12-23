# Auto-Layout: Individual Padding

## Priority: 🟡 Medium
## Difficulty: Easy
## Estimated Time: 1 hour

## Problem

Currently frames have a single `padding` value applied uniformly. Figma allows individual padding per side.

```typescript
// Current
padding: number;

// Needed
paddingTop: number;
paddingRight: number;
paddingBottom: number;
paddingLeft: number;
```

## Implementation Plan

### 1. Update FrameObject type

```typescript
// types.ts
export interface FrameObject extends BaseObject {
  // ... existing
  
  // Replace single padding with individual values
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  
  // Optional: convenience getter
  // padding?: number; // For backward compat, sets all four
}
```

### 2. Update frame creation

```typescript
// useCanvas.ts - startCreate
const newFrame: FrameObject = {
  // ... existing
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
};
```

### 3. Update rendering

```tsx
// Canvas.tsx - frame style
padding: isFlexLayout ? `${frame!.paddingTop}px ${frame!.paddingRight}px ${frame!.paddingBottom}px ${frame!.paddingLeft}px` : undefined,
```

### 4. Update hug size calculation

```typescript
// objects.ts - calculateHuggedSize
export function calculateHuggedSize(frame: FrameObject, allObjects: CanvasObject[]) {
  const children = allObjects.filter(o => o.parentId === frame.id);
  
  const paddingH = frame.paddingLeft + frame.paddingRight;
  const paddingV = frame.paddingTop + frame.paddingBottom;
  
  if (children.length === 0) {
    return {
      width: paddingH || 100,
      height: paddingV || 100,
    };
  }
  
  // ... rest of calculation using paddingH, paddingV
}
```

### 5. Property Panel UI

```tsx
// PropertyPanel.tsx - in flex section
<div className="flex flex-col gap-1">
  <span className="text-[9px] text-zinc-600">Padding</span>
  
  {/* Compact padding inputs in a visual layout */}
  <div className="grid grid-cols-3 gap-1 items-center">
    <div /> {/* spacer */}
    <NumberInput
      value={frame.paddingTop}
      onChange={(v) => onUpdate(selectedObject.id, { paddingTop: v })}
      min={0}
    />
    <div /> {/* spacer */}
    
    <NumberInput
      value={frame.paddingLeft}
      onChange={(v) => onUpdate(selectedObject.id, { paddingLeft: v })}
      min={0}
    />
    <div className="w-6 h-6 bg-zinc-700/50 rounded" /> {/* center indicator */}
    <NumberInput
      value={frame.paddingRight}
      onChange={(v) => onUpdate(selectedObject.id, { paddingRight: v })}
      min={0}
    />
    
    <div /> {/* spacer */}
    <NumberInput
      value={frame.paddingBottom}
      onChange={(v) => onUpdate(selectedObject.id, { paddingBottom: v })}
      min={0}
    />
    <div /> {/* spacer */}
  </div>
  
  {/* Link button to set all padding at once */}
  <PropertyButton
    onClick={() => {
      const value = frame.paddingTop; // Use top as reference
      onUpdate(selectedObject.id, {
        paddingTop: value,
        paddingRight: value,
        paddingBottom: value,
        paddingLeft: value,
      });
    }}
  >
    Make uniform
  </PropertyButton>
</div>
```

### 6. Alternative: Linked/Unlinked Toggle

Like Figma's chain icon to link all padding values:

```tsx
const [paddingLinked, setPaddingLinked] = useState(true);

const updatePadding = (side: string, value: number) => {
  if (paddingLinked) {
    onUpdate(selectedObject.id, {
      paddingTop: value,
      paddingRight: value,
      paddingBottom: value,
      paddingLeft: value,
    });
  } else {
    onUpdate(selectedObject.id, { [side]: value });
  }
};
```

## Testing

- [ ] Individual padding values work
- [ ] Flex layout respects padding
- [ ] Hug sizing accounts for padding
- [ ] Property panel shows all four values
- [ ] "Make uniform" sets all to same value
- [ ] Undo/redo works

## Files to Modify

- `src/lib/types.ts`
- `src/lib/useCanvas.ts`
- `src/lib/objects.ts`
- `src/components/Canvas.tsx`
- `src/components/PropertyPanel.tsx`

