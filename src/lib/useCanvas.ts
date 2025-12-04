import { useCallback, useRef, useState } from "react";
import { shallow } from "zustand/shallow";
import { useCanvasStore } from "./canvasStore";
import {
  calculateSnapping,
  getCanvasPosition,
  SNAP_THRESHOLD,
} from "./snapping";
import { useDrag } from "./interactions/useDrag";
import type {
  CanvasObject,
  FrameObject,
  ImageObject,
  TextObject,
  Guide,
  Point,
  ResizeHandle,
} from "./types";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_SPEED = 100; // pixels of pinch/scroll to double/halve zoom

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

  const createStart = useRef<Point | null>(null);
  const objectCounter = useRef(1);
  const panStart = useRef<Point | null>(null);
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
    },
    []
  );

  // ---- Drag Interaction (extracted hook) ----
  const drag = useDrag(
    {
      objects,
      selectedIds,
      getSelectionBounds,
      getDescendants,
      duplicateTree,
    },
    {
      setObjects,
      setSelectedIds,
      setGuides,
      pushHistory,
      recalculateHugSizes,
    }
  );

  // Destructure for easier access
  const {
    isDragging,
    hasDragMovement,
    potentialParentId,
    startDrag,
    updateDrag,
    endDrag,
    startDuplicateDrag,
  } = drag;

  // NOTE: Old inline drag code has been removed - see useDrag hook
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
    panStart.current = screenPoint;
  }, []);

  const updatePan = useCallback(
    (screenPoint: Point) => {
      if (!isPanning || !panStart.current) return;
      const dx = screenPoint.x - panStart.current.x;
      const dy = screenPoint.y - panStart.current.y;
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
      panStart.current = screenPoint;
    },
    [isPanning]
  );

  const endPan = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
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
