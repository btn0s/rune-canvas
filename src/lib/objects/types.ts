/**
 * Object Type System
 *
 * Clean, extensible type hierarchy for canvas objects.
 *
 * Design principles:
 * 1. BaseObject contains ALL common properties (no optional mess)
 * 2. Each object type extends BaseObject with type-specific properties
 * 3. Discriminated union via `type` field for type narrowing
 */

// ============================================================================
// Primitives
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds extends Point, Size {}

// ============================================================================
// Common Types
// ============================================================================

export type ObjectType = "frame" | "text" | "image";

/** How an object sizes itself */
export type SizeMode = "fixed" | "fit" | "expand";

/** How text sizes itself */
export type TextSizeMode = "auto-width" | "auto-height" | "fixed";

// ============================================================================
// Base Object
// ============================================================================

/**
 * BaseObject - Properties shared by ALL canvas objects.
 *
 * Every object has:
 * - Identity: id, name, type
 * - Hierarchy: parentId
 * - Geometry: x, y, width, height
 * - Appearance: opacity
 */
export interface BaseObject {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Object type for discriminated union */
  type: ObjectType;
  /** Parent object ID (null = root level) */
  parentId: string | null;
  /** X position relative to parent (or canvas if root) */
  x: number;
  /** Y position relative to parent (or canvas if root) */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Opacity 0-1 */
  opacity: number;
}

// ============================================================================
// Frame Object
// ============================================================================

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
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten";
export type BorderSide = "all" | "top" | "right" | "bottom" | "left";
export type StrokeStyle = "solid" | "dashed";

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

  // === Fill ===
  fill: string;
  fillOpacity?: number;

  // === Border Radius ===
  radius: number;
  radiusTL?: number;
  radiusTR?: number;
  radiusBR?: number;
  radiusBL?: number;

  // === Blending ===
  blendMode?: BlendMode;

  // === Clipping ===
  clipContent: boolean;

  // === Border (inside) ===
  border?: string;
  borderWidth?: number;
  borderOpacity?: number;
  borderStyle?: StrokeStyle;
  borderSide?: BorderSide;

  // === Outline (outside) ===
  outline?: string;
  outlineWidth?: number;
  outlineOpacity?: number;
  outlineStyle?: StrokeStyle;
  outlineOffset?: number;

  // === Shadows ===
  shadow?: ShadowProps;
  innerShadow?: ShadowProps;

  // === Size Behavior ===
  widthMode: SizeMode;
  heightMode: SizeMode;

  // === Layout (as container) ===
  layoutMode: LayoutMode;
  flexDirection: FlexDirection;
  justifyContent: JustifyContent;
  alignItems: AlignItems;
  flexWrap: FlexWrap;
  gap: number;
  padding: number;
}

// ============================================================================
// Text Object
// ============================================================================

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

// ============================================================================
// Image Object
// ============================================================================

export interface ImageObject extends BaseObject {
  type: "image";

  src: string;
  naturalWidth: number;
  naturalHeight: number;

  // Crop state - defines which portion of the image is visible
  // Values are in image pixels (0 to naturalWidth/Height)
  cropX: number; // Left edge of visible area
  cropY: number; // Top edge of visible area
  cropWidth: number; // Width of visible area
  cropHeight: number; // Height of visible area
}

// ============================================================================
// Union Type
// ============================================================================

export type CanvasObject = FrameObject | TextObject | ImageObject;

// ============================================================================
// Type Guards
// ============================================================================

export function isFrame(obj: CanvasObject): obj is FrameObject {
  return obj.type === "frame";
}

export function isText(obj: CanvasObject): obj is TextObject {
  return obj.type === "text";
}

export function isImage(obj: CanvasObject): obj is ImageObject {
  return obj.type === "image";
}
