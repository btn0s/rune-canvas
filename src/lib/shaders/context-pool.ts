/**
 * WebGL Context Pool
 * 
 * Manages a pool of reusable WebGL contexts to avoid hitting browser limits.
 * Instead of creating a new context for each shader component, we reuse contexts
 * from the pool and return them when components unmount.
 */

interface PooledContext {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  inUse: boolean;
  lastUsed: number;
}

class WebGLContextPool {
  private pool: PooledContext[] = [];
  private maxPoolSize = 3; // Maximum number of idle contexts to keep in pool
  private maxTotalContexts = 6; // Maximum total contexts (in use + idle) - conservative limit
  private maxIdleTime = 10000; // 10 seconds - contexts idle longer than this are disposed

  /**
   * Get a WebGL context from the pool, or create a new one if none available
   */
  acquire(): { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext } {
    // First, clean up any lost contexts
    this.removeLostContexts();
    
    // Try to find an available context in the pool
    let pooled = this.pool.find((ctx) => !ctx.inUse && !ctx.gl.isContextLost());
    
    if (pooled) {
      pooled.inUse = true;
      pooled.lastUsed = Date.now();
      return { canvas: pooled.canvas, gl: pooled.gl };
    }

    // Check if we're at the limit - if so, clean up and try again
    const totalContexts = this.pool.length;
    if (totalContexts >= this.maxTotalContexts) {
      // Aggressively clean up idle contexts
      this.cleanup();
      
      // Also remove any lost contexts
      this.removeLostContexts();
      
      // Check again after cleanup
      pooled = this.pool.find((ctx) => !ctx.inUse && !ctx.gl.isContextLost());
      if (pooled) {
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        return { canvas: pooled.canvas, gl: pooled.gl };
      }
      
      // Still at limit - don't create new context, throw error instead
      const stats = this.getStats();
      throw new Error(
        `WebGL context pool exhausted (${stats.total} total, ${stats.inUse} in use, ${stats.lost} lost). ` +
        `Cannot create more contexts. Please reduce the number of concurrent shaders.`
      );
    }

    // No available context, create a new one (if under limit)
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: false, // Disable antialiasing for better performance
    }) as WebGL2RenderingContext | null;

    if (!gl) {
      throw new Error("WebGL 2.0 is not supported");
    }

    if (gl.isContextLost()) {
      throw new Error("WebGL context was lost immediately after creation");
    }

    // Add to pool
    const pooledContext: PooledContext = {
      canvas,
      gl,
      inUse: true,
      lastUsed: Date.now(),
    };

    this.pool.push(pooledContext);
    return { canvas, gl };
  }

  /**
   * Remove any contexts that have been lost
   */
  private removeLostContexts(): void {
    const lost = this.pool.filter((ctx) => ctx.gl.isContextLost());
    for (const pooled of lost) {
      const index = this.pool.indexOf(pooled);
      if (index > -1) {
        this.pool.splice(index, 1);
      }
    }
  }

  /**
   * Return a context to the pool for reuse
   */
  release(canvas: HTMLCanvasElement): void {
    const pooled = this.pool.find((ctx) => ctx.canvas === canvas);
    if (pooled) {
      // If context is lost, remove it instead of returning to pool
      if (pooled.gl.isContextLost()) {
        const index = this.pool.indexOf(pooled);
        if (index > -1) {
          this.pool.splice(index, 1);
        }
        return;
      }
      
      pooled.inUse = false;
      pooled.lastUsed = Date.now();
      
      // Clean up any bound resources
      const gl = pooled.gl;
      // Unbind everything to clean state
      gl.useProgram(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      
      // Unbind all textures
      for (let i = 0; i < 32; i++) {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      
      gl.getError(); // Clear any errors
      
      // Clean up old contexts periodically
      this.cleanup();
    }
  }

  /**
   * Clean up idle contexts that haven't been used in a while
   */
  private cleanup(): void {
    const now = Date.now();
    const toRemove: PooledContext[] = [];

    // Remove lost contexts first
    this.removeLostContexts();

    // Remove contexts that have been idle too long
    for (const pooled of this.pool) {
      if (!pooled.inUse && now - pooled.lastUsed > this.maxIdleTime) {
        toRemove.push(pooled);
      }
    }

    // If pool is too large, remove oldest unused contexts
    const unused = this.pool.filter((ctx) => !ctx.inUse);
    if (unused.length > this.maxPoolSize) {
      unused.sort((a, b) => a.lastUsed - b.lastUsed);
      const excess = unused.slice(0, unused.length - this.maxPoolSize);
      toRemove.push(...excess);
    }

    // Dispose of contexts to be removed
    for (const pooled of toRemove) {
      if (!pooled.gl.isContextLost()) {
        const loseContextExt = pooled.gl.getExtension("WEBGL_lose_context");
        if (loseContextExt) {
          loseContextExt.loseContext();
        }
      }
      const index = this.pool.indexOf(pooled);
      if (index > -1) {
        this.pool.splice(index, 1);
      }
    }
  }

  /**
   * Dispose all contexts in the pool
   */
  disposeAll(): void {
    for (const pooled of this.pool) {
      if (!pooled.gl.isContextLost()) {
        const loseContextExt = pooled.gl.getExtension("WEBGL_lose_context");
        if (loseContextExt) {
          loseContextExt.loseContext();
        }
      }
    }
    this.pool = [];
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      total: this.pool.length,
      inUse: this.pool.filter((ctx) => ctx.inUse).length,
      available: this.pool.filter((ctx) => !ctx.inUse && !ctx.gl.isContextLost()).length,
      lost: this.pool.filter((ctx) => ctx.gl.isContextLost()).length,
    };
  }
}

// Singleton instance
export const contextPool = new WebGLContextPool();

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    contextPool.disposeAll();
  });
}
