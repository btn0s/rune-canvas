import type {
  CanvasObject,
  FrameObject,
  TextObject,
  ImageObject,
  BlendMode,
  SidebarMode,
  Fill,
  SolidFill,
  GradientFill,
  ImageFill,
} from "../lib/types";
import { createSolidFill } from "../lib/types";
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
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  MoveHorizontal,
  MoveVertical,
  Lock,
  Link,
  Unlink,
  Minus,
  Plus,
  Eye,
  EyeOff,
  Square,
  Blend,
  Image,
  ChevronDown,
  CaseSensitive,
  CaseUpper,
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

/** Layout section - X, Y, Width, Height, Rotation (shared by all object types) */
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
        <NumberInput
          label="↻"
          value={getMixedValue(objects, "rotation")}
          onChange={(v) => onUpdate({ rotation: v })}
          suffix="°"
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
// FILL HELPERS
// ============================================================================

// Convert between fill types while preserving what we can
function convertFillType(
  fill: Fill,
  newType: "solid" | "gradient" | "image"
): Fill {
  const base = { id: fill.id, visible: fill.visible, opacity: fill.opacity };

  if (newType === "solid") {
    // Extract a color from the existing fill
    let color = "#DDDDDD";
    if (fill.type === "solid") {
      color = fill.color;
    } else if (fill.type === "gradient" && fill.stops.length > 0) {
      color = fill.stops[0].color;
    }
    return { ...base, type: "solid", color } as SolidFill;
  }

  if (newType === "gradient") {
    // Create gradient from existing color
    let baseColor = "#DDDDDD";
    if (fill.type === "solid") {
      baseColor = fill.color;
    } else if (fill.type === "gradient") {
      return fill; // Already gradient
    }
    return {
      ...base,
      type: "gradient",
      gradientType: "linear",
      angle: 180,
      stops: [
        { position: 0, color: baseColor, opacity: 1 },
        { position: 1, color: "#000000", opacity: 1 },
      ],
    } as GradientFill;
  }

  if (newType === "image") {
    return {
      ...base,
      type: "image",
      src: "",
      naturalWidth: 0,
      naturalHeight: 0,
      fillMode: "fill",
      cropX: 0,
      cropY: 0,
      cropWidth: 0,
      cropHeight: 0,
    } as ImageFill;
  }

  return fill;
}

// ============================================================================
// FILL ROW COMPONENT
// ============================================================================

interface FillRowProps {
  fill: Fill;
  onUpdate: (updates: Partial<Fill>) => void;
  onChangeFill: (newFill: Fill) => void;
  onRemove: () => void;
}

function FillRow({ fill, onUpdate, onChangeFill, onRemove }: FillRowProps) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  const typeIcon =
    fill.type === "solid" ? (
      <Square className="size-3" />
    ) : fill.type === "gradient" ? (
      <Blend className="size-3" />
    ) : (
      <Image className="size-3" />
    );

  const handleTypeChange = (newType: "solid" | "gradient" | "image") => {
    if (newType !== fill.type) {
      onChangeFill(convertFillType(fill, newType));
    }
    setShowTypeMenu(false);
  };

  return (
    <div className="flex flex-col gap-1 p-1.5 rounded bg-muted/30 border border-border/50">
      {/* Header row: type selector, visibility, remove */}
      <div className="flex items-center gap-1">
        {/* Type selector dropdown */}
        <div className="relative">
          <button
            className="h-5 px-1.5 flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={() => setShowTypeMenu(!showTypeMenu)}
          >
            {typeIcon}
            <span className="capitalize">{fill.type}</span>
            <ChevronDown className="size-2.5" />
          </button>
          {showTypeMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowTypeMenu(false)}
              />
              <div className="absolute top-full left-0 mt-1 z-20 bg-popover border border-border rounded shadow-lg py-1 min-w-[100px]">
                <button
                  className={`w-full px-2 py-1 text-left text-xs flex items-center gap-2 hover:bg-muted/50 ${
                    fill.type === "solid"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => handleTypeChange("solid")}
                >
                  <Square className="size-3" />
                  Solid
                </button>
                <button
                  className={`w-full px-2 py-1 text-left text-xs flex items-center gap-2 hover:bg-muted/50 ${
                    fill.type === "gradient"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => handleTypeChange("gradient")}
                >
                  <Blend className="size-3" />
                  Gradient
                </button>
                <button
                  className={`w-full px-2 py-1 text-left text-xs flex items-center gap-2 hover:bg-muted/50 ${
                    fill.type === "image"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => handleTypeChange("image")}
                >
                  <Image className="size-3" />
                  Image
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* Visibility toggle */}
        <button
          className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={() => onUpdate({ visible: !fill.visible })}
        >
          {fill.visible ? (
            <Eye className="size-3" />
          ) : (
            <EyeOff className="size-3" />
          )}
        </button>

        {/* Remove button */}
        <button
          className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted/50 transition-colors"
          onClick={onRemove}
        >
          <Minus className="size-3" />
        </button>
      </div>

      {/* Fill-type specific controls */}
      {fill.type === "solid" && (
        <SolidFillControls fill={fill as SolidFill} onUpdate={onUpdate} />
      )}
      {fill.type === "gradient" && (
        <GradientFillControls
          fill={fill as GradientFill}
          onUpdate={onUpdate}
          onChangeFill={onChangeFill}
        />
      )}
      {fill.type === "image" && (
        <ImageFillControls
          fill={fill as ImageFill}
          onUpdate={onUpdate}
          onChangeFill={onChangeFill}
        />
      )}
    </div>
  );
}

// Solid fill controls
function SolidFillControls({
  fill,
  onUpdate,
}: {
  fill: SolidFill;
  onUpdate: (updates: Partial<SolidFill>) => void;
}) {
  return (
    <ColorInput
      color={fill.color}
      opacity={fill.opacity}
      onChange={(color) => onUpdate({ color })}
      onOpacityChange={(opacity) => onUpdate({ opacity })}
    />
  );
}

// Gradient fill controls
function GradientFillControls({
  fill,
  onUpdate,
  onChangeFill,
}: {
  fill: GradientFill;
  onUpdate: (updates: Partial<GradientFill>) => void;
  onChangeFill: (fill: Fill) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Gradient type + angle */}
      <div className="flex items-center gap-1.5">
        <IconButtonGroup>
          <IconButton
            active={fill.gradientType === "linear"}
            onClick={() => onUpdate({ gradientType: "linear" })}
            tooltip="Linear"
          >
            <div
              className="size-3 rounded-sm"
              style={{
                background: "linear-gradient(180deg, #666 0%, #333 100%)",
              }}
            />
          </IconButton>
          <IconButton
            active={fill.gradientType === "radial"}
            onClick={() => onUpdate({ gradientType: "radial" })}
            tooltip="Radial"
          >
            <div
              className="size-3 rounded-full"
              style={{
                background: "radial-gradient(circle, #666 0%, #333 100%)",
              }}
            />
          </IconButton>
        </IconButtonGroup>

        {fill.gradientType === "linear" && (
          <NumberInput
            value={fill.angle}
            onChange={(angle) => onUpdate({ angle })}
            suffix="°"
          />
        )}
      </div>

      {/* Gradient stops */}
      <div className="flex flex-col gap-1">
        {fill.stops.map((stop, index) => (
          <div
            key={index}
            className="grid items-center gap-1"
            style={{
              gridTemplateColumns: `1fr 52px ${
                fill.stops.length > 2 ? "16px" : ""
              }`,
            }}
          >
            <ColorInput
              color={stop.color}
              opacity={stop.opacity}
              onChange={(color) => {
                const newStops = [...fill.stops];
                newStops[index] = { ...newStops[index], color };
                onChangeFill({ ...fill, stops: newStops });
              }}
              onOpacityChange={(opacity) => {
                const newStops = [...fill.stops];
                newStops[index] = { ...newStops[index], opacity };
                onChangeFill({ ...fill, stops: newStops });
              }}
            />
            <NumberInput
              value={Math.round(stop.position * 100)}
              onChange={(pos) => {
                const newStops = [...fill.stops];
                newStops[index] = {
                  ...newStops[index],
                  position: Math.max(0, Math.min(100, pos)) / 100,
                };
                onChangeFill({ ...fill, stops: newStops });
              }}
              suffix="%"
              min={0}
            />
            {fill.stops.length > 2 && (
              <button
                className="size-4 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => {
                  const newStops = fill.stops.filter((_, i) => i !== index);
                  onChangeFill({ ...fill, stops: newStops });
                }}
              >
                <Minus className="size-2.5" />
              </button>
            )}
          </div>
        ))}
        <button
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          onClick={() => {
            // Add a new stop in the middle
            const newPos =
              fill.stops.length > 0
                ? (fill.stops[0].position +
                    fill.stops[fill.stops.length - 1].position) /
                  2
                : 0.5;
            const newStops = [
              ...fill.stops,
              { position: newPos, color: "#888888", opacity: 1 },
            ].sort((a, b) => a.position - b.position);
            onChangeFill({ ...fill, stops: newStops });
          }}
        >
          <Plus className="size-3" /> Add stop
        </button>
      </div>
    </div>
  );
}

// Image fill controls
function ImageFillControls({
  fill,
  onUpdate,
  onChangeFill,
}: {
  fill: ImageFill;
  onUpdate: (updates: Partial<ImageFill>) => void;
  onChangeFill: (fill: Fill) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = document.createElement("img");
      img.onload = () => {
        onChangeFill({
          ...fill,
          src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          cropWidth: img.naturalWidth,
          cropHeight: img.naturalHeight,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {fill.src ? (
        <div className="flex items-center gap-2">
          <div
            className="size-8 rounded bg-cover bg-center border border-border"
            style={{ backgroundImage: `url(${fill.src})` }}
          />
          <div className="flex-1 flex flex-col">
            <span className="text-xs text-muted-foreground">
              {fill.naturalWidth} × {fill.naturalHeight}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            Replace
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          <Image className="size-3 mr-1.5" />
          Choose Image
        </Button>
      )}

      {fill.src && (
        <div className="flex items-center gap-1">
          <IconButtonGroup>
            <IconButton
              active={fill.fillMode === "fill"}
              onClick={() => onUpdate({ fillMode: "fill" })}
              tooltip="Fill (cover)"
            >
              <span className="text-[9px] font-medium">Fill</span>
            </IconButton>
            <IconButton
              active={fill.fillMode === "fit"}
              onClick={() => onUpdate({ fillMode: "fit" })}
              tooltip="Fit (contain)"
            >
              <span className="text-[9px] font-medium">Fit</span>
            </IconButton>
            <IconButton
              active={fill.fillMode === "crop"}
              onClick={() => onUpdate({ fillMode: "crop" })}
              tooltip="Crop (manual)"
            >
              <span className="text-[9px] font-medium">Crop</span>
            </IconButton>
          </IconButtonGroup>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PADDING INPUT (X/Y or T/R/B/L)
// ============================================================================

function PaddingInput({
  frames,
  onUpdate,
}: {
  frames: FrameObject[];
  onUpdate: (updates: Partial<FrameObject>) => void;
}) {
  const pTop = getMixedValue(frames, "paddingTop");
  const pRight = getMixedValue(frames, "paddingRight");
  const pBottom = getMixedValue(frames, "paddingBottom");
  const pLeft = getMixedValue(frames, "paddingLeft");

  // Check if X (left/right) are same and Y (top/bottom) are same
  const xSame = !isMixed(pLeft) && !isMixed(pRight) && pLeft === pRight;
  const ySame = !isMixed(pTop) && !isMixed(pBottom) && pTop === pBottom;
  const canShowXY = xSame && ySame;

  const [expanded, setExpanded] = useState(!canShowXY);

  // If values diverge from external changes, switch to expanded
  if (!expanded && !canShowXY) {
    setExpanded(true);
  }

  if (expanded) {
    // Expanded: 2x2 grid with T, R, B, L
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted-foreground">Padding</span>
          <button
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={() => {
              // Collapse: set X (left=right) and Y (top=bottom)
              const xVal = isMixed(pLeft) ? 0 : (pLeft as number);
              const yVal = isMixed(pTop) ? 0 : (pTop as number);
              onUpdate({
                paddingTop: yVal,
                paddingBottom: yVal,
                paddingLeft: xVal,
                paddingRight: xVal,
              });
              setExpanded(false);
            }}
            title="Use X/Y padding"
          >
            <Unlink className="size-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NumberInput
            label="T"
            value={pTop ?? 0}
            onChange={(v) => onUpdate({ paddingTop: v })}
            min={0}
          />
          <NumberInput
            label="R"
            value={pRight ?? 0}
            onChange={(v) => onUpdate({ paddingRight: v })}
            min={0}
          />
          <NumberInput
            label="B"
            value={pBottom ?? 0}
            onChange={(v) => onUpdate({ paddingBottom: v })}
            min={0}
          />
          <NumberInput
            label="L"
            value={pLeft ?? 0}
            onChange={(v) => onUpdate({ paddingLeft: v })}
            min={0}
          />
        </div>
      </div>
    );
  }

  // Default: X and Y inputs
  const xValue = pLeft ?? 0;
  const yValue = pTop ?? 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">Padding</span>
        <button
          className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(true)}
          title="Edit individual sides"
        >
          <Link className="size-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <NumberInput
          label="X"
          value={xValue}
          onChange={(v) => onUpdate({ paddingLeft: v, paddingRight: v })}
          min={0}
        />
        <NumberInput
          label="Y"
          value={yValue}
          onChange={(v) => onUpdate({ paddingTop: v, paddingBottom: v })}
          min={0}
        />
      </div>
    </div>
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
                paddingTop: 0,
                paddingRight: 0,
                paddingBottom: 0,
                paddingLeft: 0,
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

          {/* Gap */}
          <NumberInput
            label="Gap"
            value={getMixedValue(frames, "gap") ?? 0}
            onChange={(v) => onUpdate({ gap: v })}
            min={0}
          />

          {/* Padding */}
          <PaddingInput frames={frames} onUpdate={onUpdate} />
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

      {/* Fill Section - Stackable Fills */}
      {(() => {
        // Check if all frames have the same fills
        const fillsAreSame = frames.every((frame) => {
          if (frame.fills.length !== frames[0].fills.length) return false;
          return frame.fills.every((fill, i) => {
            const ref = frames[0].fills[i];
            if (fill.type !== ref.type) return false;
            if (fill.type === "solid" && ref.type === "solid") {
              return fill.color === ref.color && fill.opacity === ref.opacity;
            }
            // For gradient/image, just check type matches (detailed comparison not needed)
            return fill.type === ref.type;
          });
        });

        const isMixedFills = !fillsAreSame;
        const hasFills = frames[0].fills.length > 0;

        // Collapsed state - no fills
        if (!hasFills && !isMixedFills) {
          return (
            <div className="flex items-center justify-between">
              <SectionLabel>Fill</SectionLabel>
              <Button
                variant="ghost"
                size="sm"
                className="size-5 p-0 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  onUpdate({ fills: [createSolidFill("#DDDDDD")] })
                }
              >
                <Plus className="size-3" />
              </Button>
            </div>
          );
        }

        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <SectionLabel>Fill</SectionLabel>
              <Button
                variant="ghost"
                size="sm"
                className="size-5 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (isMixedFills) {
                    // Mixed: replace all with a single new fill
                    onUpdate({ fills: [createSolidFill("#DDDDDD")] });
                  } else {
                    // Same: add a new fill to all
                    onUpdateEach((frame) => ({
                      fills: [...frame.fills, createSolidFill("#DDDDDD")],
                    }));
                  }
                }}
              >
                <Plus className="size-3" />
              </Button>
            </div>

            {isMixedFills ? (
              <span className="text-xs text-muted-foreground">Mixed</span>
            ) : (
              <div className="flex flex-col gap-1">
                {[...frames[0].fills].reverse().map((fill, reversedIndex) => {
                  const fillIndex = frames[0].fills.length - 1 - reversedIndex;
                  return (
                    <FillRow
                      key={fill.id}
                      fill={fill}
                      onUpdate={(updates) => {
                        onUpdateEach((frame) => {
                          if (fillIndex >= frame.fills.length) return {};
                          const newFills = [...frame.fills];
                          newFills[fillIndex] = {
                            ...newFills[fillIndex],
                            ...updates,
                          } as Fill;
                          return { fills: newFills };
                        });
                      }}
                      onChangeFill={(newFill) => {
                        onUpdateEach((frame) => {
                          if (fillIndex >= frame.fills.length) return {};
                          const newFills = [...frame.fills];
                          newFills[fillIndex] = newFill;
                          return { fills: newFills };
                        });
                      }}
                      onRemove={() => {
                        onUpdateEach((frame) => {
                          if (fillIndex >= frame.fills.length) return {};
                          return {
                            fills: frame.fills.filter(
                              (_, i) => i !== fillIndex
                            ),
                          };
                        });
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
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
  const fontStyle = getMixedValue(texts, "fontStyle");
  const textAlign = getMixedValue(texts, "textAlign");
  const verticalAlign = getMixedValue(texts, "verticalAlign");
  const textDecoration = getMixedValue(texts, "textDecoration");
  const textTransform = getMixedValue(texts, "textTransform");
  const lineHeight = getMixedValue(texts, "lineHeight");
  const letterSpacing = getMixedValue(texts, "letterSpacing");

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

        {/* Font Size */}
        <NumberInput
          label="Size"
          value={fontSize}
          onChange={(v) => onUpdate({ fontSize: v })}
          min={1}
        />

        {/* Line Height & Letter Spacing */}
        <div className="grid grid-cols-2 gap-1.5">
          <NumberInput
            label="Line"
            value={
              isMixed(lineHeight)
                ? MIXED
                : lineHeight === 0
                ? 0
                : Math.round(lineHeight * 100)
            }
            onChange={(v) => onUpdate({ lineHeight: v === 0 ? 0 : v / 100 })}
            suffix="%"
          />
          <NumberInput
            label="Letter"
            value={
              isMixed(letterSpacing) ? MIXED : Math.round(letterSpacing * 100)
            }
            onChange={(v) => onUpdate({ letterSpacing: v / 100 })}
            suffix="%"
          />
        </div>

        {/* Style toggles: Bold, Italic, Underline, Strikethrough */}
        <div className="flex gap-1">
          <button
            title="Bold"
            className={`flex-1 h-7 rounded-md text-xs transition-colors ${
              !isMixed(fontWeight) && fontWeight >= 600
                ? "bg-primary/20 text-primary"
                : "bg-input/30 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              const currentWeight = isMixed(fontWeight) ? 400 : fontWeight;
              onUpdate({ fontWeight: currentWeight >= 600 ? 400 : 700 });
            }}
          >
            <Bold className="size-3.5 mx-auto" />
          </button>
          <button
            title="Italic"
            className={`flex-1 h-7 rounded-md text-xs transition-colors ${
              !isMixed(fontStyle) && fontStyle === "italic"
                ? "bg-primary/20 text-primary"
                : "bg-input/30 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              const current = isMixed(fontStyle) ? "normal" : fontStyle;
              onUpdate({
                fontStyle: current === "italic" ? "normal" : "italic",
              });
            }}
          >
            <Italic className="size-3.5 mx-auto" />
          </button>
          <button
            title="Underline"
            className={`flex-1 h-7 rounded-md text-xs transition-colors ${
              !isMixed(textDecoration) && textDecoration === "underline"
                ? "bg-primary/20 text-primary"
                : "bg-input/30 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              const current = isMixed(textDecoration) ? "none" : textDecoration;
              onUpdate({
                textDecoration: current === "underline" ? "none" : "underline",
              });
            }}
          >
            <Underline className="size-3.5 mx-auto" />
          </button>
          <button
            title="Strikethrough"
            className={`flex-1 h-7 rounded-md text-xs transition-colors ${
              !isMixed(textDecoration) && textDecoration === "strikethrough"
                ? "bg-primary/20 text-primary"
                : "bg-input/30 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              const current = isMixed(textDecoration) ? "none" : textDecoration;
              onUpdate({
                textDecoration:
                  current === "strikethrough" ? "none" : "strikethrough",
              });
            }}
          >
            <Strikethrough className="size-3.5 mx-auto" />
          </button>
        </div>

        {/* Horizontal Text alignment */}
        <div className="flex gap-1">
          {(["left", "center", "right", "justify"] as const).map((align) => (
            <button
              key={align}
              title={align.charAt(0).toUpperCase() + align.slice(1)}
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
              {align === "justify" && (
                <AlignJustify className="size-3.5 mx-auto" />
              )}
            </button>
          ))}
        </div>

        {/* Vertical alignment */}
        <div className="flex gap-1">
          {(["top", "center", "bottom"] as const).map((align) => (
            <button
              key={align}
              title={`Align ${align}`}
              className={`flex-1 h-7 rounded-md text-xs transition-colors ${
                !isMixed(verticalAlign) && verticalAlign === align
                  ? "bg-primary/20 text-primary"
                  : "bg-input/30 text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onUpdate({ verticalAlign: align })}
            >
              {align === "top" && (
                <AlignVerticalJustifyStart className="size-3.5 mx-auto" />
              )}
              {align === "center" && (
                <AlignVerticalJustifyCenter className="size-3.5 mx-auto" />
              )}
              {align === "bottom" && (
                <AlignVerticalJustifyEnd className="size-3.5 mx-auto" />
              )}
            </button>
          ))}
        </div>

        {/* Text Transform */}
        <div className="flex gap-1">
          <button
            title="Uppercase"
            className={`flex-1 h-7 rounded-md text-xs transition-colors ${
              !isMixed(textTransform) && textTransform === "uppercase"
                ? "bg-primary/20 text-primary"
                : "bg-input/30 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              const current = isMixed(textTransform) ? "none" : textTransform;
              onUpdate({
                textTransform: current === "uppercase" ? "none" : "uppercase",
              });
            }}
          >
            <CaseUpper className="size-3.5 mx-auto" />
          </button>
          <button
            title="Capitalize"
            className={`flex-1 h-7 rounded-md text-xs transition-colors ${
              !isMixed(textTransform) && textTransform === "capitalize"
                ? "bg-primary/20 text-primary"
                : "bg-input/30 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              const current = isMixed(textTransform) ? "none" : textTransform;
              onUpdate({
                textTransform: current === "capitalize" ? "none" : "capitalize",
              });
            }}
          >
            <CaseSensitive className="size-3.5 mx-auto" />
          </button>
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
          className="absolute right-4 top-4 bottom-4 bg-card border border-border rounded-md select-none transition-all duration-200 ease-out overflow-y-auto"
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
          <div className="p-3">{emptyContent}</div>
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
        className="absolute right-4 top-4 bottom-4 bg-card border border-border rounded-md select-none transition-all duration-200 ease-out overflow-y-auto"
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
        <div className="flex flex-col gap-3 p-3">{renderContent()}</div>
      </div>
    </>
  );
}
