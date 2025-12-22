import type { CanvasObject, FrameObject } from "./types";
import {
  getCanvasPosition,
  getRotatedBoundingBox,
  type TransformedRect,
} from "./geometry";

export interface SelectionBounds extends TransformedRect {
  x: number;
  y: number;
  center: { x: number; y: number };
}

function createSelectionBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number
): SelectionBounds {
  return {
    cx: x + width / 2,
    cy: y + height / 2,
    width,
    height,
    rotation,
    x,
    y,
    center: { x: x + width / 2, y: y + height / 2 },
  };
}

export function getSelectionBounds(
  objects: CanvasObject[],
  ids: string[]
): SelectionBounds | null {
  const selected = objects.filter((o) => ids.includes(o.id));
  if (selected.length === 0) return null;

  if (selected.length === 1) {
    const obj = selected[0];
    const canvasPos = getCanvasPosition(obj, objects);
    return createSelectionBounds(
      canvasPos.x,
      canvasPos.y,
      obj.width,
      obj.height,
      obj.rotation
    );
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const obj of selected) {
    const canvasPos = getCanvasPosition(obj, objects);
    const rect = { x: canvasPos.x, y: canvasPos.y, width: obj.width, height: obj.height };
    const aabb = getRotatedBoundingBox(rect, obj.rotation);
    minX = Math.min(minX, aabb.x);
    minY = Math.min(minY, aabb.y);
    maxX = Math.max(maxX, aabb.x + aabb.width);
    maxY = Math.max(maxY, aabb.y + aabb.height);
  }

  return createSelectionBounds(minX, minY, maxX - minX, maxY - minY, 0);
}

export function getObjectTransform(
  obj: CanvasObject,
  objects: CanvasObject[]
): TransformedRect {
  const canvasPos = getCanvasPosition(obj, objects);
  return {
    cx: canvasPos.x + obj.width / 2,
    cy: canvasPos.y + obj.height / 2,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation,
  };
}

// ============================================================================
// Tree Operations
// ============================================================================

/**
 * Get all descendants of given object IDs (children, grandchildren, etc.)
 */
export function getDescendants(
  ids: string[],
  objects: CanvasObject[]
): CanvasObject[] {
  const result: CanvasObject[] = [];

  const collectDescendants = (parentIds: string[]) => {
    const children = objects.filter(
      (o) => o.parentId && parentIds.includes(o.parentId)
    );
    if (children.length > 0) {
      result.push(...children);
      collectDescendants(children.map((c) => c.id));
    }
  };

  collectDescendants(ids);
  return result;
}

/**
 * Duplicate a tree of objects with new IDs and proper parent remapping.
 */
export function duplicateTree(
  objectsToDupe: CanvasObject[],
  offset: { x: number; y: number } = { x: 20, y: 20 },
  appendCopy: boolean = true
): CanvasObject[] {
  const idMap = new Map<string, string>();

  objectsToDupe.forEach((o, index) => {
    idMap.set(
      o.id,
      `${o.type}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
    );
  });

  return objectsToDupe.map((o) => {
    const parentInSet = o.parentId && idMap.has(o.parentId);
    const isRoot = !o.parentId || !parentInSet;

    let newParentId: string | null = null;
    if (o.parentId) {
      if (parentInSet) {
        newParentId = idMap.get(o.parentId)!;
      } else {
        newParentId = o.parentId;
      }
    }

    return {
      ...o,
      id: idMap.get(o.id)!,
      name: appendCopy ? `${o.name} copy` : o.name,
      parentId: newParentId,
      x: isRoot ? o.x + offset.x : o.x,
      y: isRoot ? o.y + offset.y : o.y,
    };
  });
}

// ============================================================================
// Layout Calculations
// ============================================================================

/**
 * Calculate hugged size for a frame based on its children.
 */
export function calculateHuggedSize(
  frame: FrameObject,
  allObjects: CanvasObject[]
): { width: number; height: number } {
  const children = allObjects.filter((o) => o.parentId === frame.id);
  const paddingH = (frame.paddingLeft || 0) + (frame.paddingRight || 0);
  const paddingV = (frame.paddingTop || 0) + (frame.paddingBottom || 0);

  if (children.length === 0) {
    return {
      width: paddingH || 100,
      height: paddingV || 100,
    };
  }

  // For flex layout, calculate based on flow direction
  if (frame.layoutMode === "flex") {
    const gap = frame.gap || 0;
    const isRow =
      frame.flexDirection === "row" || frame.flexDirection === "row-reverse";

    if (isRow) {
      const totalWidth = children.reduce(
        (sum, child, i) => sum + child.width + (i > 0 ? gap : 0),
        0
      );
      const maxHeight = Math.max(...children.map((c) => c.height));
      return {
        width: totalWidth + paddingH,
        height: maxHeight + paddingV,
      };
    } else {
      const maxWidth = Math.max(...children.map((c) => c.width));
      const totalHeight = children.reduce(
        (sum, child, i) => sum + child.height + (i > 0 ? gap : 0),
        0
      );
      return {
        width: maxWidth + paddingH,
        height: totalHeight + paddingV,
      };
    }
  }

  // For absolute positioning, find bounding box
  let maxX = 0;
  let maxY = 0;
  for (const child of children) {
    maxX = Math.max(maxX, child.x + child.width);
    maxY = Math.max(maxY, child.y + child.height);
  }

  return {
    width: maxX + (frame.paddingRight || 0),
    height: maxY + (frame.paddingBottom || 0),
  };
}

/**
 * Recalculate hug sizes for frames that have fit mode enabled.
 */
export function recalculateHugSizes(
  objects: CanvasObject[]
): CanvasObject[] {
  const framesToUpdate = objects.filter(
    (o) =>
      o.type === "frame" &&
      ((o as FrameObject).widthMode === "fit" ||
        (o as FrameObject).heightMode === "fit")
  ) as FrameObject[];

  if (framesToUpdate.length === 0) return objects;

  const updates = new Map<string, Partial<FrameObject>>();

  for (const frame of framesToUpdate) {
    const { width, height } = calculateHuggedSize(frame, objects);
    const frameUpdate: Partial<FrameObject> = {};

    if (frame.widthMode === "fit") {
      frameUpdate.width = width;
    }
    if (frame.heightMode === "fit") {
      frameUpdate.height = height;
    }

    if (Object.keys(frameUpdate).length > 0) {
      updates.set(frame.id, frameUpdate);
    }
  }

  if (updates.size === 0) return objects;

  return objects.map((o) => {
    const update = updates.get(o.id);
    return update ? ({ ...o, ...update } as CanvasObject) : o;
  });
}

