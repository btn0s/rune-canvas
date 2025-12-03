import {
  CanvasObject,
  FrameObject,
  TextObject,
  ImageObject,
  Transform,
} from "../lib/types";
import { useState, useEffect, useRef, useCallback } from "react";

interface PropertyPanelProps {
  selectedObjects: CanvasObject[];
  transform: Transform;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
}

export function PropertyPanel({
  selectedObjects,
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
          <span className="text-[10px] text-zinc-600">×</span>
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
