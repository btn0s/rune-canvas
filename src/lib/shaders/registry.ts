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
import { kaleidoscopeShader } from "./shaders/kaleidoscope";
import { chromaticAberrationShader } from "./shaders/chromatic-aberration";
import { rippleShader } from "./shaders/ripple";
import { pixelateShader } from "./shaders/pixelate";
import { radialBlurShader } from "./shaders/radial-blur";
import { vhsShader } from "./shaders/vhs";
import { fractalTunnelShader } from "./shaders/fractal-tunnel";
import { fractalKaleidoscopeShader } from "./shaders/fractal-kaleidoscope";
import { bloomShader } from "./shaders/bloom";
import { edgeDetectionShader } from "./shaders/edge-detection";
import { tiltShiftShader } from "./shaders/tilt-shift";
import { fisheyeShader } from "./shaders/fisheye";

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
  [kaleidoscopeShader.id, kaleidoscopeShader],
  [chromaticAberrationShader.id, chromaticAberrationShader],
  [rippleShader.id, rippleShader],
  [pixelateShader.id, pixelateShader],
  [radialBlurShader.id, radialBlurShader],
  [vhsShader.id, vhsShader],
  [fractalTunnelShader.id, fractalTunnelShader],
  [fractalKaleidoscopeShader.id, fractalKaleidoscopeShader],
  [bloomShader.id, bloomShader],
  [edgeDetectionShader.id, edgeDetectionShader],
  [tiltShiftShader.id, tiltShiftShader],
  [fisheyeShader.id, fisheyeShader],
]);

export function getShader(id: string): ShaderDefinition | undefined {
  return SHADER_REGISTRY.get(id);
}

export function getAllShaders(): ShaderDefinition[] {
  return Array.from(SHADER_REGISTRY.values());
}
