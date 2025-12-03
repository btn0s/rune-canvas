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
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

// Canvas object types with parent-child support
export interface BaseObject {
  id: string;
  name: string;
  parentId: string | null; // null = root level
  x: number; // relative to parent (or canvas if root)
  y: number; // relative to parent (or canvas if root)
  width: number;
  height: number;
  opacity: number;
}

export type LayoutMode = "none" | "flex" | "grid";
export type FlexDirection = "row" | "column" | "row-reverse" | "column-reverse";
export type JustifyContent =
  | "flex-start"
  | "flex-end"
  | "center"
  | "space-between"
  | "space-around"
  | "space-evenly";
export type AlignItems = "flex-start" | "flex-end" | "center" | "stretch";
export type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";
export type SizeMode = "fixed" | "fit" | "expand";

export interface FrameObject extends BaseObject {
  type: "frame";
  fill: string;
  radius: number;
  clipContent: boolean; // toggle for overflow hidden
  // Size modes
  widthMode: SizeMode;
  heightMode: SizeMode;
  // Layout properties
  layoutMode: LayoutMode;
  flexDirection: FlexDirection;
  justifyContent: JustifyContent;
  alignItems: AlignItems;
  flexWrap: FlexWrap;
  gap: number;
  padding: number;
}

export interface ImageObject extends BaseObject {
  type: "image";
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface TextObject extends BaseObject {
  type: "text";
  content: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
}

export type CanvasObject = FrameObject | ImageObject | TextObject;

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

