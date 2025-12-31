import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import { colorToVec4 } from "../types";

// Edge Detection shader - useful for outlines
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_threshold;
uniform float u_thickness;
uniform vec4 u_edgeColor;
uniform bool u_invert;

in vec2 v_imageUV;
out vec4 fragColor;

void main() {
    vec2 uv = v_imageUV;
    vec2 texelSize = 1.0 / u_resolution;
    
    // Sobel edge detection kernel
    float thickness = u_thickness * u_pixelRatio;
    vec2 offset = texelSize * thickness;
    
    // Sample surrounding pixels
    vec3 tl = texture(u_image, uv + vec2(-offset.x, -offset.y)).rgb;
    vec3 tm = texture(u_image, uv + vec2(0.0, -offset.y)).rgb;
    vec3 tr = texture(u_image, uv + vec2(offset.x, -offset.y)).rgb;
    vec3 ml = texture(u_image, uv + vec2(-offset.x, 0.0)).rgb;
    vec3 mm = texture(u_image, uv).rgb;
    vec3 mr = texture(u_image, uv + vec2(offset.x, 0.0)).rgb;
    vec3 bl = texture(u_image, uv + vec2(-offset.x, offset.y)).rgb;
    vec3 bm = texture(u_image, uv + vec2(0.0, offset.y)).rgb;
    vec3 br = texture(u_image, uv + vec2(offset.x, offset.y)).rgb;
    
    // Convert to grayscale
    float gtl = dot(tl, vec3(0.299, 0.587, 0.114));
    float gtm = dot(tm, vec3(0.299, 0.587, 0.114));
    float gtr = dot(tr, vec3(0.299, 0.587, 0.114));
    float gml = dot(ml, vec3(0.299, 0.587, 0.114));
    float gmm = dot(mm, vec3(0.299, 0.587, 0.114));
    float gmr = dot(mr, vec3(0.299, 0.587, 0.114));
    float gbl = dot(bl, vec3(0.299, 0.587, 0.114));
    float gbm = dot(bm, vec3(0.299, 0.587, 0.114));
    float gbr = dot(br, vec3(0.299, 0.587, 0.114));
    
    // Sobel operators
    float gx = -gtl + gtr - 2.0 * gml + 2.0 * gmr - gbl + gbr;
    float gy = -gtl - 2.0 * gtm - gtr + gbl + 2.0 * gbm + gbr;
    
    // Calculate edge magnitude
    float edge = sqrt(gx * gx + gy * gy);
    
    // Threshold and normalize
    edge = smoothstep(u_threshold, u_threshold + 0.1, edge);
    
    if (u_invert) {
        edge = 1.0 - edge;
    }
    
    // Mix original color with edge color
    vec4 originalColor = texture(u_image, uv);
    vec4 result = mix(originalColor, u_edgeColor, edge);
    
    fragColor = result;
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const image = params.image as HTMLImageElement | string | undefined;
  let imageAspectRatio = 1;
  if (image instanceof HTMLImageElement) {
    imageAspectRatio = image.naturalWidth / image.naturalHeight;
  }

  return {
    u_image: image,
    u_imageAspectRatio: imageAspectRatio,
    u_threshold: (params.threshold as number) ?? 0.1,
    u_thickness: (params.thickness as number) ?? 1.0,
    u_edgeColor: colorToVec4((params.edgeColor as string) || "#000000"),
    u_invert: (params.invert as boolean) ?? false,
  };
}

export const edgeDetectionShader: ShaderDefinition = {
  id: "edge-detection",
  name: "Edge Detection",
  description: "Useful for outlines",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    threshold: 0.1,
    thickness: 1.0,
    edgeColor: "#000000",
    invert: false,
  },
  paramDefinitions: {
    image: {
      control: { type: "imageUrl", label: "Image" },
      defaultValue: "",
      stickyOnPresetApply: true,
    },
    threshold: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
        label: "Threshold",
      },
      defaultValue: 0.1,
    },
    thickness: {
      control: {
        type: "slider",
        min: 0.5,
        max: 5,
        step: 0.1,
        label: "Thickness",
      },
      defaultValue: 1.0,
    },
    edgeColor: {
      control: { type: "color", label: "Edge Color" },
      defaultValue: "#000000",
    },
    invert: {
      control: {
        type: "boolean",
        label: "Invert",
      },
      defaultValue: false,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        threshold: 0.1,
        thickness: 1.0,
        edgeColor: "#000000",
        invert: false,
      },
    },
    {
      name: "Thin",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        threshold: 0.15,
        thickness: 0.5,
        edgeColor: "#000000",
        invert: false,
      },
    },
    {
      name: "Thick",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        threshold: 0.08,
        thickness: 2.0,
        edgeColor: "#000000",
        invert: false,
      },
    },
    {
      name: "Inverted",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        threshold: 0.1,
        thickness: 1.0,
        edgeColor: "#ffffff",
        invert: true,
      },
    },
  ],
  paramsToUniforms,
};
