import { useCallback, useRef, useState } from "react";
import type { CanvasObject, Point } from "../types";
import { getSelectionBounds } from "../objectUtils";
import { angleBetweenPoints, normalizeAngle } from "../geometry";
import { useHistoryCapture } from "./useHistoryCapture";

interface RotationActions {
  setObjects: (updater: (prev: CanvasObject[]) => CanvasObject[]) => void;
  pushHistory: () => void;
}

interface RotationConfig {
  objects: CanvasObject[];
  selectedIds: string[];
}

export function useRotation(config: RotationConfig, actions: RotationActions) {
  const { objects, selectedIds } = config;
  const { setObjects, pushHistory } = actions;

  const history = useHistoryCapture(pushHistory);

  const [isRotating, setIsRotating] = useState(false);

  const rotationStart = useRef<{
    startAngle: number;
    objectRotations: Map<string, number>;
    center: Point;
  } | null>(null);

  const startRotation = useCallback(
    (canvasPoint: Point) => {
      const bounds = getSelectionBounds(objects, selectedIds);
      if (!bounds) return;

      const center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };

      const startAngle = angleBetweenPoints(center, canvasPoint);

      const objectRotations = new Map<string, number>();
      for (const id of selectedIds) {
        const obj = objects.find((o) => o.id === id);
        if (obj) {
          objectRotations.set(id, obj.rotation);
        }
      }

      rotationStart.current = {
        startAngle,
        objectRotations,
        center,
      };

      setIsRotating(true);
      history.reset();
    },
    [objects, selectedIds, history]
  );

  const updateRotation = useCallback(
    (canvasPoint: Point, shiftKey = false) => {
      if (!isRotating || !rotationStart.current) return;

      const { startAngle, objectRotations, center } = rotationStart.current;

      const currentAngle = angleBetweenPoints(center, canvasPoint);
      let deltaAngle = currentAngle - startAngle;

      history.captureOnce();

      setObjects((prev) =>
        prev.map((o) => {
          const originalRotation = objectRotations.get(o.id);
          if (originalRotation === undefined) return o;

          let newRotation = originalRotation + deltaAngle;
          newRotation = normalizeAngle(newRotation);

          if (shiftKey) {
            newRotation = Math.round(newRotation / 15) * 15;
          }

          return { ...o, rotation: newRotation };
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
