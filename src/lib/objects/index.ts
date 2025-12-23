/**
 * Objects Module
 *
 * Centralized utilities for canvas objects.
 *
 * Usage:
 * ```ts
 * import {
 *   // Types
 *   CanvasObject, FrameObject, TextObject, ImageObject,
 *   isFrame, isText, isImage,
 *
 *   // Context utilities
 *   getParent, isInLayoutContainer, getChildren,
 *
 *   // Style computation
 *   computeWrapperStyle, computeFrameStyle, computeTextStyle,
 * } from "@/lib/objects";
 * ```
 */

// Re-export everything from types
export * from "./types";

// Re-export everything from context
export * from "./context";

// Re-export everything from styles
export * from "./styles";

