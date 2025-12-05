import type {
  CanvasObject,
  FrameObject,
  TextObject,
  ImageObject,
  BlendMode,
  SidebarMode,
} from "../lib/types";
import { useState, useRef } from "react";
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
  getMixedValue,
  isMixed,
  MIXED,
} from "./property-panel-components";

// ============================================================================
// TYPES
// ============================================================================

interface PropertyPanelProps {
  selectedObjects: CanvasObject[];
  allObjects: CanvasObject[];
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
  sidebarMode: SidebarMode;
  canvasBackground: string;
  onCanvasBackgroundChange: (color: string) => void;
}

/** Props for type-specific property components - supports single or multiple objects */
interface ObjectPropertiesProps<T extends CanvasObject> {
  objects: T[];
  /** Apply same updates to all objects */
  onUpdate: (updates: Partial<T>) => void;
  /** Apply per-object updates (for merging with existing nested values) */
  onUpdateEach: (getUpdates: (obj: T, index: number) => Partial<T>) => void;
}

// ============================================================================
// COMMON PROPERTY SECTIONS
// ============================================================================

/** Common props for multi-object layout/opacity */
interface CommonPropertiesProps {
  objects: CanvasObject[];
  onUpdate: (updates: Partial<CanvasObject>) => void;
  onUpdateEach?: (
    getUpdates: (obj: CanvasObject, index: number) => Partial<CanvasObject>
  ) => void;
}

/** Layout section - X, Y, Width, Height (shared by all object types) */
function LayoutSection({ objects, onUpdate }: CommonPropertiesProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>Layout</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberInput
          label="X"
          value={getMixedValue(objects, "x")}
          onChange={(v) => onUpdate({ x: v })}
        />
        <NumberInput
          label="Y"
          value={getMixedValue(objects, "y")}
          onChange={(v) => onUpdate({ y: v })}
        />
        <NumberInput
          label="W"
          value={getMixedValue(objects, "width")}
          onChange={(v) => onUpdate({ width: v })}
        />
        <NumberInput
          label="H"
          value={getMixedValue(objects, "height")}
          onChange={(v) => onUpdate({ height: v })}
        />
      </div>
    </div>
  );
}

/** Opacity input - shared by all object types */
function OpacityInput({ objects, onUpdate }: CommonPropertiesProps) {
  const opacity = getMixedValue(objects, "opacity");
  const displayValue = isMixed(opacity) ? MIXED : Math.round(opacity * 100);

  return (
    <NumberInput
      value={displayValue}
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
  objects: frames,
  onUpdate,
  onUpdateEach,
}: ObjectPropertiesProps<FrameObject>) {
  // Use first frame for conditional UI (e.g., flex direction icons)
  const firstFrame = frames[0];

  // Get mixed values for common properties
  const fillColor = getMixedValue(frames, "fill");
  const layoutMode = getMixedValue(frames, "layoutMode");
  const clipContent = getMixedValue(frames, "clipContent");

  // For flex properties, only show if all frames have the same layoutMode
  const allFlex = !isMixed(layoutMode) && layoutMode === "flex";
  const allNone = !isMixed(layoutMode) && layoutMode === "none";

  return (
    <>
      {/* Layout with frame-specific additions */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Layout</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <NumberInput
            label="X"
            value={getMixedValue(frames, "x")}
            onChange={(v) => onUpdate({ x: v })}
          />
          <NumberInput
            label="Y"
            value={getMixedValue(frames, "y")}
            onChange={(v) => onUpdate({ y: v })}
          />
          <NumberInput
            label="W"
            value={getMixedValue(frames, "width")}
            onChange={(v) => onUpdate({ width: v })}
          />
          <NumberInput
            label="H"
            value={getMixedValue(frames, "height")}
            onChange={(v) => onUpdate({ height: v })}
          />
        </div>

        {/* Add flex button - only show if all frames have layoutMode: none */}
        {allNone && (
          <PropertyButton
            onClick={() =>
              onUpdate({
                layoutMode: "flex",
                // Ensure flex defaults are set
                flexDirection: "row",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                flexWrap: "nowrap",
                gap: 0,
                padding: 0,
              })
            }
          >
            Add flex ⇧ A
          </PropertyButton>
        )}

        {/* Clip content toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={isMixed(clipContent) ? "indeterminate" : clipContent}
            onCheckedChange={(checked) =>
              onUpdate({ clipContent: checked === true })
            }
            className="w-3.5 h-3.5 rounded border-border bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
          />
          <span className="text-xs text-muted-foreground">Clip content</span>
          <span className="text-xs text-muted-foreground ml-auto">⌥ C</span>
        </label>
      </div>

      {/* Flex Layout Section - only show if all frames have flex layout */}
      {allFlex && (
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

          {/* Direction - use first frame for icon display */}
          <IconButtonGroup>
            <IconButton
              active={
                !isMixed(getMixedValue(frames, "flexDirection")) &&
                getMixedValue(frames, "flexDirection") === "row"
              }
              onClick={() => onUpdate({ flexDirection: "row" })}
              tooltip="Row"
            >
              <ArrowRight className="size-4" />
            </IconButton>
            <IconButton
              active={
                !isMixed(getMixedValue(frames, "flexDirection")) &&
                getMixedValue(frames, "flexDirection") === "column"
              }
              onClick={() => onUpdate({ flexDirection: "column" })}
              tooltip="Column"
            >
              <ArrowDown className="size-4" />
            </IconButton>
            <IconButton
              active={
                !isMixed(getMixedValue(frames, "flexDirection")) &&
                getMixedValue(frames, "flexDirection") === "row-reverse"
              }
              onClick={() => onUpdate({ flexDirection: "row-reverse" })}
              tooltip="Row Reverse"
            >
              <ArrowLeft className="size-4" />
            </IconButton>
            <IconButton
              active={
                !isMixed(getMixedValue(frames, "flexDirection")) &&
                getMixedValue(frames, "flexDirection") === "column-reverse"
              }
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
                active={
                  !isMixed(getMixedValue(frames, "justifyContent")) &&
                  getMixedValue(frames, "justifyContent") === "flex-start"
                }
                onClick={() => onUpdate({ justifyContent: "flex-start" })}
                tooltip="Start"
              >
                {firstFrame.flexDirection?.includes("column") ? (
                  <AlignStartHorizontal className="size-4" />
                ) : (
                  <AlignStartVertical className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={
                  !isMixed(getMixedValue(frames, "justifyContent")) &&
                  getMixedValue(frames, "justifyContent") === "center"
                }
                onClick={() => onUpdate({ justifyContent: "center" })}
                tooltip="Center"
              >
                {firstFrame.flexDirection?.includes("column") ? (
                  <AlignCenterHorizontal className="size-4" />
                ) : (
                  <AlignCenterVertical className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={
                  !isMixed(getMixedValue(frames, "justifyContent")) &&
                  getMixedValue(frames, "justifyContent") === "flex-end"
                }
                onClick={() => onUpdate({ justifyContent: "flex-end" })}
                tooltip="End"
              >
                {firstFrame.flexDirection?.includes("column") ? (
                  <AlignEndHorizontal className="size-4" />
                ) : (
                  <AlignEndVertical className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={
                  !isMixed(getMixedValue(frames, "justifyContent")) &&
                  getMixedValue(frames, "justifyContent") === "space-between"
                }
                onClick={() => onUpdate({ justifyContent: "space-between" })}
                tooltip="Space Between"
              >
                {firstFrame.flexDirection?.includes("column") ? (
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
                active={
                  !isMixed(getMixedValue(frames, "alignItems")) &&
                  getMixedValue(frames, "alignItems") === "flex-start"
                }
                onClick={() => onUpdate({ alignItems: "flex-start" })}
                tooltip="Start"
              >
                {firstFrame.flexDirection?.includes("column") ? (
                  <AlignStartVertical className="size-4" />
                ) : (
                  <AlignStartHorizontal className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={
                  !isMixed(getMixedValue(frames, "alignItems")) &&
                  getMixedValue(frames, "alignItems") === "center"
                }
                onClick={() => onUpdate({ alignItems: "center" })}
                tooltip="Center"
              >
                {firstFrame.flexDirection?.includes("column") ? (
                  <AlignCenterVertical className="size-4" />
                ) : (
                  <AlignCenterHorizontal className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={
                  !isMixed(getMixedValue(frames, "alignItems")) &&
                  getMixedValue(frames, "alignItems") === "flex-end"
                }
                onClick={() => onUpdate({ alignItems: "flex-end" })}
                tooltip="End"
              >
                {firstFrame.flexDirection?.includes("column") ? (
                  <AlignEndVertical className="size-4" />
                ) : (
                  <AlignEndHorizontal className="size-4" />
                )}
              </IconButton>
              <IconButton
                active={
                  !isMixed(getMixedValue(frames, "alignItems")) &&
                  getMixedValue(frames, "alignItems") === "stretch"
                }
                onClick={() => onUpdate({ alignItems: "stretch" })}
                tooltip="Stretch"
              >
                {firstFrame.flexDirection?.includes("column") ? (
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
              active={
                !isMixed(getMixedValue(frames, "flexWrap")) &&
                getMixedValue(frames, "flexWrap") === "wrap"
              }
              onClick={() => {
                const currentWrap = getMixedValue(frames, "flexWrap");
                onUpdate({
                  flexWrap:
                    isMixed(currentWrap) || currentWrap === "wrap"
                      ? "nowrap"
                      : "wrap",
                });
              }}
              tooltip="Toggle Wrap"
            >
              <WrapText className="size-4" />
            </IconButton>
            <span className="text-xs text-muted-foreground">
              {(() => {
                const wrap = getMixedValue(frames, "flexWrap");
                if (isMixed(wrap)) return "Mixed";
                return wrap === "wrap" ? "Wrap" : "No wrap";
              })()}
            </span>
          </div>

          {/* Gap and Padding */}
          <div className="grid grid-cols-2 gap-1.5">
            <NumberInput
              label="Gap"
              value={getMixedValue(frames, "gap") ?? 0}
              onChange={(v) => onUpdate({ gap: v })}
              min={0}
            />
            <NumberInput
              label="Pad"
              value={getMixedValue(frames, "padding") ?? 0}
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
              value={[
                isMixed(getMixedValue(frames, "radius"))
                  ? 0
                  : (getMixedValue(frames, "radius") as number),
              ]}
              onValueChange={(values) => onUpdate({ radius: values[0] })}
              className="h-1.5 w-full"
            />
          </div>
          <NumberInput
            value={getMixedValue(frames, "radius")}
            onChange={(v) => onUpdate({ radius: Math.max(0, v) })}
            min={0}
          />
        </div>
      </div>

      {/* Blending Section */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Blending</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {(() => {
            const opacity = getMixedValue(frames, "opacity");
            return (
              <NumberInput
                value={isMixed(opacity) ? MIXED : Math.round(opacity * 100)}
                onChange={(v) =>
                  onUpdate({ opacity: Math.min(100, Math.max(0, v)) / 100 })
                }
                suffix="%"
                min={0}
              />
            );
          })()}
          <PropertySelect
            value={(() => {
              const blendMode = getMixedValue(frames, "blendMode");
              return isMixed(blendMode) ? "normal" : blendMode || "normal";
            })()}
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
      {(() => {
        const hasFill = frames.some(
          (f) => f.fill !== "transparent" && f.fill !== undefined
        );
        const fillOpacity = getMixedValue(frames, "fillOpacity");
        return (
          <CollapsibleSection
            label="Fill"
            isOpen={
              !isMixed(fillColor)
                ? fillColor !== "transparent" && fillColor !== undefined
                : hasFill
            }
            onAdd={() => onUpdate({ fill: "#DDDDDD" })}
            onRemove={() => onUpdate({ fill: "transparent" })}
            visible={isMixed(fillOpacity) ? true : (fillOpacity ?? 1) > 0}
            onToggleVisible={() => {
              const currentOpacity = isMixed(fillOpacity)
                ? 1
                : fillOpacity ?? 1;
              onUpdate({ fillOpacity: currentOpacity > 0 ? 0 : 1 });
            }}
          >
            <ColorInput
              color={isMixed(fillColor) ? MIXED : fillColor || "#DDDDDD"}
              opacity={isMixed(fillOpacity) ? MIXED : fillOpacity ?? 1}
              onChange={(color) => onUpdate({ fill: color })}
              onOpacityChange={(opacity) => onUpdate({ fillOpacity: opacity })}
            />
          </CollapsibleSection>
        );
      })()}

      {/* Outline Section */}
      <StrokeSection
        label="Outline"
        strokes={frames.map((f) => ({
          color: f.outline,
          width: f.outlineWidth,
          opacity: f.outlineOpacity,
        }))}
        onChange={(updates) => {
          // Only pass defined properties to avoid clearing others
          const mapped: Partial<FrameObject> = {};
          if (updates.color !== undefined) mapped.outline = updates.color;
          if (updates.width !== undefined) mapped.outlineWidth = updates.width;
          if (updates.opacity !== undefined)
            mapped.outlineOpacity = updates.opacity;
          onUpdate(mapped);
        }}
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
          value={getMixedValue(frames, "outlineOffset") ?? 0}
          onChange={(v) => onUpdate({ outlineOffset: v })}
        />
      </StrokeSection>

      {/* Border Section */}
      <StrokeSection
        label="Border"
        strokes={frames.map((f) => ({
          color: f.border,
          width: f.borderWidth,
          opacity: f.borderOpacity,
        }))}
        onChange={(updates) => {
          // Only pass defined properties to avoid clearing others
          const mapped: Partial<FrameObject> = {};
          if (updates.color !== undefined) mapped.border = updates.color;
          if (updates.width !== undefined) mapped.borderWidth = updates.width;
          if (updates.opacity !== undefined)
            mapped.borderOpacity = updates.opacity;
          onUpdate(mapped);
        }}
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
          value={getMixedValue(frames, "borderSide") ?? "all"}
          onChange={(side) => onUpdate({ borderSide: side })}
        />
      </StrokeSection>

      {/* Shadow Section */}
      <ShadowSection
        label="Shadow"
        shadows={frames.map((f) => f.shadow)}
        onChange={(shadow) => onUpdate({ shadow })}
        onPartialChange={(updates) => {
          // Merge partial updates with each object's existing shadow
          onUpdateEach((frame) => {
            if (frame.shadow) {
              return { shadow: { ...frame.shadow, ...updates } };
            }
            return {};
          });
        }}
      />

      {/* Inner Shadow Section */}
      <ShadowSection
        label="Inner shadow"
        shadows={frames.map((f) => f.innerShadow)}
        onChange={(innerShadow) => onUpdate({ innerShadow })}
        onPartialChange={(updates) => {
          // Merge partial updates with each object's existing innerShadow
          onUpdateEach((frame) => {
            if (frame.innerShadow) {
              return { innerShadow: { ...frame.innerShadow, ...updates } };
            }
            return {};
          });
        }}
      />
    </>
  );
}

// ============================================================================
// TEXT PROPERTIES
// ============================================================================

function TextProperties({
  objects: texts,
  onUpdate,
  onUpdateEach: _onUpdateEach,
}: ObjectPropertiesProps<TextObject>) {
  // Cast for shared components that expect CanvasObject
  const commonUpdate = onUpdate as (updates: Partial<CanvasObject>) => void;

  // Get mixed values
  const textColor = getMixedValue(texts, "color");
  const sizeMode = getMixedValue(texts, "sizeMode");
  const fontSize = getMixedValue(texts, "fontSize");
  const fontWeight = getMixedValue(texts, "fontWeight");
  const textAlign = getMixedValue(texts, "textAlign");

  return (
    <>
      {/* Layout */}
      <LayoutSection objects={texts} onUpdate={commonUpdate} />

      {/* Blending (opacity only for text) */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Blending</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <OpacityInput objects={texts} onUpdate={commonUpdate} />
          <div />
        </div>
      </div>

      {/* Color Section */}
      <CollapsibleSection
        label="Color"
        isOpen={texts.some((t) => !!t.color)}
        onAdd={() => onUpdate({ color: "#000000" })}
        onRemove={() => onUpdate({ color: "transparent" })}
      >
        <ColorInput
          color={isMixed(textColor) ? MIXED : textColor || "#000000"}
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
                !isMixed(sizeMode) && sizeMode === mode
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
          value={fontSize}
          onChange={(v) => onUpdate({ fontSize: v })}
          min={8}
        />

        {/* Bold toggle */}
        <div className="flex gap-1">
          <button
            className={`flex-1 h-7 rounded-md text-xs font-medium transition-colors ${
              !isMixed(fontWeight) && fontWeight >= 600
                ? "bg-blue-500/20 text-blue-400"
                : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
            }`}
            onClick={() => {
              const currentWeight = isMixed(fontWeight) ? 400 : fontWeight;
              onUpdate({ fontWeight: currentWeight >= 600 ? 400 : 700 });
            }}
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
                !isMixed(textAlign) && textAlign === align
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
  objects: images,
  onUpdate,
  onUpdateEach: _onUpdateEach,
}: ObjectPropertiesProps<ImageObject>) {
  // Cast for shared components that expect CanvasObject
  const commonUpdate = onUpdate as (updates: Partial<CanvasObject>) => void;
  const isSingle = images.length === 1;

  const fillMode = getMixedValue(images, "fillMode") || "fill";

  return (
    <>
      {/* Layout */}
      <LayoutSection objects={images} onUpdate={commonUpdate} />

      {/* Blending (opacity only for images) */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Blending</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <OpacityInput objects={images} onUpdate={commonUpdate} />
          <div />
        </div>
      </div>

      {/* Image Fill Section */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Image</SectionLabel>

        {/* Fill Mode Selector */}
        <div className="flex gap-1">
          {(
            [
              { mode: "fill", label: "Fill" },
              { mode: "fit", label: "Fit" },
              { mode: "crop", label: "Crop" },
            ] as const
          ).map(({ mode, label }) => (
            <button
              key={mode}
              className={`flex-1 h-7 rounded-md text-xs transition-colors ${
                !isMixed(fillMode) && fillMode === mode
                  ? "bg-primary/20 text-primary"
                  : "bg-input/30 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                // When switching to crop mode, initialize crop to current frame bounds
                if (mode === "crop") {
                  images.forEach((img) => {
                    // Calculate what crop values would show the same view as "fill" mode
                    const frameAspect = img.width / img.height;
                    const imageAspect = img.naturalWidth / img.naturalHeight;

                    let cropW, cropH, cropX, cropY;
                    if (frameAspect > imageAspect) {
                      // Frame is wider - crop top/bottom
                      cropW = img.naturalWidth;
                      cropH = img.naturalWidth / frameAspect;
                      cropX = 0;
                      cropY = (img.naturalHeight - cropH) / 2;
                    } else {
                      // Frame is taller - crop left/right
                      cropH = img.naturalHeight;
                      cropW = img.naturalHeight * frameAspect;
                      cropX = (img.naturalWidth - cropW) / 2;
                      cropY = 0;
                    }

                    onUpdate({
                      fillMode: "crop",
                      cropX,
                      cropY,
                      cropWidth: cropW,
                      cropHeight: cropH,
                    });
                  });
                } else {
                  onUpdate({ fillMode: mode });
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Crop mode hint */}
        {!isMixed(fillMode) && fillMode === "crop" && (
          <span className="text-[10px] text-muted-foreground">
            Hold ⌘ while resizing to adjust crop
          </span>
        )}

        {/* Original dimensions - only show for single selection */}
        {isSingle && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Original</span>
            <span className="text-xs font-mono text-muted-foreground">
              {images[0].naturalWidth} × {images[0].naturalHeight}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// MIXED TYPE PROPERTIES (when different object types are selected)
// ============================================================================

function MixedTypeProperties({
  objects,
  onUpdate,
  onUpdateEach: _onUpdateEach,
}: CommonPropertiesProps) {
  return (
    <>
      {/* Only show common properties: Layout and Opacity */}
      <LayoutSection objects={objects} onUpdate={onUpdate} />

      {/* Blending (opacity only) */}
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Blending</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <OpacityInput objects={objects} onUpdate={onUpdate} />
          <div />
        </div>
      </div>

      {/* Info about mixed selection */}
      <div className="text-xs text-muted-foreground text-center py-2">
        {objects.length} objects selected
        <br />
        <span className="text-xs opacity-60">Mixed types</span>
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
  onUpdate,
  sidebarMode,
  canvasBackground,
  onCanvasBackgroundChange,
}: PropertyPanelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // EMPTY STATE - Canvas properties when nothing selected
  // ==========================================================================
  if (selectedObjects.length === 0) {
    const emptyContent = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">
            Canvas Background
          </span>
          <ColorInput
            color={canvasBackground}
            onChange={onCanvasBackgroundChange}
            showOpacity={false}
          />
        </div>
      </div>
    );

    // SHOW MODE - full sidebar
    if (sidebarMode === "show") {
      return (
        <div
          ref={panelRef}
          className="absolute right-0 top-0 bottom-0 w-56 bg-card border-l border-border select-none flex flex-col"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <div className="p-3 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">
              Properties
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">{emptyContent}</div>
        </div>
      );
    }

    // HIDE MODE - hover panel
    return (
      <>
        {/* Hover trigger zone */}
        <div
          ref={panelRef}
          className="absolute right-4 top-1/2 -translate-y-1/2 select-none"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          {/* Collapsed indicator */}
          <div
            className="flex flex-col items-start gap-1 p-2 transition-opacity duration-200"
            style={{ opacity: isHovered ? 0 : 1 }}
          >
            <div className="h-[2px] w-4 rounded-full bg-zinc-600" />
          </div>
        </div>

        {/* Panel */}
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-card border border-border rounded-md p-3 select-none transition-all duration-200 ease-out"
          style={{
            width: 220,
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? "translateX(0)" : "translateX(8px)",
            pointerEvents: isHovered ? "auto" : "none",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          {emptyContent}
        </div>
      </>
    );
  }

  // Update function that applies to ALL selected objects
  const handleUpdateAll = <T extends CanvasObject>(updates: Partial<T>) => {
    selectedObjects.forEach((obj) => {
      onUpdate(obj.id, updates as Partial<CanvasObject>);
    });
  };

  // Update function that applies per-object updates (for merging nested values)
  const handleUpdateEach = <T extends CanvasObject>(
    getUpdates: (obj: T, index: number) => Partial<T>
  ) => {
    selectedObjects.forEach((obj, index) => {
      const updates = getUpdates(obj as T, index);
      onUpdate(obj.id, updates as Partial<CanvasObject>);
    });
  };

  // Determine the type(s) of selected objects
  const types = new Set(selectedObjects.map((o) => o.type));
  const isMixedTypes = types.size > 1;
  const commonType = isMixedTypes ? null : selectedObjects[0].type;

  // Render content based on selection
  const renderContent = () => {
    // Mixed types - show only common properties
    if (isMixedTypes) {
      return (
        <MixedTypeProperties
          objects={selectedObjects}
          onUpdate={handleUpdateAll}
          onUpdateEach={handleUpdateEach}
        />
      );
    }

    // All same type - show type-specific properties
    switch (commonType) {
      case "frame":
        return (
          <FrameProperties
            objects={selectedObjects as FrameObject[]}
            onUpdate={handleUpdateAll}
            onUpdateEach={handleUpdateEach}
          />
        );
      case "text":
        return (
          <TextProperties
            objects={selectedObjects as TextObject[]}
            onUpdate={handleUpdateAll}
            onUpdateEach={handleUpdateEach}
          />
        );
      case "image":
        return (
          <ImageProperties
            objects={selectedObjects as ImageObject[]}
            onUpdate={handleUpdateAll}
            onUpdateEach={handleUpdateEach}
          />
        );
      default:
        return null;
    }
  };

  // ==========================================================================
  // SHOW MODE - Full height sidebar, always visible
  // ==========================================================================
  if (sidebarMode === "show") {
    return (
      <div
        ref={panelRef}
        className="absolute right-0 top-0 bottom-0 w-56 bg-card border-l border-border select-none flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">
            Properties
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-3">{renderContent()}</div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // HIDE MODE - Hover-based with slide-in animation
  // ==========================================================================

  // Generate abstract bars based on object type (varies the visual slightly)
  const getCollapsedBars = () => {
    if (isMixedTypes) return [16, 20, 12];
    switch (commonType) {
      case "frame":
        return [20, 16, 20, 12, 16];
      case "text":
        return [20, 14, 18, 12];
      case "image":
        return [20, 16, 12];
      default:
        return [20, 16, 12];
    }
  };

  return (
    <>
      {/* Hover trigger zone with collapsed indicator */}
      <div
        ref={panelRef}
        className="absolute right-4 top-1/2 -translate-y-1/2 select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        {/* Collapsed indicator - abstract bars (will be replaced with icon) */}
        <div
          className="flex flex-col items-start gap-1 p-2 transition-opacity duration-200"
          style={{ opacity: isHovered ? 0 : 1 }}
        >
          {getCollapsedBars().map((width, i) => (
            <div
              key={i}
              className="h-[2px] rounded-full bg-zinc-600"
              style={{ width }}
            />
          ))}
        </div>
      </div>

      {/* Panel - completely separate, slides in from right */}
      <div
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-card border border-border rounded-md p-3 select-none transition-all duration-200 ease-out"
        style={{
          width: 220,
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? "translateX(0)" : "translateX(8px)",
          pointerEvents: isHovered ? "auto" : "none",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3">{renderContent()}</div>
      </div>
    </>
  );
}
