import { Frame } from "../lib/types";
import { useState } from "react";

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

  // Reverse frames so top-most appears first
  const reversedFrames = [...frames].reverse();

  return (
    <div
      className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-2 rounded-lg bg-zinc-900/50 backdrop-blur-sm transition-all duration-300 ease-out"
      style={{
        width: isHovered ? "auto" : "fit-content",
        minWidth: isHovered ? 140 : 40,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {reversedFrames.map((frame) => {
        const isSelected = selectedIds.includes(frame.id);
        return (
          <div
            key={frame.id}
            className={`
              relative h-5 flex items-center cursor-pointer rounded
              transition-all duration-300 ease-out overflow-hidden
              ${isSelected ? "bg-blue-500/20" : "hover:bg-zinc-800"}
            `}
            style={{
              width: isHovered ? "100%" : 24,
              paddingLeft: isHovered ? 8 : 0,
              paddingRight: isHovered ? 8 : 0,
            }}
            onClick={(e) => {
              if (e.shiftKey) {
                onSelect([frame.id], true);
              } else {
                onSelect([frame.id]);
              }
            }}
          >
            {/* Collapsed line */}
            <div
              className={`
                absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                h-[2px] rounded-full transition-all duration-300 ease-out
                ${isSelected ? "bg-blue-400" : "bg-zinc-500"}
              `}
              style={{
                width: isHovered ? 0 : 20,
                opacity: isHovered ? 0 : 1,
              }}
            />
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
    </div>
  );
}
