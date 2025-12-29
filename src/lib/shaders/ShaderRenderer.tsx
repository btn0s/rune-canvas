/**
 * React component wrapper for ShaderRenderer
 */

import { useEffect, useRef, useState } from "react";
import { ShaderRenderer } from "./renderer";
import type { ShaderRendererUniforms } from "./renderer";
import type { ShaderDefinition } from "./types";

export interface ShaderRendererProps {
  shader: ShaderDefinition;
  params: Record<string, unknown>;
  width: number;
  height: number;
  speed?: number;
  targetFps?: number;
  paused?: boolean;
}

/**
 * Load an image from a URL string
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Handle CORS for external URLs
    const isExternalUrl = (url: string): boolean => {
      try {
        if (url.startsWith('/')) return false;
        const urlObject = new URL(url, window.location.origin);
        return urlObject.origin !== window.location.origin;
      } catch {
        return false;
      }
    };
    
    if (isExternalUrl(url)) {
      img.crossOrigin = 'anonymous';
    }
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from ${url}`));
    img.src = url;
  });
}

/**
 * Process uniforms, converting string URLs to loaded images
 */
async function processUniforms(uniforms: ShaderRendererUniforms): Promise<ShaderRendererUniforms> {
  const processed: ShaderRendererUniforms = {};
  const imageLoadPromises: Promise<void>[] = [];

  const isValidUrl = (url: string): boolean => {
    try {
      if (url.startsWith('/')) return true;
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  for (const [key, value] of Object.entries(uniforms)) {
    if (typeof value === 'string' && value.trim() !== '') {
      // Check if this uniform name suggests it's an image (e.g., u_image, u_noiseTexture)
      if (key.includes('image') || key.includes('texture') || key.includes('Image') || key.includes('Texture')) {
        if (isValidUrl(value)) {
          const imagePromise = loadImage(value).then((img) => {
            processed[key] = img;
          }).catch((error) => {
            console.warn(`Failed to load image for uniform ${key}:`, error);
            // Use empty pixel as fallback
            processed[key] = undefined;
          });
          imageLoadPromises.push(imagePromise);
        } else {
          console.warn(`Invalid URL for uniform ${key}: ${value}`);
          processed[key] = undefined;
        }
      } else {
        // Not an image uniform, keep as string
        processed[key] = value;
      }
    } else {
      processed[key] = value;
    }
  }

  await Promise.all(imageLoadPromises);
  return processed;
}

export function ShaderRendererComponent({
  shader,
  params,
  width,
  height,
  speed = 1,
  targetFps,
  paused = false,
}: ShaderRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ShaderRenderer | null>(null);
  const [loadedUniforms, setLoadedUniforms] = useState<ShaderRendererUniforms | null>(null);

  // Load images from URLs
  useEffect(() => {
    const uniforms = shader.paramsToUniforms(params) as ShaderRendererUniforms;
    
    // Force background color to transparent - fills handle the background
    if (uniforms.u_colorBack) {
      uniforms.u_colorBack = [0, 0, 0, 0]; // Transparent RGBA
    }

    processUniforms(uniforms).then((processed) => {
      setLoadedUniforms(processed);
    });
  }, [shader, params]);

  useEffect(() => {
    if (!canvasRef.current || !loadedUniforms) return;

    // If renderer exists and only uniforms changed, update uniforms instead of recreating
    if (rendererRef.current && rendererRef.current.getShaderSource() === shader.fragmentShader) {
      rendererRef.current.setUniforms(loadedUniforms);
      rendererRef.current.setSpeed(speed);
      if (targetFps !== undefined) {
        rendererRef.current.setTargetFps(targetFps);
      }
      rendererRef.current.setPaused(paused);
      return;
    }

    // Dispose previous renderer before creating a new one (only if shader changed)
    const previousRenderer = rendererRef.current;
    if (previousRenderer) {
      previousRenderer.dispose();
      rendererRef.current = null;
    }

    try {
      // Use shared WebGL context - all shaders use the same context!
      const renderer = new ShaderRenderer(
        canvasRef.current, // Display canvas (uses 2D context for final output)
        shader.fragmentShader,
        loadedUniforms,
        speed
      );
      
      renderer.resize(width, height);
      if (targetFps !== undefined) {
        renderer.setTargetFps(targetFps);
      }
      renderer.setPaused(paused);
      rendererRef.current = renderer;

      return () => {
        // Only dispose if this is the current renderer (component unmounting)
        // Don't dispose if renderer was already replaced by a new one
        if (rendererRef.current === renderer) {
          rendererRef.current = null;
          renderer.dispose();
        }
      };
    } catch (error) {
      console.error("Failed to initialize shader renderer:", error);
    }
  }, [shader, loadedUniforms, speed]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.resize(width, height);
    }
  }, [width, height]);

  useEffect(() => {
    if (rendererRef.current && loadedUniforms) {
      rendererRef.current.setUniforms(loadedUniforms);
    }
  }, [shader, loadedUniforms]);

  // Update targetFps when it changes
  useEffect(() => {
    if (rendererRef.current && targetFps !== undefined) {
      rendererRef.current.setTargetFps(targetFps);
    }
  }, [targetFps]);

  // Update paused state when it changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setPaused(paused);
    }
  }, [paused]);

  // IntersectionObserver: auto-pause when offscreen
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (rendererRef.current) {
          // Only auto-pause if not explicitly paused by prop
          // If explicitly paused, don't override
          if (!paused) {
            rendererRef.current.setPaused(!entry.isIntersecting);
          }
        }
      },
      { threshold: 0 }
    );

    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, [paused]);

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
