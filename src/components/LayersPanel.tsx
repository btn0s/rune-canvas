import { Frame } from "../lib/types";
import { useState, useEffect, useRef } from "react";

interface LayersPanelProps {
  frames: Frame[];
  selectedIds: string[];
  onSelect: (ids: string[] | null, addToSelection?: boolean) => void;
}

export function LayersPanel({
  frames,
  selectedIds,
  onSelect,
}: LayersPanelProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const prevFrameIds = useRef<Set<string>>(new Set());

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

  return (
    <div
      className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col p-2 rounded-lg bg-zinc-900/50 backdrop-blur-sm transition-all duration-300 ease-out"
      style={{
        width: isHovered ? "auto" : "fit-content",
        minWidth: isHovered ? 140 : 40,
        gap: isHovered ? 4 : 2,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {reversedFrames.map((frame) => {
        const isSelected = selectedIds.includes(frame.id);
        const isNew = animatedIds.has(frame.id);
        return (
          <div
            key={frame.id}
            className={`
              relative flex items-center cursor-pointer rounded
              transition-all duration-300 ease-out overflow-hidden
              ${isSelected ? "bg-blue-500/20" : "hover:bg-zinc-800"}
            `}
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
                  ${isSelected ? "bg-blue-400" : "bg-zinc-500"}
                `}
              />
            )}
            {/* Expanded name */}
            <span
              className={`
                text-xs whitespace-nowrap transition-all duration-300 ease-out
                ${isSelected ? "text-blue-400" : "text-zinc-400"}
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
