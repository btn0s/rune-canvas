import type { CanvasObject, Point } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * A rectangle in canvas space with position and dimensions.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Position Helpers
// ============================================================================

/**
 * Get the absolute canvas-space position of an object,
 * accounting for parent transforms in the hierarchy.
 *
 * Objects store positions relative to their parent. This function
 * walks up the parent chain to compute the absolute position.
 */
export function getCanvasPosition(
  obj: CanvasObject,
  objects: CanvasObject[]
): Point {
  let x = obj.x;
  let y = obj.y;
  let parentId = obj.parentId;

  while (parentId) {
    const parent = objects.find((o) => o.id === parentId);
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    parentId = parent.parentId;
  }

  return { x, y };
}

/**
 * Convert a CanvasObject to a Rect in absolute canvas space.
 */
export function toCanvasRect(obj: CanvasObject, objects: CanvasObject[]): Rect {
  const pos = getCanvasPosition(obj, objects);
  return {
    x: pos.x,
    y: pos.y,
    width: obj.width,
    height: obj.height,
  };
}

// ============================================================================
// Geometry Utilities
// ============================================================================

/**
 * Check if a point is inside a rectangle.
 */
export function rectContainsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if two rectangles intersect (share any area).
 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Get the bounding box that contains all given rectangles.
 */
export function getBoundingRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ============================================================================
// Transformed Rect - unified system for rotated bounds
// ============================================================================

export interface TransformedRect {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotation: number;
}

export function createTransformedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number
): TransformedRect {
  return {
    cx: x + width / 2,
    cy: y + height / 2,
    width,
    height,
    rotation,
  };
}

export function worldToLocal(point: Point, tr: TransformedRect): Point {
  if (tr.rotation === 0) {
    return { x: point.x - tr.cx, y: point.y - tr.cy };
  }
  const rad = (-tr.rotation * Math.PI) / 180;
  const dx = point.x - tr.cx;
  const dy = point.y - tr.cy;
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad),
    y: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function localToWorld(point: Point, tr: TransformedRect): Point {
  if (tr.rotation === 0) {
    return { x: point.x + tr.cx, y: point.y + tr.cy };
  }
  const rad = (tr.rotation * Math.PI) / 180;
  const rotatedX = point.x * Math.cos(rad) - point.y * Math.sin(rad);
  const rotatedY = point.x * Math.sin(rad) + point.y * Math.cos(rad);
  return { x: rotatedX + tr.cx, y: rotatedY + tr.cy };
}

export function localDeltaToWorld(dx: number, dy: number, rotation: number): Point {
  if (rotation === 0) return { x: dx, y: dy };
  const rad = (rotation * Math.PI) / 180;
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad),
    y: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function worldDeltaToLocal(dx: number, dy: number, rotation: number): Point {
  if (rotation === 0) return { x: dx, y: dy };
  const rad = (-rotation * Math.PI) / 180;
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad),
    y: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function hitTestTransformedRect(point: Point, tr: TransformedRect): boolean {
  const local = worldToLocal(point, tr);
  return (
    Math.abs(local.x) <= tr.width / 2 && Math.abs(local.y) <= tr.height / 2
  );
}

export function drawTransformedRect(
  ctx: CanvasRenderingContext2D,
  tr: TransformedRect,
  draw: () => void
): void {
  ctx.save();
  ctx.translate(tr.cx, tr.cy);
  if (tr.rotation !== 0) {
    ctx.rotate((tr.rotation * Math.PI) / 180);
  }
  draw();
  ctx.restore();
}

// ============================================================================
// Legacy rotation utilities (for compatibility)
// ============================================================================

export function rotatePoint(
  point: Point,
  center: Point,
  angleDegrees: number
): Point {
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function getRotatedBoundingBox(
  rect: Rect,
  rotation: number,
  center?: Point
): Rect {
  if (rotation === 0) return rect;

  const cx = center?.x ?? rect.x + rect.width / 2;
  const cy = center?.y ?? rect.y + rect.height / 2;

  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  const rotated = corners.map((p) => rotatePoint(p, { x: cx, y: cy }, rotation));

  const xs = rotated.map((p) => p.x);
  const ys = rotated.map((p) => p.y);

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function angleBetweenPoints(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
}


