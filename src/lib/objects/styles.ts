/**
 * Object Style Computation
 * 
 * Centralized logic for computing CSS styles for canvas objects.
 * This ensures consistent positioning and styling behavior across all object types.
 */

import type { CSSProperties } from "react";
import type { CanvasObject, FrameObject, TextObject, ImageObject } from "./types";
import { isInLayoutContainer, isRootObject } from "./context";

// ============================================================================
// Types
// ============================================================================

export interface StyleContext {
  /** The object to compute styles for */
  object: CanvasObject;
  /** All objects in the canvas */
  allObjects: CanvasObject[];
  /** Whether this object is currently being dragged */
  isBeingDragged: boolean;
}

// ============================================================================
// Wrapper Styles
// ============================================================================

/**
 * Compute wrapper styles for any canvas object.
 * 
 * The wrapper is the outer div that positions the object in the canvas/parent.
 * 
 * Positioning rules:
 * 1. Root objects: Absolute at canvas coordinates
 * 2. Layout children (flex/grid): No position, layout handles it  
 * 3. Absolute children: Position relative to parent
 * 4. Being dragged: Break out of layout flow, use absolute
 */
export function computeWrapperStyle(ctx: StyleContext): CSSProperties {
  const { object, allObjects, isBeingDragged } = ctx;
  
  // Root object: canvas-space positioning
  if (isRootObject(object)) {
    return {
      position: "absolute",
      left: 0,
      top: 0,
      transform: `translate(${object.x}px, ${object.y}px)`,
      opacity: object.opacity,
    };
  }
  
  const inLayout = isInLayoutContainer(object, allObjects);
  
  // Layout child (not being dragged): let layout handle positioning
  if (inLayout && !isBeingDragged) {
    const style: CSSProperties = {
      opacity: object.opacity,
      flexShrink: 0,
    };
    
    // Add size hints based on object type
    // This helps flex/grid know how to size the child
    switch (object.type) {
      case "image":
        // Images need explicit size
        style.width = object.width;
        style.height = object.height;
        break;
        
      case "text": {
        const textObj = object as TextObject;
        // Auto-width text should not have fixed size (grows with content)
        // Auto-height text needs width constraint
        // Fixed text needs both
        if (textObj.sizeMode !== "auto-width") {
          style.width = object.width;
        }
        if (textObj.sizeMode === "fixed") {
          style.height = object.height;
        }
        break;
      }
      
      case "frame": {
        const frameObj = object as FrameObject;
        // Frames handle their own sizing based on widthMode/heightMode
        if (frameObj.widthMode === "expand") {
          style.flex = 1;
        } else if (frameObj.widthMode === "fixed") {
          style.width = object.width;
        }
        if (frameObj.heightMode === "fixed") {
          style.height = object.height;
        }
        break;
      }
    }
    
    return style;
  }
  
  // Absolute positioning within parent (or dragging out of layout)
  return {
    position: "absolute",
    left: object.x,
    top: object.y,
    opacity: object.opacity,
  };
}

// ============================================================================
// Frame Content Styles
// ============================================================================

/**
 * Compute styles for frame content (the inner div of a frame).
 */
export function computeFrameStyle(frame: FrameObject): CSSProperties {
  const style: CSSProperties = {
    boxSizing: "border-box",
    position: "relative", // Positioning context for children
  };
  
  // Size (for frames that manage their own size)
  if (frame.widthMode !== "expand") {
    style.width = frame.width;
  }
  if (frame.heightMode !== "expand") {
    style.height = frame.height;
  }
  if (frame.widthMode === "expand" || frame.heightMode === "expand") {
    style.flex = 1;
  }
  
  // Fill
  if (frame.fill) {
    style.backgroundColor = hexToRgba(frame.fill, frame.fillOpacity ?? 1);
  }
  
  // Blend mode
  if (frame.blendMode) {
    style.mixBlendMode = frame.blendMode;
  }
  
  // Border radius
  style.borderRadius = computeBorderRadius(frame);
  
  // Border
  if (frame.border) {
    const borderColor = hexToRgba(frame.border, frame.borderOpacity ?? 1);
    const borderStyle = frame.borderStyle || "solid";
    const borderWidth = frame.borderWidth || 1;
    
    if (frame.borderSide && frame.borderSide !== "all") {
      const side = frame.borderSide.charAt(0).toUpperCase() + frame.borderSide.slice(1);
      (style as Record<string, string>)[`border${side}`] = 
        `${borderWidth}px ${borderStyle} ${borderColor}`;
    } else {
      style.border = `${borderWidth}px ${borderStyle} ${borderColor}`;
    }
  }
  
  // Outline
  if (frame.outline) {
    style.outline = `${frame.outlineWidth || 1}px ${frame.outlineStyle || "solid"} ${
      hexToRgba(frame.outline, frame.outlineOpacity ?? 1)
    }`;
    style.outlineOffset = frame.outlineOffset ?? 0;
  }
  
  // Shadows
  style.boxShadow = computeBoxShadow(frame);
  
  // Clip content
  style.overflow = frame.clipContent ? "hidden" : "visible";
  
  // Layout (as container)
  if (frame.layoutMode !== "none") {
    style.display = frame.layoutMode === "flex" ? "flex" : "grid";
    
    if (frame.layoutMode === "flex") {
      style.flexDirection = frame.flexDirection;
      style.justifyContent = frame.justifyContent;
      style.alignItems = frame.alignItems;
      style.flexWrap = frame.flexWrap;
    }
    
    style.gap = frame.gap;
    style.padding = frame.padding;
  }
  
  return style;
}

// ============================================================================
// Text Content Styles
// ============================================================================

/**
 * Compute styles for text content.
 */
export function computeTextStyle(
  text: TextObject,
  isEditing: boolean
): CSSProperties {
  const style: CSSProperties = {
    color: text.color,
    fontSize: text.fontSize,
    fontFamily: text.fontFamily,
    fontWeight: text.fontWeight,
    textAlign: text.textAlign,
    outline: isEditing ? "1px solid #3b82f6" : "none",
    pointerEvents: isEditing ? "auto" : "none",
    cursor: isEditing ? "text" : "default",
    minHeight: 4, // Ensure clickable area
  };
  
  switch (text.sizeMode) {
    case "auto-width":
      style.whiteSpace = "pre";
      style.width = "auto";
      style.height = "auto";
      style.minWidth = 4;
      break;
      
    case "auto-height":
      style.width = text.width;
      style.height = "auto";
      style.whiteSpace = "pre-wrap";
      style.wordWrap = "break-word";
      break;
      
    case "fixed":
      style.width = text.width;
      style.height = text.height;
      style.whiteSpace = "pre-wrap";
      style.wordWrap = "break-word";
      style.overflow = "hidden";
      break;
  }
  
  return style;
}

// ============================================================================
// Image Content Styles
// ============================================================================

/**
 * Compute styles for the image wrapper (handles overflow clipping).
 */
export function computeImageWrapperStyle(image: ImageObject): CSSProperties {
  return {
    width: image.width,
    height: image.height,
    overflow: "hidden",
    position: "relative",
  };
}

/**
 * Compute styles for image content (the actual <img> element).
 * Handles different fill modes: fill (cover), fit (contain), crop (manual).
 */
export function computeImageStyle(image: ImageObject): CSSProperties {
  const fillMode = image.fillMode || "fill";

  switch (fillMode) {
    case "fill":
      // Cover: scale to fill the frame, crop as needed, centered
      return {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        display: "block",
      };

    case "fit":
      // Contain: scale to fit within frame, letterbox as needed, centered
      return {
        width: "100%",
        height: "100%",
        objectFit: "contain",
        objectPosition: "center",
        display: "block",
      };

    case "crop":
    default: {
      // Manual crop: use cropX/Y/Width/Height to position image
      if (!image.cropWidth || !image.cropHeight) {
        // Fallback if no crop data
        return {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        };
      }

      // Calculate scale: display size / crop size
      const scaleX = image.width / image.cropWidth;
      const scaleY = image.height / image.cropHeight;

      // The full image size when scaled
      const scaledWidth = image.naturalWidth * scaleX;
      const scaledHeight = image.naturalHeight * scaleY;

      // Offset based on crop position
      const offsetX = -image.cropX * scaleX;
      const offsetY = -image.cropY * scaleY;

      return {
        position: "absolute",
        width: scaledWidth,
        height: scaledHeight,
        left: offsetX,
        top: offsetY,
        maxWidth: "unset",
        display: "block",
      };
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function computeBorderRadius(frame: FrameObject): string | number {
  if (
    frame.radiusTL !== undefined ||
    frame.radiusTR !== undefined ||
    frame.radiusBR !== undefined ||
    frame.radiusBL !== undefined
  ) {
    return `${frame.radiusTL ?? frame.radius}px ${frame.radiusTR ?? frame.radius}px ${
      frame.radiusBR ?? frame.radius}px ${frame.radiusBL ?? frame.radius}px`;
  }
  return frame.radius;
}

function computeBoxShadow(frame: FrameObject): string | undefined {
  const shadows: string[] = [];
  
  if (frame.shadow) {
    const s = frame.shadow;
    shadows.push(
      `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${hexToRgba(s.color, s.opacity)}`
    );
  }
  
  if (frame.innerShadow) {
    const s = frame.innerShadow;
    shadows.push(
      `inset ${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${hexToRgba(s.color, s.opacity)}`
    );
  }
  
  return shadows.length > 0 ? shadows.join(", ") : undefined;
}
