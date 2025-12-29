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
import { ditheringShader } from "./shaders/dithering";
import { dotGridShader } from "./shaders/dot-grid";
import { spiralShader } from "./shaders/spiral";
import { waterShader } from "./shaders/water";
import { flutedGlassShader } from "./shaders/fluted-glass";
import { imageDitheringShader } from "./shaders/image-dithering";
import { bumpedSineWarpShader } from "./shaders/bumped-sine-warp";

export const SHADER_REGISTRY: Map<string, ShaderDefinition> = new Map([
  [meshGradientShader.id, meshGradientShader],
  [neuroNoiseShader.id, neuroNoiseShader],
  [simplexNoiseShader.id, simplexNoiseShader],
  [metaballsShader.id, metaballsShader],
  [ditheringShader.id, ditheringShader],
  [dotGridShader.id, dotGridShader],
  [spiralShader.id, spiralShader],
  [waterShader.id, waterShader],
  [flutedGlassShader.id, flutedGlassShader],
  [imageDitheringShader.id, imageDitheringShader],
  [bumpedSineWarpShader.id, bumpedSineWarpShader],
]);

export function getShader(id: string): ShaderDefinition | undefined {
  return SHADER_REGISTRY.get(id);
}

export function getAllShaders(): ShaderDefinition[] {
  return Array.from(SHADER_REGISTRY.values());
}
