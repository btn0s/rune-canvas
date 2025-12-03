import { Frame, Transform } from "../lib/types";
import { useState, useEffect, useRef, useCallback } from "react";

interface LayersPanelProps {
  frames: Frame[];
  selectedIds: string[];
  transform: Transform;
  containerRef: React.RefObject<HTMLDivElement>;
  onSelect: (ids: string[] | null, addToSelection?: boolean) => void;
}

export function LayersPanel({
  frames,
  selectedIds,
  transform,
  containerRef,
  onSelect,
}: LayersPanelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const [isOverlapping, setIsOverlapping] = useState(false);
  const prevFrameIds = useRef<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Check if panel overlaps with any frame
  const checkOverlap = useCallback(() => {
    if (!panelRef.current || !containerRef.current) return;

    const panelRect = panelRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Convert panel rect to canvas coordinates
    const panelInCanvas = {
      x: (panelRect.left - containerRect.left - transform.x) / transform.scale,
      y: (panelRect.top - containerRect.top - transform.y) / transform.scale,
      width: panelRect.width / transform.scale,
      height: panelRect.height / transform.scale,
    };

    // Check intersection with any frame
    const overlaps = frames.some((f) => {
      return !(
        f.x + f.width < panelInCanvas.x ||
        f.x > panelInCanvas.x + panelInCanvas.width ||
        f.y + f.height < panelInCanvas.y ||
        f.y > panelInCanvas.y + panelInCanvas.height
      );
    });

    setIsOverlapping(overlaps);
  }, [frames, transform, containerRef]);

  // Check overlap on mount and when frames/transform change
  useEffect(() => {
    checkOverlap();
  }, [checkOverlap]);

  // Track new frames for animation
  useEffect(() => {
    const currentIds = new Set(frames.map((f) => f.id));
    const newIds = frames
      .filter((f) => !prevFrameIds.current.has(f.id))
      .map((f) => f.id);

    if (newIds.length > 0) {
      // Mark new frames as animating
      setAnimatedIds((prev) => new Set([...prev, ...newIds]));

      // Remove animation class after animation completes
      setTimeout(() => {
        setAnimatedIds((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 300);
    }

    prevFrameIds.current = currentIds;
  }, [frames]);

  // Reverse frames so top-most appears first
  const reversedFrames = [...frames].reverse();

  const showGlassyBg = isHovered && isOverlapping;

  return (
    <div
      ref={panelRef}
      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 -m-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          flex flex-col transition-all duration-200 rounded-lg
          ${showGlassyBg ? "bg-zinc-900/70 backdrop-blur-sm p-2 -m-2" : ""}
        `}
        style={{
          gap: isHovered ? 4 : 3,
        }}
      >
      {reversedFrames.map((frame) => {
        const isSelected = selectedIds.includes(frame.id);
        const isNew = animatedIds.has(frame.id);
        return (
          <div
            key={frame.id}
            className="relative flex items-center cursor-pointer transition-all duration-300 ease-out overflow-hidden"
            style={{
              width: isHovered ? "100%" : 24,
              height: isHovered ? 20 : 2,
              paddingLeft: isHovered ? 8 : 0,
              paddingRight: isHovered ? 8 : 0,
              opacity: isNew ? 0 : 1,
              transform: isNew ? "translateX(-10px)" : "translateX(0)",
              animation: isNew ? "slideIn 300ms ease-out forwards" : undefined,
            }}
            onClick={(e) => {
              if (e.shiftKey) {
                onSelect([frame.id], true);
              } else {
                onSelect([frame.id]);
              }
            }}
          >
            {/* Collapsed line (visible when not hovered) - no transition to avoid ghosts */}
            {!isHovered && (
              <div
                className={`
                  absolute inset-0 rounded-full
                  ${isSelected ? "bg-blue-400/70" : "bg-zinc-600"}
                `}
              />
            )}
            {/* Expanded name */}
            <span
              className={`
                text-xs whitespace-nowrap transition-all duration-300 ease-out
                ${isSelected ? "text-blue-400" : "text-zinc-500"}
              `}
              style={{
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? "translateX(0)" : "translateX(-8px)",
              }}
            >
              {frame.name}
            </span>
          </div>
        );
      })}
      </div>
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
