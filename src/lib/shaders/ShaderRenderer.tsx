/**
 * React component wrapper for ShaderRenderer
 */

import { useEffect, useRef } from "react";
import { ShaderRenderer } from "./renderer";
import type { ShaderRendererUniforms } from "./renderer";
import type { ShaderDefinition } from "./types";

export interface ShaderRendererProps {
  shader: ShaderDefinition;
  params: Record<string, unknown>;
  width: number;
  height: number;
  speed?: number;
}

export function ShaderRendererComponent({
  shader,
  params,
  width,
  height,
  speed = 1,
}: ShaderRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ShaderRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const uniforms = shader.paramsToUniforms(params) as ShaderRendererUniforms;

    try {
      const renderer = new ShaderRenderer(
        canvasRef.current,
        shader.fragmentShader,
        uniforms,
        speed
      );
      renderer.resize(width, height);
      rendererRef.current = renderer;

      return () => {
        renderer.dispose();
        rendererRef.current = null;
      };
    } catch (error) {
      console.error("Failed to initialize shader renderer:", error);
    }
  }, [shader, params, speed]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.resize(width, height);
    }
  }, [width, height]);

  useEffect(() => {
    if (rendererRef.current) {
      const uniforms = shader.paramsToUniforms(params) as ShaderRendererUniforms;
      rendererRef.current.setUniforms(uniforms);
    }
  }, [shader, params]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
      }}
    />
  );
}
