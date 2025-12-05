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

export type StrokeStyle = "solid" | "dashed";
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten";
export type BorderSide = "all" | "top" | "right" | "bottom" | "left";

export interface ShadowProps {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

export interface FrameObject extends BaseObject {
  type: "frame";
  fill: string;
  fillOpacity?: number; // 0-1, defaults to 1
  // Radius (single or individual corners)
  radius: number;
  radiusTL?: number; // Top-left
  radiusTR?: number; // Top-right
  radiusBR?: number; // Bottom-right
  radiusBL?: number; // Bottom-left
  // Blending
  blendMode?: BlendMode;
  // Clip content
  clipContent: boolean;
  // Border (inside - shrinks content, uses border-box)
  border?: string; // Color (hex)
  borderWidth?: number; // Width in px
  borderOpacity?: number; // 0-1
  borderStyle?: StrokeStyle;
  borderSide?: BorderSide; // Which sides to apply border
  // Outline (outside - purely visual, doesn't affect content)
  outline?: string; // Color (hex)
  outlineWidth?: number; // Width in px
  outlineOpacity?: number; // 0-1
  outlineStyle?: StrokeStyle;
  outlineOffset?: number; // Offset from edge
  // Shadow (drop shadow)
  shadow?: ShadowProps;
  // Inner shadow
  innerShadow?: ShadowProps;
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

export type ImageFillMode = "fill" | "fit" | "crop";

export interface ImageObject extends BaseObject {
  type: "image";
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  // Fill mode determines how the image fits within the frame
  fillMode: ImageFillMode;
  // Crop state - only used when fillMode is "crop"
  // Values are in image pixels (0 to naturalWidth/Height)
  cropX: number; // Left edge of visible area
  cropY: number; // Top edge of visible area
  cropWidth: number; // Width of visible area
  cropHeight: number; // Height of visible area
}

export type TextSizeMode = "auto-width" | "auto-height" | "fixed";

export interface TextObject extends BaseObject {
  type: "text";
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textAlign: "left" | "center" | "right";
  color: string;
  sizeMode: TextSizeMode;
}

export type CanvasObject = FrameObject | ImageObject | TextObject;

export type Tool = "select" | "hand" | "frame" | "text" | "shader";

export type SidebarMode = "show" | "hide";

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

