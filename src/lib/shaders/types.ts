/**
 * Shader Library Types
 *
 * Types for defining and working with WebGL 2.0 shaders
 */

export interface ShaderUniforms {
  [key: string]: number | number[] | HTMLImageElement | string | boolean | undefined;
}

export interface ShaderParams {
  [key: string]: unknown;
}

export interface ShaderPreset {
  name: string;
  params: ShaderParams;
}

/**
 * Parameter control metadata for UI generation
 */
export type ParamControlType =
  | "color"
  | "colorArray"
  | "slider"
  | "enum"
  | "imageUrl"
  | "number"
  | "boolean";

export interface ColorParamControl {
  type: "color";
  label?: string;
}

export interface ColorArrayParamControl {
  type: "colorArray";
  label?: string;
}

export interface SliderParamControl {
  type: "slider";
  min: number;
  max: number;
  step?: number;
  showAsPercentage?: boolean;
  label?: string;
}

export interface EnumParamControl {
  type: "enum";
  options: string[];
  label?: string;
}

export interface ImageUrlParamControl {
  type: "imageUrl";
  label?: string;
}

export interface NumberParamControl {
  type: "number";
  label?: string;
}

export interface BooleanParamControl {
  type: "boolean";
  label?: string;
}

export type ParamControl =
  | ColorParamControl
  | ColorArrayParamControl
  | SliderParamControl
  | EnumParamControl
  | ImageUrlParamControl
  | NumberParamControl
  | BooleanParamControl;

/**
 * Parameter definition with control metadata
 */
export interface ParamDefinition {
  control: ParamControl;
  defaultValue: unknown;
}

/**
 * Map of parameter names to their definitions
 */
export interface ParamDefinitions {
  [key: string]: ParamDefinition;
}

export type ShaderCategory = "Image filters" | "Logo animations" | "Effects";

export interface ShaderDefinition {
  /** Unique identifier for this shader */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Category for grouping in the picker */
  category: ShaderCategory;
  /** Fragment shader source code (GLSL) */
  fragmentShader: string;
  /** Default parameters */
  defaultParams: ShaderParams;
  /** Parameter control definitions for UI generation (optional - falls back to heuristics) */
  paramDefinitions?: ParamDefinitions;
  /** Preset configurations */
  presets: ShaderPreset[];
  /** Function to convert params to uniforms */
  paramsToUniforms: (params: ShaderParams) => ShaderUniforms;
}

/**
 * Helper to convert hex color string to vec4 RGBA array
 */
export function colorToVec4(color: string): [number, number, number, number] {
  // Remove # if present
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
  return [r, g, b, a];
}
