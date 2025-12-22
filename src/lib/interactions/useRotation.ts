import { useCallback, useRef, useState } from "react";
import type { CanvasObject, Point } from "../types";
import { getSelectionBounds } from "../objectUtils";
import { angleBetweenPoints, normalizeAngle, rotatePoint, getCanvasPosition } from "../geometry";
import { useHistoryCapture } from "./useHistoryCapture";

interface RotationActions {
  setObjects: (updater: (prev: CanvasObject[]) => CanvasObject[]) => void;
  pushHistory: () => void;
}

interface RotationConfig {
  objects: CanvasObject[];
  selectedIds: string[];
}

interface ObjectSnapshot {
  rotation: number;
  centerX: number;
  centerY: number;
  parentId: string | null;
}

export function useRotation(config: RotationConfig, actions: RotationActions) {
  const { objects, selectedIds } = config;
  const { setObjects, pushHistory } = actions;

  const history = useHistoryCapture(pushHistory);

  const [isRotating, setIsRotating] = useState(false);

  const rotationStart = useRef<{
    startAngle: number;
    snapshots: Map<string, ObjectSnapshot>;
    groupCenter: Point;
  } | null>(null);

  const startRotation = useCallback(
    (canvasPoint: Point) => {
      const bounds = getSelectionBounds(objects, selectedIds);
      if (!bounds) return;

      const groupCenter = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };

      const startAngle = angleBetweenPoints(groupCenter, canvasPoint);

      const snapshots = new Map<string, ObjectSnapshot>();
      for (const id of selectedIds) {
        const obj = objects.find((o) => o.id === id);
        if (obj) {
          const canvasPos = getCanvasPosition(obj, objects);
          snapshots.set(id, {
            rotation: obj.rotation,
            centerX: canvasPos.x + obj.width / 2,
            centerY: canvasPos.y + obj.height / 2,
            parentId: obj.parentId,
          });
        }
      }

      rotationStart.current = {
        startAngle,
        snapshots,
        groupCenter,
      };

      setIsRotating(true);
      history.reset();
    },
    [objects, selectedIds, history]
  );

  const updateRotation = useCallback(
    (canvasPoint: Point, shiftKey = false) => {
      if (!isRotating || !rotationStart.current) return;

      const { startAngle, snapshots, groupCenter } = rotationStart.current;

      const currentAngle = angleBetweenPoints(groupCenter, canvasPoint);
      let deltaAngle = currentAngle - startAngle;

      if (shiftKey) {
        deltaAngle = Math.round(deltaAngle / 15) * 15;
      }

      history.captureOnce();

      setObjects((prev) =>
        prev.map((o) => {
          const snapshot = snapshots.get(o.id);
          if (!snapshot) return o;

          const newRotation = normalizeAngle(snapshot.rotation + deltaAngle);

          const rotatedCenter = rotatePoint(
            { x: snapshot.centerX, y: snapshot.centerY },
            groupCenter,
            deltaAngle
          );

          let newX = rotatedCenter.x - o.width / 2;
          let newY = rotatedCenter.y - o.height / 2;

          if (snapshot.parentId) {
            const parent = prev.find((p) => p.id === snapshot.parentId);
            if (parent) {
              const parentCanvasPos = getCanvasPosition(parent, prev);
              newX -= parentCanvasPos.x;
              newY -= parentCanvasPos.y;
            }
          }

          return { ...o, rotation: newRotation, x: newX, y: newY };
        })
      );
    },
    [isRotating, setObjects, history]
  );

  const endRotation = useCallback(() => {
    setIsRotating(false);
    rotationStart.current = null;
    history.reset();
  }, [history]);

  return {
    isRotating,
    startRotation,
    updateRotation,
    endRotation,
  };
}
