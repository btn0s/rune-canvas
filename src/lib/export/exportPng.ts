/**
 * PNG Export Utilities
 *
 * Export canvas objects to PNG images
 * - Shaders: Direct canvas.toDataURL() export (fast, pixel-perfect)
 * - Frames: html2canvas-pro (supports modern CSS like oklch, handles fonts/transforms)
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
 * Export a shader object by finding its canvas and using toDataURL directly
 * Optionally scales up the canvas for higher resolution exports
 */
async function exportShaderCanvas(
  shaderElement: HTMLElement,
  fileName: string,
  pixelRatio: number = 3
): Promise<void> {
  // Find the canvas element within the shader
  const sourceCanvas = shaderElement.querySelector("canvas") as HTMLCanvasElement;
  if (!sourceCanvas) {
    throw new Error("Shader canvas not found");
  }

  if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
    throw new Error("Shader canvas has zero dimensions");
  }

  let dataUrl: string;
  
  if (pixelRatio === 1) {
    // Export at native resolution
    dataUrl = sourceCanvas.toDataURL("image/png");
  } else {
    // Scale up for higher resolution export
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = sourceCanvas.width * pixelRatio;
    exportCanvas.height = sourceCanvas.height * pixelRatio;
    
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    
    // Use imageSmoothingEnabled for better quality when scaling up
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    
    // Draw the source canvas scaled up
    ctx.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    
    dataUrl = exportCanvas.toDataURL("image/png");
  }
  
  // Create download link
  const link = document.createElement("a");
  link.download = `${sanitizeFileName(fileName)}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Export a frame object using html2canvas-pro (supports modern CSS like oklch)
 */
async function exportFrameElement(
  frameElement: HTMLElement,
  fileName: string,
  pixelRatio: number = 3
): Promise<void> {
  const html2canvas = (await import("html2canvas-pro")).default;
  
  // Get bounding rect for dimensions
  const rect = frameElement.getBoundingClientRect();
  
  if (rect.width === 0 || rect.height === 0) {
    throw new Error("Frame element has zero dimensions");
  }

  // Use html2canvas-pro which supports modern CSS (oklch, etc.)
  // It handles CSS transforms, fonts, and complex layouts
  const canvas = await html2canvas(frameElement, {
    width: rect.width,
    height: rect.height,
    scale: pixelRatio,
    backgroundColor: "#ffffff",
    useCORS: true, // Allow cross-origin images
    logging: false, // Disable console logging
    windowWidth: rect.width,
    windowHeight: rect.height,
  });

  // Convert canvas to data URL and download
  const dataUrl = canvas.toDataURL("image/png");
  
  const link = document.createElement("a");
  link.download = `${sanitizeFileName(fileName)}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Export a DOM node to PNG and trigger download
 * 
 * Automatically detects if it's a shader (has canvas) or frame (DOM content)
 */
export async function exportNodeToPng(
  node: HTMLElement | null,
  options: {
    fileName?: string;
    pixelRatio?: number;
  } = {}
): Promise<void> {
  if (!node) {
    throw new Error("Node element is required");
  }
  const { fileName = "export", pixelRatio = 3 } = options;

  // Check if this is a shader (has a canvas element)
  const canvas = node.querySelector("canvas");
  if (canvas && canvas.width > 0 && canvas.height > 0) {
    // Shader: export canvas with optional scaling
    await exportShaderCanvas(node, fileName, pixelRatio);
  } else {
    // Frame: use html2canvas-pro for modern CSS support (oklch, etc.)
    await exportFrameElement(node, fileName, pixelRatio);
  }
}
