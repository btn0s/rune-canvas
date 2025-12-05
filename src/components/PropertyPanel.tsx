import {
  CanvasObject,
  FrameObject,
  TextObject,
  ImageObject,
  Transform,
  BlendMode,
} from "../lib/types";
import { useState, useEffect, useRef, useCallback } from "react";
import { SelectItem } from "./ui/select";
import {
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  StretchHorizontal,
  StretchVertical,
  WrapText,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MoveHorizontal,
  MoveVertical,
  Lock,
  Minus,
} from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import {
  IconButton,
  IconButtonGroup,
  SectionLabel,
  NumberInput,
  ColorInput,
  CollapsibleSection,
  PropertySelect,
  PropertyButton,
  ShadowSection,
  StrokeSection,
  BorderSideSelect,
} from "./property-panel-components";

// ============================================================================
// TYPES
// ============================================================================

interface PropertyPanelProps {
  selectedObjects: CanvasObject[];
  allObjects: CanvasObject[];
  transform: Transform;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
}

/** Props for type-specific property components */
interface ObjectPropertiesProps<T extends CanvasObject> {
  object: T;
  onUpdate: (updates: Partial<T>) => void;
}

// ============================================================================
// COMMON PROPERTY SECTIONS
// ============================================================================

/** Common props for layout/opacity that work with any object type */
interface CommonPropertiesProps {
  object: CanvasObject;
  onUpdate: (updates: Partial<CanvasObject>) => void;
}

/** Layout section - X, Y, Width, Height (shared by all object types) */
function LayoutSection({ object, onUpdate }: CommonPropertiesProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>Layout</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberInput
          label="X"
          value={object.x}
          onChange={(v) => onUpdate({ x: v })}
        />
        <NumberInput
          label="Y"
          value={object.y}
          onChange={(v) => onUpdate({ y: v })}
        />
        <NumberInput
          label="W"
          value={object.width}
          onChange={(v) => onUpdate({ width: v })}
        />
        <NumberInput
          label="H"
          value={object.height}
          onChange={(v) => onUpdate({ height: v })}
        />
      </div>
    </div>
  );
}

/** Opacity input - shared by all object types */
function OpacityInput({ object, onUpdate }: CommonPropertiesProps) {
  return (
    <NumberInput
      value={Math.round(object.opacity * 100)}
      onChange={(v) =>
        onUpdate({ opacity: Math.min(100, Math.max(0, v)) / 100 })
      }
      suffix="%"
      min={0}
    />
  );
}

// ============================================================================
// FRAME PROPERTIES
// ============================================================================

function FrameProperties({
  object: frame,
  onUpdate,
}: ObjectPropertiesProps<FrameObject>) {
  const fillColor = frame.fill;

  return (
    <>
      {/* Layout with frame-specific additions */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Layout</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <NumberInput
            label="X"
            value={frame.x}
            onChange={(v) => onUpdate({ x: v })}
          />
          <NumberInput
            label="Y"
            value={frame.y}
            onChange={(v) => onUpdate({ y: v })}
          />
          <NumberInput
            label="W"
            value={frame.width}
            onChange={(v) => onUpdate({ width: v })}
          />
          <NumberInput
            label="H"
            value={frame.height}
            onChange={(v) => onUpdate({ height: v })}
          />
        </div>

        {/* Add flex button */}
        {frame.layoutMode === "none" && (
          <PropertyButton onClick={() => onUpdate({ layoutMode: "flex" })}>
            Add flex ⇧ A
          </PropertyButton>
        )}

        {/* Clip content toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={frame.clipContent}
            onCheckedChange={(checked) =>
              onUpdate({ clipContent: checked === true })
            }
            className="w-3.5 h-3.5 rounded border-border bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
          />
          <span className="text-xs text-muted-foreground">Clip content</span>
          <span className="text-xs text-muted-foreground ml-auto">⌥ C</span>
        </label>
      </div>

      {/* Flex Layout Section */}
      {frame.layoutMode === "flex" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <SectionLabel>Flex</SectionLabel>
            <Button
              variant="ghost"
              onClick={() => onUpdate({ layoutMode: "none" })}
              className="size-6 p-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Minus className="size-3.5" />
            </Button>
          </div>

          {/* Direction */}
          <IconButtonGroup>
            <IconButton
              active={frame.flexDirection === "row"}
              onClick={() => onUpdate({ flexDirection: "row" })}
              tooltip="Row"
            >
              <ArrowRight className="size-4" />
            </IconButton>
            <IconButton
              active={frame.flexDirection === "column"}
              onClick={() => onUpdate({ flexDirection: "column" })}
              tooltip="Column"
            >
              <ArrowDown className="size-4" />
            </IconButton>
            <IconButton
              active={frame.flexDirection === "row-reverse"}
              onClick={() => onUpdate({ flexDirection: "row-reverse" })}
              tooltip="Row Reverse"
            >
              <ArrowLeft className="size-4" />
            </IconButton>
            <IconButton
              active={frame.flexDirection === "column-reverse"}
              onClick={() => onUpdate({ flexDirection: "column-reverse" })}
              tooltip="Column Reverse"
            >
              <ArrowUp className="size-4" />
            </IconButton>
          </IconButtonGroup>

          {/* Justify Content */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Justify</span>
            <IconButtonGroup>
              <IconButton
                active={frame.justifyContent === "flex-start"}
                onClick={() => onUpdate({ justifyContent: "flex-start" })}
                tooltip="Start"
              >
                {frame.flexDirection?.includes("column") ? (
                  <AlignStartHorizontal className="size-4" />
                ) : (
                  <AlignStartVertical className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={frame.justifyContent === "center"}
                onClick={() => onUpdate({ justifyContent: "center" })}
                tooltip="Center"
              >
                {frame.flexDirection?.includes("column") ? (
                  <AlignCenterHorizontal className="size-4" />
                ) : (
                  <AlignCenterVertical className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={frame.justifyContent === "flex-end"}
                onClick={() => onUpdate({ justifyContent: "flex-end" })}
                tooltip="End"
              >
                {frame.flexDirection?.includes("column") ? (
                  <AlignEndHorizontal className="size-4" />
                ) : (
                  <AlignEndVertical className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={frame.justifyContent === "space-between"}
                onClick={() => onUpdate({ justifyContent: "space-between" })}
                tooltip="Space Between"
              >
                {frame.flexDirection?.includes("column") ? (
                  <StretchVertical className="size-4" />
                ) : (
                  <StretchHorizontal className="size-4" />
                )}
              </IconButton>
            </IconButtonGroup>
          </div>

          {/* Align Items */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Align</span>
            <IconButtonGroup>
              <IconButton
                active={frame.alignItems === "flex-start"}
                onClick={() => onUpdate({ alignItems: "flex-start" })}
                tooltip="Start"
              >
                {frame.flexDirection?.includes("column") ? (
                  <AlignStartVertical className="size-4" />
                ) : (
                  <AlignStartHorizontal className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={frame.alignItems === "center"}
                onClick={() => onUpdate({ alignItems: "center" })}
                tooltip="Center"
              >
                {frame.flexDirection?.includes("column") ? (
                  <AlignCenterVertical className="size-4" />
                ) : (
                  <AlignCenterHorizontal className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={frame.alignItems === "flex-end"}
                onClick={() => onUpdate({ alignItems: "flex-end" })}
                tooltip="End"
              >
                {frame.flexDirection?.includes("column") ? (
                  <AlignEndVertical className="size-4" />
                ) : (
                  <AlignEndHorizontal className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={frame.alignItems === "stretch"}
                onClick={() => onUpdate({ alignItems: "stretch" })}
                tooltip="Stretch"
              >
                {frame.flexDirection?.includes("column") ? (
                  <StretchHorizontal className="size-4" />
                ) : (
                  <StretchVertical className="size-4" />
                )}
              </IconButton>
            </IconButtonGroup>
          </div>

          {/* Wrap toggle */}
          <div className="flex items-center gap-2">
            <IconButton
              active={frame.flexWrap === "wrap"}
              onClick={() =>
                onUpdate({
                  flexWrap: frame.flexWrap === "wrap" ? "nowrap" : "wrap",
                })
              }
              tooltip={frame.flexWrap === "wrap" ? "No Wrap" : "Wrap"}
            >
              <WrapText className="size-4" />
            </IconButton>
            <span className="text-xs text-muted-foreground">
              {frame.flexWrap === "wrap" ? "Wrap" : "No wrap"}
            </span>
          </div>

          {/* Gap and Padding */}
          <div className="grid grid-cols-2 gap-1.5">
            <NumberInput
              label="Gap"
              value={frame.gap || 0}
              onChange={(v) => onUpdate({ gap: v })}
              min={0}
            />
            <NumberInput
              label="Pad"
              value={frame.padding || 0}
              onChange={(v) => onUpdate({ padding: v })}
              min={0}
            />
          </div>
        </div>
      )}

      {/* Radius Section */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Radius</SectionLabel>
        <div className="grid grid-cols-[3fr_1fr] gap-1.5 items-center">
          <div className="w-full [&_[data-slot=slider]]:w-full [&_[data-slot=slider-track]]:bg-input [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-thumb]]:bg-foreground [&_[data-slot=slider-thumb]]:border-foreground [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:shadow-none">
            <Slider
              min={0}
              max={100}
              value={[frame.radius]}
              onValueChange={(values) => onUpdate({ radius: values[0] })}
              className="h-1.5 w-full"
            />
          </div>
          <NumberInput
            value={frame.radius}
            onChange={(v) => onUpdate({ radius: Math.max(0, v) })}
            min={0}
          />
        </div>
      </div>

      {/* Blending Section */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Blending</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <NumberInput
            value={Math.round(frame.opacity * 100)}
            onChange={(v) =>
              onUpdate({ opacity: Math.min(100, Math.max(0, v)) / 100 })
            }
            suffix="%"
            min={0}
          />
          <PropertySelect
            value={frame.blendMode || "normal"}
            onValueChange={(value) =>
              onUpdate({ blendMode: value as BlendMode })
            }
          >
            {(
              [
                "normal",
                "multiply",
                "screen",
                "overlay",
                "darken",
                "lighten",
              ] as BlendMode[]
            ).map((mode) => (
              <SelectItem
                key={mode}
                value={mode}
                className="capitalize text-xs"
              >
                {mode}
              </SelectItem>
            ))}
          </PropertySelect>
        </div>
      </div>

      {/* Fill Section */}
      <CollapsibleSection
        label="Fill"
        isOpen={fillColor !== "transparent" && fillColor !== undefined}
        onAdd={() => onUpdate({ fill: "#DDDDDD" })}
        onRemove={() => onUpdate({ fill: "transparent" })}
        visible={(frame.fillOpacity ?? 1) > 0}
        onToggleVisible={() =>
          onUpdate({ fillOpacity: (frame.fillOpacity ?? 1) > 0 ? 0 : 1 })
        }
      >
        <ColorInput
          color={fillColor || "#DDDDDD"}
          opacity={frame.fillOpacity ?? 1}
          onChange={(color) => onUpdate({ fill: color })}
          onOpacityChange={(opacity) => onUpdate({ fillOpacity: opacity })}
        />
      </CollapsibleSection>

      {/* Outline Section */}
      <StrokeSection
        label="Outline"
        color={frame.outline}
        width={frame.outlineWidth || 1}
        opacity={frame.outlineOpacity ?? 1}
        onChange={(updates) =>
          onUpdate({
            outline: updates.color ?? frame.outline,
            outlineWidth: updates.width ?? frame.outlineWidth,
            outlineOpacity: updates.opacity ?? frame.outlineOpacity,
          })
        }
        onAdd={() =>
          onUpdate({
            outline: "#000000",
            outlineWidth: 1,
            outlineOpacity: 1,
            outlineStyle: "solid",
            outlineOffset: 0,
          })
        }
        onRemove={() =>
          onUpdate({
            outline: undefined,
            outlineWidth: undefined,
            outlineOpacity: undefined,
            outlineStyle: undefined,
            outlineOffset: undefined,
          })
        }
      >
        <NumberInput
          label="Off"
          value={frame.outlineOffset || 0}
          onChange={(v) => onUpdate({ outlineOffset: v })}
        />
      </StrokeSection>

      {/* Border Section */}
      <StrokeSection
        label="Border"
        color={frame.border}
        width={frame.borderWidth || 1}
        opacity={frame.borderOpacity ?? 1}
        onChange={(updates) =>
          onUpdate({
            border: updates.color ?? frame.border,
            borderWidth: updates.width ?? frame.borderWidth,
            borderOpacity: updates.opacity ?? frame.borderOpacity,
          })
        }
        onAdd={() =>
          onUpdate({
            border: "#000000",
            borderWidth: 1,
            borderOpacity: 1,
            borderStyle: "solid",
            borderSide: "all",
          })
        }
        onRemove={() =>
          onUpdate({
            border: undefined,
            borderWidth: undefined,
            borderOpacity: undefined,
            borderStyle: undefined,
            borderSide: undefined,
          })
        }
      >
        <BorderSideSelect
          value={frame.borderSide || "all"}
          onChange={(side) => onUpdate({ borderSide: side })}
        />
      </StrokeSection>

      {/* Shadow Section */}
      <ShadowSection
        label="Shadow"
        shadow={frame.shadow}
        onChange={(shadow) => onUpdate({ shadow })}
      />

      {/* Inner Shadow Section */}
      <ShadowSection
        label="Inner shadow"
        shadow={frame.innerShadow}
        onChange={(innerShadow) => onUpdate({ innerShadow })}
      />
    </>
  );
}

// ============================================================================
// TEXT PROPERTIES
// ============================================================================

function TextProperties({
  object: text,
  onUpdate,
}: ObjectPropertiesProps<TextObject>) {
  // Cast for shared components that expect CanvasObject
  const commonUpdate = onUpdate as (updates: Partial<CanvasObject>) => void;

  return (
    <>
      {/* Layout */}
      <LayoutSection object={text} onUpdate={commonUpdate} />

      {/* Blending (opacity only for text) */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Blending</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <OpacityInput object={text} onUpdate={commonUpdate} />
          <div />
        </div>
      </div>

      {/* Color Section */}
      <CollapsibleSection
        label="Color"
        isOpen={!!text.color}
        onAdd={() => onUpdate({ color: "#000000" })}
        onRemove={() => onUpdate({ color: "transparent" })}
      >
        <ColorInput
          color={text.color || "#000000"}
          onChange={(color) => onUpdate({ color })}
        />
      </CollapsibleSection>

      {/* Text Section */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Text</SectionLabel>

        {/* Size Mode */}
        <div className="flex gap-1">
          {(
            [
              { mode: "auto-width", icon: MoveHorizontal, label: "Auto Width" },
              { mode: "auto-height", icon: MoveVertical, label: "Auto Height" },
              { mode: "fixed", icon: Lock, label: "Fixed" },
            ] as const
          ).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              title={label}
              className={`flex-1 h-7 rounded-md text-xs transition-colors ${
                text.sizeMode === mode
                  ? "bg-primary/20 text-primary"
                  : "bg-input/30 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onUpdate({ sizeMode: mode })}
            >
              <Icon className="size-3.5 mx-auto" />
            </button>
          ))}
        </div>

        <NumberInput
          label="Size"
          value={text.fontSize}
          onChange={(v) => onUpdate({ fontSize: v })}
          min={8}
        />

        {/* Bold toggle */}
        <div className="flex gap-1">
          <button
            className={`flex-1 h-7 rounded-md text-xs font-medium transition-colors ${
              text.fontWeight >= 600
                ? "bg-blue-500/20 text-blue-400"
                : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
            }`}
            onClick={() =>
              onUpdate({ fontWeight: text.fontWeight >= 600 ? 400 : 700 })
            }
          >
            <Bold className="size-3.5 mx-auto" />
          </button>
        </div>

        {/* Text alignment */}
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((align) => (
            <button
              key={align}
              className={`flex-1 h-7 rounded-md text-xs transition-colors ${
                text.textAlign === align
                  ? "bg-primary/20 text-primary"
                  : "bg-input/30 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onUpdate({ textAlign: align })}
            >
              {align === "left" && <AlignLeft className="size-3.5 mx-auto" />}
              {align === "center" && (
                <AlignCenter className="size-3.5 mx-auto" />
              )}
              {align === "right" && <AlignRight className="size-3.5 mx-auto" />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// IMAGE PROPERTIES
// ============================================================================

function ImageProperties({
  object: image,
  onUpdate,
}: ObjectPropertiesProps<ImageObject>) {
  // Cast for shared components that expect CanvasObject
  const commonUpdate = onUpdate as (updates: Partial<CanvasObject>) => void;

  return (
    <>
      {/* Layout */}
      <LayoutSection object={image} onUpdate={commonUpdate} />

      {/* Blending (opacity only for images) */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Blending</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <OpacityInput object={image} onUpdate={commonUpdate} />
          <div />
        </div>
      </div>

      {/* Original dimensions */}
      <div className="flex flex-col gap-1">
        <SectionLabel>Original</SectionLabel>
        <span className="text-xs font-mono text-muted-foreground">
          {image.naturalWidth} × {image.naturalHeight}
        </span>
      </div>
    </>
  );
}

// ============================================================================
// MAIN PROPERTY PANEL
// ============================================================================

export function PropertyPanel({
  selectedObjects,
  allObjects: _allObjects,
  transform,
  containerRef,
  onUpdate,
}: PropertyPanelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOverlapping, setIsOverlapping] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedObject =
    selectedObjects.length === 1 ? selectedObjects[0] : null;

  // Check if panel overlaps with any object
  const checkOverlap = useCallback(() => {
    if (!panelRef.current || !containerRef.current) return;

    const panelRect = panelRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const panelInCanvas = {
      x: (panelRect.left - containerRect.left - transform.x) / transform.scale,
      y: (panelRect.top - containerRect.top - transform.y) / transform.scale,
      width: panelRect.width / transform.scale,
      height: panelRect.height / transform.scale,
    };

    const overlaps = selectedObjects.some((o) => {
      return !(
        o.x + o.width < panelInCanvas.x ||
        o.x > panelInCanvas.x + panelInCanvas.width ||
        o.y + o.height < panelInCanvas.y ||
        o.y > panelInCanvas.y + panelInCanvas.height
      );
    });

    setIsOverlapping(overlaps);
  }, [selectedObjects, transform, containerRef]);

  useEffect(() => {
    checkOverlap();
  }, [checkOverlap]);

  if (!selectedObject) return null;

  // Create a typed update function that binds the object ID
  const handleUpdate = <T extends CanvasObject>(updates: Partial<T>) => {
    onUpdate(selectedObject.id, updates as Partial<CanvasObject>);
  };

  // Render content based on object type
  const renderContent = () => {
    switch (selectedObject.type) {
      case "frame":
        return (
          <FrameProperties
            object={selectedObject as FrameObject}
            onUpdate={handleUpdate}
          />
        );
      case "text":
        return (
          <TextProperties
            object={selectedObject as TextObject}
            onUpdate={handleUpdate}
          />
        );
      case "image":
        return (
          <ImageProperties
            object={selectedObject as ImageObject}
            onUpdate={handleUpdate}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 -m-3 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div
        className={`
          flex flex-col gap-3 transition-all duration-200 rounded-md p-3
          bg-card border border-border
          ${isHovered ? "opacity-100" : "opacity-50"}
        `}
        style={{ width: 220 }}
      >
        {renderContent()}
      </div>
    </div>
  );
}
