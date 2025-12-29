/**
 * Shader Registry
 *
 * Central registry of all available shaders
 */

import type { ShaderDefinition } from "./types";
import { meshGradientShader } from "./shaders/mesh-gradient";
import { neuroNoiseShader } from "./shaders/neuro-noise";
import { simplexNoiseShader } from "./shaders/simplex-noise";
import { metaballsShader } from "./shaders/metaballs";

export const SHADER_REGISTRY: Map<string, ShaderDefinition> = new Map([
  [meshGradientShader.id, meshGradientShader],
  [neuroNoiseShader.id, neuroNoiseShader],
  [simplexNoiseShader.id, simplexNoiseShader],
  [metaballsShader.id, metaballsShader],
]);

export function getShader(id: string): ShaderDefinition | undefined {
  return SHADER_REGISTRY.get(id);
}

export function getAllShaders(): ShaderDefinition[] {
  return Array.from(SHADER_REGISTRY.values());
}
