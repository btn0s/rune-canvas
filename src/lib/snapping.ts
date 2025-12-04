import type { CanvasObject, Guide, ResizeHandle } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SnapTarget {
  value: number;
  objectId: string;
  object: Rect;
}

interface GapInfo {
  distance: number;
  start: number;
  end: number;
  topY?: number;
  bottomY?: number;
  leftX?: number;
  rightX?: number;
}

export type SnapMode = "move" | "create" | "resize";

// ============================================================================
// Constants
// ============================================================================

const SNAP_THRESHOLD = 8;

// ============================================================================
// Canvas Position Helpers
// ============================================================================

/**
 * Get the absolute canvas-space position of an object,
 * accounting for parent transforms in the hierarchy.
 */
export function getCanvasPosition(
  obj: CanvasObject,
  objects: CanvasObject[]
): { x: number; y: number } {
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
 * Convert a CanvasObject to a Rect in canvas space.
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
// Guide Creation Helpers
// ============================================================================

function createVerticalGuide(
  position: number,
  currentObj: { y: number; height: number },
  snapObj: { y: number; height: number }
): Guide {
  return {
    type: "vertical",
    position,
    startBound: Math.min(currentObj.y, snapObj.y),
    endBound: Math.max(
      currentObj.y + currentObj.height,
      snapObj.y + snapObj.height
    ),
  };
}

function createHorizontalGuide(
  position: number,
  currentObj: { x: number; width: number },
  snapObj: { x: number; width: number }
): Guide {
  return {
    type: "horizontal",
    position,
    startBound: Math.min(currentObj.x, snapObj.x),
    endBound: Math.max(
      currentObj.x + currentObj.width,
      snapObj.x + snapObj.width
    ),
  };
}

// ============================================================================
// Gap Calculation
// ============================================================================

/**
 * Calculate all horizontal and vertical gaps between objects.
 * Used for gap snapping during drag operations.
 */
export function calculateAllGaps(
  objects: CanvasObject[],
  allObjects: CanvasObject[]
): {
  horizontal: GapInfo[];
  vertical: GapInfo[];
} {
  const horizontal: GapInfo[] = [];
  const vertical: GapInfo[] = [];

  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];
      const aPos = getCanvasPosition(a, allObjects);
      const bPos = getCanvasPosition(b, allObjects);

      // Horizontal gap (objects side by side)
      if (aPos.x + a.width < bPos.x) {
        const gapStart = aPos.x + a.width;
        const gapEnd = bPos.x;
        const overlapTop = Math.max(aPos.y, bPos.y);
        const overlapBottom = Math.min(aPos.y + a.height, bPos.y + b.height);
        if (overlapBottom > overlapTop) {
          horizontal.push({
            distance: Math.round(gapEnd - gapStart),
            start: gapStart,
            end: gapEnd,
            topY: overlapTop,
            bottomY: overlapBottom,
          });
        }
      } else if (bPos.x + b.width < aPos.x) {
        const gapStart = bPos.x + b.width;
        const gapEnd = aPos.x;
        const overlapTop = Math.max(aPos.y, bPos.y);
        const overlapBottom = Math.min(aPos.y + a.height, bPos.y + b.height);
        if (overlapBottom > overlapTop) {
          horizontal.push({
            distance: Math.round(gapEnd - gapStart),
            start: gapStart,
            end: gapEnd,
            topY: overlapTop,
            bottomY: overlapBottom,
          });
        }
      }

      // Vertical gap (objects stacked)
      if (aPos.y + a.height < bPos.y) {
        const gapStart = aPos.y + a.height;
        const gapEnd = bPos.y;
        const overlapLeft = Math.max(aPos.x, bPos.x);
        const overlapRight = Math.min(aPos.x + a.width, bPos.x + b.width);
        if (overlapRight > overlapLeft) {
          vertical.push({
            distance: Math.round(gapEnd - gapStart),
            start: gapStart,
            end: gapEnd,
            leftX: overlapLeft,
            rightX: overlapRight,
          });
        }
      } else if (bPos.y + b.height < aPos.y) {
        const gapStart = bPos.y + b.height;
        const gapEnd = aPos.y;
        const overlapLeft = Math.max(aPos.x, bPos.x);
        const overlapRight = Math.min(aPos.x + a.width, bPos.x + b.width);
        if (overlapRight > overlapLeft) {
          vertical.push({
            distance: Math.round(gapEnd - gapStart),
            start: gapStart,
            end: gapEnd,
            leftX: overlapLeft,
            rightX: overlapRight,
          });
        }
      }
    }
  }

  return { horizontal, vertical };
}

// ============================================================================
// Snapping Engine
// ============================================================================

export interface SnapResult {
  x: number;
  y: number;
  width: number;
  height: number;
  guides: Guide[];
}

/**
 * Calculate snapped position for an object based on nearby objects.
 * Handles edge snapping, center snapping, and gap snapping.
 */
export function calculateSnapping(
  obj: Rect,
  otherObjects: CanvasObject[],
  allObjects: CanvasObject[],
  mode: SnapMode,
  resizeHandle?: ResizeHandle
): SnapResult {
  let { x, y, width, height } = obj;
  const guides: Guide[] = [];

  if (otherObjects.length === 0) {
    return { x, y, width, height, guides };
  }

  // Collect snap targets with object references (using canvas-space positions)
  const xTargets: SnapTarget[] = [];
  const yTargets: SnapTarget[] = [];

  for (const other of otherObjects) {
    const canvasPos = getCanvasPosition(other, allObjects);
    const rect: Rect = {
      ...canvasPos,
      width: other.width,
      height: other.height,
    };

    xTargets.push({ value: canvasPos.x, objectId: other.id, object: rect });
    xTargets.push({
      value: canvasPos.x + other.width,
      objectId: other.id,
      object: rect,
    });
    xTargets.push({
      value: canvasPos.x + other.width / 2,
      objectId: other.id,
      object: rect,
    });

    yTargets.push({ value: canvasPos.y, objectId: other.id, object: rect });
    yTargets.push({
      value: canvasPos.y + other.height,
      objectId: other.id,
      object: rect,
    });
    yTargets.push({
      value: canvasPos.y + other.height / 2,
      objectId: other.id,
      object: rect,
    });
  }

  let snappedX = false;
  let snappedY = false;

  // Helper to try snapping X position
  const trySnapX = (
    edgePos: number,
    applySnap: (targetValue: number) => void
  ) => {
    if (snappedX) return;
    for (const target of xTargets) {
      if (Math.abs(edgePos - target.value) < SNAP_THRESHOLD) {
        applySnap(target.value);
        snappedX = true;
        guides.push(
          createVerticalGuide(target.value, { y, height }, target.object)
        );
        break;
      }
    }
  };

  // Helper to try snapping Y position
  const trySnapY = (
    edgePos: number,
    applySnap: (targetValue: number) => void
  ) => {
    if (snappedY) return;
    for (const target of yTargets) {
      if (Math.abs(edgePos - target.value) < SNAP_THRESHOLD) {
        applySnap(target.value);
        snappedY = true;
        guides.push(
          createHorizontalGuide(target.value, { x, width }, target.object)
        );
        break;
      }
    }
  };

  if (mode === "move" || mode === "create") {
    // Snap left edge
    trySnapX(x, (v) => {
      x = v;
    });
    // Snap right edge
    trySnapX(x + width, (v) => {
      x = v - width;
    });
    // Snap center X
    trySnapX(x + width / 2, (v) => {
      x = v - width / 2;
    });

    // Snap top edge
    trySnapY(y, (v) => {
      y = v;
    });
    // Snap bottom edge
    trySnapY(y + height, (v) => {
      y = v - height;
    });
    // Snap center Y
    trySnapY(y + height / 2, (v) => {
      y = v - height / 2;
    });
  }

  // Edge snapping during resize
  if (mode === "resize" && resizeHandle) {
    if (resizeHandle.includes("e")) {
      trySnapX(x + width, (v) => {
        width = v - x;
      });
    }
    if (resizeHandle.includes("w")) {
      trySnapX(x, (v) => {
        width = width + (x - v);
        x = v;
      });
    }
    if (resizeHandle.includes("s")) {
      trySnapY(y + height, (v) => {
        height = v - y;
      });
    }
    if (resizeHandle.includes("n")) {
      trySnapY(y, (v) => {
        height = height + (y - v);
        y = v;
      });
    }
  }

  // Gap snapping for move mode
  if (mode === "move") {
    const allGaps = calculateAllGaps(otherObjects, allObjects);

    // Try horizontal gap snapping
    for (const gap of allGaps.horizontal) {
      if (snappedX) break;
      for (const other of otherObjects) {
        const otherCanvasPos = getCanvasPosition(other, allObjects);
        const gapToRight = otherCanvasPos.x - (x + width);
        if (
          gapToRight > 0 &&
          Math.abs(gapToRight - gap.distance) < SNAP_THRESHOLD
        ) {
          x = otherCanvasPos.x - width - gap.distance;
          snappedX = true;
          // Add guide for the new gap being created
          guides.push({
            type: "gap",
            distance: gap.distance,
            orientation: "vertical",
            gapStart: x + width,
            gapEnd: otherCanvasPos.x,
            gapTopY: Math.max(y, otherCanvasPos.y),
            gapBottomY: Math.min(y + height, otherCanvasPos.y + other.height),
          });
          // Add guides for ALL existing gaps with this distance
          for (const existingGap of allGaps.horizontal) {
            if (existingGap.distance === gap.distance) {
              guides.push({
                type: "gap",
                distance: existingGap.distance,
                orientation: "vertical",
                gapStart: existingGap.start,
                gapEnd: existingGap.end,
                gapTopY: existingGap.topY,
                gapBottomY: existingGap.bottomY,
              });
            }
          }
          break;
        }
        const gapToLeft = x - (otherCanvasPos.x + other.width);
        if (
          gapToLeft > 0 &&
          Math.abs(gapToLeft - gap.distance) < SNAP_THRESHOLD
        ) {
          x = otherCanvasPos.x + other.width + gap.distance;
          snappedX = true;
          guides.push({
            type: "gap",
            distance: gap.distance,
            orientation: "vertical",
            gapStart: otherCanvasPos.x + other.width,
            gapEnd: x,
            gapTopY: Math.max(y, otherCanvasPos.y),
            gapBottomY: Math.min(y + height, otherCanvasPos.y + other.height),
          });
          for (const existingGap of allGaps.horizontal) {
            if (existingGap.distance === gap.distance) {
              guides.push({
                type: "gap",
                distance: existingGap.distance,
                orientation: "vertical",
                gapStart: existingGap.start,
                gapEnd: existingGap.end,
                gapTopY: existingGap.topY,
                gapBottomY: existingGap.bottomY,
              });
            }
          }
          break;
        }
      }
    }

    // Try vertical gap snapping
    for (const gap of allGaps.vertical) {
      if (snappedY) break;
      for (const other of otherObjects) {
        const otherCanvasPos = getCanvasPosition(other, allObjects);
        const gapBelow = otherCanvasPos.y - (y + height);
        if (
          gapBelow > 0 &&
          Math.abs(gapBelow - gap.distance) < SNAP_THRESHOLD
        ) {
          y = otherCanvasPos.y - height - gap.distance;
          snappedY = true;
          guides.push({
            type: "gap",
            distance: gap.distance,
            orientation: "horizontal",
            gapStart: y + height,
            gapEnd: otherCanvasPos.y,
            gapLeftX: Math.max(x, otherCanvasPos.x),
            gapRightX: Math.min(x + width, otherCanvasPos.x + other.width),
          });
          for (const existingGap of allGaps.vertical) {
            if (existingGap.distance === gap.distance) {
              guides.push({
                type: "gap",
                distance: existingGap.distance,
                orientation: "horizontal",
                gapStart: existingGap.start,
                gapEnd: existingGap.end,
                gapLeftX: existingGap.leftX,
                gapRightX: existingGap.rightX,
              });
            }
          }
          break;
        }
        const gapAbove = y - (otherCanvasPos.y + other.height);
        if (
          gapAbove > 0 &&
          Math.abs(gapAbove - gap.distance) < SNAP_THRESHOLD
        ) {
          y = otherCanvasPos.y + other.height + gap.distance;
          snappedY = true;
          guides.push({
            type: "gap",
            distance: gap.distance,
            orientation: "horizontal",
            gapStart: otherCanvasPos.y + other.height,
            gapEnd: y,
            gapLeftX: Math.max(x, otherCanvasPos.x),
            gapRightX: Math.min(x + width, otherCanvasPos.x + other.width),
          });
          for (const existingGap of allGaps.vertical) {
            if (existingGap.distance === gap.distance) {
              guides.push({
                type: "gap",
                distance: existingGap.distance,
                orientation: "horizontal",
                gapStart: existingGap.start,
                gapEnd: existingGap.end,
                gapLeftX: existingGap.leftX,
                gapRightX: existingGap.rightX,
              });
            }
          }
          break;
        }
      }
    }
  }

  return { x, y, width, height, guides };
}

// ============================================================================
// Snap Threshold Export (for use in creation snapping)
// ============================================================================

export { SNAP_THRESHOLD };
