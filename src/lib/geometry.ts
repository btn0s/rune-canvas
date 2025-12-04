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
