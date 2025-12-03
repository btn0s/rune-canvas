import {
  CanvasObject,
  FrameObject,
  TextObject,
  ImageObject,
  Transform,
  LayoutMode,
  FlexDirection,
  JustifyContent,
  AlignItems,
  FlexWrap,
  SizeMode,
} from "../lib/types";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { Check, MoveHorizontal, Shrink, ArrowLeftRight } from "lucide-react";

// Size mode dropdown component
function SizeModeDropdown({
  axis,
  mode,
  value,
  showFit,
  showFill,
  onChange,
  onValueChange,
}: {
  axis: "width" | "height";
  mode: SizeMode;
  value: number;
  showFit: boolean;
  showFill: boolean;
  onChange: (mode: SizeMode) => void;
  onValueChange: (value: number) => void;
}) {
  const label = axis === "width" ? "W" : "H";
  const fixedLabel = axis === "width" ? "Fixed width" : "Fixed height";

  const getModeIcon = (m: SizeMode) => {
    switch (m) {
      case "fixed":
        return <MoveHorizontal className="size-3" />;
      case "fit":
        return <Shrink className="size-3" />;
      case "expand":
        return <ArrowLeftRight className="size-3" />;
    }
  };

  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 h-5 px-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded cursor-pointer outline-none">
            <span className="text-zinc-500">{label}</span>
            {mode !== "fixed" && <span>{mode === "fit" ? "Hug" : "Fill"}</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[160px]">
          <DropdownMenuItem
            onClick={() => onChange("fixed")}
            className="flex items-center gap-2"
          >
            {mode === "fixed" ? (
              <Check className="size-4" />
            ) : (
              <span className="size-4" />
            )}
            {getModeIcon("fixed")}
            <span>
              {fixedLabel} ({value})
            </span>
          </DropdownMenuItem>
          {showFit && (
            <DropdownMenuItem
              onClick={() => onChange("fit")}
              className="flex items-center gap-2"
            >
              {mode === "fit" ? (
                <Check className="size-4" />
              ) : (
                <span className="size-4" />
              )}
              {getModeIcon("fit")}
              <span>Hug contents</span>
            </DropdownMenuItem>
          )}
          {showFill && (
            <DropdownMenuItem
              onClick={() => onChange("expand")}
              className="flex items-center gap-2"
            >
              {mode === "expand" ? (
                <Check className="size-4" />
              ) : (
                <span className="size-4" />
              )}
              {getModeIcon("expand")}
              <span>Fill container</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {mode === "fixed" ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
          className="w-10 h-5 text-[10px] font-mono text-zinc-400 bg-transparent border-none outline-none text-right hover:text-zinc-200 focus:text-zinc-200"
        />
      ) : (
        <span className="w-10 h-5 text-[10px] font-mono text-zinc-500 text-right leading-5">
          {value}
        </span>
      )}
    </div>
  );
}

interface PropertyPanelProps {
  selectedObjects: CanvasObject[];
  allObjects: CanvasObject[];
  transform: Transform;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
}

export function PropertyPanel({
  selectedObjects,
  allObjects,
  transform,
  containerRef,
  onUpdate,
}: PropertyPanelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOverlapping, setIsOverlapping] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedObject =
    selectedObjects.length === 1 ? selectedObjects[0] : null;

  // Check if selected object is inside a flex/grid container
  const isInsideFlexContainer = selectedObject
    ? (() => {
        if (!selectedObject.parentId) return false;
        const parent = allObjects.find((o) => o.id === selectedObject.parentId);
        return (
          parent?.type === "frame" &&
          (parent as FrameObject).layoutMode !== "none"
        );
      })()
    : false;

  // Check if selected frame has layout enabled (for showing Hug option)
  const hasLayoutEnabled =
    selectedObject?.type === "frame" &&
    (selectedObject as FrameObject).layoutMode !== "none";

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

  // Get fill color for display
  const fillColor =
    selectedObject.type === "frame"
      ? (selectedObject as FrameObject).fill
      : selectedObject.type === "text"
      ? (selectedObject as TextObject).fill
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
          flex flex-col gap-2 transition-all duration-200 rounded-lg
          ${showGlassyBg ? "bg-zinc-900/70 backdrop-blur-sm p-2 -m-2" : ""}
          ${isHovered ? "opacity-100" : "opacity-40"}
        `}
      >
        {/* Size */}
        <div className="flex items-center gap-1">
          {selectedObject.type === "frame" ? (
            <SizeModeDropdown
              axis="width"
              mode={(selectedObject as FrameObject).widthMode || "fixed"}
              value={Math.round(selectedObject.width)}
              showFit={hasLayoutEnabled}
              showFill={isInsideFlexContainer}
              onChange={(mode) =>
                onUpdate(selectedObject.id, {
                  widthMode: mode,
                } as Partial<FrameObject>)
              }
              onValueChange={(val) =>
                onUpdate(selectedObject.id, { width: val })
              }
            />
          ) : (
            <>
              <span className="text-[10px] text-zinc-500 w-3">W</span>
              <input
                type="number"
                value={Math.round(selectedObject.width)}
                onChange={(e) =>
                  onUpdate(selectedObject.id, {
                    width: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-10 h-5 text-[10px] font-mono text-zinc-400 bg-transparent border-none outline-none text-right hover:text-zinc-200 focus:text-zinc-200"
              />
            </>
          )}
          <span className="text-[10px] text-zinc-600">×</span>
          {selectedObject.type === "frame" ? (
            <SizeModeDropdown
              axis="height"
              mode={(selectedObject as FrameObject).heightMode || "fixed"}
              value={Math.round(selectedObject.height)}
              showFit={hasLayoutEnabled}
              showFill={isInsideFlexContainer}
              onChange={(mode) =>
                onUpdate(selectedObject.id, {
                  heightMode: mode,
                } as Partial<FrameObject>)
              }
              onValueChange={(val) =>
                onUpdate(selectedObject.id, { height: val })
              }
            />
          ) : (
            <>
              <span className="text-[10px] text-zinc-500 w-3">H</span>
              <input
                type="number"
                value={Math.round(selectedObject.height)}
                onChange={(e) =>
                  onUpdate(selectedObject.id, {
                    height: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-10 h-5 text-[10px] font-mono text-zinc-400 bg-transparent border-none outline-none hover:text-zinc-200 focus:text-zinc-200"
              />
            </>
          )}
        </div>

        {/* Position */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Math.round(selectedObject.x)}
            onChange={(e) =>
              onUpdate(selectedObject.id, {
                x: parseFloat(e.target.value) || 0,
              })
            }
            className="w-10 h-5 text-[10px] font-mono text-zinc-500 bg-transparent border-none outline-none text-right hover:text-zinc-300 focus:text-zinc-300"
          />
          <span className="text-[10px] text-zinc-700">,</span>
          <input
            type="number"
            value={Math.round(selectedObject.y)}
            onChange={(e) =>
              onUpdate(selectedObject.id, {
                y: parseFloat(e.target.value) || 0,
              })
            }
            className="w-10 h-5 text-[10px] font-mono text-zinc-500 bg-transparent border-none outline-none hover:text-zinc-300 focus:text-zinc-300"
          />
        </div>

        {/* Opacity */}
        <div className="flex items-center gap-1">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(selectedObject.opacity * 100)}
            onChange={(e) =>
              onUpdate(selectedObject.id, {
                opacity: parseInt(e.target.value) / 100,
              })
            }
            className="w-12 h-1 appearance-none bg-zinc-700 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-400"
          />
          <span className="text-[10px] font-mono text-zinc-500 w-6">
            {Math.round(selectedObject.opacity * 100)}%
          </span>
        </div>

        {/* Fill color - only for frames and text */}
        {fillColor && (
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={fillColor}
              onChange={(e) =>
                onUpdate(selectedObject.id, { fill: e.target.value })
              }
              className="w-4 h-4 rounded cursor-pointer border-none bg-transparent"
            />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">
              {fillColor.replace("#", "")}
            </span>
          </div>
        )}

        {/* Radius - only for frames */}
        {selectedObject.type === "frame" && (
          <div className="flex items-center gap-1">
            <svg
              viewBox="0 0 12 12"
              className="w-3 h-3 text-zinc-600"
              fill="none"
              stroke="currentColor"
            >
              <path d="M2 8 L2 4 Q2 2 4 2 L8 2" strokeWidth="1.5" />
            </svg>
            <input
              type="number"
              value={(selectedObject as FrameObject).radius}
              onChange={(e) =>
                onUpdate(selectedObject.id, {
                  radius: Math.max(0, parseFloat(e.target.value) || 0),
                } as Partial<FrameObject>)
              }
              className="w-6 h-5 text-[10px] font-mono text-zinc-500 bg-transparent border-none outline-none hover:text-zinc-300 focus:text-zinc-300"
            />
          </div>
        )}

        {/* Layout Mode - only for frames */}
        {selectedObject.type === "frame" && (
          <>
            <div className="h-px bg-zinc-800 my-1" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-600 w-8">Layout</span>
              <select
                value={(selectedObject as FrameObject).layoutMode || "none"}
                onChange={(e) =>
                  onUpdate(selectedObject.id, {
                    layoutMode: e.target.value as LayoutMode,
                  } as Partial<FrameObject>)
                }
                className="h-5 text-[10px] font-mono text-zinc-400 bg-zinc-800 border-none outline-none rounded cursor-pointer"
              >
                <option value="none">None</option>
                <option value="flex">Flex</option>
                <option value="grid">Grid</option>
              </select>
            </div>

            {/* Flex/Grid specific options */}
            {(selectedObject as FrameObject).layoutMode === "flex" && (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-600 w-8">Dir</span>
                  <select
                    value={
                      (selectedObject as FrameObject).flexDirection || "row"
                    }
                    onChange={(e) =>
                      onUpdate(selectedObject.id, {
                        flexDirection: e.target.value as FlexDirection,
                      } as Partial<FrameObject>)
                    }
                    className="h-5 text-[10px] font-mono text-zinc-400 bg-zinc-800 border-none outline-none rounded cursor-pointer"
                  >
                    <option value="row">Row</option>
                    <option value="column">Column</option>
                    <option value="row-reverse">Row ↩</option>
                    <option value="column-reverse">Col ↩</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-600 w-8">Justify</span>
                  <select
                    value={
                      (selectedObject as FrameObject).justifyContent ||
                      "flex-start"
                    }
                    onChange={(e) =>
                      onUpdate(selectedObject.id, {
                        justifyContent: e.target.value as JustifyContent,
                      } as Partial<FrameObject>)
                    }
                    className="h-5 text-[10px] font-mono text-zinc-400 bg-zinc-800 border-none outline-none rounded cursor-pointer"
                  >
                    <option value="flex-start">Start</option>
                    <option value="flex-end">End</option>
                    <option value="center">Center</option>
                    <option value="space-between">Between</option>
                    <option value="space-around">Around</option>
                    <option value="space-evenly">Evenly</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-600 w-8">Align</span>
                  <select
                    value={
                      (selectedObject as FrameObject).alignItems || "flex-start"
                    }
                    onChange={(e) =>
                      onUpdate(selectedObject.id, {
                        alignItems: e.target.value as AlignItems,
                      } as Partial<FrameObject>)
                    }
                    className="h-5 text-[10px] font-mono text-zinc-400 bg-zinc-800 border-none outline-none rounded cursor-pointer"
                  >
                    <option value="flex-start">Start</option>
                    <option value="flex-end">End</option>
                    <option value="center">Center</option>
                    <option value="stretch">Stretch</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-600 w-8">Wrap</span>
                  <select
                    value={(selectedObject as FrameObject).flexWrap || "nowrap"}
                    onChange={(e) =>
                      onUpdate(selectedObject.id, {
                        flexWrap: e.target.value as FlexWrap,
                      } as Partial<FrameObject>)
                    }
                    className="h-5 text-[10px] font-mono text-zinc-400 bg-zinc-800 border-none outline-none rounded cursor-pointer"
                  >
                    <option value="nowrap">No Wrap</option>
                    <option value="wrap">Wrap</option>
                    <option value="wrap-reverse">Wrap ↩</option>
                  </select>
                </div>
              </>
            )}

            {/* Gap and Padding - for flex and grid */}
            {((selectedObject as FrameObject).layoutMode === "flex" ||
              (selectedObject as FrameObject).layoutMode === "grid") && (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-600 w-8">Gap</span>
                  <input
                    type="number"
                    value={(selectedObject as FrameObject).gap || 0}
                    onChange={(e) =>
                      onUpdate(selectedObject.id, {
                        gap: Math.max(0, parseFloat(e.target.value) || 0),
                      } as Partial<FrameObject>)
                    }
                    className="w-8 h-5 text-[10px] font-mono text-zinc-500 bg-transparent border-none outline-none hover:text-zinc-300 focus:text-zinc-300"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-600 w-8">Pad</span>
                  <input
                    type="number"
                    value={(selectedObject as FrameObject).padding || 0}
                    onChange={(e) =>
                      onUpdate(selectedObject.id, {
                        padding: Math.max(0, parseFloat(e.target.value) || 0),
                      } as Partial<FrameObject>)
                    }
                    className="w-8 h-5 text-[10px] font-mono text-zinc-500 bg-transparent border-none outline-none hover:text-zinc-300 focus:text-zinc-300"
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* Font size - only for text */}
        {selectedObject.type === "text" && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-600">T</span>
            <input
              type="number"
              value={(selectedObject as TextObject).fontSize}
              onChange={(e) =>
                onUpdate(selectedObject.id, {
                  fontSize: Math.max(8, parseFloat(e.target.value) || 16),
                } as Partial<TextObject>)
              }
              className="w-6 h-5 text-[10px] font-mono text-zinc-500 bg-transparent border-none outline-none hover:text-zinc-300 focus:text-zinc-300"
            />
            <span className="text-[10px] text-zinc-600">px</span>
          </div>
        )}

        {/* Image dimensions - read only */}
        {selectedObject.type === "image" && (
          <span className="text-[10px] font-mono text-zinc-600">
            {(selectedObject as ImageObject).naturalWidth}×
            {(selectedObject as ImageObject).naturalHeight}
          </span>
        )}
      </div>
    </div>
  );
}
