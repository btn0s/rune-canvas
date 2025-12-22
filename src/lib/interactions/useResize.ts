import { useCallback, useRef, useState } from "react";
import type { CanvasObject, ImageObject, Point, Guide, ResizeHandle } from "../types";
import { getCanvasPosition } from "../geometry";
import { calculateSnapping } from "../snapping";
import { getSelectionBounds, recalculateHugSizes } from "../objectUtils";
import { useHistoryCapture } from "./useHistoryCapture";

// ============================================================================
// Types
// ============================================================================

interface ResizeActions {
  setObjects: (updater: (prev: CanvasObject[]) => CanvasObject[]) => void;
  setGuides: (guides: Guide[]) => void;
  pushHistory: () => void;
}

interface ResizeConfig {
  objects: CanvasObject[];
  selectedIds: string[];
}

// ============================================================================
// Hook
// ============================================================================

export function useResize(config: ResizeConfig, actions: ResizeActions) {
  const { objects, selectedIds } = config;
  const { setObjects, setGuides, pushHistory } = actions;

  // ---- History capture ----
  const history = useHistoryCapture(pushHistory);

  // ---- State ----
  const [isResizing, setIsResizing] = useState(false);

  const resizeHandle = useRef<ResizeHandle | null>(null);
  const resizeStart = useRef<{
    object: { x: number; y: number; width: number; height: number };
    point: Point;
    rotation: number;
    center: Point;
  } | null>(null);
  const resizeBoundsStart = useRef<{
    bounds: { x: number; y: number; width: number; height: number };
    frames: CanvasObject[];
    rotation: number;
    center: Point;
  } | null>(null);

  // ---- Handlers ----

  const startResize = useCallback(
    (handle: ResizeHandle, canvasPoint: Point) => {
      const bounds = getSelectionBounds(objects, selectedIds);
      if (!bounds) return;

      setIsResizing(true);
      history.reset();
      resizeHandle.current = handle;
      resizeStart.current = {
        object: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
        point: canvasPoint,
        rotation: bounds.rotation,
        center: bounds.center,
      };
      resizeBoundsStart.current = {
        bounds: { ...bounds },
        frames: objects
          .filter((o) => selectedIds.includes(o.id))
          .map((o) => ({ ...o })),
        rotation: bounds.rotation,
        center: bounds.center,
      };
    },
    [objects, selectedIds, history]
  );

  const updateResize = useCallback(
    (canvasPoint: Point, shiftKey = false, altKey = false, metaKey = false) => {
      if (!isResizing || !resizeStart.current || !resizeBoundsStart.current)
        return;

      const { point: start, rotation } = resizeStart.current;
      const { bounds: origBounds, frames: origObjects } =
        resizeBoundsStart.current;
      const handle = resizeHandle.current!;

      let dx = canvasPoint.x - start.x;
      let dy = canvasPoint.y - start.y;

      if (rotation !== 0) {
        const rad = (-rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const localDx = dx * cos - dy * sin;
        const localDy = dx * sin + dy * cos;
        dx = localDx;
        dy = localDy;
      }

      // Capture history on first movement
      if (dx !== 0 || dy !== 0) {
        history.captureOnce();
      }

      // Check if we're in crop mode (meta key + single image)
      const selectedObj = objects.find((o) => o.id === selectedIds[0]);
      const isImage = selectedIds.length === 1 && selectedObj?.type === "image";
      const isCropMode = metaKey && isImage;

      if (isCropMode) {
        const imageObj = selectedObj as ImageObject;

        // If image is not in crop mode, switch it and initialize crop values
        if (imageObj.fillMode !== "crop") {
          // Calculate crop values that match current "fill" view
          const frameAspect = imageObj.width / imageObj.height;
          const imageAspect = imageObj.naturalWidth / imageObj.naturalHeight;

          let initCropW, initCropH, initCropX, initCropY;
          if (frameAspect > imageAspect) {
            // Frame is wider - crop top/bottom
            initCropW = imageObj.naturalWidth;
            initCropH = imageObj.naturalWidth / frameAspect;
            initCropX = 0;
            initCropY = (imageObj.naturalHeight - initCropH) / 2;
          } else {
            // Frame is taller - crop left/right
            initCropH = imageObj.naturalHeight;
            initCropW = imageObj.naturalHeight * frameAspect;
            initCropX = (imageObj.naturalWidth - initCropW) / 2;
            initCropY = 0;
          }

          // Update to crop mode with calculated values
          setObjects((prev) =>
            prev.map((o) => {
              if (o.id !== imageObj.id) return o;
              return {
                ...o,
                fillMode: "crop",
                cropX: initCropX,
                cropY: initCropY,
                cropWidth: initCropW,
                cropHeight: initCropH,
              } as ImageObject;
            })
          );

          // Update the refs so the crop logic below uses correct values
          if (resizeBoundsStart.current) {
            resizeBoundsStart.current.frames =
              resizeBoundsStart.current.frames.map((f) => {
                if (f.id !== imageObj.id) return f;
                return {
                  ...f,
                  fillMode: "crop",
                  cropX: initCropX,
                  cropY: initCropY,
                  cropWidth: initCropW,
                  cropHeight: initCropH,
                } as ImageObject;
              });
          }

          return; // Let next frame handle the actual crop resize
        }
        // CROP MODE: Change display size while keeping image scale constant
        // The image "stays in place" - we're moving the frame/mask edges
        const img = selectedObj as ImageObject;
        const origImg = origObjects.find((o) => o.id === img.id) as ImageObject;
        if (!origImg) return;

        // Calculate the current scale (display pixels per image pixel)
        // This scale remains constant during crop - we're just revealing more/less
        const scaleX = origImg.width / origImg.cropWidth;
        const scaleY = origImg.height / origImg.cropHeight;

        // Start with original values
        let newWidth = origImg.width;
        let newHeight = origImg.height;
        let newX = origImg.x;
        let newY = origImg.y;
        let newCropX = origImg.cropX;
        let newCropY = origImg.cropY;
        let newCropWidth = origImg.cropWidth;
        let newCropHeight = origImg.cropHeight;

        // Adjust based on handle - change display size, crop adjusts to maintain scale
        if (handle.includes("e")) {
          // East edge: expand/contract right side
          newWidth = Math.max(1, origImg.width + dx);
          // Crop width changes to maintain scale
          newCropWidth = newWidth / scaleX;
          // Clamp: can't show more than available image on right
          const maxCropWidth = img.naturalWidth - newCropX;
          if (newCropWidth > maxCropWidth) {
            newCropWidth = maxCropWidth;
            newWidth = newCropWidth * scaleX;
          }
        }
        if (handle.includes("w")) {
          // West edge: expand/contract left side, position changes
          const widthDelta = -dx;
          newWidth = Math.max(1, origImg.width + widthDelta);
          // Crop width changes to maintain scale
          const cropWidthDelta = widthDelta / scaleX;
          newCropWidth = origImg.cropWidth + cropWidthDelta;
          // Crop X moves in opposite direction (revealing more on left = lower cropX)
          newCropX = origImg.cropX - cropWidthDelta;
          // Position moves with the edge
          newX = origImg.x + dx;

          // Clamp: can't reveal more than available image on left
          if (newCropX < 0) {
            const overflow = -newCropX;
            newCropX = 0;
            newCropWidth = newCropWidth - overflow;
            newWidth = newCropWidth * scaleX;
            newX = origImg.x + (origImg.width - newWidth);
          }
        }
        if (handle.includes("s")) {
          // South edge: expand/contract bottom
          newHeight = Math.max(1, origImg.height + dy);
          newCropHeight = newHeight / scaleY;
          // Clamp: can't show more than available image on bottom
          const maxCropHeight = img.naturalHeight - newCropY;
          if (newCropHeight > maxCropHeight) {
            newCropHeight = maxCropHeight;
            newHeight = newCropHeight * scaleY;
          }
        }
        if (handle.includes("n")) {
          // North edge: expand/contract top, position changes
          const heightDelta = -dy;
          newHeight = Math.max(1, origImg.height + heightDelta);
          const cropHeightDelta = heightDelta / scaleY;
          newCropHeight = origImg.cropHeight + cropHeightDelta;
          newCropY = origImg.cropY - cropHeightDelta;
          newY = origImg.y + dy;

          // Clamp: can't reveal more than available image on top
          if (newCropY < 0) {
            const overflow = -newCropY;
            newCropY = 0;
            newCropHeight = newCropHeight - overflow;
            newHeight = newCropHeight * scaleY;
            newY = origImg.y + (origImg.height - newHeight);
          }
        }

        // Enforce minimums
        newWidth = Math.max(1, newWidth);
        newHeight = Math.max(1, newHeight);
        newCropWidth = Math.max(1, newCropWidth);
        newCropHeight = Math.max(1, newCropHeight);

        setObjects((prev) =>
          prev.map((o) => {
            if (o.id !== selectedObj.id) return o;
            return {
              ...o,
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
              cropX: newCropX,
              cropY: newCropY,
              cropWidth: newCropWidth,
              cropHeight: newCropHeight,
            } as ImageObject;
          })
        );

        return; // Don't do normal resize
      }

      // NORMAL RESIZE MODE
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

      let width = origBounds.width;
      let height = origBounds.height;
      const origCenterX = origBounds.x + origBounds.width / 2;
      const origCenterY = origBounds.y + origBounds.height / 2;

      // Alt: resize from center
      if (altKey) {
        if (handle.includes("w")) {
          width = origBounds.width - dx * 2;
        }
        if (handle.includes("e")) {
          width = origBounds.width + dx * 2;
        }
        if (handle.includes("n")) {
          height = origBounds.height - dy * 2;
        }
        if (handle.includes("s")) {
          height = origBounds.height + dy * 2;
        }
        if (shiftKey) {
          if (handle === "e" || handle === "w") {
            height = origBounds.height + Math.abs(width - origBounds.width);
          } else if (handle === "n" || handle === "s") {
            width = origBounds.width + Math.abs(height - origBounds.height);
          }
        }
      } else {
        if (handle.includes("w")) width = origBounds.width - dx;
        if (handle.includes("e")) width = origBounds.width + dx;
        if (handle.includes("n")) height = origBounds.height - dy;
        if (handle.includes("s")) height = origBounds.height + dy;
      }

      // Calculate new center position
      // The key insight: keep the opposite edge/corner fixed in world space
      let newCenterX = origCenterX;
      let newCenterY = origCenterY;

      if (!altKey) {
        // Local offset from original center to new center
        let localDx = 0;
        let localDy = 0;

        if (handle.includes("w")) localDx = (origBounds.width - width) / 2;
        if (handle.includes("e")) localDx = (width - origBounds.width) / 2;
        if (handle.includes("n")) localDy = (origBounds.height - height) / 2;
        if (handle.includes("s")) localDy = (height - origBounds.height) / 2;

        if (rotation !== 0) {
          const rad = (rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          newCenterX = origCenterX + localDx * cos - localDy * sin;
          newCenterY = origCenterY + localDx * sin + localDy * cos;
        } else {
          newCenterX = origCenterX + localDx;
          newCenterY = origCenterY + localDy;
        }
      }

      // Convert center back to top-left
      let x = newCenterX - width / 2;
      let y = newCenterY - height / 2;

      // Enforce minimum size
      if (width < 1) {
        width = 1;
        if (handle.includes("w")) x = origBounds.x + origBounds.width - 1;
      }
      if (height < 1) {
        height = 1;
        if (handle.includes("n")) y = origBounds.y + origBounds.height - 1;
      }

      // Get parent for snapping (children snap to parent edges + siblings)
      const firstSelected = objects.find((o) => o.id === selectedIds[0]);
      const parentId = firstSelected?.parentId ?? null;
      const parent = parentId ? objects.find((o) => o.id === parentId) : null;

      // Siblings = objects with same parent, excluding selected
      const siblings = objects.filter(
        (o) => !selectedIds.includes(o.id) && o.parentId === parentId
      );

      const snapped = calculateSnapping(
        { x, y, width, height },
        siblings,
        objects,
        "resize",
        handle,
        parent // snap to parent edges too
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
    [isResizing, selectedIds, objects, setGuides, setObjects, history]
  );

  const endResize = useCallback(() => {
    // Recalculate hug sizes for parent frames after resize
    setObjects((prev) => recalculateHugSizes(prev));
    setIsResizing(false);
    setGuides([]);
    history.reset();
    resizeHandle.current = null;
    resizeStart.current = null;
    resizeBoundsStart.current = null;
  }, [setObjects, setGuides, history]);

  return {
    // State
    isResizing,
    // Handlers
    startResize,
    updateResize,
    endResize,
  };
}

