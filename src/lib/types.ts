export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface Frame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

export type Tool =
  | "select"
  | "hand"
  | "frame"
  | "rectangle"
  | "text"
  | "shader";

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface Guide {
  type: "vertical" | "horizontal" | "width" | "height" | "gap";
  position?: number;
  label?: string;
  refFrame?: { x: number; y: number; width: number; height: number };
  distance?: number;
  orientation?: "vertical" | "horizontal";
  // Bounds for alignment lines (so they don't extend past elements)
  startBound?: number;
  endBound?: number;
  // Gap-specific properties for rendering
  gapStart?: number;
  gapEnd?: number;
  gapTopY?: number; // for vertical gaps - top edge of overlap
  gapBottomY?: number; // for vertical gaps - bottom edge of overlap
  gapLeftX?: number; // for horizontal gaps - left edge of overlap
  gapRightX?: number; // for horizontal gaps - right edge of overlap
}

