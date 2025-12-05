import type { CanvasObject, Guide, ResizeHandle, FrameObject } from "./types";
import { getCanvasPosition, type Rect } from "./geometry";

// Re-export for consumers
export { getCanvasPosition, type Rect } from "./geometry";

// ============================================================================
// Types
// ============================================================================

export type SnapMode = "move" | "create" | "resize";

export interface SnapResult {
  x: number;
  y: number;
  width: number;
  height: number;
  guides: Guide[];
}

interface SnapLine {
  position: number;
  /** The rect this snap line belongs to (for guide bounds calculation) */
  rect: Rect;
  /** Type of line: edge or center */
  type: "edge" | "center";
}

// ============================================================================
// Constants
// ============================================================================

const SNAP_THRESHOLD = 8;

export { SNAP_THRESHOLD };

// ============================================================================
// Guide Creation
// ============================================================================

function createVerticalGuide(
  position: number,
  movingRect: Rect,
  snapRect: Rect
): Guide {
  return {
    type: "vertical",
    position,
    startBound: Math.min(movingRect.y, snapRect.y),
    endBound: Math.max(
      movingRect.y + movingRect.height,
      snapRect.y + snapRect.height
    ),
  };
}

function createHorizontalGuide(
  position: number,
  movingRect: Rect,
  snapRect: Rect
): Guide {
  return {
    type: "horizontal",
    position,
    startBound: Math.min(movingRect.x, snapRect.x),
    endBound: Math.max(
      movingRect.x + movingRect.width,
      snapRect.x + snapRect.width
    ),
  };
}

// ============================================================================
// Snap Line Collection
// ============================================================================

/**
 * Collect snap lines from an array of objects.
 * Returns arrays of X and Y snap positions with their source rects.
 */
function collectSnapLines(
  objects: CanvasObject[],
  allObjects: CanvasObject[]
): { xLines: SnapLine[]; yLines: SnapLine[] } {
  const xLines: SnapLine[] = [];
  const yLines: SnapLine[] = [];

  for (const obj of objects) {
    const pos = getCanvasPosition(obj, allObjects);
    const rect: Rect = {
      x: pos.x,
      y: pos.y,
      width: obj.width,
      height: obj.height,
    };

    // Left edge
    xLines.push({ position: pos.x, rect, type: "edge" });
    // Right edge
    xLines.push({ position: pos.x + obj.width, rect, type: "edge" });
    // Center X
    xLines.push({ position: pos.x + obj.width / 2, rect, type: "center" });

    // Top edge
    yLines.push({ position: pos.y, rect, type: "edge" });
    // Bottom edge
    yLines.push({ position: pos.y + obj.height, rect, type: "edge" });
    // Center Y
    yLines.push({ position: pos.y + obj.height / 2, rect, type: "center" });
  }

  return { xLines, yLines };
}

/**
 * Add snap lines for a parent container (inner edges for child snapping).
 * Children snap to the inside edges of their parent.
 */
function addParentSnapLines(
  parent: CanvasObject,
  allObjects: CanvasObject[],
  xLines: SnapLine[],
  yLines: SnapLine[]
): void {
  const pos = getCanvasPosition(parent, allObjects);
  const rect: Rect = {
    x: pos.x,
    y: pos.y,
    width: parent.width,
    height: parent.height,
  };

  // For parent snapping, we use the INNER edges (same as outer for the child's perspective)
  // Left inner edge
  xLines.push({ position: pos.x, rect, type: "edge" });
  // Right inner edge
  xLines.push({ position: pos.x + parent.width, rect, type: "edge" });
  // Center X
  xLines.push({ position: pos.x + parent.width / 2, rect, type: "center" });

  // Top inner edge
  yLines.push({ position: pos.y, rect, type: "edge" });
  // Bottom inner edge
  yLines.push({ position: pos.y + parent.height, rect, type: "edge" });
  // Center Y
  yLines.push({ position: pos.y + parent.height / 2, rect, type: "center" });

  // If parent has padding (flex container), also snap to padded edges
  if (parent.type === "frame") {
    const frame = parent as FrameObject;
    const padding = frame.padding || 0;
    if (padding > 0 && frame.layoutMode !== "none") {
      // Padded inner edges
      xLines.push({ position: pos.x + padding, rect, type: "edge" });
      xLines.push({
        position: pos.x + parent.width - padding,
        rect,
        type: "edge",
      });
      yLines.push({ position: pos.y + padding, rect, type: "edge" });
      yLines.push({
        position: pos.y + parent.height - padding,
        rect,
        type: "edge",
      });
    }
  }
}

// ============================================================================
// Snapping Engine
// ============================================================================

/**
 * Calculate snapped position for a rect based on snap lines.
 *
 * Simple algorithm:
 * 1. Collect snap lines from siblings and optionally parent
 * 2. Check if moving rect's edges/center are within threshold of any snap line
 * 3. Snap to the closest match and generate guides
 */
export function calculateSnapping(
  movingRect: Rect,
  /** Sibling objects to snap to */
  siblings: CanvasObject[],
  /** All objects (for position calculation) */
  allObjects: CanvasObject[],
  mode: SnapMode,
  resizeHandle?: ResizeHandle,
  /** Parent object for inner-edge snapping */
  parent?: CanvasObject | null
): SnapResult {
  let { x, y, width, height } = movingRect;
  const guides: Guide[] = [];

  // Collect snap lines from siblings
  const { xLines, yLines } = collectSnapLines(siblings, allObjects);

  // Add parent snap lines if provided
  if (parent) {
    addParentSnapLines(parent, allObjects, xLines, yLines);
  }

  // No snap targets
  if (xLines.length === 0 && yLines.length === 0) {
    return { x, y, width, height, guides };
  }

  // Current rect for guide calculation
  const currentRect = (): Rect => ({ x, y, width, height });

  // Try to snap X position
  const trySnapX = (
    edgePosition: number,
    applySnap: (snapTo: number) => void
  ): boolean => {
    for (const line of xLines) {
      if (Math.abs(edgePosition - line.position) < SNAP_THRESHOLD) {
        applySnap(line.position);
        guides.push(
          createVerticalGuide(line.position, currentRect(), line.rect)
        );
        return true;
      }
    }
    return false;
  };

  // Try to snap Y position
  const trySnapY = (
    edgePosition: number,
    applySnap: (snapTo: number) => void
  ): boolean => {
    for (const line of yLines) {
      if (Math.abs(edgePosition - line.position) < SNAP_THRESHOLD) {
        applySnap(line.position);
        guides.push(
          createHorizontalGuide(line.position, currentRect(), line.rect)
        );
        return true;
      }
    }
    return false;
  };

  let snappedX = false;
  let snappedY = false;

  // Move/Create mode: snap all edges and center
  if (mode === "move" || mode === "create") {
    // X axis: left edge, right edge, center (in priority order)
    if (!snappedX)
      snappedX = trySnapX(x, (v) => {
        x = v;
      });
    if (!snappedX)
      snappedX = trySnapX(x + width, (v) => {
        x = v - width;
      });
    if (!snappedX)
      snappedX = trySnapX(x + width / 2, (v) => {
        x = v - width / 2;
      });

    // Y axis: top edge, bottom edge, center
    if (!snappedY)
      snappedY = trySnapY(y, (v) => {
        y = v;
      });
    if (!snappedY)
      snappedY = trySnapY(y + height, (v) => {
        y = v - height;
      });
    if (!snappedY)
      snappedY = trySnapY(y + height / 2, (v) => {
        y = v - height / 2;
      });
  }

  // Resize mode: only snap the edge being resized
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

  return { x, y, width, height, guides };
}
