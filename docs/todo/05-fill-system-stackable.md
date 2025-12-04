# Stackable Fill System

## Priority: 🟠 High
## Difficulty: Hard
## Estimated Time: 4-6 hours

## Problem

Currently frames have a single solid fill color:

```typescript
fill: string;
fillOpacity?: number;
```

Figma supports multiple stacked fills of different types: solid colors, gradients, and images.

## Expected Behavior

- Add multiple fills to a frame
- Each fill can be solid, gradient, or image
- Fills stack (render bottom to top)
- Each fill has independent opacity and blend mode
- Fills can be reordered, hidden, or removed

## Implementation Plan

### 1. Define new fill types

```typescript
// types.ts

export type FillType = "solid" | "linear-gradient" | "radial-gradient" | "image";

export interface GradientStop {
  position: number; // 0-1
  color: string;    // hex
}

export interface FillSolid {
  type: "solid";
  color: string;
}

export interface FillLinearGradient {
  type: "linear-gradient";
  angle: number; // degrees
  stops: GradientStop[];
}

export interface FillRadialGradient {
  type: "radial-gradient";
  centerX: number; // 0-1, relative to frame
  centerY: number; // 0-1
  radius: number;  // 0-1
  stops: GradientStop[];
}

export interface FillImage {
  type: "image";
  src: string;
  scaleMode: "fill" | "fit" | "crop" | "tile";
  // For crop mode
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

export interface FillLayer {
  id: string;
  fill: FillSolid | FillLinearGradient | FillRadialGradient | FillImage;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
}

// Update FrameObject
export interface FrameObject extends BaseObject {
  type: "frame";
  fills: FillLayer[]; // Replaces fill: string
  // ... rest unchanged
}
```

### 2. Migration helper

```typescript
// For existing frames with old fill property
function migrateFrame(frame: OldFrameObject): FrameObject {
  return {
    ...frame,
    fills: frame.fill ? [{
      id: `fill-${Date.now()}`,
      fill: { type: "solid", color: frame.fill },
      opacity: frame.fillOpacity ?? 1,
      blendMode: "normal",
      visible: true,
    }] : [],
  };
}
```

### 3. Render fills as stacked layers

```tsx
// Canvas.tsx - frame rendering
{obj.type === "frame" && (
  <div
    style={{
      position: "relative",
      width: obj.width,
      height: obj.height,
      borderRadius: frame!.radius,
      overflow: frame!.clipContent ? "hidden" : "visible",
    }}
  >
    {/* Fill layers (rendered bottom to top) */}
    {frame!.fills.map((fillLayer, index) => (
      fillLayer.visible && (
        <div
          key={fillLayer.id}
          style={{
            position: "absolute",
            inset: 0,
            opacity: fillLayer.opacity,
            mixBlendMode: fillLayer.blendMode,
            borderRadius: "inherit",
            ...getFillStyle(fillLayer.fill),
          }}
        />
      )
    ))}
    
    {/* Children */}
    {children.map((child) => renderObject(child))}
  </div>
)}
```

### 4. Fill style helpers

```typescript
// lib/fills.ts

export function getFillStyle(fill: FillLayer["fill"]): React.CSSProperties {
  switch (fill.type) {
    case "solid":
      return { backgroundColor: fill.color };
      
    case "linear-gradient":
      return {
        background: `linear-gradient(${fill.angle}deg, ${
          fill.stops.map(s => `${s.color} ${s.position * 100}%`).join(", ")
        })`,
      };
      
    case "radial-gradient":
      return {
        background: `radial-gradient(circle at ${fill.centerX * 100}% ${fill.centerY * 100}%, ${
          fill.stops.map(s => `${s.color} ${s.position * 100}%`).join(", ")
        })`,
      };
      
    case "image":
      return {
        backgroundImage: `url(${fill.src})`,
        backgroundSize: fill.scaleMode === "fill" ? "cover" 
          : fill.scaleMode === "fit" ? "contain"
          : fill.scaleMode === "tile" ? "auto"
          : `${fill.cropWidth}px ${fill.cropHeight}px`,
        backgroundPosition: fill.scaleMode === "crop" 
          ? `${-fill.cropX}px ${-fill.cropY}px`
          : "center",
        backgroundRepeat: fill.scaleMode === "tile" ? "repeat" : "no-repeat",
      };
  }
}
```

### 5. Property Panel UI for fills

```tsx
// PropertyPanel.tsx

{frame && (
  <CollapsibleSection
    label="Fill"
    isOpen={frame.fills.length > 0}
    onAdd={() => {
      const newFill: FillLayer = {
        id: `fill-${Date.now()}`,
        fill: { type: "solid", color: "#DDDDDD" },
        opacity: 1,
        blendMode: "normal",
        visible: true,
      };
      onUpdate(selectedObject.id, {
        fills: [...frame.fills, newFill],
      });
    }}
    onRemove={() => {
      // Remove last fill
      onUpdate(selectedObject.id, {
        fills: frame.fills.slice(0, -1),
      });
    }}
  >
    {frame.fills.map((fillLayer, index) => (
      <FillLayerEditor
        key={fillLayer.id}
        fill={fillLayer}
        onChange={(updated) => {
          const newFills = [...frame.fills];
          newFills[index] = updated;
          onUpdate(selectedObject.id, { fills: newFills });
        }}
        onRemove={() => {
          onUpdate(selectedObject.id, {
            fills: frame.fills.filter(f => f.id !== fillLayer.id),
          });
        }}
        onMoveUp={index > 0 ? () => {
          const newFills = [...frame.fills];
          [newFills[index], newFills[index - 1]] = [newFills[index - 1], newFills[index]];
          onUpdate(selectedObject.id, { fills: newFills });
        } : undefined}
        onMoveDown={index < frame.fills.length - 1 ? () => {
          const newFills = [...frame.fills];
          [newFills[index], newFills[index + 1]] = [newFills[index + 1], newFills[index]];
          onUpdate(selectedObject.id, { fills: newFills });
        } : undefined}
      />
    ))}
  </CollapsibleSection>
)}
```

### 6. FillLayerEditor component

```tsx
// components/FillLayerEditor.tsx

function FillLayerEditor({
  fill,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  fill: FillLayer;
  onChange: (fill: FillLayer) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-2 bg-zinc-800/30 rounded">
      {/* Fill type selector */}
      <div className="flex items-center justify-between">
        <PropertySelect
          value={fill.fill.type}
          onValueChange={(type) => {
            // Convert fill to new type
            let newFill: FillLayer["fill"];
            switch (type) {
              case "solid":
                newFill = { type: "solid", color: "#DDDDDD" };
                break;
              case "linear-gradient":
                newFill = {
                  type: "linear-gradient",
                  angle: 180,
                  stops: [
                    { position: 0, color: "#ffffff" },
                    { position: 1, color: "#000000" },
                  ],
                };
                break;
              // ... other types
            }
            onChange({ ...fill, fill: newFill });
          }}
        >
          <SelectItem value="solid">Solid</SelectItem>
          <SelectItem value="linear-gradient">Linear</SelectItem>
          <SelectItem value="radial-gradient">Radial</SelectItem>
          <SelectItem value="image">Image</SelectItem>
        </PropertySelect>
        
        <div className="flex items-center gap-0.5">
          <IconButton onClick={() => onChange({ ...fill, visible: !fill.visible })}>
            {fill.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </IconButton>
          <IconButton onClick={onRemove}>
            <Minus size={12} />
          </IconButton>
        </div>
      </div>
      
      {/* Type-specific controls */}
      {fill.fill.type === "solid" && (
        <ColorInput
          color={fill.fill.color}
          opacity={fill.opacity}
          onChange={(color) => onChange({
            ...fill,
            fill: { ...fill.fill, color },
          })}
          onOpacityChange={(opacity) => onChange({ ...fill, opacity })}
        />
      )}
      
      {fill.fill.type === "linear-gradient" && (
        <GradientEditor
          gradient={fill.fill}
          onChange={(gradient) => onChange({ ...fill, fill: gradient })}
        />
      )}
      
      {/* ... other types */}
    </div>
  );
}
```

## Testing

- [ ] Can add multiple fills to a frame
- [ ] Fills render in correct order (bottom to top)
- [ ] Solid fills work
- [ ] Linear gradients work
- [ ] Radial gradients work
- [ ] Image fills work with all scale modes
- [ ] Can reorder fills
- [ ] Can toggle fill visibility
- [ ] Can remove fills
- [ ] Each fill has independent opacity
- [ ] Blend modes work per fill
- [ ] Undo/redo works
- [ ] Copy/paste preserves fills

## Files to Modify

- `src/lib/types.ts`
- `src/lib/useCanvas.ts` (frame creation)
- `src/components/Canvas.tsx` (rendering)
- `src/components/PropertyPanel.tsx`
- Create `src/lib/fills.ts`
- Create `src/components/FillLayerEditor.tsx`
- Create `src/components/GradientEditor.tsx`

