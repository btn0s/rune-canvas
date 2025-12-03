import { useCallback, useRef, useState } from "react";
import type {
  Frame,
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
  frameId: string;
  frame: Frame;
}

// Helper to create a vertical guide with proper bounds
function createVerticalGuide(
  position: number,
  currentFrame: { y: number; height: number },
  snapFrame: Frame
): Guide {
  return {
    type: "vertical",
    position,
    startBound: Math.min(currentFrame.y, snapFrame.y),
    endBound: Math.max(
      currentFrame.y + currentFrame.height,
      snapFrame.y + snapFrame.height
    ),
  };
}

// Helper to create a horizontal guide with proper bounds
function createHorizontalGuide(
  position: number,
  currentFrame: { x: number; width: number },
  snapFrame: Frame
): Guide {
  return {
    type: "horizontal",
    position,
    startBound: Math.min(currentFrame.x, snapFrame.x),
    endBound: Math.max(
      currentFrame.x + currentFrame.width,
      snapFrame.x + snapFrame.width
    ),
  };
}

function calculateSnapping(
  frame: { x: number; y: number; width: number; height: number },
  otherFrames: Frame[],
  mode: "move" | "create" | "resize",
  resizeHandle?: ResizeHandle
): {
  x: number;
  y: number;
  width: number;
  height: number;
  guides: Guide[];
} {
  let { x, y, width, height } = frame;
  const guides: Guide[] = [];

  if (otherFrames.length === 0) {
    return { x, y, width, height, guides };
  }

  // Collect snap targets with frame references
  const xTargets: SnapTarget[] = [];
  const yTargets: SnapTarget[] = [];

  for (const other of otherFrames) {
    xTargets.push({ value: other.x, frameId: other.id, frame: other });
    xTargets.push({
      value: other.x + other.width,
      frameId: other.id,
      frame: other,
    });
    xTargets.push({
      value: other.x + other.width / 2,
      frameId: other.id,
      frame: other,
    });
    yTargets.push({ value: other.y, frameId: other.id, frame: other });
    yTargets.push({
      value: other.y + other.height,
      frameId: other.id,
      frame: other,
    });
    yTargets.push({
      value: other.y + other.height / 2,
      frameId: other.id,
      frame: other,
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
          createVerticalGuide(target.value, { y, height }, target.frame)
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
          createHorizontalGuide(target.value, { x, width }, target.frame)
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

  // Dimension snapping (width/height matching) - only during resize/create
  if (mode === "resize" || mode === "create") {
    const isChangingWidth =
      mode === "create" ||
      (resizeHandle &&
        (resizeHandle.includes("e") || resizeHandle.includes("w")));
    const isChangingHeight =
      mode === "create" ||
      (resizeHandle &&
        (resizeHandle.includes("n") || resizeHandle.includes("s")));

    if (isChangingWidth) {
      const matchingWidthFrames = otherFrames.filter(
        (f) => Math.abs(f.width - width) < SNAP_THRESHOLD
      );
      if (matchingWidthFrames.length > 0) {
        const targetWidth = matchingWidthFrames[0].width;
        const oldWidth = width;
        width = targetWidth;
        if (resizeHandle?.includes("w")) {
          x += oldWidth - width;
        }
        for (const matchFrame of matchingWidthFrames) {
          guides.push({
            type: "width",
            position: targetWidth,
            refFrame: {
              x: matchFrame.x,
              y: matchFrame.y,
              width: matchFrame.width,
              height: matchFrame.height,
            },
          });
        }
      }
    }

    if (isChangingHeight) {
      const matchingHeightFrames = otherFrames.filter(
        (f) => Math.abs(f.height - height) < SNAP_THRESHOLD
      );
      if (matchingHeightFrames.length > 0) {
        const targetHeight = matchingHeightFrames[0].height;
        const oldHeight = height;
        height = targetHeight;
        if (resizeHandle?.includes("n")) {
          y += oldHeight - height;
        }
        for (const matchFrame of matchingHeightFrames) {
          guides.push({
            type: "height",
            position: targetHeight,
            refFrame: {
              x: matchFrame.x,
              y: matchFrame.y,
              width: matchFrame.width,
              height: matchFrame.height,
            },
          });
        }
      }
    }

    // Edge snapping during resize
    if (resizeHandle) {
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
  }

  // Gap snapping for move mode
  if (mode === "move") {
    const allGaps = calculateAllGaps(otherFrames);

    // Try horizontal gap snapping
    for (const gap of allGaps.horizontal) {
      if (snappedX) break;
      for (const other of otherFrames) {
        const gapToRight = other.x - (x + width);
        if (
          gapToRight > 0 &&
          Math.abs(gapToRight - gap.distance) < SNAP_THRESHOLD
        ) {
          x = other.x - width - gap.distance;
          snappedX = true;
          // Add guide for the new gap being created
          guides.push({
            type: "gap",
            distance: gap.distance,
            orientation: "vertical",
            gapStart: x + width,
            gapEnd: other.x,
            gapTopY: Math.max(y, other.y),
            gapBottomY: Math.min(y + height, other.y + other.height),
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
        const gapToLeft = x - (other.x + other.width);
        if (
          gapToLeft > 0 &&
          Math.abs(gapToLeft - gap.distance) < SNAP_THRESHOLD
        ) {
          x = other.x + other.width + gap.distance;
          snappedX = true;
          guides.push({
            type: "gap",
            distance: gap.distance,
            orientation: "vertical",
            gapStart: other.x + other.width,
            gapEnd: x,
            gapTopY: Math.max(y, other.y),
            gapBottomY: Math.min(y + height, other.y + other.height),
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
      for (const other of otherFrames) {
        const gapBelow = other.y - (y + height);
        if (
          gapBelow > 0 &&
          Math.abs(gapBelow - gap.distance) < SNAP_THRESHOLD
        ) {
          y = other.y - height - gap.distance;
          snappedY = true;
          guides.push({
            type: "gap",
            distance: gap.distance,
            orientation: "horizontal",
            gapStart: y + height,
            gapEnd: other.y,
            gapLeftX: Math.max(x, other.x),
            gapRightX: Math.min(x + width, other.x + other.width),
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
        const gapAbove = y - (other.y + other.height);
        if (
          gapAbove > 0 &&
          Math.abs(gapAbove - gap.distance) < SNAP_THRESHOLD
        ) {
          y = other.y + other.height + gap.distance;
          snappedY = true;
          guides.push({
            type: "gap",
            distance: gap.distance,
            orientation: "horizontal",
            gapStart: other.y + other.height,
            gapEnd: y,
            gapLeftX: Math.max(x, other.x),
            gapRightX: Math.min(x + width, other.x + other.width),
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

function calculateAllGaps(frames: Frame[]): {
  horizontal: GapInfo[];
  vertical: GapInfo[];
} {
  const horizontal: GapInfo[] = [];
  const vertical: GapInfo[] = [];

  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const a = frames[i];
      const b = frames[j];

      // Horizontal gap (frames side by side)
      if (a.x + a.width < b.x) {
        const gapStart = a.x + a.width;
        const gapEnd = b.x;
        const overlapTop = Math.max(a.y, b.y);
        const overlapBottom = Math.min(a.y + a.height, b.y + b.height);
        if (overlapBottom > overlapTop) {
          horizontal.push({
            distance: Math.round(gapEnd - gapStart),
            start: gapStart,
            end: gapEnd,
            topY: overlapTop,
            bottomY: overlapBottom,
          });
        }
      } else if (b.x + b.width < a.x) {
        const gapStart = b.x + b.width;
        const gapEnd = a.x;
        const overlapTop = Math.max(a.y, b.y);
        const overlapBottom = Math.min(a.y + a.height, b.y + b.height);
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

      // Vertical gap (frames stacked)
      if (a.y + a.height < b.y) {
        const gapStart = a.y + a.height;
        const gapEnd = b.y;
        const overlapLeft = Math.max(a.x, b.x);
        const overlapRight = Math.min(a.x + a.width, b.x + b.width);
        if (overlapRight > overlapLeft) {
          vertical.push({
            distance: Math.round(gapEnd - gapStart),
            start: gapStart,
            end: gapEnd,
            leftX: overlapLeft,
            rightX: overlapRight,
          });
        }
      } else if (b.y + b.height < a.y) {
        const gapStart = b.y + b.height;
        const gapEnd = a.y;
        const overlapLeft = Math.max(a.x, b.x);
        const overlapRight = Math.min(a.x + a.width, b.x + b.width);
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
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("frame");

  const [isCreating, setIsCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
  const dragStart = useRef<Point | null>(null);
  const dragFramesStart = useRef<{ id: string; x: number; y: number }[]>([]);
  const resizeHandle = useRef<ResizeHandle | null>(null);
  const resizeStart = useRef<{ frame: Frame; point: Point } | null>(null);
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

  const startCreate = useCallback((canvasPoint: Point) => {
    setIsCreating(true);
    createStart.current = canvasPoint;
    const id = `frame-${Date.now()}`;
    setFrames((prev) => [
      ...prev,
      {
        id,
        x: canvasPoint.x,
        y: canvasPoint.y,
        width: 0,
        height: 0,
        fill: "#ffffff",
      },
    ]);
    setSelectedIds([id]);
  }, []);

  const updateCreate = useCallback(
    (canvasPoint: Point) => {
      const creatingId = selectedIds[0];
      if (!isCreating || !createStart.current || !creatingId) return;
      const start = createStart.current;

      let x = Math.min(start.x, canvasPoint.x);
      let y = Math.min(start.y, canvasPoint.y);
      let width = Math.abs(canvasPoint.x - start.x);
      let height = Math.abs(canvasPoint.y - start.y);

      const otherFrames = frames.filter((f) => f.id !== creatingId);
      const snapped = calculateSnapping(
        { x, y, width, height },
        otherFrames,
        "create"
      );

      setGuides(snapped.guides);
      setFrames((prev) =>
        prev.map((f) =>
          f.id === creatingId
            ? {
                ...f,
                x: snapped.x,
                y: snapped.y,
                width: snapped.width,
                height: snapped.height,
              }
            : f
        )
      );
    },
    [isCreating, selectedIds, frames]
  );

  const endCreate = useCallback(() => {
    const creatingId = selectedIds[0];
    if (!creatingId) return;
    setFrames((prev) => {
      const frame = prev.find((f) => f.id === creatingId);
      if (frame && frame.width < 10 && frame.height < 10) {
        setSelectedIds([]);
        return prev.filter((f) => f.id !== creatingId);
      }
      return prev;
    });
    setIsCreating(false);
    setGuides([]);
    createStart.current = null;
    setTool("select");
  }, [selectedIds]);

  // Compute bounding box of selected frames
  const getSelectionBounds = useCallback(
    (framesList: Frame[], ids: string[]) => {
      const selected = framesList.filter((f) => ids.includes(f.id));
      if (selected.length === 0) return null;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const f of selected) {
        minX = Math.min(minX, f.x);
        minY = Math.min(minY, f.y);
        maxX = Math.max(maxX, f.x + f.width);
        maxY = Math.max(maxY, f.y + f.height);
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    },
    []
  );

  // Store initial selection bounds for dragging
  const dragBoundsStart = useRef<{ x: number; y: number } | null>(null);

  const startDrag = useCallback(
    (frameId: string, canvasPoint: Point, addToSelection = false) => {
      const frame = frames.find((f) => f.id === frameId);
      if (!frame) return;

      // If clicking a selected frame, drag all selected
      // If clicking an unselected frame, select it (or add to selection with shift)
      let newSelectedIds: string[];
      if (selectedIds.includes(frameId)) {
        newSelectedIds = selectedIds;
      } else if (addToSelection) {
        newSelectedIds = [...selectedIds, frameId];
      } else {
        newSelectedIds = [frameId];
      }

      setSelectedIds(newSelectedIds);
      setIsDragging(true);
      dragStart.current = canvasPoint;

      // Store starting positions for all selected frames
      const selectedFramesList = frames.filter((f) =>
        newSelectedIds.includes(f.id)
      );
      dragFramesStart.current = selectedFramesList.map((f) => ({
        id: f.id,
        x: f.x,
        y: f.y,
      }));

      // Store initial bounding box position
      const bounds = getSelectionBounds(frames, newSelectedIds);
      dragBoundsStart.current = bounds ? { x: bounds.x, y: bounds.y } : null;
    },
    [frames, selectedIds, getSelectionBounds]
  );

  const updateDrag = useCallback(
    (canvasPoint: Point) => {
      if (
        !isDragging ||
        !dragStart.current ||
        dragFramesStart.current.length === 0 ||
        !dragBoundsStart.current
      )
        return;

      const dx = canvasPoint.x - dragStart.current.x;
      const dy = canvasPoint.y - dragStart.current.y;

      // Compute current bounding box dimensions from starting frames
      const startingFrames = dragFramesStart.current;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const sf of startingFrames) {
        const frame = frames.find((f) => f.id === sf.id);
        if (!frame) continue;
        minX = Math.min(minX, sf.x);
        minY = Math.min(minY, sf.y);
        maxX = Math.max(maxX, sf.x + frame.width);
        maxY = Math.max(maxY, sf.y + frame.height);
      }
      const boundsWidth = maxX - minX;
      const boundsHeight = maxY - minY;

      // New bounding box position
      const newBoundsX = dragBoundsStart.current.x + dx;
      const newBoundsY = dragBoundsStart.current.y + dy;

      const otherFrames = frames.filter((f) => !selectedIds.includes(f.id));
      const snapped = calculateSnapping(
        {
          x: newBoundsX,
          y: newBoundsY,
          width: boundsWidth,
          height: boundsHeight,
        },
        otherFrames,
        "move"
      );

      // Calculate the snap delta
      const snapDx = snapped.x - newBoundsX;
      const snapDy = snapped.y - newBoundsY;

      setGuides(snapped.guides);
      setFrames((prev) =>
        prev.map((f) => {
          const startPos = dragFramesStart.current.find((s) => s.id === f.id);
          if (!startPos) return f;
          return {
            ...f,
            x: startPos.x + dx + snapDx,
            y: startPos.y + dy + snapDy,
          };
        })
      );
    },
    [isDragging, selectedIds, frames]
  );

  const endDrag = useCallback(() => {
    setIsDragging(false);
    setGuides([]);
    dragStart.current = null;
    dragFramesStart.current = [];
    dragBoundsStart.current = null;
  }, []);

  // Store resize starting state
  const resizeBoundsStart = useRef<{
    bounds: { x: number; y: number; width: number; height: number };
    frames: Frame[];
  } | null>(null);

  const startResize = useCallback(
    (handle: ResizeHandle, canvasPoint: Point) => {
      const bounds = getSelectionBounds(frames, selectedIds);
      if (!bounds) return;
      
      setIsResizing(true);
      resizeHandle.current = handle;
      resizeStart.current = { 
        frame: { id: '', x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, fill: '' }, 
        point: canvasPoint 
      };
      resizeBoundsStart.current = {
        bounds: { ...bounds },
        frames: frames.filter((f) => selectedIds.includes(f.id)).map((f) => ({ ...f })),
      };
    },
    [frames, selectedIds, getSelectionBounds]
  );

  const updateResize = useCallback(
    (canvasPoint: Point) => {
      if (!isResizing || !resizeStart.current || !resizeBoundsStart.current) return;
      const { point: start } = resizeStart.current;
      const { bounds: origBounds, frames: origFrames } = resizeBoundsStart.current;
      const handle = resizeHandle.current!;
      const dx = canvasPoint.x - start.x;
      const dy = canvasPoint.y - start.y;

      let { x, y, width, height } = origBounds;

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

      if (width < 1) {
        width = 1;
        if (handle.includes("w")) x = origBounds.x + origBounds.width - 1;
      }
      if (height < 1) {
        height = 1;
        if (handle.includes("n")) y = origBounds.y + origBounds.height - 1;
      }

      const otherFrames = frames.filter((f) => !selectedIds.includes(f.id));
      const snapped = calculateSnapping(
        { x, y, width, height },
        otherFrames,
        "resize",
        handle
      );

      // Calculate scale factors
      const scaleX = origBounds.width > 0 ? snapped.width / origBounds.width : 1;
      const scaleY = origBounds.height > 0 ? snapped.height / origBounds.height : 1;

      setGuides(snapped.guides);
      setFrames((prev) =>
        prev.map((f) => {
          const origFrame = origFrames.find((of) => of.id === f.id);
          if (!origFrame) return f;
          
          // Scale position and size relative to bounds origin
          const relX = origFrame.x - origBounds.x;
          const relY = origFrame.y - origBounds.y;
          
          return {
            ...f,
            x: snapped.x + relX * scaleX,
            y: snapped.y + relY * scaleY,
            width: origFrame.width * scaleX,
            height: origFrame.height * scaleY,
          };
        })
      );
    },
    [isResizing, selectedIds, frames]
  );

  const endResize = useCallback(() => {
    setIsResizing(false);
    setGuides([]);
    resizeHandle.current = null;
    resizeStart.current = null;
    resizeBoundsStart.current = null;
  }, []);

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
    },
    [isMarqueeSelecting]
  );

  const endMarquee = useCallback(() => {
    if (marqueeRect && marqueeRect.width > 5 && marqueeRect.height > 5) {
      // Find frames that intersect with marquee
      const intersecting = frames.filter((f) => {
        return !(
          f.x + f.width < marqueeRect.x ||
          f.x > marqueeRect.x + marqueeRect.width ||
          f.y + f.height < marqueeRect.y ||
          f.y > marqueeRect.y + marqueeRect.height
        );
      });
      setSelectedIds(intersecting.map((f) => f.id));
    }
    setIsMarqueeSelecting(false);
    setMarqueeRect(null);
    marqueeStart.current = null;
  }, [marqueeRect, frames]);

  // Clipboard for copy/paste
  const clipboard = useRef<Frame[]>([]);

  const copySelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    clipboard.current = frames
      .filter((f) => selectedIds.includes(f.id))
      .map((f) => ({ ...f }));
  }, [selectedIds, frames]);

  const pasteClipboard = useCallback(() => {
    if (clipboard.current.length === 0) return;
    const newFrames: Frame[] = clipboard.current.map((f) => ({
      ...f,
      id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: f.x + 20,
      y: f.y + 20,
    }));
    setFrames((prev) => [...prev, ...newFrames]);
    setSelectedIds(newFrames.map((f) => f.id));
  }, []);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const newFrames: Frame[] = frames
      .filter((f) => selectedIds.includes(f.id))
      .map((f) => ({
        ...f,
        id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: f.x + 20,
        y: f.y + 20,
      }));
    setFrames((prev) => [...prev, ...newFrames]);
    setSelectedIds(newFrames.map((f) => f.id));
  }, [selectedIds, frames]);

  // Alt+drag to duplicate
  const startDuplicateDrag = useCallback(
    (frameId: string, canvasPoint: Point) => {
      // Duplicate all selected frames if the clicked one is selected, otherwise just the clicked one
      const toDuplicate = selectedIds.includes(frameId)
        ? selectedIds
        : [frameId];
      const framesToDupe = frames.filter((f) => toDuplicate.includes(f.id));

      const newFrames: Frame[] = framesToDupe.map((f) => ({
        ...f,
        id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      setFrames((prev) => [...prev, ...newFrames]);
      setSelectedIds(newFrames.map((f) => f.id));

      // Start dragging the new frames
      setIsDragging(true);
      dragStart.current = canvasPoint;
      dragFramesStart.current = newFrames.map((f) => ({
        id: f.id,
        x: f.x,
        y: f.y,
      }));

      // Set initial bounds for snapping
      const bounds = getSelectionBounds(newFrames, newFrames.map((f) => f.id));
      dragBoundsStart.current = bounds ? { x: bounds.x, y: bounds.y } : null;
    },
    [frames, selectedIds, getSelectionBounds]
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    setFrames((prev) => prev.filter((f) => !selectedIds.includes(f.id)));
    setSelectedIds([]);
  }, [selectedIds]);

  const selectedFrames = frames.filter((f) => selectedIds.includes(f.id));
  const selectionBounds = getSelectionBounds(frames, selectedIds);

  return {
    transform,
    frames,
    selectedIds,
    selectedFrames,
    selectionBounds,
    tool,
    isCreating,
    isDragging,
    isResizing,
    isPanning,
    isMarqueeSelecting,
    marqueeRect,
    guides,
    setTool,
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
  };
}

