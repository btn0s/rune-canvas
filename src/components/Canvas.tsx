import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCanvas } from "../lib/useCanvas";
import {
  useKeyboardShortcuts,
  type Shortcut,
} from "../lib/useKeyboardShortcuts";
import type {
  ResizeHandle,
  Tool,
  CanvasObject,
  FrameObject,
  ImageObject,
  TextObject,
} from "../lib/types";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { LayersPanel } from "./LayersPanel";
import { PropertyPanel } from "./PropertyPanel";

const HANDLE_SIZE = 8;
const EDGE_HIT_WIDTH = 6; // Pixels from edge to trigger edge resize
const CORNER_HANDLES: ResizeHandle[] = ["nw", "ne", "se", "sw"];

const TOOLS: {
  id: Tool;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "select",
    label: "Select",
    shortcut: "V",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5">
        <path
          d="m5.0581,3.5724l10.6813,3.903c1.0363.3787,1.0063,1.8545-.0445,2.1908l-4.5677,1.4617-1.4616,4.5674c-.3363,1.0509-1.8123,1.0808-2.1908.0444L3.5728,5.0575c-.338-.9253.5601-1.8232,1.4853-1.4851Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: "hand",
    label: "Hand",
    shortcut: "H",
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        stroke="currentColor"
        className="size-5"
      >
        <line
          x1="16"
          y1="5"
          x2="16"
          y2="11"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <line
          x1="13"
          y1="4"
          x2="13"
          y2="12"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <line
          x1="10"
          y1="3"
          x2="10"
          y2="13"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <line
          x1="7"
          y1="4"
          x2="7"
          y2="12"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <line
          x1="7.384"
          y1="15.082"
          x2="3.5"
          y2="10"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        <path
          d="m7,10.5v1.5l-.793,1.43c.615,2.065,2.528,3.57,4.793,3.57,2.761,0,5-2.239,5-5v-1.5H7Z"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: "frame",
    label: "Frame",
    shortcut: "F",
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        className="size-5"
      >
        <path
          d="m7,16h-3c-.5523,0-1-.4477-1-1V5c0-.5523.4477-1,1-1h3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="m13,16h3c.5523,0,1-.4477,1-1V5c0-.5523-.4477-1-1-1h-3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: "rectangle",
    label: "Rectangle",
    shortcut: "R",
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        className="size-5"
      >
        <rect
          x="3"
          y="3"
          width="14"
          height="14"
          rx="3"
          ry="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    shortcut: "T",
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        className="size-5"
      >
        <line
          x1="16"
          y1="4"
          x2="4"
          y2="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <line
          x1="10"
          y1="16"
          x2="10"
          y2="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    id: "shader",
    label: "Shader",
    shortcut: "S",
    icon: (
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        stroke="currentColor"
        className="size-5"
      >
        <polygon
          points="6.5 10 7.3077 12.6923 10 13.5 7.3077 14.3077 6.5 17 5.6923 14.3077 3 13.5 5.6923 12.6923 6.5 10"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <polygon
          points="13.5 3 14.3077 5.6923 17 6.5 14.3077 7.3077 13.5 10 12.6923 7.3077 10 6.5 12.6923 5.6923 13.5 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="m6.6526,3.978l-1.2005-.4533-.4506-1.2087c-.1563-.4214-.8468-.4214-1.0031,0l-.4506,1.2087-1.2005.4533c-.2086.079-.3474.2802-.3474.505s.1388.4259.3474.505l1.2005.4533.4506,1.2087c.0781.2107.2783.3501.5015.3501s.4234-.1394.5015-.3501l.4506-1.2087,1.2005-.4533c.2086-.079.3474-.2802.3474-.505s-.1388-.4259-.3474-.505Z"
          strokeWidth="0"
        />
        <path
          d="m17.6526,14.978l-1.2005-.4533-.4506-1.2087c-.1563-.4214-.8468-.4214-1.0031,0l-.4506,1.2087-1.2005.4533c-.2086.079-.3474.2802-.3474.505s.1388.4259.3474.505l1.2005.4533.4506,1.2087c.0781.2107.2783.3501.5015.3501s.4234-.1394.5015-.3501l.4506-1.2087,1.2005-.4533c.2086-.079.3474-.2802.3474-.505s-.1388-.4259-.3474-.505Z"
          strokeWidth="0"
        />
      </svg>
    ),
  },
];

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
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
    updateTextContent,
    updateObject,
  } = useCanvas();

  // Space key held for temporary pan
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Debug mode for hitbox visualization
  const [debugMode, setDebugMode] = useState(false);

  // Hovered resize handle for cursor
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle | null>(null);

  // Focus text element when editing starts
  useEffect(() => {
    if (editingTextId) {
      // Small delay to ensure the element is rendered with contentEditable
      requestAnimationFrame(() => {
        const el = document.querySelector(
          `[data-text-id="${editingTextId}"]`
        ) as HTMLElement;
        if (el) {
          el.focus();
        }
      });
    }
  }, [editingTextId]);

  // Sync positions and sizes from DOM for flex children and fit/expand frames
  // Also re-sync when drag ends (hasDragMovement goes false) to update flex child positions
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    // Skip sync during active drag movement - we're controlling position directly
    if (hasDragMovement) return;

    objects.forEach((obj) => {
      const el = containerRef.current?.querySelector(
        `[data-object-id="${obj.id}"]`
      ) as HTMLElement;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const updates: Partial<CanvasObject> = {};

      // Sync size for frames with fit/expand mode
      if (obj.type === "frame") {
        const frame = obj as FrameObject;
        if (frame.widthMode !== "fixed") {
          const domWidth = rect.width / transform.scale;
          if (Math.abs(obj.width - domWidth) > 1) {
            updates.width = domWidth;
          }
        }
        if (frame.heightMode !== "fixed") {
          const domHeight = rect.height / transform.scale;
          if (Math.abs(obj.height - domHeight) > 1) {
            updates.height = domHeight;
          }
        }
      }

      // Sync position for objects inside flex/grid containers
      if (obj.parentId) {
        const parent = objects.find((o) => o.id === obj.parentId);
        if (
          parent?.type === "frame" &&
          (parent as FrameObject).layoutMode !== "none"
        ) {
          const parentEl = containerRef.current?.querySelector(
            `[data-object-id="${parent.id}"]`
          ) as HTMLElement;
          if (parentEl) {
            const parentRect = parentEl.getBoundingClientRect();
            const relX = (rect.left - parentRect.left) / transform.scale;
            const relY = (rect.top - parentRect.top) / transform.scale;

            if (Math.abs(obj.x - relX) > 1) updates.x = relX;
            if (Math.abs(obj.y - relY) > 1) updates.y = relY;
          }
        }
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        updateObject(obj.id, updates);
      }
    });
  }, [objects, transform.scale, updateObject, hasDragMovement]);

  // Draw interaction layer
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = container.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Helper functions for guide drawing
    const toScreenX = (canvasX: number) =>
      canvasX * transform.scale + transform.x;
    const toScreenY = (canvasY: number) =>
      canvasY * transform.scale + transform.y;

    const drawLine = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      dashed = false
    ) => {
      ctx.setLineDash(dashed ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const drawXMark = (cx: number, cy: number, size = 3) => {
      ctx.beginPath();
      ctx.moveTo(cx - size, cy - size);
      ctx.lineTo(cx + size, cy + size);
      ctx.moveTo(cx + size, cy - size);
      ctx.lineTo(cx - size, cy + size);
      ctx.stroke();
    };

    const drawPill = (cx: number, cy: number, label: string) => {
      const textWidth = ctx.measureText(label).width;
      const pillWidth = textWidth + 12;
      const pillHeight = 18;
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.roundRect(
        cx - pillWidth / 2,
        cy - pillHeight / 2,
        pillWidth,
        pillHeight,
        4
      );
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, cx - textWidth / 2, cy + 4);
      ctx.fillStyle = "#f43f5e";
    };

    // Draw alignment guides
    if (guides.length > 0) {
      ctx.font = "11px system-ui";
      ctx.strokeStyle = "#f43f5e";
      ctx.fillStyle = "#f43f5e";
      ctx.lineWidth = 1;

      for (const guide of guides) {
        if (guide.type === "vertical" && guide.position !== undefined) {
          const screenX = toScreenX(guide.position);
          const startY =
            guide.startBound !== undefined ? toScreenY(guide.startBound) : 0;
          const endY =
            guide.endBound !== undefined ? toScreenY(guide.endBound) : height;
          drawLine(screenX, startY, screenX, endY);
        } else if (
          guide.type === "horizontal" &&
          guide.position !== undefined
        ) {
          const screenY = toScreenY(guide.position);
          const startX =
            guide.startBound !== undefined ? toScreenX(guide.startBound) : 0;
          const endX =
            guide.endBound !== undefined ? toScreenX(guide.endBound) : width;
          drawLine(startX, screenY, endX, screenY);
        } else if (
          guide.type === "gap" &&
          guide.distance !== undefined &&
          guide.gapStart !== undefined &&
          guide.gapEnd !== undefined
        ) {
          ctx.setLineDash([]);

          if (
            guide.orientation === "vertical" &&
            guide.gapTopY !== undefined &&
            guide.gapBottomY !== undefined
          ) {
            const startX = toScreenX(guide.gapStart);
            const endX = toScreenX(guide.gapEnd);
            const topY = toScreenY(guide.gapTopY);
            const bottomY = toScreenY(guide.gapBottomY);
            const midX = (startX + endX) / 2;
            const midY = (topY + bottomY) / 2;

            // X marks at all 4 corners
            drawXMark(startX, topY);
            drawXMark(endX, topY);
            drawXMark(startX, bottomY);
            drawXMark(endX, bottomY);

            // Center line and pill
            drawLine(startX, midY, endX, midY);
            drawPill(midX, midY, `${guide.distance}`);
          } else if (
            guide.orientation === "horizontal" &&
            guide.gapLeftX !== undefined &&
            guide.gapRightX !== undefined
          ) {
            const startY = toScreenY(guide.gapStart);
            const endY = toScreenY(guide.gapEnd);
            const leftX = toScreenX(guide.gapLeftX);
            const rightX = toScreenX(guide.gapRightX);
            const midX = (leftX + rightX) / 2;
            const midY = (startY + endY) / 2;

            // X marks at all 4 corners
            drawXMark(leftX, startY);
            drawXMark(rightX, startY);
            drawXMark(leftX, endY);
            drawXMark(rightX, endY);

            // Center line and pill
            drawLine(midX, startY, midX, endY);
            drawPill(midX, midY, `${guide.distance}`);
          }
        }
      }
      ctx.setLineDash([]);
    }

    // Draw selection: outline, handles, dimensions
    if (selectionBounds) {
      const x = selectionBounds.x * transform.scale + transform.x;
      const y = selectionBounds.y * transform.scale + transform.y;
      const w = selectionBounds.width * transform.scale;
      const h = selectionBounds.height * transform.scale;

      // 1. Blue outline
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);

      // 2. Resize handles (corners only)
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#3b82f6";
      const hs = HANDLE_SIZE;

      const cornerPositions: [number, number][] = [
        [x - hs / 2, y - hs / 2], // nw
        [x + w - hs / 2, y - hs / 2], // ne
        [x + w - hs / 2, y + h - hs / 2], // se
        [x - hs / 2, y + h - hs / 2], // sw
      ];

      cornerPositions.forEach(([hx, hy]) => {
        ctx.fillRect(hx, hy, hs, hs);
        ctx.strokeRect(hx, hy, hs, hs);
      });

      // 3. Dimension badge
      const dimLabel = `${Math.round(selectionBounds.width)} × ${Math.round(
        selectionBounds.height
      )}`;
      ctx.font = "11px system-ui";
      const dimTextWidth = ctx.measureText(dimLabel).width;
      const dimPillWidth = dimTextWidth + 12;
      const dimPillHeight = 18;
      const dimPillX = x + w / 2 - dimPillWidth / 2;
      const dimPillY = y + h + 8;

      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.roundRect(dimPillX, dimPillY, dimPillWidth, dimPillHeight, 4);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.fillText(dimLabel, x + w / 2 - dimTextWidth / 2, dimPillY + 13);
    }

    // Draw marquee selection rectangle
    if (marqueeRect && isMarqueeSelecting) {
      const mx = marqueeRect.x * transform.scale + transform.x;
      const my = marqueeRect.y * transform.scale + transform.y;
      const mw = marqueeRect.width * transform.scale;
      const mh = marqueeRect.height * transform.scale;

      ctx.strokeStyle = "#3b82f6";
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.lineWidth = 1;
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeRect(mx, my, mw, mh);
    }

    // Debug mode visualizations
    if (debugMode && selectionBounds) {
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
      ctx.fillRect(10, 10, 180, 40);
      ctx.fillStyle = "#fff";
      ctx.fillText(
        `Bounds: ${Math.round(selectionBounds.x)},${Math.round(
          selectionBounds.y
        )}`,
        15,
        25
      );
      ctx.fillText(`Selected: ${selectedIds.length} objects`, 15, 45);
    }
  }, [
    transform,
    selectionBounds,
    guides,
    marqueeRect,
    isMarqueeSelecting,
    debugMode,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      handleWheel(e, container.getBoundingClientRect());
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [handleWheel]);

  // Hit test resize handles and edges on selection bounds
  const hitTestHandle = useCallback(
    (screenX: number, screenY: number): ResizeHandle | null => {
      if (!selectionBounds) return null;
      const x = selectionBounds.x * transform.scale + transform.x;
      const y = selectionBounds.y * transform.scale + transform.y;
      const w = selectionBounds.width * transform.scale;
      const h = selectionBounds.height * transform.scale;
      const hs = HANDLE_SIZE;

      // Test corner handles first
      const cornerPositions: Record<string, [number, number]> = {
        nw: [x - hs / 2, y - hs / 2],
        ne: [x + w - hs / 2, y - hs / 2],
        se: [x + w - hs / 2, y + h - hs / 2],
        sw: [x - hs / 2, y + h - hs / 2],
      };

      for (const handle of CORNER_HANDLES) {
        const [hx, hy] = cornerPositions[handle];
        if (
          screenX >= hx &&
          screenX <= hx + hs &&
          screenY >= hy &&
          screenY <= hy + hs
        ) {
          return handle;
        }
      }

      // Test edges (selection border)
      const edgeHit = EDGE_HIT_WIDTH;

      // North edge
      if (
        screenX >= x + hs &&
        screenX <= x + w - hs &&
        screenY >= y - edgeHit &&
        screenY <= y + edgeHit
      ) {
        return "n";
      }
      // South edge
      if (
        screenX >= x + hs &&
        screenX <= x + w - hs &&
        screenY >= y + h - edgeHit &&
        screenY <= y + h + edgeHit
      ) {
        return "s";
      }
      // West edge
      if (
        screenX >= x - edgeHit &&
        screenX <= x + edgeHit &&
        screenY >= y + hs &&
        screenY <= y + h - hs
      ) {
        return "w";
      }
      // East edge
      if (
        screenX >= x + w - edgeHit &&
        screenX <= x + w + edgeHit &&
        screenY >= y + hs &&
        screenY <= y + h - hs
      ) {
        return "e";
      }

      return null;
    },
    [selectionBounds, transform]
  );

  // Helper to get canvas position (accounting for parent)
  const getCanvasPosition = useCallback(
    (obj: CanvasObject): { x: number; y: number } => {
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
    },
    [objects]
  );

  // Hit test objects (canvas space) - includes label area for root objects
  const hitTestObject = useCallback(
    (canvasX: number, canvasY: number): string | null => {
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        const canvasPos = getCanvasPosition(obj);

        // Check object bounds
        const inObject =
          canvasX >= canvasPos.x &&
          canvasX <= canvasPos.x + obj.width &&
          canvasY >= canvasPos.y &&
          canvasY <= canvasPos.y + obj.height;

        // Check label bounds (only for root objects - those without a parent)
        // Label is above the object with margin. Use generous bounds.
        const labelHeight = 16; // canvas units - generous estimate
        const labelMargin = 6; // canvas units
        const labelWidth = Math.max(obj.width, obj.name.length * 8); // canvas units
        const inLabel =
          !obj.parentId &&
          canvasX >= canvasPos.x &&
          canvasX <= canvasPos.x + labelWidth &&
          canvasY >= canvasPos.y - labelMargin - labelHeight &&
          canvasY <= canvasPos.y;

        if (inObject || inLabel) {
          return obj.id;
        }
      }
      return null;
    },
    [objects, getCanvasPosition]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPoint = screenToCanvas(screenX, screenY);

    // Middle click, hand tool, or space held to pan
    if (e.button === 1 || (e.button === 0 && (tool === "hand" || spaceHeld))) {
      startPan({ x: e.clientX, y: e.clientY });
      return;
    }

    if (tool === "select") {
      // Check resize handles first (only for single selection)
      const handle = hitTestHandle(screenX, screenY);
      if (handle) {
        setHoveredHandle(handle);
        startResize(handle, canvasPoint);
        return;
      }

      // Check object hit
      const objectId = hitTestObject(canvasPoint.x, canvasPoint.y);
      if (objectId) {
        // Double-click on text object = edit
        if (e.detail === 2) {
          const obj = objects.find((o) => o.id === objectId);
          if (obj && obj.type === "text") {
            setEditingTextId(objectId);
            return;
          }
        }
        // Alt+click on object = duplicate and drag
        if (e.altKey) {
          startDuplicateDrag(objectId, canvasPoint);
        } else {
          // Shift+click to add/remove from selection
          startDrag(objectId, canvasPoint, e.shiftKey);
        }
      } else {
        // Clicked on empty space - start marquee selection or clear selection
        if (!e.shiftKey) {
          select(null);
        }
        startMarquee(canvasPoint);
      }
    } else if (tool === "frame" || tool === "rectangle" || tool === "text") {
      startCreate(canvasPoint);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPoint = screenToCanvas(screenX, screenY);

    if (isPanning) {
      updatePan({ x: e.clientX, y: e.clientY });
    } else if (isCreating) {
      updateCreate(canvasPoint);
    } else if (isDragging) {
      updateDrag(canvasPoint, e.shiftKey);
    } else if (isResizing) {
      updateResize(canvasPoint, e.shiftKey, e.altKey);
    } else if (isMarqueeSelecting) {
      updateMarquee(canvasPoint);
    } else if (tool === "select") {
      // Check for handle hover when idle
      setHoveredHandle(hitTestHandle(screenX, screenY));
    } else {
      setHoveredHandle(null);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) endPan();
    if (isCreating) endCreate();
    if (isDragging) endDrag();
    if (isResizing) {
      endResize();
      setHoveredHandle(null);
    }
    if (isMarqueeSelecting) endMarquee();
  };

  // Toggle flex layout on selected frames
  const toggleFlex = useCallback(() => {
    selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        const frame = obj as FrameObject;
        const newMode = frame.layoutMode === "flex" ? "none" : "flex";
        updateObject(obj.id, { layoutMode: newMode } as Partial<FrameObject>);
      }
    });
  }, [selectedObjects, updateObject]);

  // Keyboard shortcuts (declarative)
  const shortcuts: Shortcut[] = useMemo(
    () => [
      // === Tools ===
      { key: "v", action: () => setTool("select") },
      { key: "Escape", action: () => setTool("select") },
      { key: "h", action: () => setTool("hand") },
      { key: "f", action: () => setTool("frame") },
      { key: "r", action: () => setTool("rectangle") },
      { key: "t", action: () => setTool("text") },

      // === Editing (Cmd/Ctrl) ===
      { key: "c", modifiers: { meta: true }, action: copySelected },
      { key: "v", modifiers: { meta: true }, action: pasteClipboard },
      { key: "d", modifiers: { meta: true }, action: duplicateSelected },
      {
        key: "a",
        modifiers: { meta: true },
        action: selectAllSiblings,
        stopPropagation: true,
      },
      { key: "Backspace", action: deleteSelected },
      { key: "Delete", action: deleteSelected },

      // === Alignment (Alt+WASD/HV) - use code for macOS compatibility ===
      { code: "KeyW", modifiers: { alt: true }, action: alignTop },
      { code: "KeyA", modifiers: { alt: true }, action: alignLeft },
      { code: "KeyS", modifiers: { alt: true }, action: alignBottom },
      { code: "KeyD", modifiers: { alt: true }, action: alignRight },
      { code: "KeyH", modifiers: { alt: true }, action: alignCenterH },
      { code: "KeyV", modifiers: { alt: true }, action: alignCenterV },

      // === Layout ===
      { code: "KeyA", modifiers: { shift: true }, action: toggleFlex },

      // === Movement (Arrow keys) ===
      { key: "ArrowUp", action: () => moveSelected(0, -1) },
      { key: "ArrowDown", action: () => moveSelected(0, 1) },
      { key: "ArrowLeft", action: () => moveSelected(-1, 0) },
      { key: "ArrowRight", action: () => moveSelected(1, 0) },
      {
        key: "ArrowUp",
        modifiers: { shift: true },
        action: () => moveSelected(0, -10),
      },
      {
        key: "ArrowDown",
        modifiers: { shift: true },
        action: () => moveSelected(0, 10),
      },
      {
        key: "ArrowLeft",
        modifiers: { shift: true },
        action: () => moveSelected(-10, 0),
      },
      {
        key: "ArrowRight",
        modifiers: { shift: true },
        action: () => moveSelected(10, 0),
      },
    ],
    [
      setTool,
      copySelected,
      pasteClipboard,
      duplicateSelected,
      selectAllSiblings,
      deleteSelected,
      alignTop,
      alignLeft,
      alignBottom,
      alignRight,
      alignCenterH,
      alignCenterV,
      toggleFlex,
      moveSelected,
    ]
  );

  useKeyboardShortcuts(shortcuts, {
    enabled: !editingTextId,
    onKeyDown: (e) => {
      // Special case: space for temporary pan (needs repeat check)
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    },
    onKeyUp: (e) => {
      if (e.key === " ") {
        setSpaceHeld(false);
      }
    },
  });

  // Image drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

      if (imageFiles.length > 0) {
        const rect = containerRef.current!.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const canvasPoint = screenToCanvas(screenX, screenY);

        imageFiles.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const src = event.target?.result as string;
            const img = new Image();
            img.onload = () => {
              console.log(
                "Adding image:",
                img.naturalWidth,
                img.naturalHeight,
                canvasPoint
              );
              addImage(src, img.naturalWidth, img.naturalHeight, canvasPoint);
            };
            img.onerror = () => {
              console.error("Failed to load dropped image");
            };
            img.src = src;
          };
          reader.onerror = () => {
            console.error("Failed to read file");
          };
          reader.readAsDataURL(file);
        });
      }
    },
    [screenToCanvas, addImage]
  );

  // Get cursor for resize handle
  const getHandleCursor = (handle: ResizeHandle | null): string => {
    if (!handle) return "default";
    switch (handle) {
      case "nw":
      case "se":
        return "nwse-resize";
      case "ne":
      case "sw":
        return "nesw-resize";
      case "n":
      case "s":
        return "ns-resize";
      case "e":
      case "w":
        return "ew-resize";
      default:
        return "default";
    }
  };

  const cursor = isPanning
    ? "grabbing"
    : isResizing
    ? getHandleCursor(hoveredHandle)
    : tool === "hand" || spaceHeld
    ? "grab"
    : tool === "frame" || tool === "rectangle" || tool === "text"
    ? "crosshair"
    : hoveredHandle
    ? getHandleCursor(hoveredHandle)
    : "default";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden bg-background"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ cursor }}
      >
        {/* DOM layer - objects */}
        <div
          className="absolute top-0 left-0 origin-top-left pointer-events-none"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          {(() => {
            // Render an object (always recursive - children render inside parent)
            const renderObject = (obj: CanvasObject): React.ReactNode => {
              const isSelected = selectedIds.includes(obj.id);
              const isEditing = editingTextId === obj.id;
              const isPotentialParent = potentialParentId === obj.id;
              const frame = obj.type === "frame" ? (obj as FrameObject) : null;
              const isFlexLayout = frame && frame.layoutMode !== "none";

              // Get children for this object
              const children = objects.filter((o) => o.parentId === obj.id);

              // Determine parent context for positioning
              const parent = obj.parentId
                ? objects.find((o) => o.id === obj.parentId)
                : null;
              const parentFrame =
                parent?.type === "frame" ? (parent as FrameObject) : null;
              const isFlexChild =
                parentFrame && parentFrame.layoutMode !== "none";

              // During drag (with actual movement), objects break out of flex flow
              const isBeingDragged =
                hasDragMovement && selectedIds.includes(obj.id);

              // Position style based on context:
              // - Root objects: canvas-space transform
              // - Flex children (not dragging): no explicit positioning (flex handles it)
              // - Absolute children OR dragging: position relative to parent
              const wrapperStyle: React.CSSProperties = !obj.parentId
                ? {
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: `translate(${obj.x}px, ${obj.y}px)`,
                    opacity: obj.opacity,
                  }
                : isFlexChild && !isBeingDragged
                ? {
                    opacity: obj.opacity,
                    flexShrink: 0,
                  }
                : {
                    position: "absolute",
                    left: obj.x,
                    top: obj.y,
                    opacity: obj.opacity,
                  };

              return (
                <div key={obj.id} data-object-id={obj.id} style={wrapperStyle}>
                  {/* Object label - hidden for nested objects */}
                  {!obj.parentId && (
                    <div
                      className={`absolute whitespace-nowrap pointer-events-none select-none ${
                        isSelected ? "text-blue-400" : "text-zinc-500"
                      }`}
                      style={{
                        bottom: "100%",
                        left: 0,
                        marginBottom: 4,
                        fontSize: `${Math.max(10, 11 / transform.scale)}px`,
                      }}
                    >
                      {obj.name}
                    </div>
                  )}

                  {/* Render based on object type */}
                  {obj.type === "frame" && (
                    <div
                      className={`transition-shadow duration-150 ${
                        isPotentialParent
                          ? "shadow-[inset_0_0_0_2px_#3b82f6]"
                          : ""
                      }`}
                      style={{
                        // Width/height are always stored values (calculated for fit mode)
                        width:
                          frame!.widthMode === "expand" ? undefined : obj.width,
                        height:
                          frame!.heightMode === "expand"
                            ? undefined
                            : obj.height,
                        // Flex grow for expand mode (only works inside flex parent)
                        flex:
                          frame!.widthMode === "expand" ||
                          frame!.heightMode === "expand"
                            ? "1"
                            : undefined,
                        backgroundColor: frame!.fill,
                        boxSizing: "border-box",
                        // Blend mode
                        mixBlendMode: frame!.blendMode || undefined,
                        // Border (inside - shrinks content)
                        ...(frame!.border &&
                        frame!.borderSide !== "all" &&
                        frame!.borderSide
                          ? {
                              [`border${
                                frame!.borderSide.charAt(0).toUpperCase() +
                                frame!.borderSide.slice(1)
                              }`]: `${frame!.borderWidth || 1}px ${
                                frame!.borderStyle || "solid"
                              } rgba(${parseInt(
                                frame!.border.slice(1, 3),
                                16
                              )}, ${parseInt(
                                frame!.border.slice(3, 5),
                                16
                              )}, ${parseInt(frame!.border.slice(5, 7), 16)}, ${
                                frame!.borderOpacity ?? 1
                              })`,
                            }
                          : {
                              border: frame!.border
                                ? `${frame!.borderWidth || 1}px ${
                                    frame!.borderStyle || "solid"
                                  } rgba(${parseInt(
                                    frame!.border.slice(1, 3),
                                    16
                                  )}, ${parseInt(
                                    frame!.border.slice(3, 5),
                                    16
                                  )}, ${parseInt(
                                    frame!.border.slice(5, 7),
                                    16
                                  )}, ${frame!.borderOpacity ?? 1})`
                                : undefined,
                            }),
                        // Outline (outside - purely visual)
                        outline: frame!.outline
                          ? `${frame!.outlineWidth || 1}px ${
                              frame!.outlineStyle || "solid"
                            } rgba(${parseInt(
                              frame!.outline.slice(1, 3),
                              16
                            )}, ${parseInt(
                              frame!.outline.slice(3, 5),
                              16
                            )}, ${parseInt(frame!.outline.slice(5, 7), 16)}, ${
                              frame!.outlineOpacity ?? 1
                            })`
                          : undefined,
                        outlineOffset: frame!.outlineOffset ?? 0,
                        // Border radius (individual corners or single value)
                        borderRadius:
                          frame!.radiusTL !== undefined ||
                          frame!.radiusTR !== undefined ||
                          frame!.radiusBR !== undefined ||
                          frame!.radiusBL !== undefined
                            ? `${frame!.radiusTL ?? frame!.radius}px ${
                                frame!.radiusTR ?? frame!.radius
                              }px ${frame!.radiusBR ?? frame!.radius}px ${
                                frame!.radiusBL ?? frame!.radius
                              }px`
                            : frame!.radius,
                        // Box shadow (drop shadow + inner shadow)
                        boxShadow:
                          [
                            frame!.shadow
                              ? `${frame!.shadow.x}px ${frame!.shadow.y}px ${
                                  frame!.shadow.blur
                                }px ${frame!.shadow.spread}px rgba(${parseInt(
                                  frame!.shadow.color.slice(1, 3),
                                  16
                                )}, ${parseInt(
                                  frame!.shadow.color.slice(3, 5),
                                  16
                                )}, ${parseInt(
                                  frame!.shadow.color.slice(5, 7),
                                  16
                                )}, ${frame!.shadow.opacity})`
                              : null,
                            frame!.innerShadow
                              ? `inset ${frame!.innerShadow.x}px ${
                                  frame!.innerShadow.y
                                }px ${frame!.innerShadow.blur}px ${
                                  frame!.innerShadow.spread
                                }px rgba(${parseInt(
                                  frame!.innerShadow.color.slice(1, 3),
                                  16
                                )}, ${parseInt(
                                  frame!.innerShadow.color.slice(3, 5),
                                  16
                                )}, ${parseInt(
                                  frame!.innerShadow.color.slice(5, 7),
                                  16
                                )}, ${frame!.innerShadow.opacity})`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(", ") || undefined,
                        overflow: frame!.clipContent ? "hidden" : "visible",
                        // Always relative - creates positioning context for children
                        position: "relative",
                        // Layout styles (only when flex/grid enabled)
                        display: isFlexLayout
                          ? frame!.layoutMode === "flex"
                            ? "flex"
                            : "grid"
                          : undefined,
                        flexDirection:
                          frame!.layoutMode === "flex"
                            ? frame!.flexDirection
                            : undefined,
                        justifyContent: isFlexLayout
                          ? frame!.justifyContent
                          : undefined,
                        alignItems: isFlexLayout
                          ? frame!.alignItems
                          : undefined,
                        flexWrap:
                          frame!.layoutMode === "flex"
                            ? frame!.flexWrap
                            : undefined,
                        gap: isFlexLayout ? frame!.gap : undefined,
                        padding: isFlexLayout ? frame!.padding : undefined,
                      }}
                    >
                      {/* Always render children inside frame */}
                      {children.map((child) => renderObject(child))}
                    </div>
                  )}

                  {obj.type === "image" && (
                    <img
                      src={(obj as ImageObject).src}
                      alt={obj.name}
                      draggable={false}
                      style={{
                        width: obj.width,
                        height: obj.height,
                        maxWidth: "unset",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  )}

                  {obj.type === "text" && (
                    <div
                      data-text-id={obj.id}
                      contentEditable={isEditing}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        // Use innerText to preserve newlines
                        updateTextContent(
                          obj.id,
                          e.currentTarget.innerText || ""
                        );
                        setEditingTextId(null);
                      }}
                      onKeyDown={(e) => {
                        // Stop propagation to prevent global shortcuts while editing
                        e.stopPropagation();
                        if (e.key === "Escape") {
                          e.currentTarget.blur();
                        }
                      }}
                      style={{
                        width: obj.width,
                        minHeight: obj.height,
                        color: (obj as TextObject).fill,
                        fontSize: (obj as TextObject).fontSize,
                        fontFamily: (obj as TextObject).fontFamily,
                        outline: isEditing ? "1px solid #3b82f6" : "none",
                        whiteSpace: "pre-wrap",
                        wordWrap: "break-word",
                        pointerEvents: isEditing ? "auto" : "none",
                        cursor: isEditing ? "text" : "default",
                      }}
                    >
                      {(obj as TextObject).content}
                    </div>
                  )}
                </div>
              );
            };

            // Render only root objects - children render recursively inside parents
            return objects
              .filter((obj) => obj.parentId === null)
              .map((obj) => renderObject(obj));
          })()}
        </div>

        {/* Canvas layer - selection + handles */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Toolbar */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-1 p-1.5 bg-card border border-border border-b-0 rounded-t-lg">
          {TOOLS.map((t) => (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <span>
                  <Toggle
                    size="sm"
                    pressed={tool === t.id}
                    onPressedChange={() => setTool(t.id)}
                    aria-label={t.label}
                  >
                    {t.icon}
                  </Toggle>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="flex items-center gap-2">
                <span>{t.label}</span>
                <Kbd>{t.shortcut}</Kbd>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Layers panel */}
        <LayersPanel
          items={objects
            .filter((o) => o.type === "frame")
            .map((o) => ({
              id: o.id,
              name: o.name,
              parentId: o.parentId,
            }))}
          selectedIds={selectedIds}
          transform={transform}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          onSelect={select}
          debug={debugMode}
        />

        {/* Property panel */}
        <PropertyPanel
          selectedObjects={selectedObjects}
          allObjects={objects}
          transform={transform}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          onUpdate={updateObject}
        />

        {/* Zoom indicator */}
        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-card border border-border rounded-md text-xs font-mono text-muted-foreground">
          {Math.round(transform.scale * 100)}%
        </div>

        {/* Debug toggle */}
        <button
          onClick={() => setDebugMode(!debugMode)}
          className={`absolute top-4 right-4 px-2 py-1 text-xs font-mono rounded transition-colors ${
            debugMode
              ? "bg-red-500/20 text-red-400 border border-red-500/50"
              : "bg-zinc-800/50 text-zinc-500 border border-zinc-700 hover:bg-zinc-700/50"
          }`}
        >
          {debugMode ? "Debug ON" : "Debug"}
        </button>
      </div>
    </TooltipProvider>
  );
}
