/**
 * PNG Export Utilities
 *
 * Export canvas objects to PNG images using html2canvas-pro.
 * This properly captures all CSS styling (fills, shadows, borders, etc.)
 * for both frames and shaders, while also handling embedded WebGL canvases.
 */

/**
 * Sanitize a filename by removing invalid characters
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase() || "export";
}

/**
 * Export a DOM element using html2canvas-pro (supports modern CSS like oklch)
 * Properly captures all styling including fills, shadows, borders, and embedded canvases.
 */
async function exportElement(
  element: HTMLElement,
  fileName: string,
  pixelRatio: number = 3,
  expectedWidth?: number,
  expectedHeight?: number
): Promise<void> {
  const html2canvas = (await import("html2canvas-pro")).default;
  
  // Get bounding rect to know the element's actual rendered size
  const rect = element.getBoundingClientRect();
  
  // Use provided dimensions if available (from data model), otherwise use measured dimensions
  // This ensures we export at the correct size even if the element is scaled/transformed
  const width = expectedWidth ?? rect.width;
  const height = expectedHeight ?? rect.height;
  
  if (width === 0 || height === 0) {
    throw new Error("Element has zero dimensions");
  }

  // Use html2canvas-pro which supports modern CSS (oklch, etc.)
  // It handles CSS transforms, fonts, complex layouts, and embedded canvases
  // Capture the element - html2canvas will capture it at its current position
  const canvas = await html2canvas(element, {
    width,
    height,
    scale: pixelRatio,
    backgroundColor: null, // Preserve transparency
    useCORS: true, // Allow cross-origin images
    logging: false, // Disable console logging
  });
  
  // html2canvas might return a canvas that's larger than the element
  // (due to shadows, outlines, or positioning). Crop to exact dimensions.
  // The element should be at the top-left of the captured canvas.
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width * pixelRatio;
  exportCanvas.height = height * pixelRatio;
  
  const ctx = exportCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get 2D context");
  }
  
  // Crop from top-left (where the element should be)
  // If canvas is larger, take the top-left portion
  const sourceWidth = Math.min(canvas.width, width * pixelRatio);
  const sourceHeight = Math.min(canvas.height, height * pixelRatio);
  
  ctx.drawImage(
    canvas,
    0, 0, // Source position (top-left)
    sourceWidth, sourceHeight, // Source size
    0, 0, // Destination position
    sourceWidth, sourceHeight // Destination size
  );

  // Convert canvas to data URL and download
  const dataUrl = exportCanvas.toDataURL("image/png");
  
  const link = document.createElement("a");
  link.download = `${sanitizeFileName(fileName)}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Export a DOM node to PNG and trigger download
 * 
 * Uses html2canvas-pro to capture the full styled element including:
 * - All CSS styling (fills, shadows, borders, border-radius, etc.)
 * - Embedded WebGL/2D canvases (shaders)
 * - Modern CSS features (oklch colors, transforms, etc.)
 */
export async function exportNodeToPng(
  node: HTMLElement | null,
  options: {
    fileName?: string;
    pixelRatio?: number;
    width?: number;
    height?: number;
  } = {}
): Promise<void> {
  if (!node) {
    throw new Error("Node element is required");
  }
  const { fileName = "export", pixelRatio = 3, width, height } = options;

  await exportElement(node, fileName, pixelRatio, width, height);
}

/**
 * Copy a DOM node to PNG and copy to clipboard
 * 
 * Uses html2canvas-pro to capture the full styled element including:
 * - All CSS styling (fills, shadows, borders, border-radius, etc.)
 * - Embedded WebGL/2D canvases (shaders)
 * - Modern CSS features (oklch colors, transforms, etc.)
 */
export async function copyNodeToPng(
  node: HTMLElement | null,
  options: {
    pixelRatio?: number;
    width?: number;
    height?: number;
  } = {}
): Promise<void> {
  if (!node) {
    throw new Error("Node element is required");
  }
  const { pixelRatio = 3, width, height } = options;

  const html2canvas = (await import("html2canvas-pro")).default;
  
  // Get bounding rect to know the element's actual rendered size
  const rect = node.getBoundingClientRect();
  
  // Use provided dimensions if available (from data model), otherwise use measured dimensions
  const exportWidth = width ?? rect.width;
  const exportHeight = height ?? rect.height;
  
  if (exportWidth === 0 || exportHeight === 0) {
    throw new Error("Element has zero dimensions");
  }

  // Capture the element
  const canvas = await html2canvas(node, {
    width: exportWidth,
    height: exportHeight,
    scale: pixelRatio,
    backgroundColor: null, // Preserve transparency
    useCORS: true, // Allow cross-origin images
    logging: false, // Disable console logging
  });
  
  // Crop to exact dimensions
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = exportWidth * pixelRatio;
  exportCanvas.height = exportHeight * pixelRatio;
  
  const ctx = exportCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get 2D context");
  }
  
  const sourceWidth = Math.min(canvas.width, exportWidth * pixelRatio);
  const sourceHeight = Math.min(canvas.height, exportHeight * pixelRatio);
  
  ctx.drawImage(
    canvas,
    0, 0,
    sourceWidth, sourceHeight,
    0, 0,
    sourceWidth, sourceHeight
  );

  // Convert canvas to blob and copy to clipboard
  return new Promise<void>((resolve, reject) => {
    exportCanvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("Failed to create blob"));
        return;
      }
      
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        resolve();
      } catch (error) {
        // Fallback: convert to data URL and use legacy clipboard API
        try {
          const dataUrl = exportCanvas.toDataURL("image/png");
          await navigator.clipboard.writeText(dataUrl);
          resolve();
        } catch (fallbackError) {
          reject(fallbackError);
        }
      }
    }, "image/png");
  });
}
