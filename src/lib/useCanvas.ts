import { useCallback, useRef, useState } from "react";
import { shallow } from "zustand/shallow";
import { useCanvasStore } from "./canvasStore";
import { getCanvasPosition, SNAP_THRESHOLD } from "./snapping";
import {
  getSelectionBounds,
  getDescendants,
  duplicateTree,
  recalculateHugSizes,
} from "./objects";
import { useDrag } from "./interactions/useDrag";
import { useResize } from "./interactions/useResize";
import type {
  CanvasObject,
  FrameObject,
  ImageObject,
  TextObject,
  Guide,
  Point,
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
  const createParentId = useRef<string | null>(null);
  const objectCounter = useRef(1);
  const panStart = useRef<Point | null>(null);
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

      // Store start point and parent - don't create object yet
      setIsCreating(true);
      createStart.current = canvasPoint;
      createParentId.current = targetParent?.id ?? null;
      setSelectedIds([]);
      // Note: Text tool is handled separately via createText()
    },
    [objects]
  );

  const updateCreate = useCallback(
    (canvasPoint: Point) => {
      if (!isCreating || !createStart.current) return;
      const start = createStart.current;
      const parentId = createParentId.current;

      // Check if we've started dragging (moved enough to create)
      const dx = Math.abs(canvasPoint.x - start.x);
      const dy = Math.abs(canvasPoint.y - start.y);
      if (dx < 3 && dy < 3) return; // Not dragging yet

      let creatingId = selectedIds[0];

      // Create the frame on first drag movement
      if (!creatingId && (tool === "frame" || tool === "rectangle")) {
        pushHistory();
        const id = `frame-${Date.now()}`;
        const name = `Frame ${objectCounter.current++}`;

        // Convert start to relative position if nested
        let relativeStart = start;
        if (parentId) {
          const parent = objects.find((o) => o.id === parentId);
          if (parent) {
            const parentCanvasPos = getCanvasPosition(parent, objects);
            relativeStart = {
              x: start.x - parentCanvasPos.x,
              y: start.y - parentCanvasPos.y,
            };
          }
        }

        const newFrame: FrameObject = {
          id,
          name,
          type: "frame",
          parentId,
          x: relativeStart.x,
          y: relativeStart.y,
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
        creatingId = id;
      }

      if (!creatingId) return;
      const creatingObj = objects.find((o) => o.id === creatingId);

      // For creation, the start point is FIXED - only snap the end point
      let endX = canvasPoint.x;
      let endY = canvasPoint.y;
      const guides: Guide[] = [];

      // Collect snap targets from sibling objects (same parent scope)
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
      if (creatingObj?.parentId) {
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
    [isCreating, selectedIds, objects, tool, pushHistory]
  );

  const endCreate = useCallback(() => {
    const creatingId = selectedIds[0];
    const start = createStart.current;
    const parentId = createParentId.current;

    // Single-click: create frame centered at click point
    if (!creatingId && start && (tool === "frame" || tool === "rectangle")) {
      pushHistory();
      const id = `frame-${Date.now()}`;
      const name = `Frame ${objectCounter.current++}`;
      const defaultSize = 100;

      // Convert start to relative position if nested, then center
      let relativeX = start.x - defaultSize / 2;
      let relativeY = start.y - defaultSize / 2;
      if (parentId) {
        const parent = objects.find((o) => o.id === parentId);
        if (parent) {
          const parentCanvasPos = getCanvasPosition(parent, objects);
          relativeX = start.x - parentCanvasPos.x - defaultSize / 2;
          relativeY = start.y - parentCanvasPos.y - defaultSize / 2;
        }
      }

      const newFrame: FrameObject = {
        id,
        name,
        type: "frame",
        parentId,
        x: relativeX,
        y: relativeY,
        width: defaultSize,
        height: defaultSize,
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
      setObjects((prev) => recalculateHugSizes([...prev, newFrame]));
      setSelectedIds([id]);
    } else if (creatingId) {
      // Dragged: finalize the frame (ensure minimum size)
      setObjects((prev) => {
        let updated = prev;
        const obj = prev.find((o) => o.id === creatingId);
        if (!obj) return prev;
        // For frames/rectangles that are too small, give them a default size centered at start
        if (obj.type !== "text" && obj.width < 10 && obj.height < 10) {
          const defaultSize = 100;
          updated = prev.map((o) =>
            o.id === creatingId
              ? {
                  ...o,
                  x: o.x - defaultSize / 2,
                  y: o.y - defaultSize / 2,
                  width: defaultSize,
                  height: defaultSize,
                }
              : o
          );
        }
        // Recalculate hug sizes for parent frames
        return recalculateHugSizes(updated);
      });
    }

    setIsCreating(false);
    setGuides([]);
    createStart.current = null;
    createParentId.current = null;
    setTool("select");
  }, [selectedIds, tool, objects, pushHistory]);

  // ---- Drag Interaction (extracted hook) ----
  const drag = useDrag(
    { objects, selectedIds },
    { setObjects, setSelectedIds, setGuides, pushHistory }
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

  // ---- Resize Interaction (extracted hook) ----
  const resize = useResize(
    { objects, selectedIds },
    { setObjects, setGuides, pushHistory }
  );

  const { isResizing, startResize, updateResize, endResize } = resize;

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

      // Filter out children whose parent is also selected (select outermost only)
      const intersectingIds = new Set(intersecting.map((o) => o.id));
      const outermostOnly = intersecting.filter((o) => {
        // Walk up the parent chain - if any ancestor is in the selection, exclude this object
        let parentId = o.parentId;
        while (parentId) {
          if (intersectingIds.has(parentId)) {
            return false; // Parent is selected, so skip this child
          }
          const parent = objects.find((p) => p.id === parentId);
          parentId = parent?.parentId ?? null;
        }
        return true;
      });

      setSelectedIds(outermostOnly.map((o) => o.id));
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
  }, [selectedIds, objects]);

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
  }, [pushHistory]);

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
  }, [selectedIds, objects, pushHistory]);

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
  }, [selectedIds, objects, pushHistory]);

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

  // Z-order functions
  const bringToFront = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();
    setObjects((prev) => {
      const selected = prev.filter((o) => selectedIds.includes(o.id));
      const rest = prev.filter((o) => !selectedIds.includes(o.id));
      return [...rest, ...selected];
    });
  }, [selectedIds, pushHistory]);

  const sendToBack = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();
    setObjects((prev) => {
      const selected = prev.filter((o) => selectedIds.includes(o.id));
      const rest = prev.filter((o) => !selectedIds.includes(o.id));
      return [...selected, ...rest];
    });
  }, [selectedIds, pushHistory]);

  const bringForward = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();
    setObjects((prev) => {
      const result = [...prev];
      // Process each selected object from end to start to avoid index issues
      for (let i = result.length - 2; i >= 0; i--) {
        if (
          selectedIds.includes(result[i].id) &&
          !selectedIds.includes(result[i + 1].id)
        ) {
          // Swap with next object
          [result[i], result[i + 1]] = [result[i + 1], result[i]];
        }
      }
      return result;
    });
  }, [selectedIds, pushHistory]);

  const sendBackward = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();
    setObjects((prev) => {
      const result = [...prev];
      // Process each selected object from start to end to avoid index issues
      for (let i = 1; i < result.length; i++) {
        if (
          selectedIds.includes(result[i].id) &&
          !selectedIds.includes(result[i - 1].id)
        ) {
          // Swap with previous object
          [result[i - 1], result[i]] = [result[i], result[i - 1]];
        }
      }
      return result;
    });
  }, [selectedIds, pushHistory]);

  // Frame selection - wrap selected objects in a new frame
  const frameSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();

    // Get bounding box of selection
    const bounds = getSelectionBounds(objects, selectedIds);
    if (!bounds) return;

    const frameId = `frame-${Date.now()}`;
    const newFrame: FrameObject = {
      id: frameId,
      name: `Frame ${objectCounter.current++}`,
      type: "frame",
      parentId: null,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
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

    setObjects((prev) => {
      // Reparent selected objects to new frame, adjusting positions
      const updated = prev.map((o) => {
        if (selectedIds.includes(o.id)) {
          const canvasPos = getCanvasPosition(o, prev);
          return {
            ...o,
            parentId: frameId,
            x: canvasPos.x - bounds.x,
            y: canvasPos.y - bounds.y,
          };
        }
        return o;
      });
      return [...updated, newFrame];
    });

    setSelectedIds([frameId]);
  }, [selectedIds, objects, pushHistory]);

  // Paste at specific canvas position
  const pasteAt = useCallback(
    (position: Point) => {
      if (clipboard.current.length === 0) return;
      pushHistory();

      // Calculate offset from clipboard bounds to paste position
      const clipboardBounds = getSelectionBounds(
        clipboard.current,
        clipboard.current.map((o) => o.id)
      );
      const offsetX = position.x - (clipboardBounds?.x ?? 0);
      const offsetY = position.y - (clipboardBounds?.y ?? 0);

      const newObjects = duplicateTree(
        clipboard.current,
        { x: offsetX, y: offsetY },
        false
      );
      setObjects((prev) => [...prev, ...newObjects]);
      const newRootIds = newObjects
        .filter(
          (o) => !o.parentId || !newObjects.some((c) => c.id === o.parentId)
        )
        .map((o) => o.id);
      setSelectedIds(newRootIds);
    },
    [pushHistory]
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
    [pushHistory]
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

  // Create text object (separate from frame/rectangle creation)
  const createText = useCallback(
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

      const id = `text-${Date.now()}`;
      const name = `Text ${objectCounter.current++}`;
      const newText: TextObject = {
        id,
        name,
        type: "text",
        parentId,
        x: relativePoint.x,
        y: relativePoint.y,
        width: 0, // Will be auto-sized
        height: 0, // Will be auto-sized
        opacity: 1,
        content: "",
        fontSize: 16,
        fontFamily: "system-ui",
        fontWeight: 400,
        textAlign: "left",
        color: "#000000",
        sizeMode: "auto-width",
      };

      pushHistory();
      setObjects((prev) => [...prev, newText]);
      setSelectedIds([id]);
      setEditingTextId(id);
      setTool("select");
    },
    [objects, pushHistory]
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
    [pushHistory]
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
    createText,
    setParent,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    frameSelection,
    pasteAt,
  };
}
