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
  rotation: number; // degrees, 0-360
  visible: boolean;
  locked: boolean;
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
  id: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  visible: boolean;
}

// Helper to create a default shadow
export function createShadow(
  x = 0,
  y = 4,
  blur = 8,
  spread = 0,
  color = "#000000",
  opacity = 0.25
): ShadowProps {
  return {
    id: `shadow-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x,
    y,
    blur,
    spread,
    color,
    opacity,
    visible: true,
  };
}

// Helper to create a default inner shadow
export function createInnerShadow(
  x = 0,
  y = 2,
  blur = 4,
  spread = 0,
  color = "#000000",
  opacity = 0.25
): ShadowProps {
  return {
    id: `ishadow-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x,
    y,
    blur,
    spread,
    color,
    opacity,
    visible: true,
  };
}

// =============================================================================
// Fill System - Stackable fills for frames
// =============================================================================

export type GradientType = "linear" | "radial";

export interface GradientStop {
  position: number; // 0-1
  color: string;
  opacity: number; // 0-1
}

export interface BaseFill {
  id: string;
  visible: boolean;
  opacity: number; // 0-1
}

export interface SolidFill extends BaseFill {
  type: "solid";
  color: string;
}

export interface GradientFill extends BaseFill {
  type: "gradient";
  gradientType: GradientType;
  angle: number; // degrees, for linear
  stops: GradientStop[];
}

export interface ImageFill extends BaseFill {
  type: "image";
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  fillMode: ImageFillMode;
  // Crop (for fillMode: "crop")
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
}

export type Fill = SolidFill | GradientFill | ImageFill;

// Helper to create a default solid fill
export function createSolidFill(color: string, opacity = 1): SolidFill {
  return {
    id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "solid",
    visible: true,
    opacity,
    color,
  };
}

// =============================================================================

export interface FrameObject extends BaseObject {
  type: "frame";
  // Stackable fills (rendered bottom to top)
  fills: Fill[];
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
  // Stackable shadows (rendered as CSS box-shadow, comma-separated)
  shadows: ShadowProps[];
  // Stackable inner shadows (rendered as inset box-shadow)
  innerShadows: ShadowProps[];
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
  // Per-side padding
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
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

export type FontStyle = "normal" | "italic";
export type TextDecoration = "none" | "underline" | "strikethrough";
export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";
export type VerticalAlign = "top" | "center" | "bottom";

export interface TextObject extends BaseObject {
  type: "text";
  content: string;
  // Font
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: FontStyle;
  // Spacing
  lineHeight: number; // multiplier (1.2 = 120%), 0 = auto
  letterSpacing: number; // em units (0.05 = 5% of font size)
  // Alignment
  textAlign: "left" | "center" | "right" | "justify";
  verticalAlign: VerticalAlign;
  // Decoration
  textDecoration: TextDecoration;
  textTransform: TextTransform;
  // Color
  color: string;
  // Sizing
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

