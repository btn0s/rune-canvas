import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";

// Chromatic Aberration shader - RGB channel separation
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_strength;
uniform float u_angle;

in vec2 v_imageUV;
out vec4 fragColor;

#define PI 3.14159265358979323846

void main() {
    vec2 uv = v_imageUV;
    vec2 center = vec2(0.5);
    vec2 coord = uv - center;
    
    // Calculate distance from center
    float dist = length(coord);
    
    // Direction vector
    vec2 dir = normalize(coord);
    
    // Apply rotation
    float angle = u_angle * PI / 180.0;
    float cosA = cos(angle);
    float sinA = sin(angle);
    dir = vec2(
        dir.x * cosA - dir.y * sinA,
        dir.x * sinA + dir.y * cosA
    );
    
    // Offset each channel
    float offset = dist * u_strength;
    vec2 offsetR = dir * offset * 1.0;
    vec2 offsetG = dir * offset * 0.0;
    vec2 offsetB = dir * offset * -1.0;
    
    // Sample each channel separately
    float r = texture(u_image, uv + offsetR).r;
    float g = texture(u_image, uv + offsetG).g;
    float b = texture(u_image, uv + offsetB).b;
    float a = texture(u_image, uv).a;
    
    fragColor = vec4(r, g, b, a);
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
    u_strength: (params.strength as number) ?? 0.02,
    u_angle: (params.angle as number) ?? 0.0,
  };
}

export const chromaticAberrationShader: ShaderDefinition = {
  id: "chromatic-aberration",
  name: "Chromatic Aberration",
  description: "RGB channel separation effect",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    strength: 0.015,
    angle: 0,
  },
  paramDefinitions: {
    image: {
      control: { type: "imageUrl", label: "Image" },
      defaultValue: "",
      stickyOnPresetApply: true,
    },
    strength: {
      control: {
        type: "slider",
        min: 0,
        max: 0.1,
        step: 0.001,
      },
      defaultValue: 0.015,
    },
    angle: {
      control: {
        type: "slider",
        min: -180,
        max: 180,
        step: 1,
      },
      defaultValue: 0,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.02,
        angle: 0,
      },
    },
    {
      name: "Strong",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.05,
        angle: 0,
      },
    },
    {
      name: "Radial",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.03,
        angle: 0,
      },
    },
    {
      name: "Diagonal",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.03,
        angle: 45,
      },
    },
  ],
  paramsToUniforms,
};
