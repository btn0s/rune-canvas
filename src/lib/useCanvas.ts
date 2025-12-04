import { useCallback, useRef, useState } from "react";
import { shallow } from "zustand/shallow";
import { useCanvasStore } from "./canvasStore";
import type {
  CanvasObject,
  FrameObject,
  ImageObject,
  TextObject,
  Guide,
  Point,
  ResizeHandle,
  Tool,
  Transform,
} from "./types";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_SPEED = 100; // pixels of pinch/scroll to double/halve zoom
const SNAP_THRESHOLD = 8;

interface SnapTarget {
  value: number;
  objectId: string;
  object: { x: number; y: number; width: number; height: number };
}

// Helper to get canvas-space position (accounting for parent transforms)
function getCanvasPosition(
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

// Helper to create a vertical guide with proper bounds
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

// Helper to create a horizontal guide with proper bounds
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

function calculateSnapping(
  obj: { x: number; y: number; width: number; height: number },
  otherObjects: CanvasObject[],
  allObjects: CanvasObject[],
  mode: "move" | "create" | "resize",
  resizeHandle?: ResizeHandle
): {
  x: number;
  y: number;
  width: number;
  height: number;
  guides: Guide[];
} {
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
    xTargets.push({
      value: canvasPos.x,
      objectId: other.id,
      object: { ...canvasPos, width: other.width, height: other.height },
    });
    xTargets.push({
      value: canvasPos.x + other.width,
      objectId: other.id,
      object: { ...canvasPos, width: other.width, height: other.height },
    });
    xTargets.push({
      value: canvasPos.x + other.width / 2,
      objectId: other.id,
      object: { ...canvasPos, width: other.width, height: other.height },
    });
    yTargets.push({
      value: canvasPos.y,
      objectId: other.id,
      object: { ...canvasPos, width: other.width, height: other.height },
    });
    yTargets.push({
      value: canvasPos.y + other.height,
      objectId: other.id,
      object: { ...canvasPos, width: other.width, height: other.height },
    });
    yTargets.push({
      value: canvasPos.y + other.height / 2,
      objectId: other.id,
      object: { ...canvasPos, width: other.width, height: other.height },
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

interface GapInfo {
  distance: number;
  start: number;
  end: number;
  topY?: number; // for horizontal gaps (vertical orientation) - top of overlapping area
  bottomY?: number; // for horizontal gaps (vertical orientation) - bottom of overlapping area
  leftX?: number; // for vertical gaps (horizontal orientation) - left of overlapping area
  rightX?: number; // for vertical gaps (horizontal orientation) - right of overlapping area
}

function calculateAllGaps(
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

export function useCanvas() {
  const {
    transform,
    objects,
    selectedIds,
    tool,
    editingTextId,
    setTransform,
    setObjects,
    setSelectedIds,
    setTool,
    setEditingTextId,
    pushHistory,
    undo,
    redo,
  } = useCanvasStore(
    (state) => ({
      transform: state.transform,
      objects: state.objects,
      selectedIds: state.selectedIds,
      tool: state.tool,
      editingTextId: state.editingTextId,
      setTransform: state.setTransform,
      setObjects: state.setObjects,
      setSelectedIds: state.setSelectedIds,
      setTool: state.setTool,
      setEditingTextId: state.setEditingTextId,
      pushHistory: state.pushHistory,
      undo: state.undo,
      redo: state.redo,
    }),
    shallow
  );
  const canUndo = useCanvasStore((state) => state.history.past.length > 0);
  const canRedo = useCanvasStore((state) => state.history.future.length > 0);

  const [isCreating, setIsCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragMovement, setHasDragMovement] = useState(false); // True when drag has actual movement
  const [isResizing, setIsResizing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [potentialParentId, setPotentialParentId] = useState<string | null>(
    null
  );

  // Reparent delay timer
  const reparentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingParentId = useRef<string | null>(null);
  const lastDragPoint = useRef<Point | null>(null);
  const REPARENT_DELAY = 150; // ms

  const createStart = useRef<Point | null>(null);
  const objectCounter = useRef(1);
  const dragStart = useRef<Point | null>(null);
  const dragObjectsStart = useRef<{ id: string; x: number; y: number }[]>([]);
  const resizeHandle = useRef<ResizeHandle | null>(null);
  const resizeStart = useRef<{
    object: { x: number; y: number; width: number; height: number };
    point: Point;
  } | null>(null);
  const marqueeStart = useRef<Point | null>(null);

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): Point => ({
      x: (screenX - transform.x) / transform.scale,
      y: (screenY - transform.y) / transform.scale,
    }),
    [transform]
  );

  const handleWheel = useCallback(
    (e: WheelEvent, rect: DOMRect) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Pinch zoom - use exponential scaling for natural feel
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        // Exponential zoom: deltaY pixels = doubling/halving of zoom
        const zoomFactor = Math.pow(2, -e.deltaY / ZOOM_SPEED);
        const newScale = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, transform.scale * zoomFactor)
        );
        const scaleRatio = newScale / transform.scale;
        setTransform({
          x: mouseX - (mouseX - transform.x) * scaleRatio,
          y: mouseY - (mouseY - transform.y) * scaleRatio,
          scale: newScale,
        });
      } else {
        // Two-finger pan
        setTransform((t) => ({ ...t, x: t.x - e.deltaX, y: t.y - e.deltaY }));
      }
    },
    [transform]
  );

  // Calculate hugged size for a frame based on its children
  const calculateHuggedSize = useCallback(
    (
      frame: FrameObject,
      allObjects: CanvasObject[]
    ): { width: number; height: number } => {
      const children = allObjects.filter((o) => o.parentId === frame.id);
      const padding = frame.padding || 0;

      if (children.length === 0) {
        // No children - minimum size is just padding
        return {
          width: padding * 2 || 100,
          height: padding * 2 || 100,
        };
      }

      // For flex layout, we need to calculate based on flow direction
      if (frame.layoutMode === "flex") {
        const gap = frame.gap || 0;
        const isRow =
          frame.flexDirection === "row" ||
          frame.flexDirection === "row-reverse";

        if (isRow) {
          // Row: sum widths + gaps, max height
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
          // Column: max width, sum heights + gaps
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
    },
    []
  );

  // Recalculate hug sizes for frames that have fit mode enabled
  const recalculateHugSizes = useCallback(
    (objectsToUpdate: CanvasObject[]): CanvasObject[] => {
      // Find all frames with fit modes
      const framesToUpdate = objectsToUpdate.filter(
        (o) =>
          o.type === "frame" &&
          ((o as FrameObject).widthMode === "fit" ||
            (o as FrameObject).heightMode === "fit")
      ) as FrameObject[];

      if (framesToUpdate.length === 0) return objectsToUpdate;

      // Build a map for quick updates
      const updates = new Map<string, Partial<FrameObject>>();

      for (const frame of framesToUpdate) {
        const { width, height } = calculateHuggedSize(frame, objectsToUpdate);
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

      if (updates.size === 0) return objectsToUpdate;

      return objectsToUpdate.map((o) => {
        const update = updates.get(o.id);
        return update ? ({ ...o, ...update } as CanvasObject) : o;
      });
    },
    [calculateHuggedSize]
  );

  const startCreate = useCallback(
    (canvasPoint: Point) => {
      // Find the smallest frame that contains this point (for auto-nesting)
      const frames = objects.filter((o) => o.type === "frame");
      let targetParent: CanvasObject | null = null;
      let smallestArea = Infinity;

      for (const frame of frames) {
        const frameCanvasPos = getCanvasPosition(frame, objects);
        const inBounds =
          canvasPoint.x >= frameCanvasPos.x &&
          canvasPoint.x <= frameCanvasPos.x + frame.width &&
          canvasPoint.y >= frameCanvasPos.y &&
          canvasPoint.y <= frameCanvasPos.y + frame.height;

        if (inBounds) {
          const area = frame.width * frame.height;
          if (area < smallestArea) {
            smallestArea = area;
            targetParent = frame;
          }
        }
      }

      const parentId = targetParent?.id ?? null;

      // Convert canvas point to relative position if nested
      let relativePoint = canvasPoint;
      if (targetParent) {
        const parentCanvasPos = getCanvasPosition(targetParent, objects);
        relativePoint = {
          x: canvasPoint.x - parentCanvasPos.x,
          y: canvasPoint.y - parentCanvasPos.y,
        };
      }

      pushHistory();
      setIsCreating(true);
      createStart.current = canvasPoint; // Store canvas point for drag calculation

      if (tool === "frame" || tool === "rectangle") {
        const id = `frame-${Date.now()}`;
        const name = `Frame ${objectCounter.current++}`;
        const newFrame: FrameObject = {
          id,
          name,
          type: "frame",
          parentId,
          x: relativePoint.x,
          y: relativePoint.y,
          width: 0,
          height: 0,
          opacity: 1,
          fill: "#ffffff",
          radius: 0,
          clipContent: false,
          widthMode: "fixed",
          heightMode: "fixed",
          layoutMode: "none",
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          flexWrap: "nowrap",
          gap: 0,
          padding: 0,
        };
        setObjects((prev) => [...prev, newFrame]);
        setSelectedIds([id]);
      } else if (tool === "text") {
        const id = `text-${Date.now()}`;
        const name = `Text ${objectCounter.current++}`;
        const newText: TextObject = {
          id,
          name,
          type: "text",
          parentId,
          x: relativePoint.x,
          y: relativePoint.y,
          width: 200,
          height: 24,
          opacity: 1,
          content: "",
          fontSize: 16,
          fontFamily: "system-ui",
          fill: "#000000",
        };
        setObjects((prev) => [...prev, newText]);
        setSelectedIds([id]);
        setEditingTextId(id);
        setTool("select"); // Switch to select after creating text
      }
    },
    [tool, objects, pushHistory]
  );

  const updateCreate = useCallback(
    (canvasPoint: Point) => {
      const creatingId = selectedIds[0];
      if (!isCreating || !createStart.current || !creatingId) return;
      const start = createStart.current;
      const creatingObj = objects.find((o) => o.id === creatingId);
      if (!creatingObj) return;

      // For creation, the start point is FIXED - only snap the end point
      let endX = canvasPoint.x;
      let endY = canvasPoint.y;
      const guides: Guide[] = [];

      // Collect snap targets from sibling objects (same parent scope)
      const parentId = creatingObj.parentId ?? null;
      const otherObjects = objects.filter(
        (o) => o.id !== creatingId && o.parentId === parentId
      );
      const xTargets: number[] = [];
      const yTargets: number[] = [];

      for (const other of otherObjects) {
        const canvasPos = getCanvasPosition(other, objects);
        xTargets.push(
          canvasPos.x,
          canvasPos.x + other.width,
          canvasPos.x + other.width / 2
        );
        yTargets.push(
          canvasPos.y,
          canvasPos.y + other.height,
          canvasPos.y + other.height / 2
        );
      }

      // Snap end point X
      for (const target of xTargets) {
        if (Math.abs(endX - target) < SNAP_THRESHOLD) {
          endX = target;
          guides.push({ type: "vertical", position: target });
          break;
        }
      }

      // Snap end point Y
      for (const target of yTargets) {
        if (Math.abs(endY - target) < SNAP_THRESHOLD) {
          endY = target;
          guides.push({ type: "horizontal", position: target });
          break;
        }
      }

      // Calculate bounding box from fixed start and snapped end
      const finalWidth = Math.abs(endX - start.x);
      const finalHeight = Math.abs(endY - start.y);
      const finalX = Math.min(start.x, endX);
      const finalY = Math.min(start.y, endY);

      // Convert to relative if object has a parent
      let relativeX = finalX;
      let relativeY = finalY;
      if (creatingObj.parentId) {
        const parent = objects.find((o) => o.id === creatingObj.parentId);
        if (parent) {
          const parentCanvasPos = getCanvasPosition(parent, objects);
          relativeX = finalX - parentCanvasPos.x;
          relativeY = finalY - parentCanvasPos.y;
        }
      }

      setGuides(guides);
      setObjects((prev) =>
        prev.map((o) =>
          o.id === creatingId
            ? {
                ...o,
                x: relativeX,
                y: relativeY,
                width: finalWidth,
                height: finalHeight,
              }
            : o
        )
      );
    },
    [isCreating, selectedIds, objects]
  );

  const endCreate = useCallback(() => {
    const creatingId = selectedIds[0];
    if (!creatingId) return;
    setObjects((prev) => {
      let updated = prev;
      const obj = prev.find((o) => o.id === creatingId);
      if (!obj) return prev;
      // For frames/rectangles that are too small, give them a default size
      if (obj.type !== "text" && obj.width < 10 && obj.height < 10) {
        updated = prev.map((o) =>
          o.id === creatingId ? { ...o, width: 100, height: 100 } : o
        );
      }
      // Recalculate hug sizes for parent frames
      return recalculateHugSizes(updated);
    });
    setIsCreating(false);
    setGuides([]);
    createStart.current = null;
    setTool("select");
  }, [selectedIds, recalculateHugSizes]);

  // Compute bounding box of selected objects (in canvas space)
  const getSelectionBounds = useCallback(
    (objectsList: CanvasObject[], ids: string[]) => {
      const selected = objectsList.filter((o) => ids.includes(o.id));
      if (selected.length === 0) return null;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const obj of selected) {
        const canvasPos = getCanvasPosition(obj, objectsList);
        minX = Math.min(minX, canvasPos.x);
        minY = Math.min(minY, canvasPos.y);
        maxX = Math.max(maxX, canvasPos.x + obj.width);
        maxY = Math.max(maxY, canvasPos.y + obj.height);
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    },
    []
  );

  // Store initial selection bounds for dragging
  const dragBoundsStart = useRef<{ x: number; y: number } | null>(null);
  // Track clicked frame for potential deselect-on-mouseup
  const clickedFrameId = useRef<string | null>(null);
  const didDrag = useRef(false);
  const dragHistoryCaptured = useRef(false);
  // Track if shift was held on mousedown (for deselect on mouseup)
  const shiftOnMouseDown = useRef(false);
  // Track if clicked object was already selected (for shift+click deselect)
  const wasAlreadySelected = useRef(false);
  // Track locked axis for shift-drag constraint
  const dragLockedAxis = useRef<"x" | "y" | null>(null);

  const startDrag = useCallback(
    (objectId: string, canvasPoint: Point, addToSelection = false) => {
      const obj = objects.find((o) => o.id === objectId);
      if (!obj) return;

      const isAlreadySelected = selectedIds.includes(objectId);

      // Reset drag tracking
      clickedFrameId.current = objectId;
      didDrag.current = false;
      dragHistoryCaptured.current = false;
      // Track if shift was held (to prevent "click = select only this" behavior)
      shiftOnMouseDown.current = addToSelection;
      // Track if object was already selected (for shift+click deselect)
      wasAlreadySelected.current = isAlreadySelected;

      // Determine new selection
      let newSelectedIds: string[];
      if (addToSelection && !isAlreadySelected) {
        // Shift+click unselected = add to selection
        newSelectedIds = [...selectedIds, objectId];
      } else if (isAlreadySelected) {
        // Click on already-selected object = keep all selected (might deselect on mouseup)
        newSelectedIds = selectedIds;
      } else {
        // Click unselected without shift = select only this one
        newSelectedIds = [objectId];
      }

      setSelectedIds(newSelectedIds);
      setIsDragging(true);
      setHasDragMovement(false); // Reset - no movement yet
      dragStart.current = canvasPoint;

      // Store starting positions for all selected objects (relative positions)
      const selectedObjectsList = objects.filter((o) =>
        newSelectedIds.includes(o.id)
      );
      dragObjectsStart.current = selectedObjectsList.map((o) => ({
        id: o.id,
        x: o.x,
        y: o.y,
      }));

      // Store initial bounding box position (canvas space)
      const bounds = getSelectionBounds(objects, newSelectedIds);
      dragBoundsStart.current = bounds ? { x: bounds.x, y: bounds.y } : null;
    },
    [objects, selectedIds, getSelectionBounds]
  );

  const updateDrag = useCallback(
    (canvasPoint: Point, shiftKey = false) => {
      if (
        !isDragging ||
        !dragStart.current ||
        dragObjectsStart.current.length === 0 ||
        !dragBoundsStart.current
      )
        return;

      // Store last drag point for reparent timer
      lastDragPoint.current = canvasPoint;

      let dx = canvasPoint.x - dragStart.current.x;
      let dy = canvasPoint.y - dragStart.current.y;

      // Mark as dragged if moved more than 2px
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        if (!dragHistoryCaptured.current) {
          pushHistory();
          dragHistoryCaptured.current = true;
        }
        didDrag.current = true;
        if (!hasDragMovement) setHasDragMovement(true);
      }

      // Shift-drag: lock to axis based on initial movement direction
      if (shiftKey && didDrag.current) {
        // Determine locked axis on first significant movement
        if (!dragLockedAxis.current) {
          dragLockedAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        }
        // Constrain movement to locked axis
        if (dragLockedAxis.current === "x") {
          dy = 0;
        } else {
          dx = 0;
        }
      } else {
        // Reset locked axis when shift is released
        dragLockedAxis.current = null;
      }

      // Compute current bounding box dimensions from starting objects (canvas space)
      const startingObjects = dragObjectsStart.current;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const so of startingObjects) {
        const obj = objects.find((o) => o.id === so.id);
        if (!obj) continue;
        const canvasPos = getCanvasPosition(
          { ...obj, x: so.x, y: so.y },
          objects
        );
        minX = Math.min(minX, canvasPos.x);
        minY = Math.min(minY, canvasPos.y);
        maxX = Math.max(maxX, canvasPos.x + obj.width);
        maxY = Math.max(maxY, canvasPos.y + obj.height);
      }
      const boundsWidth = maxX - minX;
      const boundsHeight = maxY - minY;

      // New bounding box position (canvas space)
      const newBoundsX = dragBoundsStart.current.x + dx;
      const newBoundsY = dragBoundsStart.current.y + dy;

      // Exclude selected objects and all their descendants from snapping
      const descendants = getDescendants(selectedIds, objects);
      const excludeIds = new Set([
        ...selectedIds,
        ...descendants.map((d) => d.id),
      ]);

      // Scope snapping to siblings (same parent) only
      const firstSelected = objects.find((o) => o.id === selectedIds[0]);
      const parentId = firstSelected?.parentId ?? null;
      const otherObjects = objects.filter(
        (o) => !excludeIds.has(o.id) && o.parentId === parentId
      );
      const snapped = calculateSnapping(
        {
          x: newBoundsX,
          y: newBoundsY,
          width: boundsWidth,
          height: boundsHeight,
        },
        otherObjects,
        objects,
        "move"
      );

      // Calculate the snap delta
      const snapDx = snapped.x - newBoundsX;
      const snapDy = snapped.y - newBoundsY;

      setGuides(snapped.guides);
      setObjects((prev) =>
        prev.map((o) => {
          const startPos = dragObjectsStart.current.find((s) => s.id === o.id);
          if (!startPos) return o;
          // Update relative position
          return {
            ...o,
            x: startPos.x + dx + snapDx,
            y: startPos.y + dy + snapDy,
          };
        })
      );

      // Calculate potential parent for nesting with delay
      if (selectedIds.length === 1) {
        const dragged = objects.find((o) => o.id === selectedIds[0]);
        if (dragged) {
          const draggedCenter = {
            x: snapped.x + boundsWidth / 2,
            y: snapped.y + boundsHeight / 2,
          };

          const frames = objects.filter(
            (o) => o.type === "frame" && !selectedIds.includes(o.id)
          );

          let targetFrame: CanvasObject | null = null;
          let smallestArea = Infinity;

          for (const frame of frames) {
            // Don't nest into own children
            let isDescendant = false;
            let checkId: string | null = frame.id;
            while (checkId) {
              const check = objects.find((o) => o.id === checkId);
              if (check?.parentId === dragged.id) {
                isDescendant = true;
                break;
              }
              checkId = check?.parentId ?? null;
            }
            if (isDescendant) continue;

            const frameCanvasPos = getCanvasPosition(frame, objects);
            const inBounds =
              draggedCenter.x >= frameCanvasPos.x &&
              draggedCenter.x <= frameCanvasPos.x + frame.width &&
              draggedCenter.y >= frameCanvasPos.y &&
              draggedCenter.y <= frameCanvasPos.y + frame.height;

            if (inBounds) {
              const area = frame.width * frame.height;
              if (area < smallestArea) {
                smallestArea = area;
                targetFrame = frame;
              }
            }
          }

          const newTargetId = targetFrame?.id ?? null;

          // If target changed, reset timer
          if (newTargetId !== pendingParentId.current) {
            if (reparentTimer.current) {
              clearTimeout(reparentTimer.current);
              reparentTimer.current = null;
            }
            pendingParentId.current = newTargetId;

            // If we have a new target and it's different from current parent, start timer
            if (newTargetId && newTargetId !== dragged.parentId) {
              reparentTimer.current = setTimeout(() => {
                // Immediately reparent when timer fires
                setPotentialParentId(newTargetId);
                setObjects((prev) => {
                  const obj = prev.find((o) => o.id === dragged.id);
                  const newParent = prev.find((o) => o.id === newTargetId);
                  if (!obj || !newParent) return prev;

                  const canvasPos = getCanvasPosition(obj, prev);
                  const parentCanvasPos = getCanvasPosition(newParent, prev);

                  // Calculate new relative position
                  const newRelX = canvasPos.x - parentCanvasPos.x;
                  const newRelY = canvasPos.y - parentCanvasPos.y;

                  // Reset drag references to current position so drag continues smoothly
                  if (lastDragPoint.current) {
                    dragStart.current = lastDragPoint.current;
                    dragBoundsStart.current = {
                      x: canvasPos.x,
                      y: canvasPos.y,
                    };
                    dragObjectsStart.current = [
                      { id: dragged.id, x: newRelX, y: newRelY },
                    ];
                  }

                  return prev.map((o) =>
                    o.id === dragged.id
                      ? {
                          ...o,
                          parentId: newTargetId,
                          x: newRelX,
                          y: newRelY,
                        }
                      : o
                  );
                });
                reparentTimer.current = null;
              }, REPARENT_DELAY);
            } else if (!newTargetId || newTargetId === dragged.parentId) {
              // No target or same as current parent - clear highlight
              setPotentialParentId(null);
            }
          }
        }
      } else {
        if (reparentTimer.current) {
          clearTimeout(reparentTimer.current);
          reparentTimer.current = null;
        }
        pendingParentId.current = null;
        setPotentialParentId(null);
      }
    },
    [isDragging, selectedIds, objects, pushHistory, hasDragMovement]
  );

  const endDrag = useCallback(() => {
    // Clear reparent timer
    if (reparentTimer.current) {
      clearTimeout(reparentTimer.current);
      reparentTimer.current = null;
    }
    dragHistoryCaptured.current = false;
    pendingParentId.current = null;

    // Handle click-without-drag scenarios
    if (clickedFrameId.current && !didDrag.current) {
      if (
        shiftOnMouseDown.current &&
        wasAlreadySelected.current &&
        selectedIds.includes(clickedFrameId.current)
      ) {
        // Shift+click on already-selected object without dragging = deselect it
        setSelectedIds(
          selectedIds.filter((id) => id !== clickedFrameId.current)
        );
      } else if (
        !shiftOnMouseDown.current &&
        selectedIds.length > 1 &&
        selectedIds.includes(clickedFrameId.current)
      ) {
        // Click on selected object without shift = select only this one
        setSelectedIds([clickedFrameId.current]);
      }
    }

    // Handle unnesting: if object has a parent but is now outside all frames, unnest it
    if (didDrag.current && selectedIds.length === 1) {
      setObjects((prev) => {
        const dragged = prev.find((o) => o.id === selectedIds[0]);
        if (!dragged || !dragged.parentId) {
          // Still recalculate hug sizes even if not unnesting
          return recalculateHugSizes(prev);
        }

        const draggedCanvasPos = getCanvasPosition(dragged, prev);
        const draggedCenter = {
          x: draggedCanvasPos.x + dragged.width / 2,
          y: draggedCanvasPos.y + dragged.height / 2,
        };

        // Check if still inside any frame
        const frames = prev.filter(
          (o) => o.type === "frame" && o.id !== dragged.id
        );

        let insideAnyFrame = false;
        for (const frame of frames) {
          const frameCanvasPos = getCanvasPosition(frame, prev);
          if (
            draggedCenter.x >= frameCanvasPos.x &&
            draggedCenter.x <= frameCanvasPos.x + frame.width &&
            draggedCenter.y >= frameCanvasPos.y &&
            draggedCenter.y <= frameCanvasPos.y + frame.height
          ) {
            insideAnyFrame = true;
            break;
          }
        }

        // If outside all frames, unnest to root
        if (!insideAnyFrame) {
          const updated = prev.map((o) =>
            o.id === dragged.id
              ? {
                  ...o,
                  parentId: null,
                  x: draggedCanvasPos.x,
                  y: draggedCanvasPos.y,
                }
              : o
          );
          return recalculateHugSizes(updated);
        }

        return recalculateHugSizes(prev);
      });
    } else if (didDrag.current) {
      // Recalculate hug sizes after multi-object drag
      setObjects((prev) => recalculateHugSizes(prev));
    }

    setIsDragging(false);
    setHasDragMovement(false);
    setGuides([]);
    setPotentialParentId(null);
    dragStart.current = null;
    dragObjectsStart.current = [];
    dragBoundsStart.current = null;
    clickedFrameId.current = null;
    didDrag.current = false;
    shiftOnMouseDown.current = false;
    wasAlreadySelected.current = false;
    dragLockedAxis.current = null;
    lastDragPoint.current = null;
  }, [selectedIds]);

  // Store resize starting state
  const resizeBoundsStart = useRef<{
    bounds: { x: number; y: number; width: number; height: number };
    frames: CanvasObject[];
  } | null>(null);
  const resizeHistoryCaptured = useRef(false);

  const startResize = useCallback(
    (handle: ResizeHandle, canvasPoint: Point) => {
      const bounds = getSelectionBounds(objects, selectedIds);
      if (!bounds) return;

      setIsResizing(true);
      resizeHistoryCaptured.current = false;
      resizeHandle.current = handle;
      resizeStart.current = {
        object: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
        point: canvasPoint,
      };
      resizeBoundsStart.current = {
        bounds: { ...bounds },
        frames: objects
          .filter((o) => selectedIds.includes(o.id))
          .map((o) => ({ ...o })),
      };
    },
    [objects, selectedIds, getSelectionBounds]
  );

  const updateResize = useCallback(
    (canvasPoint: Point, shiftKey = false, altKey = false) => {
      if (!isResizing || !resizeStart.current || !resizeBoundsStart.current)
        return;
      const { point: start } = resizeStart.current;
      const { bounds: origBounds, frames: origObjects } =
        resizeBoundsStart.current;
      const handle = resizeHandle.current!;
      let dx = canvasPoint.x - start.x;
      let dy = canvasPoint.y - start.y;

      if (!resizeHistoryCaptured.current && (dx !== 0 || dy !== 0)) {
        pushHistory();
        resizeHistoryCaptured.current = true;
      }

      // Shift: lock aspect ratio
      if (shiftKey && origBounds.width > 0 && origBounds.height > 0) {
        const aspectRatio = origBounds.width / origBounds.height;
        // For corner handles, constrain to aspect ratio
        if (handle.length === 2) {
          // Corner handle (nw, ne, sw, se)
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          if (absDx / aspectRatio > absDy) {
            // Width is dominant, adjust height
            dy = (absDx / aspectRatio) * Math.sign(dy || 1);
            // Correct sign based on handle
            if (handle.includes("n"))
              dy =
                -Math.abs(dy) * Math.sign(dx * (handle.includes("w") ? -1 : 1));
            if (handle.includes("s"))
              dy =
                Math.abs(dy) * Math.sign(dx * (handle.includes("w") ? -1 : 1));
          } else {
            // Height is dominant, adjust width
            dx = absDy * aspectRatio * Math.sign(dx || 1);
            // Correct sign based on handle
            if (handle.includes("w"))
              dx =
                -Math.abs(dx) * Math.sign(dy * (handle.includes("n") ? -1 : 1));
            if (handle.includes("e"))
              dx =
                Math.abs(dx) * Math.sign(dy * (handle.includes("n") ? -1 : 1));
          }
        } else if (handle === "e" || handle === "w") {
          // Horizontal edge: adjust height based on width change
          dy = (Math.abs(dx) / aspectRatio) * (handle === "w" ? -1 : 1);
        } else if (handle === "n" || handle === "s") {
          // Vertical edge: adjust width based on height change
          dx = Math.abs(dy) * aspectRatio * (handle === "n" ? -1 : 1);
        }
      }

      let { x, y, width, height } = origBounds;
      const centerX = origBounds.x + origBounds.width / 2;
      const centerY = origBounds.y + origBounds.height / 2;

      // Alt: resize from center (handle follows cursor exactly, opposite edge mirrors)
      if (altKey) {
        if (handle.includes("w")) {
          width = origBounds.width - dx * 2;
          x = centerX - width / 2;
        }
        if (handle.includes("e")) {
          width = origBounds.width + dx * 2;
          x = centerX - width / 2;
        }
        if (handle.includes("n")) {
          height = origBounds.height - dy * 2;
          y = centerY - height / 2;
        }
        if (handle.includes("s")) {
          height = origBounds.height + dy * 2;
          y = centerY - height / 2;
        }
        // For edge handles with shift, also apply the other dimension symmetrically
        if (shiftKey) {
          if (handle === "e" || handle === "w") {
            height = origBounds.height + Math.abs(width - origBounds.width);
            y = centerY - height / 2;
          } else if (handle === "n" || handle === "s") {
            width = origBounds.width + Math.abs(height - origBounds.height);
            x = centerX - width / 2;
          }
        }
      } else {
        // Normal resize: opposite corner stays fixed
        if (handle.includes("w")) {
          x = origBounds.x + dx;
          width = origBounds.width - dx;
        }
        if (handle.includes("e")) {
          width = origBounds.width + dx;
        }
        if (handle.includes("n")) {
          y = origBounds.y + dy;
          height = origBounds.height - dy;
        }
        if (handle.includes("s")) {
          height = origBounds.height + dy;
        }
      }

      if (width < 1) {
        width = 1;
        if (handle.includes("w")) x = origBounds.x + origBounds.width - 1;
      }
      if (height < 1) {
        height = 1;
        if (handle.includes("n")) y = origBounds.y + origBounds.height - 1;
      }

      // Scope snapping to siblings (same parent) only
      const firstSelected = objects.find((o) => o.id === selectedIds[0]);
      const parentId = firstSelected?.parentId ?? null;
      const otherObjects = objects.filter(
        (o) => !selectedIds.includes(o.id) && o.parentId === parentId
      );
      const snapped = calculateSnapping(
        { x, y, width, height },
        otherObjects,
        objects,
        "resize",
        handle
      );

      // Calculate scale factors
      const scaleX =
        origBounds.width > 0 ? snapped.width / origBounds.width : 1;
      const scaleY =
        origBounds.height > 0 ? snapped.height / origBounds.height : 1;

      setGuides(snapped.guides);
      setObjects((prev) =>
        prev.map((o) => {
          const origObj = origObjects.find((oo) => oo.id === o.id);
          if (!origObj) return o;

          // Get original canvas position
          const origCanvasPos = getCanvasPosition(origObj, objects);
          // Calculate relative position from bounds origin
          const relX = origCanvasPos.x - origBounds.x;
          const relY = origCanvasPos.y - origBounds.y;

          // New canvas position
          const newCanvasX = snapped.x + relX * scaleX;
          const newCanvasY = snapped.y + relY * scaleY;

          // Convert back to relative position
          const parentId = origObj.parentId;
          if (parentId) {
            const parent = objects.find((p) => p.id === parentId);
            if (parent) {
              const parentCanvasPos = getCanvasPosition(parent, objects);
              return {
                ...o,
                x: newCanvasX - parentCanvasPos.x,
                y: newCanvasY - parentCanvasPos.y,
                width: origObj.width * scaleX,
                height: origObj.height * scaleY,
              };
            }
          }

          return {
            ...o,
            x: newCanvasX,
            y: newCanvasY,
            width: origObj.width * scaleX,
            height: origObj.height * scaleY,
          };
        })
      );
    },
    [isResizing, selectedIds, objects, pushHistory]
  );

  const endResize = useCallback(() => {
    // Recalculate hug sizes for parent frames after resize
    setObjects((prev) => recalculateHugSizes(prev));
    setIsResizing(false);
    setGuides([]);
    resizeHistoryCaptured.current = false;
    resizeHandle.current = null;
    resizeStart.current = null;
    resizeBoundsStart.current = null;
  }, [recalculateHugSizes]);

  const startPan = useCallback((screenPoint: Point) => {
    setIsPanning(true);
    dragStart.current = screenPoint;
  }, []);

  const updatePan = useCallback(
    (screenPoint: Point) => {
      if (!isPanning || !dragStart.current) return;
      const dx = screenPoint.x - dragStart.current.x;
      const dy = screenPoint.y - dragStart.current.y;
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
      dragStart.current = screenPoint;
    },
    [isPanning]
  );

  const endPan = useCallback(() => {
    setIsPanning(false);
    dragStart.current = null;
  }, []);

  const select = useCallback((ids: string[] | null, addToSelection = false) => {
    if (ids === null) {
      setSelectedIds([]);
    } else if (addToSelection) {
      setSelectedIds((prev) => {
        const newIds = ids.filter((id) => !prev.includes(id));
        const removedIds = ids.filter((id) => prev.includes(id));
        if (removedIds.length > 0) {
          return prev.filter((id) => !removedIds.includes(id));
        }
        return [...prev, ...newIds];
      });
    } else {
      setSelectedIds(ids);
    }
  }, []);

  // Marquee selection
  const startMarquee = useCallback((canvasPoint: Point) => {
    setIsMarqueeSelecting(true);
    marqueeStart.current = canvasPoint;
    setMarqueeRect({ x: canvasPoint.x, y: canvasPoint.y, width: 0, height: 0 });
  }, []);

  const updateMarquee = useCallback(
    (canvasPoint: Point) => {
      if (!isMarqueeSelecting || !marqueeStart.current) return;
      const start = marqueeStart.current;
      const x = Math.min(start.x, canvasPoint.x);
      const y = Math.min(start.y, canvasPoint.y);
      const width = Math.abs(canvasPoint.x - start.x);
      const height = Math.abs(canvasPoint.y - start.y);
      setMarqueeRect({ x, y, width, height });

      // Live selection: find objects that intersect with marquee (canvas space)
      const intersecting = objects.filter((o) => {
        const canvasPos = getCanvasPosition(o, objects);
        return !(
          canvasPos.x + o.width < x ||
          canvasPos.x > x + width ||
          canvasPos.y + o.height < y ||
          canvasPos.y > y + height
        );
      });
      setSelectedIds(intersecting.map((o) => o.id));
    },
    [isMarqueeSelecting, objects]
  );

  const endMarquee = useCallback(() => {
    setIsMarqueeSelecting(false);
    setMarqueeRect(null);
    marqueeStart.current = null;
  }, []);

  // Clipboard for copy/paste
  const clipboard = useRef<CanvasObject[]>([]);

  // Helper to get all descendants of given object IDs
  const getDescendants = useCallback(
    (ids: string[], allObjects: CanvasObject[]): CanvasObject[] => {
      const result: CanvasObject[] = [];
      const collectDescendants = (parentIds: string[]) => {
        const children = allObjects.filter(
          (o) => o.parentId && parentIds.includes(o.parentId)
        );
        if (children.length > 0) {
          result.push(...children);
          collectDescendants(children.map((c) => c.id));
        }
      };
      collectDescendants(ids);
      return result;
    },
    []
  );

  // Helper to duplicate a tree of objects with new IDs and proper parent remapping
  const duplicateTree = useCallback(
    (
      objectsToDupe: CanvasObject[],
      offset: { x: number; y: number } = { x: 20, y: 20 },
      appendCopy: boolean = true
    ): CanvasObject[] => {
      const idMap = new Map<string, string>();
      objectsToDupe.forEach((o, index) => {
        idMap.set(
          o.id,
          `${o.type}-${Date.now()}-${index}-${Math.random()
            .toString(36)
            .substr(2, 9)}`
        );
      });

      return objectsToDupe.map((o) => {
        // Check if this object's parent is in the duplication set
        const parentInSet = o.parentId && idMap.has(o.parentId);
        // Is this a "root" of the duplication (no parent, or parent not in set)
        const isRoot = !o.parentId || !parentInSet;

        // Determine the new parent:
        // - If parent is in the set, remap to new ID
        // - If parent is NOT in set but exists, keep original parent (stay nested)
        // - If no parent, stay null
        let newParentId: string | null = null;
        if (o.parentId) {
          if (parentInSet) {
            newParentId = idMap.get(o.parentId)!;
          } else {
            // Keep the original parent - duplicate stays in same frame
            newParentId = o.parentId;
          }
        }

        return {
          ...o,
          id: idMap.get(o.id)!,
          name: appendCopy ? `${o.name} copy` : o.name,
          parentId: newParentId,
          // Only offset root-level objects (children stay relative to parent)
          x: isRoot ? o.x + offset.x : o.x,
          y: isRoot ? o.y + offset.y : o.y,
        };
      });
    },
    []
  );

  const copySelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selected = objects.filter((o) => selectedIds.includes(o.id));
    const descendants = getDescendants(selectedIds, objects);
    clipboard.current = [...selected, ...descendants].map((o) => ({ ...o }));
  }, [selectedIds, objects, getDescendants]);

  const pasteClipboard = useCallback(() => {
    if (clipboard.current.length === 0) return;
    pushHistory();
    const newObjects = duplicateTree(
      clipboard.current,
      { x: 20, y: 20 },
      false
    );
    setObjects((prev) => [...prev, ...newObjects]);
    const newRootIds = newObjects
      .filter(
        (o) => !o.parentId || !newObjects.some((c) => c.id === o.parentId)
      )
      .map((o) => o.id);
    setSelectedIds(newRootIds);
  }, [duplicateTree, pushHistory]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();
    const selected = objects.filter((o) => selectedIds.includes(o.id));
    const descendants = getDescendants(selectedIds, objects);
    const allToDupe = [...selected, ...descendants];
    const newObjects = duplicateTree(allToDupe);
    setObjects((prev) => [...prev, ...newObjects]);
    const newRootIds = newObjects
      .filter(
        (o) => !o.parentId || !newObjects.some((c) => c.id === o.parentId)
      )
      .map((o) => o.id);
    setSelectedIds(newRootIds);
  }, [selectedIds, objects, getDescendants, duplicateTree, pushHistory]);

  // Alt+drag to duplicate
  const startDuplicateDrag = useCallback(
    (objectId: string, canvasPoint: Point) => {
      const toDuplicate = selectedIds.includes(objectId)
        ? selectedIds
        : [objectId];
      const selected = objects.filter((o) => toDuplicate.includes(o.id));
      const descendants = getDescendants(toDuplicate, objects);
      const allToDupe = [...selected, ...descendants];

      const newObjects = duplicateTree(allToDupe, { x: 0, y: 0 }, true);
      pushHistory();
      dragHistoryCaptured.current = true;
      setObjects((prev) => [...prev, ...newObjects]);
      const newRootIds = newObjects
        .filter(
          (o) => !o.parentId || !newObjects.some((c) => c.id === o.parentId)
        )
        .map((o) => o.id);
      setSelectedIds(newRootIds);
      setIsDragging(true);
      dragStart.current = canvasPoint;
      const rootObjects = newObjects.filter((o) => newRootIds.includes(o.id));
      dragObjectsStart.current = rootObjects.map((o) => ({
        id: o.id,
        x: o.x,
        y: o.y,
      }));

      // Set initial bounds for snapping
      const bounds = getSelectionBounds(rootObjects, newRootIds);
      dragBoundsStart.current = bounds ? { x: bounds.x, y: bounds.y } : null;
    },
    [
      objects,
      selectedIds,
      getSelectionBounds,
      getDescendants,
      duplicateTree,
      pushHistory,
    ]
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();
    const descendants = getDescendants(selectedIds, objects);
    const toDelete = new Set([...selectedIds, ...descendants.map((d) => d.id)]);
    setObjects((prev) => {
      const filtered = prev.filter((o) => !toDelete.has(o.id));
      // Recalculate hug sizes for parent frames after deletion
      return recalculateHugSizes(filtered);
    });
    setSelectedIds([]);
    setEditingTextId(null);
  }, [selectedIds, objects, getDescendants, recalculateHugSizes, pushHistory]);

  const selectAllSiblings = useCallback(() => {
    if (selectedIds.length === 0) {
      const rootIds = objects
        .filter((o) => o.parentId === null)
        .map((o) => o.id);
      setSelectedIds(rootIds);
    } else {
      const firstSelected = objects.find((o) => o.id === selectedIds[0]);
      const parentId = firstSelected?.parentId ?? null;
      const siblingIds = objects
        .filter((o) => o.parentId === parentId)
        .map((o) => o.id);
      setSelectedIds(siblingIds);
    }
  }, [selectedIds, objects]);

  // Alignment functions
  const alignObjects = useCallback(
    (
      alignment: "left" | "right" | "top" | "bottom" | "centerH" | "centerV"
    ) => {
      if (selectedIds.length === 0) return;

      pushHistory();
      const selected = objects.filter((o) => selectedIds.includes(o.id));

      // Single object with parent frame: align within parent
      if (selectedIds.length === 1) {
        const obj = selected[0];
        if (!obj.parentId) return; // Can't align single root object

        const parent = objects.find((o) => o.id === obj.parentId);
        if (!parent || parent.type !== "frame") return;

        setObjects((prev) =>
          prev.map((o) => {
            if (o.id !== obj.id) return o;

            let newX = o.x;
            let newY = o.y;

            switch (alignment) {
              case "left":
                newX = 0;
                break;
              case "right":
                newX = parent.width - o.width;
                break;
              case "top":
                newY = 0;
                break;
              case "bottom":
                newY = parent.height - o.height;
                break;
              case "centerH":
                newX = (parent.width - o.width) / 2;
                break;
              case "centerV":
                newY = (parent.height - o.height) / 2;
                break;
            }

            return { ...o, x: newX, y: newY };
          })
        );
        return;
      }

      // Multiple objects: align to each other
      const positions = selected.map((o) => ({
        id: o.id,
        ...getCanvasPosition(o, objects),
        width: o.width,
        height: o.height,
        parentId: o.parentId,
      }));

      // Calculate bounds
      const minX = Math.min(...positions.map((p) => p.x));
      const maxX = Math.max(...positions.map((p) => p.x + p.width));
      const minY = Math.min(...positions.map((p) => p.y));
      const maxY = Math.max(...positions.map((p) => p.y + p.height));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setObjects((prev) =>
        prev.map((o) => {
          if (!selectedIds.includes(o.id)) return o;

          const pos = positions.find((p) => p.id === o.id)!;
          const canvasPos = { x: pos.x, y: pos.y };
          let newCanvasX = canvasPos.x;
          let newCanvasY = canvasPos.y;

          switch (alignment) {
            case "left":
              newCanvasX = minX;
              break;
            case "right":
              newCanvasX = maxX - o.width;
              break;
            case "top":
              newCanvasY = minY;
              break;
            case "bottom":
              newCanvasY = maxY - o.height;
              break;
            case "centerH":
              newCanvasX = centerX - o.width / 2;
              break;
            case "centerV":
              newCanvasY = centerY - o.height / 2;
              break;
          }

          // Convert back to relative position if has parent
          if (o.parentId) {
            const parent = prev.find((p) => p.id === o.parentId);
            if (parent) {
              const parentCanvasPos = getCanvasPosition(parent, prev);
              return {
                ...o,
                x: newCanvasX - parentCanvasPos.x,
                y: newCanvasY - parentCanvasPos.y,
              };
            }
          }

          return { ...o, x: newCanvasX, y: newCanvasY };
        })
      );
    },
    [selectedIds, objects, pushHistory]
  );

  const alignLeft = useCallback(() => alignObjects("left"), [alignObjects]);
  const alignRight = useCallback(() => alignObjects("right"), [alignObjects]);
  const alignTop = useCallback(() => alignObjects("top"), [alignObjects]);
  const alignBottom = useCallback(() => alignObjects("bottom"), [alignObjects]);
  const alignCenterH = useCallback(
    () => alignObjects("centerH"),
    [alignObjects]
  );
  const alignCenterV = useCallback(
    () => alignObjects("centerV"),
    [alignObjects]
  );

  // Move selected objects by delta
  const moveSelected = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.length === 0) return;
      if (dx === 0 && dy === 0) return;
      pushHistory();
      setObjects((prev) =>
        prev.map((o) => {
          if (!selectedIds.includes(o.id)) return o;
          return { ...o, x: o.x + dx, y: o.y + dy };
        })
      );
    },
    [selectedIds, pushHistory]
  );

  // Add image object
  const addImage = useCallback(
    (
      src: string,
      naturalWidth: number,
      naturalHeight: number,
      position: Point,
      parentId: string | null = null
    ) => {
      const id = `image-${Date.now()}`;
      const name = `Image ${objectCounter.current++}`;
      const newImage: ImageObject = {
        id,
        name,
        type: "image",
        parentId,
        x: position.x,
        y: position.y,
        width: naturalWidth,
        height: naturalHeight,
        opacity: 1,
        src,
        naturalWidth,
        naturalHeight,
      };
      pushHistory();
      setObjects((prev) => [...prev, newImage]);
      setSelectedIds([id]);
    },
    [pushHistory]
  );

  // Update object properties
  const updateObject = useCallback(
    (
      id: string,
      updates: Partial<CanvasObject>,
      options?: { commit?: boolean }
    ) => {
      if (options?.commit !== false) {
        pushHistory();
      }
      setObjects((prev) => {
        const updated = prev.map((o) =>
          o.id === id ? ({ ...o, ...updates } as CanvasObject) : o
        );
        // Recalculate hug sizes after update
        return recalculateHugSizes(updated);
      });
    },
    [recalculateHugSizes, pushHistory]
  );

  // Update text content
  const updateTextContent = useCallback(
    (id: string, content: string) => {
      pushHistory();
      setObjects((prev) =>
        prev.map((o) =>
          o.id === id && o.type === "text" ? { ...o, content } : o
        )
      );
    },
    [pushHistory]
  );

  // Set parent for nesting
  const setParent = useCallback(
    (childId: string, parentId: string | null) => {
      pushHistory();
      setObjects((prev) => {
        const updated = prev.map((o) => {
          if (o.id === childId) {
            // When nesting, convert position to relative to parent
            if (parentId) {
              const parent = prev.find((p) => p.id === parentId);
              if (parent) {
                const canvasPos = getCanvasPosition(o, prev);
                const parentCanvasPos = getCanvasPosition(parent, prev);
                return {
                  ...o,
                  parentId,
                  x: canvasPos.x - parentCanvasPos.x,
                  y: canvasPos.y - parentCanvasPos.y,
                };
              }
            } else {
              // Unnesting - convert to canvas space
              const canvasPos = getCanvasPosition(o, prev);
              return {
                ...o,
                parentId: null,
                x: canvasPos.x,
                y: canvasPos.y,
              };
            }
          }
          return o;
        });
        // Recalculate hug sizes for affected parent frames
        return recalculateHugSizes(updated);
      });
    },
    [recalculateHugSizes, pushHistory]
  );

  const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));
  const selectionBounds = getSelectionBounds(objects, selectedIds);

  return {
    transform,
    objects,
    selectedIds,
    selectedObjects,
    selectionBounds,
    tool,
    editingTextId,
    potentialParentId,
    isCreating,
    isDragging,
    hasDragMovement,
    isResizing,
    isPanning,
    isMarqueeSelecting,
    marqueeRect,
    guides,
    setTool,
    setEditingTextId,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    screenToCanvas,
    handleWheel,
    startCreate,
    updateCreate,
    endCreate,
    startDrag,
    updateDrag,
    endDrag,
    startResize,
    updateResize,
    endResize,
    startPan,
    updatePan,
    endPan,
    select,
    startMarquee,
    updateMarquee,
    endMarquee,
    copySelected,
    pasteClipboard,
    duplicateSelected,
    startDuplicateDrag,
    deleteSelected,
    selectAllSiblings,
    alignLeft,
    alignRight,
    alignTop,
    alignBottom,
    alignCenterH,
    alignCenterV,
    moveSelected,
    addImage,
    updateObject,
    updateTextContent,
    setParent,
  };
}

