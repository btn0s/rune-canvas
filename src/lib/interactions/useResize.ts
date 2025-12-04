import { useCallback, useRef, useState } from "react";
import type { CanvasObject, Point, Guide, ResizeHandle } from "../types";
import { getCanvasPosition, type Rect } from "../geometry";
import { calculateSnapping } from "../snapping";

// ============================================================================
// Types
// ============================================================================

interface ResizeActions {
  setObjects: (updater: (prev: CanvasObject[]) => CanvasObject[]) => void;
  setGuides: (guides: Guide[]) => void;
  pushHistory: () => void;
  recalculateHugSizes: (objects: CanvasObject[]) => CanvasObject[];
}

interface ResizeConfig {
  objects: CanvasObject[];
  selectedIds: string[];
  getSelectionBounds: (objects: CanvasObject[], ids: string[]) => Rect | null;
}

// ============================================================================
// Hook
// ============================================================================

export function useResize(config: ResizeConfig, actions: ResizeActions) {
  const { objects, selectedIds, getSelectionBounds } = config;
  const { setObjects, setGuides, pushHistory, recalculateHugSizes } = actions;

  // ---- State ----
  const [isResizing, setIsResizing] = useState(false);

  // ---- Refs ----
  const resizeHandle = useRef<ResizeHandle | null>(null);
  const resizeStart = useRef<{
    object: { x: number; y: number; width: number; height: number };
    point: Point;
  } | null>(null);
  const resizeBoundsStart = useRef<{
    bounds: { x: number; y: number; width: number; height: number };
    frames: CanvasObject[];
  } | null>(null);
  const resizeHistoryCaptured = useRef(false);

  // ---- Handlers ----

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

      // Capture history on first movement
      if (!resizeHistoryCaptured.current && (dx !== 0 || dy !== 0)) {
        pushHistory();
        resizeHistoryCaptured.current = true;
      }

      // Shift: lock aspect ratio
      if (shiftKey && origBounds.width > 0 && origBounds.height > 0) {
        const aspectRatio = origBounds.width / origBounds.height;

        if (handle.length === 2) {
          // Corner handle (nw, ne, sw, se)
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          if (absDx / aspectRatio > absDy) {
            // Width is dominant, adjust height
            dy = (absDx / aspectRatio) * Math.sign(dy || 1);
            if (handle.includes("n"))
              dy =
                -Math.abs(dy) * Math.sign(dx * (handle.includes("w") ? -1 : 1));
            if (handle.includes("s"))
              dy =
                Math.abs(dy) * Math.sign(dx * (handle.includes("w") ? -1 : 1));
          } else {
            // Height is dominant, adjust width
            dx = absDy * aspectRatio * Math.sign(dx || 1);
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

      // Alt: resize from center
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

      // Enforce minimum size
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

          // Convert back to relative position if has parent
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
    [isResizing, selectedIds, objects, pushHistory, setGuides, setObjects]
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
  }, [setObjects, setGuides, recalculateHugSizes]);

  return {
    // State
    isResizing,
    // Handlers
    startResize,
    updateResize,
    endResize,
  };
}
