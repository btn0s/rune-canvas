import { useCallback, useRef, useState } from "react";
import type { CanvasObject, Point, Guide } from "../types";
import { getCanvasPosition } from "../geometry";
import { calculateSnapping } from "../snapping";
import {
  getSelectionBounds,
  getDescendants,
  duplicateTree,
  recalculateHugSizes,
} from "../objects";
import { useHistoryCapture } from "./useHistoryCapture";

// ============================================================================
// Types
// ============================================================================

interface DragActions {
  setObjects: (updater: (prev: CanvasObject[]) => CanvasObject[]) => void;
  setSelectedIds: (ids: string[]) => void;
  setGuides: (guides: Guide[]) => void;
  pushHistory: () => void;
}

interface DragConfig {
  objects: CanvasObject[];
  selectedIds: string[];
}

// ============================================================================
// Constants
// ============================================================================

const REPARENT_DELAY = 150; // ms

// ============================================================================
// Hook
// ============================================================================

export function useDrag(config: DragConfig, actions: DragActions) {
  const { objects, selectedIds } = config;
  const { setObjects, setSelectedIds, setGuides, pushHistory } = actions;

  // ---- History capture ----
  const history = useHistoryCapture(pushHistory);

  // ---- State ----
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragMovement, setHasDragMovement] = useState(false);
  const [potentialParentId, setPotentialParentId] = useState<string | null>(
    null
  );

  // ---- Refs ----
  const dragStart = useRef<Point | null>(null);
  const dragObjectsStart = useRef<{ id: string; x: number; y: number }[]>([]);
  const dragBoundsStart = useRef<{ x: number; y: number } | null>(null);
  const lastDragPoint = useRef<Point | null>(null);

  // Reparent timing
  const reparentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingParentId = useRef<string | null>(null);

  // Click vs drag detection
  const clickedFrameId = useRef<string | null>(null);
  const didDrag = useRef(false);

  // Selection state on mousedown
  const shiftOnMouseDown = useRef(false);
  const wasAlreadySelected = useRef(false);

  // Axis constraint for shift+drag
  const dragLockedAxis = useRef<"x" | "y" | null>(null);

  // ---- Handlers ----

  const startDrag = useCallback(
    (objectId: string, canvasPoint: Point, addToSelection = false) => {
      const obj = objects.find((o) => o.id === objectId);
      if (!obj) return;

      const isAlreadySelected = selectedIds.includes(objectId);

      // Reset drag tracking
      clickedFrameId.current = objectId;
      didDrag.current = false;
      history.reset();
      shiftOnMouseDown.current = addToSelection;
      wasAlreadySelected.current = isAlreadySelected;

      // Determine new selection
      let newSelectedIds: string[];
      if (addToSelection && !isAlreadySelected) {
        newSelectedIds = [...selectedIds, objectId];
      } else if (isAlreadySelected) {
        newSelectedIds = selectedIds;
      } else {
        newSelectedIds = [objectId];
      }

      setSelectedIds(newSelectedIds);
      setIsDragging(true);
      setHasDragMovement(false);
      dragStart.current = canvasPoint;

      // Store starting positions
      const selectedObjectsList = objects.filter((o) =>
        newSelectedIds.includes(o.id)
      );
      dragObjectsStart.current = selectedObjectsList.map((o) => ({
        id: o.id,
        x: o.x,
        y: o.y,
      }));

      // Store initial bounding box position
      const bounds = getSelectionBounds(objects, newSelectedIds);
      dragBoundsStart.current = bounds ? { x: bounds.x, y: bounds.y } : null;
    },
    [objects, selectedIds, setSelectedIds]
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

      lastDragPoint.current = canvasPoint;

      let dx = canvasPoint.x - dragStart.current.x;
      let dy = canvasPoint.y - dragStart.current.y;

      // Mark as dragged if moved more than 2px
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        history.captureOnce();
        didDrag.current = true;
        if (!hasDragMovement) setHasDragMovement(true);
      }

      // Shift-drag: lock to axis
      if (shiftKey && didDrag.current) {
        if (!dragLockedAxis.current) {
          dragLockedAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        }
        if (dragLockedAxis.current === "x") {
          dy = 0;
        } else {
          dx = 0;
        }
      } else {
        dragLockedAxis.current = null;
      }

      // Compute current bounding box
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

      const newBoundsX = dragBoundsStart.current.x + dx;
      const newBoundsY = dragBoundsStart.current.y + dy;

      // Exclude selected objects and descendants from snapping
      const descendants = getDescendants(selectedIds, objects);
      const excludeIds = new Set([
        ...selectedIds,
        ...descendants.map((d) => d.id),
      ]);

      // Scope snapping to siblings only
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

      const snapDx = snapped.x - newBoundsX;
      const snapDy = snapped.y - newBoundsY;

      setGuides(snapped.guides);
      setObjects((prev) =>
        prev.map((o) => {
          const startPos = dragObjectsStart.current.find((s) => s.id === o.id);
          if (!startPos) return o;
          return {
            ...o,
            x: startPos.x + dx + snapDx,
            y: startPos.y + dy + snapDy,
          };
        })
      );

      // Calculate potential parent for nesting (single object only)
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

          // Handle reparent timer
          if (newTargetId !== pendingParentId.current) {
            if (reparentTimer.current) {
              clearTimeout(reparentTimer.current);
              reparentTimer.current = null;
            }
            pendingParentId.current = newTargetId;

            if (newTargetId && newTargetId !== dragged.parentId) {
              reparentTimer.current = setTimeout(() => {
                setPotentialParentId(newTargetId);
                setObjects((prev) => {
                  const obj = prev.find((o) => o.id === dragged.id);
                  const newParent = prev.find((o) => o.id === newTargetId);
                  if (!obj || !newParent) return prev;

                  const canvasPos = getCanvasPosition(obj, prev);
                  const parentCanvasPos = getCanvasPosition(newParent, prev);

                  const newRelX = canvasPos.x - parentCanvasPos.x;
                  const newRelY = canvasPos.y - parentCanvasPos.y;

                  // Reset drag refs for smooth continuation
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
                      ? { ...o, parentId: newTargetId, x: newRelX, y: newRelY }
                      : o
                  );
                });
                reparentTimer.current = null;
              }, REPARENT_DELAY);
            } else if (!newTargetId || newTargetId === dragged.parentId) {
              setPotentialParentId(null);
            }
          }
        }
      } else {
        // Multi-select: no reparenting
        if (reparentTimer.current) {
          clearTimeout(reparentTimer.current);
          reparentTimer.current = null;
        }
        pendingParentId.current = null;
        setPotentialParentId(null);
      }
    },
    [isDragging, selectedIds, objects, hasDragMovement, setObjects, setGuides, history]
  );

  const endDrag = useCallback(() => {
    // Clear reparent timer
    if (reparentTimer.current) {
      clearTimeout(reparentTimer.current);
      reparentTimer.current = null;
    }
    history.reset();
    pendingParentId.current = null;

    // Handle click-without-drag scenarios
    if (clickedFrameId.current && !didDrag.current) {
      if (
        shiftOnMouseDown.current &&
        wasAlreadySelected.current &&
        selectedIds.includes(clickedFrameId.current)
      ) {
        // Shift+click on already-selected = deselect
        setSelectedIds(
          selectedIds.filter((id) => id !== clickedFrameId.current)
        );
      } else if (
        !shiftOnMouseDown.current &&
        selectedIds.length > 1 &&
        selectedIds.includes(clickedFrameId.current)
      ) {
        // Click on selected without shift = select only this one
        setSelectedIds([clickedFrameId.current]);
      }
    }

    // Handle unnesting
    if (didDrag.current && selectedIds.length === 1) {
      setObjects((prev) => {
        const dragged = prev.find((o) => o.id === selectedIds[0]);
        if (!dragged || !dragged.parentId) {
          return recalculateHugSizes(prev);
        }

        const draggedCanvasPos = getCanvasPosition(dragged, prev);
        const draggedCenter = {
          x: draggedCanvasPos.x + dragged.width / 2,
          y: draggedCanvasPos.y + dragged.height / 2,
        };

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

        // Unnest to root if outside all frames
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
      setObjects((prev) => recalculateHugSizes(prev));
    }

    // Reset state
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
  }, [selectedIds, setSelectedIds, setObjects, setGuides, history]);

  const startDuplicateDrag = useCallback(
    (objectId: string, canvasPoint: Point) => {
      const toDuplicate = selectedIds.includes(objectId)
        ? selectedIds
        : [objectId];
      const selected = objects.filter((o) => toDuplicate.includes(o.id));
      const descendants = getDescendants(toDuplicate, objects);
      const allToDupe = [...selected, ...descendants];

      const newObjects = duplicateTree(allToDupe, { x: 0, y: 0 }, true);
      history.captureOnce();

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

      const bounds = getSelectionBounds(rootObjects, newRootIds);
      dragBoundsStart.current = bounds ? { x: bounds.x, y: bounds.y } : null;
    },
    [objects, selectedIds, setObjects, setSelectedIds, history]
  );

  return {
    // State
    isDragging,
    hasDragMovement,
    potentialParentId,
    // Handlers
    startDrag,
    updateDrag,
    endDrag,
    startDuplicateDrag,
  };
}
