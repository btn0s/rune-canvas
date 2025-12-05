import {
  CanvasObject,
  FrameObject,
  TextObject,
  ImageObject,
  Transform,
  BlendMode,
  BorderSide,
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
} from "./property-panel-components";

interface PropertyPanelProps {
  selectedObjects: CanvasObject[];
  allObjects: CanvasObject[];
  transform: Transform;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
}

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

  const showGlassyBg = isHovered && isOverlapping;
  const frame =
    selectedObject.type === "frame" ? (selectedObject as FrameObject) : null;

  // Get fill color for display (frames) or text color (text objects)
  const fillColor =
    selectedObject.type === "frame"
      ? (selectedObject as FrameObject).fill
      : null;
  const textColor =
    selectedObject.type === "text"
      ? (selectedObject as TextObject).color
      : null;

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
        {/* Layout Section */}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Layout</SectionLabel>

          {/* Position & Size */}
          <div className="grid grid-cols-2 gap-1.5">
            <NumberInput
              label="X"
              value={selectedObject.x}
              onChange={(v) => onUpdate(selectedObject.id, { x: v })}
            />
            <NumberInput
              label="Y"
              value={selectedObject.y}
              onChange={(v) => onUpdate(selectedObject.id, { y: v })}
            />
            <NumberInput
              label="W"
              value={selectedObject.width}
              onChange={(v) => onUpdate(selectedObject.id, { width: v })}
            />
            <NumberInput
              label="H"
              value={selectedObject.height}
              onChange={(v) => onUpdate(selectedObject.id, { height: v })}
            />
          </div>

          {/* Add flex button - only for frames */}
          {frame && frame.layoutMode === "none" && (
            <PropertyButton
              onClick={() =>
                onUpdate(selectedObject.id, {
                  layoutMode: "flex",
                } as Partial<FrameObject>)
              }
            >
              Add flex ⇧ A
            </PropertyButton>
          )}

          {/* Clip content toggle - only for frames */}
          {frame && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={frame.clipContent}
                onCheckedChange={(checked) =>
                  onUpdate(selectedObject.id, {
                    clipContent: checked === true,
                  } as Partial<FrameObject>)
                }
                className="w-3.5 h-3.5 rounded border-border bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
              />
              <span className="text-xs text-muted-foreground">
                Clip content
              </span>
              <span className="text-xs text-muted-foreground ml-auto">⌥ C</span>
            </label>
          )}
        </div>

        {/* Flex Layout Section - only for frames with layout enabled */}
        {frame && frame.layoutMode === "flex" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <SectionLabel>Flex</SectionLabel>
              <Button
                variant="ghost"
                onClick={() =>
                  onUpdate(selectedObject.id, {
                    layoutMode: "none",
                  } as Partial<FrameObject>)
                }
                className="size-6 p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Minus className="size-3.5" />
              </Button>
            </div>

            {/* Direction */}
            <IconButtonGroup>
              <IconButton
                active={frame.flexDirection === "row"}
                onClick={() =>
                  onUpdate(selectedObject.id, {
                    flexDirection: "row",
                  } as Partial<FrameObject>)
                }
                tooltip="Row"
              >
                <ArrowRight className="size-4" />
              </IconButton>
              <IconButton
                active={frame.flexDirection === "column"}
                onClick={() =>
                  onUpdate(selectedObject.id, {
                    flexDirection: "column",
                  } as Partial<FrameObject>)
                }
                tooltip="Column"
              >
                <ArrowDown className="size-4" />
              </IconButton>
              <IconButton
                active={frame.flexDirection === "row-reverse"}
                onClick={() =>
                  onUpdate(selectedObject.id, {
                    flexDirection: "row-reverse",
                  } as Partial<FrameObject>)
                }
                tooltip="Row Reverse"
              >
                <ArrowLeft className="size-4" />
              </IconButton>
              <IconButton
                active={frame.flexDirection === "column-reverse"}
                onClick={() =>
                  onUpdate(selectedObject.id, {
                    flexDirection: "column-reverse",
                  } as Partial<FrameObject>)
                }
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
                  onClick={() =>
                    onUpdate(selectedObject.id, {
                      justifyContent: "flex-start",
                    } as Partial<FrameObject>)
                  }
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
                  onClick={() =>
                    onUpdate(selectedObject.id, {
                      justifyContent: "center",
                    } as Partial<FrameObject>)
                  }
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
                  onClick={() =>
                    onUpdate(selectedObject.id, {
                      justifyContent: "flex-end",
                    } as Partial<FrameObject>)
                  }
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
                  onClick={() =>
                    onUpdate(selectedObject.id, {
                      justifyContent: "space-between",
                    } as Partial<FrameObject>)
                  }
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
                  onClick={() =>
                    onUpdate(selectedObject.id, {
                      alignItems: "flex-start",
                    } as Partial<FrameObject>)
                  }
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
                  onClick={() =>
                    onUpdate(selectedObject.id, {
                      alignItems: "center",
                    } as Partial<FrameObject>)
                  }
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
                  onClick={() =>
                    onUpdate(selectedObject.id, {
                      alignItems: "flex-end",
                    } as Partial<FrameObject>)
                  }
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
                  onClick={() =>
                    onUpdate(selectedObject.id, {
                      alignItems: "stretch",
                    } as Partial<FrameObject>)
                  }
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
                  onUpdate(selectedObject.id, {
                    flexWrap: frame.flexWrap === "wrap" ? "nowrap" : "wrap",
                  } as Partial<FrameObject>)
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
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    gap: v,
                  } as Partial<FrameObject>)
                }
                min={0}
              />
              <NumberInput
                label="Pad"
                value={frame.padding || 0}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    padding: v,
                  } as Partial<FrameObject>)
                }
                min={0}
              />
            </div>
          </div>
        )}

        {/* Radius Section - only for frames */}
        {frame && (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Radius</SectionLabel>
            <div className="grid grid-cols-[3fr_1fr] gap-1.5 items-center">
              <div className="w-full [&_[data-slot=slider]]:w-full [&_[data-slot=slider-track]]:bg-input [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-thumb]]:bg-foreground [&_[data-slot=slider-thumb]]:border-foreground [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:shadow-none">
                <Slider
                  min={0}
                  max={100}
                  value={[frame.radius]}
                  onValueChange={(values) =>
                    onUpdate(selectedObject.id, {
                      radius: values[0],
                    } as Partial<FrameObject>)
                  }
                  className="h-1.5 w-full"
                />
              </div>
              <NumberInput
                value={frame.radius}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    radius: Math.max(0, v),
                  } as Partial<FrameObject>)
                }
                min={0}
              />
            </div>
          </div>
        )}

        {/* Blending Section */}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Blending</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            <NumberInput
              value={Math.round(selectedObject.opacity * 100)}
              onChange={(v) =>
                onUpdate(selectedObject.id, {
                  opacity: Math.min(100, Math.max(0, v)) / 100,
                })
              }
              suffix="%"
              min={0}
            />
            {frame ? (
              <PropertySelect
                value={frame.blendMode || "normal"}
                onValueChange={(value) =>
                  onUpdate(selectedObject.id, {
                    blendMode: value as BlendMode,
                  } as Partial<FrameObject>)
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
            ) : (
              <div />
            )}
          </div>
        </div>

        {/* Fill Section - for frames only */}
        {selectedObject.type === "frame" && (
          <CollapsibleSection
            label="Fill"
            isOpen={fillColor !== "transparent" && fillColor !== undefined}
            onAdd={() => onUpdate(selectedObject.id, { fill: "#DDDDDD" })}
            onRemove={() =>
              onUpdate(selectedObject.id, { fill: "transparent" })
            }
            visible={(frame?.fillOpacity ?? 1) > 0}
            onToggleVisible={
              frame
                ? () =>
                    onUpdate(selectedObject.id, {
                      fillOpacity: (frame.fillOpacity ?? 1) > 0 ? 0 : 1,
                    } as Partial<FrameObject>)
                : undefined
            }
          >
            <ColorInput
              color={fillColor || "#DDDDDD"}
              opacity={frame?.fillOpacity ?? 1}
              onChange={(color) => onUpdate(selectedObject.id, { fill: color })}
              onOpacityChange={(opacity) =>
                onUpdate(selectedObject.id, {
                  fillOpacity: opacity,
                } as Partial<FrameObject>)
              }
            />
          </CollapsibleSection>
        )}

        {/* Color Section - for text only */}
        {selectedObject.type === "text" && (
          <CollapsibleSection
            label="Color"
            isOpen={!!textColor}
            onAdd={() =>
              onUpdate(selectedObject.id, {
                color: "#000000",
              } as Partial<TextObject>)
            }
            onRemove={() =>
              onUpdate(selectedObject.id, {
                color: "transparent",
              } as Partial<TextObject>)
            }
          >
            <ColorInput
              color={textColor || "#000000"}
              onChange={(color) =>
                onUpdate(selectedObject.id, {
                  color,
                } as Partial<TextObject>)
              }
            />
          </CollapsibleSection>
        )}

        {/* Outline Section - outside stroke (purely visual) */}
        {frame && (
          <CollapsibleSection
            label="Outline"
            isOpen={!!frame.outline}
            onAdd={() =>
              onUpdate(selectedObject.id, {
                outline: "#000000",
                outlineWidth: 1,
                outlineOpacity: 1,
                outlineStyle: "solid",
                outlineOffset: 0,
              } as Partial<FrameObject>)
            }
            onRemove={() =>
              onUpdate(selectedObject.id, {
                outline: undefined,
                outlineWidth: undefined,
                outlineOpacity: undefined,
                outlineStyle: undefined,
                outlineOffset: undefined,
              } as Partial<FrameObject>)
            }
            visible={(frame.outlineOpacity ?? 1) > 0}
            onToggleVisible={() =>
              onUpdate(selectedObject.id, {
                outlineOpacity: (frame.outlineOpacity ?? 1) > 0 ? 0 : 1,
              } as Partial<FrameObject>)
            }
          >
            <div className="grid grid-cols-2 gap-1.5">
              <NumberInput
                label="W"
                value={frame.outlineWidth || 1}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    outlineWidth: Math.max(0, v),
                  } as Partial<FrameObject>)
                }
                min={0}
              />
              <NumberInput
                label="Off"
                value={frame.outlineOffset || 0}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    outlineOffset: v,
                  } as Partial<FrameObject>)
                }
              />
            </div>
            <ColorInput
              color={frame.outline!}
              opacity={frame.outlineOpacity ?? 1}
              onChange={(color) =>
                onUpdate(selectedObject.id, {
                  outline: color,
                } as Partial<FrameObject>)
              }
              onOpacityChange={(opacity) =>
                onUpdate(selectedObject.id, {
                  outlineOpacity: opacity,
                } as Partial<FrameObject>)
              }
            />
          </CollapsibleSection>
        )}

        {/* Border Section - inside stroke (shrinks content) */}
        {frame && (
          <CollapsibleSection
            label="Border"
            isOpen={!!frame.border}
            onAdd={() =>
              onUpdate(selectedObject.id, {
                border: "#000000",
                borderWidth: 1,
                borderOpacity: 1,
                borderStyle: "solid",
                borderSide: "all",
              } as Partial<FrameObject>)
            }
            onRemove={() =>
              onUpdate(selectedObject.id, {
                border: undefined,
                borderWidth: undefined,
                borderOpacity: undefined,
                borderStyle: undefined,
                borderSide: undefined,
              } as Partial<FrameObject>)
            }
            visible={(frame.borderOpacity ?? 1) > 0}
            onToggleVisible={() =>
              onUpdate(selectedObject.id, {
                borderOpacity: (frame.borderOpacity ?? 1) > 0 ? 0 : 1,
              } as Partial<FrameObject>)
            }
          >
            <div className="grid grid-cols-2 gap-1.5">
              <NumberInput
                label="W"
                value={frame.borderWidth || 1}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    borderWidth: Math.max(0, v),
                  } as Partial<FrameObject>)
                }
                min={0}
              />
              <PropertySelect
                value={frame.borderSide || "all"}
                onValueChange={(value) =>
                  onUpdate(selectedObject.id, {
                    borderSide: value as BorderSide,
                  } as Partial<FrameObject>)
                }
              >
                {(
                  ["all", "top", "right", "bottom", "left"] as BorderSide[]
                ).map((side) => (
                  <SelectItem
                    key={side}
                    value={side}
                    className="capitalize text-xs"
                  >
                    {side}
                  </SelectItem>
                ))}
              </PropertySelect>
            </div>
            <ColorInput
              color={frame.border!}
              opacity={frame.borderOpacity ?? 1}
              onChange={(color) =>
                onUpdate(selectedObject.id, {
                  border: color,
                } as Partial<FrameObject>)
              }
              onOpacityChange={(opacity) =>
                onUpdate(selectedObject.id, {
                  borderOpacity: opacity,
                } as Partial<FrameObject>)
              }
            />
          </CollapsibleSection>
        )}

        {/* Shadow Section */}
        {frame && (
          <CollapsibleSection
            label="Shadow"
            isOpen={!!frame.shadow}
            onAdd={() =>
              onUpdate(selectedObject.id, {
                shadow: {
                  x: 0,
                  y: 2,
                  blur: 4,
                  spread: 0,
                  color: "#000000",
                  opacity: 0.2,
                },
              } as Partial<FrameObject>)
            }
            onRemove={() =>
              onUpdate(selectedObject.id, {
                shadow: undefined,
              } as Partial<FrameObject>)
            }
            visible={(frame.shadow?.opacity ?? 0) > 0}
            onToggleVisible={() =>
              onUpdate(selectedObject.id, {
                shadow: frame.shadow
                  ? {
                      ...frame.shadow,
                      opacity: frame.shadow.opacity > 0 ? 0 : 0.2,
                    }
                  : undefined,
              } as Partial<FrameObject>)
            }
          >
            <div className="grid grid-cols-2 gap-1.5">
              <NumberInput
                label="X"
                value={frame.shadow?.x || 0}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    shadow: { ...frame.shadow!, x: v },
                  } as Partial<FrameObject>)
                }
              />
              <NumberInput
                label="Y"
                value={frame.shadow?.y || 0}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    shadow: { ...frame.shadow!, y: v },
                  } as Partial<FrameObject>)
                }
              />
              <NumberInput
                label="Blur"
                value={frame.shadow?.blur || 0}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    shadow: { ...frame.shadow!, blur: Math.max(0, v) },
                  } as Partial<FrameObject>)
                }
                min={0}
              />
              <NumberInput
                label="Spread"
                value={frame.shadow?.spread || 0}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    shadow: { ...frame.shadow!, spread: v },
                  } as Partial<FrameObject>)
                }
              />
            </div>
            <ColorInput
              color={frame.shadow?.color || "#000000"}
              opacity={frame.shadow?.opacity ?? 0.2}
              onChange={(color) =>
                onUpdate(selectedObject.id, {
                  shadow: { ...frame.shadow!, color },
                } as Partial<FrameObject>)
              }
              onOpacityChange={(opacity) =>
                onUpdate(selectedObject.id, {
                  shadow: { ...frame.shadow!, opacity },
                } as Partial<FrameObject>)
              }
            />
          </CollapsibleSection>
        )}

        {/* Inner Shadow Section */}
        {frame && (
          <CollapsibleSection
            label="Inner shadow"
            isOpen={!!frame.innerShadow}
            onAdd={() =>
              onUpdate(selectedObject.id, {
                innerShadow: {
                  x: 0,
                  y: 2,
                  blur: 4,
                  spread: 0,
                  color: "#000000",
                  opacity: 0.2,
                },
              } as Partial<FrameObject>)
            }
            onRemove={() =>
              onUpdate(selectedObject.id, {
                innerShadow: undefined,
              } as Partial<FrameObject>)
            }
            visible={(frame.innerShadow?.opacity ?? 0) > 0}
            onToggleVisible={() =>
              onUpdate(selectedObject.id, {
                innerShadow: frame.innerShadow
                  ? {
                      ...frame.innerShadow,
                      opacity: frame.innerShadow.opacity > 0 ? 0 : 0.2,
                    }
                  : undefined,
              } as Partial<FrameObject>)
            }
          >
            <div className="grid grid-cols-2 gap-1.5">
              <NumberInput
                label="X"
                value={frame.innerShadow?.x || 0}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    innerShadow: { ...frame.innerShadow!, x: v },
                  } as Partial<FrameObject>)
                }
              />
              <NumberInput
                label="Y"
                value={frame.innerShadow?.y || 0}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    innerShadow: { ...frame.innerShadow!, y: v },
                  } as Partial<FrameObject>)
                }
              />
              <NumberInput
                label="Blur"
                value={frame.innerShadow?.blur || 0}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    innerShadow: {
                      ...frame.innerShadow!,
                      blur: Math.max(0, v),
                    },
                  } as Partial<FrameObject>)
                }
                min={0}
              />
              <NumberInput
                label="Spread"
                value={frame.innerShadow?.spread || 0}
                onChange={(v) =>
                  onUpdate(selectedObject.id, {
                    innerShadow: { ...frame.innerShadow!, spread: v },
                  } as Partial<FrameObject>)
                }
              />
            </div>
            <ColorInput
              color={frame.innerShadow?.color || "#000000"}
              opacity={frame.innerShadow?.opacity ?? 0.2}
              onChange={(color) =>
                onUpdate(selectedObject.id, {
                  innerShadow: { ...frame.innerShadow!, color },
                } as Partial<FrameObject>)
              }
              onOpacityChange={(opacity) =>
                onUpdate(selectedObject.id, {
                  innerShadow: { ...frame.innerShadow!, opacity },
                } as Partial<FrameObject>)
              }
            />
          </CollapsibleSection>
        )}

        {/* Text Section */}
        {selectedObject.type === "text" && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Text</SectionLabel>
            {/* Size Mode */}
            <div className="flex gap-1">
              {(
                [
                  {
                    mode: "auto-width",
                    icon: MoveHorizontal,
                    label: "Auto Width",
                  },
                  {
                    mode: "auto-height",
                    icon: MoveVertical,
                    label: "Auto Height",
                  },
                  { mode: "fixed", icon: Lock, label: "Fixed" },
                ] as const
              ).map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  title={label}
                  className={`flex-1 h-7 rounded-md text-xs transition-colors ${
                    (selectedObject as TextObject).sizeMode === mode
                      ? "bg-primary/20 text-primary"
                      : "bg-input/30 text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() =>
                    onUpdate(selectedObject.id, {
                      sizeMode: mode,
                    } as Partial<TextObject>)
                  }
                >
                  <Icon className="size-3.5 mx-auto" />
                </button>
              ))}
            </div>
            <NumberInput
              label="Size"
              value={(selectedObject as TextObject).fontSize}
              onChange={(v) =>
                onUpdate(selectedObject.id, {
                  fontSize: v,
                } as Partial<TextObject>)
              }
              min={8}
            />
            <div className="flex gap-1">
              <button
                className={`flex-1 h-7 rounded-md text-xs font-medium transition-colors ${
                  (selectedObject as TextObject).fontWeight >= 600
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
                }`}
                onClick={() =>
                  onUpdate(selectedObject.id, {
                    fontWeight:
                      (selectedObject as TextObject).fontWeight >= 600
                        ? 400
                        : 700,
                  } as Partial<TextObject>)
                }
              >
                <Bold className="size-3.5 mx-auto" />
              </button>
            </div>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  className={`flex-1 h-7 rounded-md text-xs transition-colors ${
                    (selectedObject as TextObject).textAlign === align
                      ? "bg-primary/20 text-primary"
                      : "bg-input/30 text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() =>
                    onUpdate(selectedObject.id, {
                      textAlign: align,
                    } as Partial<TextObject>)
                  }
                >
                  {align === "left" && (
                    <AlignLeft className="size-3.5 mx-auto" />
                  )}
                  {align === "center" && (
                    <AlignCenter className="size-3.5 mx-auto" />
                  )}
                  {align === "right" && (
                    <AlignRight className="size-3.5 mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image info */}
        {selectedObject.type === "image" && (
          <div className="flex flex-col gap-1">
            <SectionLabel>Original</SectionLabel>
            <span className="text-xs font-mono text-muted-foreground">
              {(selectedObject as ImageObject).naturalWidth} ×{" "}
              {(selectedObject as ImageObject).naturalHeight}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
