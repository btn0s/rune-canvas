# Enhanced Text Properties

## Priority: 🟠 High
## Difficulty: Medium
## Estimated Time: 2-3 hours

## Problem

Text objects have minimal properties:

```typescript
export interface TextObject extends BaseObject {
  type: "text";
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textAlign: "left" | "center" | "right";
  color: string;
}
```

Missing essential typography controls available in Figma.

## Expected Properties

```typescript
export interface TextObject extends BaseObject {
  type: "text";
  content: string;
  
  // Font
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  
  // Spacing
  lineHeight: number | "auto"; // multiplier (1.2 = 120%) or "auto"
  letterSpacing: number;       // em units (0.05 = 5% of font size)
  paragraphSpacing: number;    // pixels between paragraphs
  
  // Alignment
  textAlign: "left" | "center" | "right" | "justify";
  verticalAlign: "top" | "center" | "bottom";
  
  // Decoration
  textDecoration: "none" | "underline" | "strikethrough";
  textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
  
  // Sizing
  widthMode: "auto" | "fixed"; // auto = shrink to content, fixed = wrap
  
  // Color
  color: string;
}
```

## Implementation Plan

### 1. Update TextObject type

Add all new properties with sensible defaults.

### 2. Update text creation

```typescript
// useCanvas.ts - createText
const newText: TextObject = {
  // ... existing
  fontStyle: "normal",
  lineHeight: "auto",
  letterSpacing: 0,
  paragraphSpacing: 0,
  verticalAlign: "top",
  textDecoration: "none",
  textTransform: "none",
  widthMode: "fixed",
};
```

### 3. Update text rendering

```tsx
// Canvas.tsx
{obj.type === "text" && (
  <div
    data-text-id={obj.id}
    contentEditable={isEditing}
    style={{
      width: text.widthMode === "auto" ? "max-content" : obj.width,
      minHeight: obj.height,
      color: text.color,
      fontSize: text.fontSize,
      fontFamily: text.fontFamily,
      fontWeight: text.fontWeight,
      fontStyle: text.fontStyle,
      lineHeight: text.lineHeight === "auto" ? "normal" : text.lineHeight,
      letterSpacing: `${text.letterSpacing}em`,
      textAlign: text.textAlign,
      textDecoration: text.textDecoration === "strikethrough" 
        ? "line-through" 
        : text.textDecoration,
      textTransform: text.textTransform,
      // Vertical alignment via flexbox
      display: "flex",
      alignItems: text.verticalAlign === "top" ? "flex-start"
        : text.verticalAlign === "center" ? "center"
        : "flex-end",
      // ... other styles
    }}
  >
    {text.content}
  </div>
)}
```

### 4. Update PropertyPanel

```tsx
// PropertyPanel.tsx - Text Section
{selectedObject.type === "text" && (
  <div className="flex flex-col gap-2">
    <SectionLabel>Text</SectionLabel>
    
    {/* Font Family Picker */}
    <PropertySelect
      value={text.fontFamily}
      onValueChange={(v) => onUpdate(selectedObject.id, { fontFamily: v })}
    >
      <SelectItem value="system-ui">System</SelectItem>
      <SelectItem value="Inter">Inter</SelectItem>
      <SelectItem value="Roboto">Roboto</SelectItem>
      <SelectItem value="Georgia">Georgia</SelectItem>
      <SelectItem value="monospace">Monospace</SelectItem>
    </PropertySelect>
    
    {/* Size & Weight */}
    <div className="grid grid-cols-2 gap-1.5">
      <NumberInput
        label="Size"
        value={text.fontSize}
        onChange={(v) => onUpdate(selectedObject.id, { fontSize: v })}
        min={1}
      />
      <PropertySelect
        value={String(text.fontWeight)}
        onValueChange={(v) => onUpdate(selectedObject.id, { fontWeight: Number(v) })}
      >
        <SelectItem value="300">Light</SelectItem>
        <SelectItem value="400">Regular</SelectItem>
        <SelectItem value="500">Medium</SelectItem>
        <SelectItem value="600">Semibold</SelectItem>
        <SelectItem value="700">Bold</SelectItem>
      </PropertySelect>
    </div>
    
    {/* Spacing */}
    <div className="grid grid-cols-2 gap-1.5">
      <NumberInput
        label="Line"
        value={text.lineHeight === "auto" ? 0 : text.lineHeight * 100}
        onChange={(v) => onUpdate(selectedObject.id, { 
          lineHeight: v === 0 ? "auto" : v / 100 
        })}
        suffix="%"
      />
      <NumberInput
        label="Letter"
        value={text.letterSpacing * 100}
        onChange={(v) => onUpdate(selectedObject.id, { letterSpacing: v / 100 })}
        suffix="%"
      />
    </div>
    
    {/* Style buttons */}
    <IconButtonGroup>
      <IconButton
        active={text.fontStyle === "italic"}
        onClick={() => onUpdate(selectedObject.id, { 
          fontStyle: text.fontStyle === "italic" ? "normal" : "italic" 
        })}
        tooltip="Italic"
      >
        <Italic className="size-4" />
      </IconButton>
      <IconButton
        active={text.textDecoration === "underline"}
        onClick={() => onUpdate(selectedObject.id, { 
          textDecoration: text.textDecoration === "underline" ? "none" : "underline" 
        })}
        tooltip="Underline"
      >
        <Underline className="size-4" />
      </IconButton>
      <IconButton
        active={text.textDecoration === "strikethrough"}
        onClick={() => onUpdate(selectedObject.id, { 
          textDecoration: text.textDecoration === "strikethrough" ? "none" : "strikethrough" 
        })}
        tooltip="Strikethrough"
      >
        <Strikethrough className="size-4" />
      </IconButton>
    </IconButtonGroup>
    
    {/* Horizontal Alignment */}
    <IconButtonGroup>
      <IconButton
        active={text.textAlign === "left"}
        onClick={() => onUpdate(selectedObject.id, { textAlign: "left" })}
      >
        <AlignLeft className="size-4" />
      </IconButton>
      <IconButton
        active={text.textAlign === "center"}
        onClick={() => onUpdate(selectedObject.id, { textAlign: "center" })}
      >
        <AlignCenter className="size-4" />
      </IconButton>
      <IconButton
        active={text.textAlign === "right"}
        onClick={() => onUpdate(selectedObject.id, { textAlign: "right" })}
      >
        <AlignRight className="size-4" />
      </IconButton>
      <IconButton
        active={text.textAlign === "justify"}
        onClick={() => onUpdate(selectedObject.id, { textAlign: "justify" })}
      >
        <AlignJustify className="size-4" />
      </IconButton>
    </IconButtonGroup>
    
    {/* Vertical Alignment */}
    <IconButtonGroup>
      <IconButton
        active={text.verticalAlign === "top"}
        onClick={() => onUpdate(selectedObject.id, { verticalAlign: "top" })}
      >
        <ArrowUp className="size-4" />
      </IconButton>
      <IconButton
        active={text.verticalAlign === "center"}
        onClick={() => onUpdate(selectedObject.id, { verticalAlign: "center" })}
      >
        <Minus className="size-4" />
      </IconButton>
      <IconButton
        active={text.verticalAlign === "bottom"}
        onClick={() => onUpdate(selectedObject.id, { verticalAlign: "bottom" })}
      >
        <ArrowDown className="size-4" />
      </IconButton>
    </IconButtonGroup>
    
    {/* Transform */}
    <IconButtonGroup>
      <IconButton
        active={text.textTransform === "uppercase"}
        onClick={() => onUpdate(selectedObject.id, { 
          textTransform: text.textTransform === "uppercase" ? "none" : "uppercase" 
        })}
        tooltip="Uppercase"
      >
        AA
      </IconButton>
      <IconButton
        active={text.textTransform === "capitalize"}
        onClick={() => onUpdate(selectedObject.id, { 
          textTransform: text.textTransform === "capitalize" ? "none" : "capitalize" 
        })}
        tooltip="Capitalize"
      >
        Aa
      </IconButton>
    </IconButtonGroup>
    
    {/* Width Mode */}
    <div className="flex items-center gap-2">
      <Checkbox
        checked={text.widthMode === "auto"}
        onCheckedChange={(checked) => onUpdate(selectedObject.id, { 
          widthMode: checked ? "auto" : "fixed" 
        })}
      />
      <span className="text-[10px] text-zinc-500">Auto width</span>
    </div>
  </div>
)}
```

## Font Loading (Future Enhancement)

For custom fonts, will need:
- Google Fonts integration
- Font upload support
- Font loading state handling

## Testing

- [ ] Line height adjusts text spacing
- [ ] Letter spacing works
- [ ] Italic style works
- [ ] Underline works
- [ ] Strikethrough works
- [ ] Text transform (uppercase, etc.) works
- [ ] Vertical alignment positions text correctly
- [ ] Auto-width mode shrinks to content
- [ ] Fixed-width mode wraps text
- [ ] Font weight selector works
- [ ] All changes persist and undo/redo

## Files to Modify

- `src/lib/types.ts`
- `src/lib/useCanvas.ts`
- `src/components/Canvas.tsx`
- `src/components/PropertyPanel.tsx`

