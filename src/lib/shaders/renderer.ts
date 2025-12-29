/**
 * WebGL Shader Renderer
 *
 * Simplified WebGL 2.0 shader mount for rendering shaders on canvas
 */

// Vertex shader source - simple full-screen quad
// Outputs both v_objectUV and v_patternUV for compatibility
// v_objectUV is centered at origin (can go negative) to match Paper shader behavior
const vertexShaderSource = `#version 300 es
precision mediump float;

layout(location = 0) in vec4 a_position;

out vec2 v_objectUV;
out vec2 v_patternUV;

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
}
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
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
  [key: string]: number | number[] | HTMLImageElement | undefined;
}

export class ShaderRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private program: WebGLProgram | null = null;
  private uniformLocations: Map<string, WebGLUniformLocation | null> = new Map();
  private rafId: number | null = null;
  private startTime = Date.now();
  private speed = 1;
  private uniforms: ShaderRendererUniforms = {};
  private fragmentShaderSource: string;

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

    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("WebGL 2.0 is not supported");
    }
    this.gl = gl;

    this.init();
  }

  private init() {
    // Create program
    this.program = createProgram(this.gl, vertexShaderSource, this.fragmentShaderSource);
    if (!this.program) {
      throw new Error("Failed to create shader program");
    }

    // Setup position attribute
    const positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Get uniform locations
    this.updateUniformLocations();
    this.setUniforms(this.uniforms);

    // Start render loop
    this.start();
  }

  private updateUniformLocations() {
    this.uniformLocations.clear();
    this.uniformLocations.set("u_time", this.gl.getUniformLocation(this.program!, "u_time"));
    this.uniformLocations.set("u_resolution", this.gl.getUniformLocation(this.program!, "u_resolution"));
    this.uniformLocations.set("u_pixelRatio", this.gl.getUniformLocation(this.program!, "u_pixelRatio"));

    // Get locations for all provided uniforms
    Object.keys(this.uniforms).forEach((key) => {
      this.uniformLocations.set(key, this.gl.getUniformLocation(this.program!, key));
    });
  }

  setUniforms(uniforms: ShaderRendererUniforms) {
    this.uniforms = uniforms;
    this.updateUniformLocations();
    this.applyUniforms();
  }

  private applyUniforms() {
    if (!this.program) return;

    this.gl.useProgram(this.program);

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
        this.gl.uniform1f(loc, value);
      } else if (Array.isArray(value)) {
        if (value.length === 2) {
          this.gl.uniform2f(loc, value[0] as number, value[1] as number);
        } else if (value.length === 3) {
          this.gl.uniform3f(loc, value[0] as number, value[1] as number, value[2] as number);
        } else if (value.length === 4) {
          this.gl.uniform4f(loc, value[0] as number, value[1] as number, value[2] as number, value[3] as number);
        } else if (value.length > 4 && value.length % 4 === 0) {
          // Array of vec4s (for colors array)
          this.gl.uniform4fv(loc, new Float32Array(value as number[]));
        }
      } else if (value instanceof HTMLImageElement) {
        // Handle textures if needed
        // For now, skip texture uniforms
      }
    });
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  resize(width: number, height: number) {
    this.canvas.width = width * (window.devicePixelRatio || 1);
    this.canvas.height = height * (window.devicePixelRatio || 1);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private render() {
    if (!this.program) return;

    this.applyUniforms();

    this.gl.useProgram(this.program);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    this.rafId = requestAnimationFrame(() => this.render());
  }

  start() {
    if (this.rafId === null) {
      this.startTime = Date.now();
      this.render();
    }
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  dispose() {
    this.stop();
    if (this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }
  }
}
