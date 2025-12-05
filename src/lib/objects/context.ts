/**
 * Object Context
 *
 * Utilities for understanding an object's context within the canvas.
 * These help determine how an object should be positioned and styled.
 */

import type { CanvasObject, FrameObject } from "./types";

// ============================================================================
// Parent Context
// ============================================================================

/**
 * Get an object's parent, if it exists.
 */
export function getParent(
  object: CanvasObject,
  allObjects: CanvasObject[]
): CanvasObject | null {
  if (!object.parentId) return null;
  return allObjects.find((o) => o.id === object.parentId) ?? null;
}

/**
 * Get an object's parent as a FrameObject, if the parent is a frame.
 */
export function getParentFrame(
  object: CanvasObject,
  allObjects: CanvasObject[]
): FrameObject | null {
  const parent = getParent(object, allObjects);
  if (!parent || parent.type !== "frame") return null;
  return parent as FrameObject;
}

/**
 * Check if an object is a root-level object (no parent).
 */
export function isRootObject(object: CanvasObject): boolean {
  return object.parentId === null;
}

// ============================================================================
// Layout Context
// ============================================================================

/**
 * Check if an object is inside a flex/grid container.
 * This determines whether the object should flow with layout or use absolute positioning.
 */
export function isInLayoutContainer(
  object: CanvasObject,
  allObjects: CanvasObject[]
): boolean {
  const parentFrame = getParentFrame(object, allObjects);
  if (!parentFrame) return false;
  return parentFrame.layoutMode !== "none";
}

/**
 * Get the parent's layout mode, if applicable.
 */
export function getParentLayoutMode(
  object: CanvasObject,
  allObjects: CanvasObject[]
): "none" | "flex" | "grid" | null {
  const parentFrame = getParentFrame(object, allObjects);
  if (!parentFrame) return null;
  return parentFrame.layoutMode;
}

/**
 * Check if an object is a container that can have children.
 * Currently only frames can be containers.
 */
export function isContainer(object: CanvasObject): boolean {
  return object.type === "frame";
}

/**
 * Check if a frame has layout enabled (flex or grid).
 */
export function hasLayout(frame: FrameObject): boolean {
  return frame.layoutMode !== "none";
}

// ============================================================================
// Hierarchy Utilities
// ============================================================================

/**
 * Get all children of an object.
 */
export function getChildren(
  object: CanvasObject,
  allObjects: CanvasObject[]
): CanvasObject[] {
  return allObjects.filter((o) => o.parentId === object.id);
}

/**
 * Get all descendants of an object (children, grandchildren, etc.)
 */
export function getDescendants(
  object: CanvasObject,
  allObjects: CanvasObject[]
): CanvasObject[] {
  const descendants: CanvasObject[] = [];
  const stack = getChildren(object, allObjects);

  while (stack.length > 0) {
    const child = stack.pop()!;
    descendants.push(child);
    stack.push(...getChildren(child, allObjects));
  }

  return descendants;
}

/**
 * Get all ancestors of an object (parent, grandparent, etc.)
 */
export function getAncestors(
  object: CanvasObject,
  allObjects: CanvasObject[]
): CanvasObject[] {
  const ancestors: CanvasObject[] = [];
  let current = getParent(object, allObjects);

  while (current) {
    ancestors.push(current);
    current = getParent(current, allObjects);
  }

  return ancestors;
}

/**
 * Check if an object is a descendant of another object.
 */
export function isDescendantOf(
  object: CanvasObject,
  potentialAncestor: CanvasObject,
  allObjects: CanvasObject[]
): boolean {
  return getAncestors(object, allObjects).some(
    (a) => a.id === potentialAncestor.id
  );
}
