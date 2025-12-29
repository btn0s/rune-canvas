/**
 * Shared WebGL Context Manager
 * 
 * Provides a single WebGL context shared across all shader renderers.
 * Each shader renders to its own framebuffer, then copies the result to
 * its display canvas. This eliminates the "too many contexts" problem.
 */

class SharedWebGLContext {
  private gl: WebGL2RenderingContext | null = null;
  private offscreenCanvas: HTMLCanvasElement;

  constructor() {
    // #region agent log
    fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:13',message:'SharedWebGLContext constructor',data:{documentReady:typeof document!=='undefined'?document.readyState:'N/A',windowReady:typeof window!=='undefined'?'ready':'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // Create offscreen canvas for rendering (never displayed)
    // Use reasonable initial size - WebGL contexts need at least 1x1, but some browsers
    // may have issues with very small canvases, so we use 256x256
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = 256;
    this.offscreenCanvas.height = 256;
    // #region agent log
    fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:20',message:'Canvas created',data:{width:this.offscreenCanvas.width,height:this.offscreenCanvas.height,hasParent:!!this.offscreenCanvas.parentNode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
  }

  /**
   * Get the shared WebGL context (creates if needed)
   */
  getContext(): WebGL2RenderingContext {
    // #region agent log
    fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:25',message:'getContext called',data:{hasExistingGl:!!this.gl,isContextLost:this.gl?this.gl.isContextLost():false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (this.gl && !this.gl.isContextLost()) {
      return this.gl;
    }

    // Ensure canvas has valid dimensions (should already be set in constructor)
    // #region agent log
    fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:32',message:'Before context creation',data:{canvasWidth:this.offscreenCanvas.width,canvasHeight:this.offscreenCanvas.height,documentReady:document.readyState,hasParent:!!this.offscreenCanvas.parentNode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (this.offscreenCanvas.width < 1 || this.offscreenCanvas.height < 1) {
      this.offscreenCanvas.width = 256;
      this.offscreenCanvas.height = 256;
    }

    // Try creating context - WebGL 2.0 is required
    // #region agent log
    fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:37',message:'Attempting getContext webgl2',data:{canvasWidth:this.offscreenCanvas.width,canvasHeight:this.offscreenCanvas.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    let gl = this.offscreenCanvas.getContext("webgl2") as WebGL2RenderingContext | null;
    // #region agent log
    fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:38',message:'First getContext result',data:{success:!!gl,isNull:gl===null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // If that fails, try with explicit attributes
    if (!gl) {
      // #region agent log
      fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:42',message:'Retrying with explicit attributes',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      gl = this.offscreenCanvas.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        antialias: false,
        desynchronized: false,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false,
      }) as WebGL2RenderingContext | null;
      // #region agent log
      fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:50',message:'Second getContext result',data:{success:!!gl,isNull:gl===null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    }

    if (!gl) {
      // Check if WebGL 2.0 is actually supported
      // #region agent log
      fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:54',message:'Testing WebGL2 support with test canvas',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const testCanvas = document.createElement("canvas");
      const testGl = testCanvas.getContext("webgl2");
      // #region agent log
      fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:56',message:'Test canvas result',data:{testCanvasSuccess:!!testGl,offscreenCanvasWidth:this.offscreenCanvas.width,offscreenCanvasHeight:this.offscreenCanvas.height,testCanvasWidth:testCanvas.width,testCanvasHeight:testCanvas.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      if (!testGl) {
        throw new Error(
          "WebGL 2.0 is not supported in this browser. " +
          "Please use a browser that supports WebGL 2.0 (Chrome 56+, Firefox 51+, Safari 15.1+, Edge 79+)"
        );
      }
      // If test context works but ours doesn't, there's a different issue
      // #region agent log
      fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:63',message:'Throwing error - test canvas works but offscreen fails',data:{testCanvasSuccess:true,offscreenCanvasWidth:this.offscreenCanvas.width,offscreenCanvasHeight:this.offscreenCanvas.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      throw new Error("Failed to create WebGL 2.0 context on offscreen canvas");
    }

    if (gl.isContextLost()) {
      throw new Error("WebGL context was lost immediately after creation");
    }

    // #region agent log
    fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:70',message:'Context created successfully',data:{isContextLost:gl.isContextLost()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    this.gl = gl;
    return gl;
  }

  /**
   * Dispose the shared context
   */
  dispose(): void {
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
// #region agent log
if(typeof window!=='undefined'){fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'shared-context.ts:89',message:'Module loading - creating singleton',data:{documentReady:document.readyState,windowExists:typeof window!=='undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});}
// #endregion
export const sharedContext = new SharedWebGLContext();

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    sharedContext.dispose();
  });
}
