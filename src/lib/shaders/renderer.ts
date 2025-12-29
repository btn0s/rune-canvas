/**
 * WebGL Shader Renderer
 *
 * Simplified WebGL 2.0 shader mount for rendering shaders on canvas
 * Uses shared WebGL context to avoid context limit issues
 */

import { sharedContext } from "./shared-context";

// Vertex shader source - simple full-screen quad
// Outputs v_objectUV, v_patternUV, and v_imageUV for compatibility
// v_objectUV is centered at origin (can go negative) to match Paper shader behavior
const vertexShaderSource = `#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

out vec2 v_objectUV;
out vec2 v_patternUV;
out vec2 v_imageUV;

void main() {
  gl_Position = a_position;
  
  // Map from [-1, 1] to [0, 1] for pattern UV
  vec2 patternUV = a_position.xy * 0.5 + 0.5;
  patternUV.y = 1.0 - patternUV.y; // Flip Y (top becomes 0, bottom becomes 1)
  v_patternUV = patternUV * 100.0; // Scale for pattern UV (used by some shaders)
  
  // For object UV, output centered at origin [-0.5, 0.5] (matches Paper shader behavior)
  // Shaders can add 0.5 to get [0, 1] range centered properly
  vec2 objectUV = a_position.xy * 0.5;
  objectUV.y = -objectUV.y; // Flip Y (top becomes 0.5, bottom becomes -0.5)
  v_objectUV = objectUV;
  
  // Image UV is [0, 1] range for sampling textures
  v_imageUV = patternUV;
}
`;

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    console.error("Shader compilation error:", info);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    console.error("Program linking error:", info);
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export interface ShaderRendererUniforms {
  [key: string]: number | number[] | HTMLImageElement | string | undefined;
}

export class ShaderRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private program: WebGLProgram | null = null;
  private uniformLocations: Map<string, WebGLUniformLocation | null> =
    new Map();
  private uniformTypes: Map<string, number> = new Map(); // Store uniform types (gl.INT, gl.FLOAT, etc.)
  private startTime = Date.now();
  private speed = 1;
  private uniforms: ShaderRendererUniforms = {};
  private fragmentShaderSource: string;
  private textures: Map<string, WebGLTexture> = new Map();
  private textureUnitMap: Map<string, number> = new Map();
  private nextTextureUnit = 0;
  private positionBuffer: WebGLBuffer | null = null;
  private renderTargetId: string | null = null;
  private framebuffer: WebGLFramebuffer | null = null;
  private renderTexture: WebGLTexture | null = null;
  private displayCtx: CanvasRenderingContext2D | null = null;
  private renderFrameCallback: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    fragmentShader: string,
    uniforms: ShaderRendererUniforms = {},
    speed = 1
  ) {
    this.canvas = canvas;
    this.fragmentShaderSource = fragmentShader;
    this.uniforms = uniforms;
    this.speed = speed;

    // Use shared WebGL context - single context for all shaders!
    this.gl = sharedContext.getContext();
    this.renderTargetId = `shader-${Date.now()}-${Math.random()}`;

    // Initialize canvas dimensions if not set
    if (!this.canvas.width || !this.canvas.height) {
      const pixelRatio = window.devicePixelRatio || 1;
      this.canvas.width = (this.canvas.offsetWidth || 1) * pixelRatio;
      this.canvas.height = (this.canvas.offsetHeight || 1) * pixelRatio;
    }

    // Get or create 2D context for copying pixels to display canvas
    // Note: The 2D context resolution is determined by canvas.width/height
    // We'll set these correctly in resize(), but ensure we have a context
    this.displayCtx = this.canvas.getContext("2d", {
      alpha: true,
      desynchronized: false,
      willReadFrequently: false,
    });
    if (!this.displayCtx) {
      throw new Error("Failed to get 2D context for display canvas");
    }

    // Set image smoothing for better quality when scaling
    this.displayCtx.imageSmoothingEnabled = true;
    this.displayCtx.imageSmoothingQuality = "high";

    // Create render frame callback bound to this instance
    this.renderFrameCallback = () => this.renderFrame();

    this.init();
  }

  private init() {
    // Create program
    this.program = createProgram(
      this.gl,
      vertexShaderSource,
      this.fragmentShaderSource
    );
    if (!this.program) {
      throw new Error("Failed to create shader program");
    }

    // Setup position attribute
    const positionLocation = this.gl.getAttribLocation(
      this.program,
      "a_position"
    );
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    const positions = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(
      positionLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    // Create render target (framebuffer) for this shader
    this.createRenderTarget();

    // Get uniform locations
    this.updateUniformLocations();
    this.setUniforms(this.uniforms);

    // Register with centralized render coordinator
    this.start();
  }

  private createRenderTarget(): void {
    if (!this.renderTargetId) return;

    // Use the same logic as resize() to ensure consistency
    const displayWidth = this.canvas.offsetWidth || 1;
    const displayHeight = this.canvas.offsetHeight || 1;
    const pixelRatio = window.devicePixelRatio || 1;
    const renderWidth = Math.max(1, Math.round(displayWidth * pixelRatio));
    const renderHeight = Math.max(1, Math.round(displayHeight * pixelRatio));

    // Update canvas internal resolution to match
    this.canvas.width = renderWidth;
    this.canvas.height = renderHeight;

    // Create framebuffer
    this.framebuffer = this.gl.createFramebuffer();
    if (!this.framebuffer) {
      throw new Error("Failed to create framebuffer");
    }

    // Create texture to render into
    this.renderTexture = this.gl.createTexture();
    if (!this.renderTexture) {
      this.gl.deleteFramebuffer(this.framebuffer);
      throw new Error("Failed to create render texture");
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.renderTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      renderWidth,
      renderHeight,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );

    // Attach texture to framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.renderTexture,
      0
    );

    // Check framebuffer status
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      this.gl.deleteTexture(this.renderTexture);
      this.gl.deleteFramebuffer(this.framebuffer);
      throw new Error(`Framebuffer incomplete: ${status}`);
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  private updateUniformLocations() {
    this.uniformLocations.clear();
    this.uniformTypes.clear();

    if (!this.program) return;

    // Query all active uniforms to get their types
    const numUniforms = this.gl.getProgramParameter(
      this.program,
      this.gl.ACTIVE_UNIFORMS
    );
    for (let i = 0; i < numUniforms; i++) {
      const uniformInfo = this.gl.getActiveUniform(this.program, i);
      if (uniformInfo) {
        const location = this.gl.getUniformLocation(
          this.program,
          uniformInfo.name
        );
        this.uniformLocations.set(uniformInfo.name, location);
        this.uniformTypes.set(uniformInfo.name, uniformInfo.type);
      }
    }

    // Also explicitly set standard uniforms if they exist
    const timeLoc = this.gl.getUniformLocation(this.program, "u_time");
    if (timeLoc !== null) {
      this.uniformLocations.set("u_time", timeLoc);
    }
    const resolutionLoc = this.gl.getUniformLocation(
      this.program,
      "u_resolution"
    );
    if (resolutionLoc !== null) {
      this.uniformLocations.set("u_resolution", resolutionLoc);
    }
    const pixelRatioLoc = this.gl.getUniformLocation(
      this.program,
      "u_pixelRatio"
    );
    if (pixelRatioLoc !== null) {
      this.uniformLocations.set("u_pixelRatio", pixelRatioLoc);
    }

    // Also check for aspect ratio uniforms (e.g., u_imageAspectRatio for u_image)
    Object.keys(this.uniforms).forEach((key) => {
      if (this.uniforms[key] instanceof HTMLImageElement) {
        const aspectRatioKey = `${key}AspectRatio`;
        const aspectRatioLoc = this.gl.getUniformLocation(
          this.program!,
          aspectRatioKey
        );
        if (aspectRatioLoc !== null) {
          this.uniformLocations.set(aspectRatioKey, aspectRatioLoc);
        }
      }
    });
  }

  setUniforms(uniforms: ShaderRendererUniforms) {
    if (this.gl.isContextLost()) {
      return;
    }
    this.uniforms = uniforms;
    this.updateUniformLocations();
    this.applyUniforms();
  }

  private applyUniforms() {
    if (!this.program) return;

    // Check if context was lost
    if (this.gl.isContextLost()) {
      return;
    }

    // NOTE: Program should already be bound via gl.useProgram() before calling this
    // We don't call useProgram here to avoid state conflicts with shared context

    // Set time
    const timeLoc = this.uniformLocations.get("u_time");
    if (timeLoc !== null && timeLoc !== undefined) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.gl.uniform1f(timeLoc, elapsed * this.speed);
    }

    // Set resolution
    const resolutionLoc = this.uniformLocations.get("u_resolution");
    if (resolutionLoc !== null && resolutionLoc !== undefined) {
      this.gl.uniform2f(resolutionLoc, this.canvas.width, this.canvas.height);
    }

    // Set pixel ratio
    const pixelRatioLoc = this.uniformLocations.get("u_pixelRatio");
    if (pixelRatioLoc !== null && pixelRatioLoc !== undefined) {
      this.gl.uniform1f(pixelRatioLoc, window.devicePixelRatio || 1);
    }

    // Set custom uniforms
    Object.entries(this.uniforms).forEach(([key, value]) => {
      const loc = this.uniformLocations.get(key);
      if (loc === null || loc === undefined) return;

      if (typeof value === "number") {
        // Check if this is an integer uniform
        const uniformType = this.uniformTypes.get(key);
        if (uniformType === this.gl.INT || uniformType === this.gl.SAMPLER_2D) {
          this.gl.uniform1i(loc, Math.round(value));
        } else {
          this.gl.uniform1f(loc, value);
        }
      } else if (Array.isArray(value)) {
        const uniformType = this.uniformTypes.get(key);
        if (value.length === 2) {
          if (uniformType === this.gl.INT_VEC2) {
            this.gl.uniform2i(
              loc,
              Math.round(value[0] as number),
              Math.round(value[1] as number)
            );
          } else {
            this.gl.uniform2f(loc, value[0] as number, value[1] as number);
          }
        } else if (value.length === 3) {
          if (uniformType === this.gl.INT_VEC3) {
            this.gl.uniform3i(
              loc,
              Math.round(value[0] as number),
              Math.round(value[1] as number),
              Math.round(value[2] as number)
            );
          } else {
            this.gl.uniform3f(
              loc,
              value[0] as number,
              value[1] as number,
              value[2] as number
            );
          }
        } else if (value.length === 4) {
          if (uniformType === this.gl.INT_VEC4) {
            this.gl.uniform4i(
              loc,
              Math.round(value[0] as number),
              Math.round(value[1] as number),
              Math.round(value[2] as number),
              Math.round(value[3] as number)
            );
          } else {
            this.gl.uniform4f(
              loc,
              value[0] as number,
              value[1] as number,
              value[2] as number,
              value[3] as number
            );
          }
        } else if (value.length > 4 && value.length % 4 === 0) {
          // Array of vec4s (for colors array)
          this.gl.uniform4fv(loc, new Float32Array(value as number[]));
        }
      } else if (value instanceof HTMLImageElement) {
        this.setTextureUniform(key, value);
      }
    });
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  resize(width: number, height: number) {
    if (this.gl.isContextLost()) {
      return;
    }

    // Use the actual container size (from CSS) or fall back to passed dimensions
    // The canvas fills its container via CSS (width/height: 100%)
    const displayWidth = this.canvas.offsetWidth || width;
    const displayHeight = this.canvas.offsetHeight || height;

    const pixelRatio = window.devicePixelRatio || 1;
    const renderWidth = Math.max(1, Math.round(displayWidth * pixelRatio));
    const renderHeight = Math.max(1, Math.round(displayHeight * pixelRatio));

    // Set internal resolution (for rendering) - this determines the actual pixel resolution
    // Don't set inline styles - let CSS handle display size (width/height: 100%)
    const needsResize =
      this.canvas.width !== renderWidth || this.canvas.height !== renderHeight;

    if (needsResize) {
      this.canvas.width = renderWidth;
      this.canvas.height = renderHeight;

      // Update framebuffer size to match (or create if it doesn't exist)
      if (this.framebuffer && this.renderTexture) {
        // Recreate texture with new size
        this.gl.deleteTexture(this.renderTexture);
        this.gl.deleteFramebuffer(this.framebuffer);
      }

      // Create or recreate framebuffer with correct size
      this.renderTexture = this.gl.createTexture();
      if (!this.renderTexture) {
        throw new Error("Failed to create render texture");
      }

      this.gl.bindTexture(this.gl.TEXTURE_2D, this.renderTexture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        renderWidth,
        renderHeight,
        0,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        null
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MIN_FILTER,
        this.gl.LINEAR
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_MAG_FILTER,
        this.gl.LINEAR
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_S,
        this.gl.CLAMP_TO_EDGE
      );
      this.gl.texParameteri(
        this.gl.TEXTURE_2D,
        this.gl.TEXTURE_WRAP_T,
        this.gl.CLAMP_TO_EDGE
      );

      this.framebuffer = this.gl.createFramebuffer();
      if (!this.framebuffer) {
        this.gl.deleteTexture(this.renderTexture);
        throw new Error("Failed to create framebuffer");
      }

      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
      this.gl.framebufferTexture2D(
        this.gl.FRAMEBUFFER,
        this.gl.COLOR_ATTACHMENT0,
        this.gl.TEXTURE_2D,
        this.renderTexture,
        0
      );

      // Verify framebuffer is complete
      const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
      if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
        this.gl.deleteTexture(this.renderTexture);
        this.gl.deleteFramebuffer(this.framebuffer);
        this.renderTexture = null;
        this.framebuffer = null;
        throw new Error(`Framebuffer incomplete after resize: ${status}`);
      }

      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Get the canvas element (useful when using context pool)
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Render a single frame (called by centralized render coordinator)
   * This method is called once per frame by the shared context's render loop
   */
  renderFrame(): void {
    if (!this.program || !this.framebuffer) return;

    // Check if context was lost - unregister from coordinator if so
    if (this.gl.isContextLost()) {
      this.stop();
      return;
    }

    // Ensure canvas has valid dimensions
    if (this.canvas.width <= 0 || this.canvas.height <= 0) {
      return;
    }

    // IMPORTANT: With shared context, we must set up ALL state before rendering
    // to avoid interfering with other shaders' rendering. Order matters:
    // 1. Bind framebuffer first (isolates rendering target)
    // 2. Set viewport (scoped to our framebuffer)
    // 3. Use program (sets shader state)
    // 4. Apply uniforms (sets shader parameters)
    // 5. Draw

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Clear the framebuffer before rendering (important for proper output)
    this.gl.clearColor(0, 0, 0, 0); // Clear to transparent black
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Use program BEFORE applying uniforms (ensures uniforms go to correct program)
    this.gl.useProgram(this.program);

    // Apply uniforms (now that program is bound)
    this.applyUniforms();

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Check for errors after draw
    const drawError = this.gl.getError();
    if (drawError !== this.gl.NO_ERROR) {
      console.warn(`WebGL error after drawArrays: ${drawError}`);
    }

    // Copy rendered result to display canvas (framebuffer is still bound)
    this.copyToDisplay();

    // Unbind framebuffer after copying to avoid interfering with other shaders
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  private copyToDisplay(): void {
    if (!this.framebuffer || !this.displayCtx) return;

    // Ensure framebuffer is bound before reading
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);

    // Check for WebGL errors before reading
    const error = this.gl.getError();
    if (error !== this.gl.NO_ERROR) {
      console.warn(`WebGL error before readPixels: ${error}`);
    }

    // Read pixels from framebuffer
    const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
    this.gl.readPixels(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      pixels
    );

    // Check for errors after reading
    const readError = this.gl.getError();
    if (readError !== this.gl.NO_ERROR) {
      console.warn(`WebGL error after readPixels: ${readError}`);
      return;
    }

    // Copy to display canvas using cached 2D context
    const displayCtx = this.displayCtx;

    // Create ImageData
    const imageData = displayCtx.createImageData(
      this.canvas.width,
      this.canvas.height
    );

    // Flip vertically (WebGL origin is bottom-left, canvas 2D is top-left)
    const flipped = new Uint8ClampedArray(imageData.data.length);
    for (let y = 0; y < this.canvas.height; y++) {
      const srcRow = this.canvas.height - 1 - y;
      flipped.set(
        pixels.subarray(
          srcRow * this.canvas.width * 4,
          (srcRow + 1) * this.canvas.width * 4
        ),
        y * this.canvas.width * 4
      );
    }
    imageData.data.set(flipped);

    // Clear and draw to display canvas
    // Important: canvas.width/height determines the 2D context resolution
    // We've already set canvas.width/height to match the render resolution
    // So ImageData matches canvas internal resolution perfectly
    // CSS will scale the display automatically
    displayCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    displayCtx.putImageData(imageData, 0, 0);
  }

  start() {
    this.startTime = Date.now();
    // Register with centralized render coordinator
    // The coordinator will call renderFrame() each frame
    sharedContext.registerRenderer(this.renderFrameCallback);
  }

  stop() {
    // Unregister from centralized render coordinator
    sharedContext.unregisterRenderer(this.renderFrameCallback);
  }

  private setTextureUniform(
    uniformName: string,
    image: HTMLImageElement
  ): void {
    if (this.gl.isContextLost()) {
      return;
    }

    if (
      !image.complete ||
      image.naturalWidth === 0 ||
      image.naturalHeight === 0
    ) {
      console.warn(
        `ShaderRenderer: image for uniform ${uniformName} is not fully loaded`
      );
      return;
    }

    // IMPORTANT: With shared context, ensure program is bound before setting texture uniforms
    // This ensures uniforms are set on the correct program
    if (!this.program) return;
    this.gl.useProgram(this.program);

    // Check for WebGL errors before starting
    const preError = this.gl.getError();
    if (
      preError !== this.gl.NO_ERROR &&
      preError !== this.gl.CONTEXT_LOST_WEBGL
    ) {
      console.warn(
        `ShaderRenderer: WebGL error before texture upload for ${uniformName}:`,
        preError
      );
    }

    // Clean up existing texture if present
    const existingTexture = this.textures.get(uniformName);
    if (existingTexture) {
      this.gl.deleteTexture(existingTexture);
      this.textures.delete(uniformName);
    }

    // Get or assign texture unit
    if (!this.textureUnitMap.has(uniformName)) {
      // Check if we've exceeded max texture units (typically 16)
      if (this.nextTextureUnit >= 16) {
        console.error(
          `ShaderRenderer: exceeded maximum texture units (16) for ${uniformName}`
        );
        return;
      }
      this.textureUnitMap.set(uniformName, this.nextTextureUnit);
      this.nextTextureUnit++;
    }
    const textureUnit = this.textureUnitMap.get(uniformName)!;

    // Activate correct texture unit before creating the texture
    // NOTE: Texture units are global state in shared context, but each shader uses
    // its own texture unit assignments, so conflicts are avoided as long as we
    // don't exceed 16 total texture units across all shaders
    this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);

    // Create and set up the new texture
    const texture = this.gl.createTexture();
    if (!texture) {
      console.error(
        `ShaderRenderer: failed to create texture for ${uniformName}`
      );
      return;
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Set texture parameters
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );

    // Upload image to texture - ensure we're using the correct format
    try {
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        image
      );
    } catch (error) {
      console.error(
        `ShaderRenderer: exception uploading texture ${uniformName}:`,
        error
      );
      this.gl.deleteTexture(texture);
      return;
    }

    // Store texture for cleanup
    this.textures.set(uniformName, texture);

    // Set the sampler uniform to the texture unit
    const loc = this.uniformLocations.get(uniformName);
    if (loc !== null && loc !== undefined) {
      this.gl.uniform1i(loc, textureUnit);
    }

    // Set aspect ratio uniform if it exists
    const aspectRatioKey = `${uniformName}AspectRatio`;
    const aspectRatioLoc = this.uniformLocations.get(aspectRatioKey);
    if (aspectRatioLoc !== null && aspectRatioLoc !== undefined) {
      const aspectRatio = image.naturalWidth / image.naturalHeight;
      this.gl.uniform1f(aspectRatioLoc, aspectRatio);
    }

    // Check for errors after texture operations
    const error = this.gl.getError();
    if (error !== this.gl.NO_ERROR && error !== this.gl.CONTEXT_LOST_WEBGL) {
      console.error(
        `ShaderRenderer: WebGL error when uploading texture ${uniformName}:`,
        error
      );
    }
  }

  dispose() {
    this.stop();

    // Check if context was lost - if so, just clear references
    if (this.gl.isContextLost()) {
      this.program = null;
      this.textures.clear();
      this.textureUnitMap.clear();
      this.uniformLocations.clear();
      this.uniformTypes.clear();
      this.framebuffer = null;
      this.renderTexture = null;
      return;
    }

    // Clean up render target (framebuffer and texture)
    if (this.renderTexture) {
      this.gl.deleteTexture(this.renderTexture);
      this.renderTexture = null;
    }
    if (this.framebuffer) {
      this.gl.deleteFramebuffer(this.framebuffer);
      this.framebuffer = null;
    }

    // Clean up textures and unbind them
    this.textures.forEach((texture, uniformName) => {
      const textureUnit = this.textureUnitMap.get(uniformName);
      if (textureUnit !== undefined) {
        this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
      }
      this.gl.deleteTexture(texture);
    });
    this.textures.clear();
    this.textureUnitMap.clear();
    this.nextTextureUnit = 0;

    if (this.program) {
      // Unbind program first
      this.gl.useProgram(null);

      // Get attached shaders and detach them before deleting program
      const attachedShaders = this.gl.getAttachedShaders(this.program);
      if (attachedShaders) {
        attachedShaders.forEach((shader) => {
          this.gl.detachShader(this.program!, shader);
          this.gl.deleteShader(shader);
        });
      }
      this.gl.deleteProgram(this.program);
      this.program = null;
    }

    // Clean up position buffer
    if (this.positionBuffer) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
      this.gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }

    // Unbind everything
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    // Clear uniform locations and types
    this.uniformLocations.clear();
    this.uniformTypes.clear();

    // Clear any errors
    this.gl.getError();
  }
}
