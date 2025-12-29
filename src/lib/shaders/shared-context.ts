/**
 * Shared WebGL Context Manager
 * 
 * Provides a single WebGL context shared across all shader renderers.
 * Each shader renders to its own framebuffer, then copies the result to
 * its display canvas. This eliminates the "too many contexts" problem.
 * 
 * Also coordinates rendering across all shaders with a single RAF loop
 * to ensure predictable state management and efficient batching.
 * 
 * Responsibilities:
 * - WebGL context creation and lifecycle
 * - Centralized requestAnimationFrame coordination
 * - Renderer registration/unregistration
 */

type RendererFrameCallback = () => void;

class SharedWebGLContext {
  private gl: WebGL2RenderingContext | null = null;
  private offscreenCanvas: HTMLCanvasElement;
  private renderers: Set<RendererFrameCallback> = new Set();
  private rafId: number | null = null;

  constructor() {
    // Create offscreen canvas for rendering (never displayed)
    // Use reasonable initial size - WebGL contexts need at least 1x1, but some browsers
    // may have issues with very small canvases, so we use 256x256
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = 256;
    this.offscreenCanvas.height = 256;
  }

  /**
   * Get the shared WebGL context (creates if needed)
   */
  getContext(): WebGL2RenderingContext {
    if (this.gl && !this.gl.isContextLost()) {
      return this.gl;
    }

    // Ensure canvas has valid dimensions (should already be set in constructor)
    if (this.offscreenCanvas.width < 1 || this.offscreenCanvas.height < 1) {
      this.offscreenCanvas.width = 256;
      this.offscreenCanvas.height = 256;
    }

    // Try creating context - WebGL 2.0 is required
    let gl = this.offscreenCanvas.getContext("webgl2") as WebGL2RenderingContext | null;
    
    // If that fails, try with explicit attributes
    if (!gl) {
      gl = this.offscreenCanvas.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        antialias: false,
        desynchronized: false,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false,
      }) as WebGL2RenderingContext | null;
    }

    if (!gl) {
      // Check if WebGL 2.0 is actually supported
      const testCanvas = document.createElement("canvas");
      const testGl = testCanvas.getContext("webgl2");
      if (!testGl) {
        throw new Error(
          "WebGL 2.0 is not supported in this browser. " +
          "Please use a browser that supports WebGL 2.0 (Chrome 56+, Firefox 51+, Safari 15.1+, Edge 79+)"
        );
      }
      // If test context works but ours doesn't, there's a different issue
      throw new Error("Failed to create WebGL 2.0 context on offscreen canvas");
    }

    if (gl.isContextLost()) {
      throw new Error("WebGL context was lost immediately after creation");
    }

    this.gl = gl;
    return gl;
  }

  /**
   * Register a renderer to be called each frame
   * Automatically starts the render loop if this is the first renderer
   */
  registerRenderer(renderFrame: RendererFrameCallback): void {
    this.renderers.add(renderFrame);
    this.startRenderLoop();
  }

  /**
   * Unregister a renderer
   * Automatically stops the render loop if this was the last renderer
   */
  unregisterRenderer(renderFrame: RendererFrameCallback): void {
    this.renderers.delete(renderFrame);
    if (this.renderers.size === 0) {
      this.stopRenderLoop();
    }
  }

  /**
   * Start the centralized render loop
   */
  private startRenderLoop(): void {
    if (this.rafId !== null) return; // Already running

    const renderAll = () => {
      // Check if context was lost
      if (this.gl && this.gl.isContextLost()) {
        this.stopRenderLoop();
        return;
      }

      // If no renderers are registered, stop the loop
      if (this.renderers.size === 0) {
        this.stopRenderLoop();
        return;
      }

      // Render all registered renderers in a single frame
      // This ensures predictable state management with the shared context
      // Use Array.from to create a snapshot to avoid issues if renderers are removed during iteration
      const renderersSnapshot = Array.from(this.renderers);
      for (const renderFrame of renderersSnapshot) {
        try {
          renderFrame();
        } catch (error) {
          console.error("Error in shader render frame:", error);
          // If a renderer throws an error, it might be disposed - remove it from the set
          this.renderers.delete(renderFrame);
        }
      }

      // Only continue loop if we still have renderers (they might have been removed during rendering)
      if (this.renderers.size > 0) {
        this.rafId = requestAnimationFrame(renderAll);
      } else {
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(renderAll);
  }

  /**
   * Stop the centralized render loop
   */
  private stopRenderLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Dispose the shared context
   */
  dispose(): void {
    this.stopRenderLoop();
    this.renderers.clear();
    
    if (this.gl && !this.gl.isContextLost()) {
      const loseContextExt = this.gl.getExtension("WEBGL_lose_context");
      if (loseContextExt) {
        loseContextExt.loseContext();
      }
    }
    this.gl = null;
  }
}

// Singleton instance - ONE context for ALL shaders!
export const sharedContext = new SharedWebGLContext();

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    sharedContext.dispose();
  });
}
