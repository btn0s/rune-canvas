import type { CanvasObject, FrameObject } from "./types";
import { getCanvasPosition, type Rect } from "./geometry";

// ============================================================================
// Selection Helpers
// ============================================================================

/**
 * Compute the bounding box of selected objects in canvas space.
 */
export function getSelectionBounds(
  objects: CanvasObject[],
  ids: string[]
): Rect | null {
  const selected = objects.filter((o) => ids.includes(o.id));
  if (selected.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const obj of selected) {
    const canvasPos = getCanvasPosition(obj, objects);
    minX = Math.min(minX, canvasPos.x);
    minY = Math.min(minY, canvasPos.y);
    maxX = Math.max(maxX, canvasPos.x + obj.width);
    maxY = Math.max(maxY, canvasPos.y + obj.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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
  const padding = frame.padding || 0;

  if (children.length === 0) {
    return {
      width: padding * 2 || 100,
      height: padding * 2 || 100,
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
        width: totalWidth + padding * 2,
        height: maxHeight + padding * 2,
      };
    } else {
      const maxWidth = Math.max(...children.map((c) => c.width));
      const totalHeight = children.reduce(
        (sum, child, i) => sum + child.height + (i > 0 ? gap : 0),
        0
      );
      return {
        width: maxWidth + padding * 2,
        height: totalHeight + padding * 2,
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
    width: maxX + padding,
    height: maxY + padding,
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
