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
 */
async function exportShaderCanvas(
  shaderElement: HTMLElement,
  fileName: string
): Promise<void> {
  // Find the canvas element within the shader
  const canvas = shaderElement.querySelector("canvas") as HTMLCanvasElement;
  if (!canvas) {
    throw new Error("Shader canvas not found");
  }

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("Shader canvas has zero dimensions");
  }

  // Export canvas directly
  const dataUrl = canvas.toDataURL("image/png");
  
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
  pixelRatio: number = 2
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
  const { fileName = "export", pixelRatio = 2 } = options;

  // Check if this is a shader (has a canvas element)
  const canvas = node.querySelector("canvas");
  if (canvas && canvas.width > 0 && canvas.height > 0) {
    // Shader: export canvas directly
    await exportShaderCanvas(node, fileName);
  } else {
    // Frame: use html2canvas-pro for modern CSS support (oklch, etc.)
    await exportFrameElement(node, fileName, pixelRatio);
  }
}
