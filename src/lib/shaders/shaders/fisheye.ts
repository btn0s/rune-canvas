import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";

// Fisheye shader - strong lens distortion
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_strength;
uniform vec2 u_center;

in vec2 v_imageUV;
out vec4 fragColor;

void main() {
    vec2 uv = v_imageUV;
    
    // Center coordinates
    vec2 center = u_center;
    vec2 coord = uv - center;
    
    // Normalize coordinates
    float dist = length(coord);
    
    // Apply fisheye distortion
    float strength = u_strength;
    float r = dist;
    
    // Fisheye formula: r' = r * (1 + k * r^2)
    // where k controls the strength
    float k = strength * 2.0;
    float r2 = r * r;
    float rDistorted = r * (1.0 + k * r2);
    
    // Normalize back
    vec2 distortedCoord = normalize(coord) * rDistorted;
    vec2 distortedUV = distortedCoord + center;
    
    // Sample with bounds checking
    if (distortedUV.x < 0.0 || distortedUV.x > 1.0 || 
        distortedUV.y < 0.0 || distortedUV.y > 1.0) {
        // Sample edge color for out-of-bounds
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        fragColor = texture(u_image, distortedUV);
    }
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const image = params.image as HTMLImageElement | string | undefined;
  let imageAspectRatio = 1;
  if (image instanceof HTMLImageElement) {
    imageAspectRatio = image.naturalWidth / image.naturalHeight;
  }

  const center = Array.isArray(params.center) && params.center.length === 2
    ? [params.center[0] as number, params.center[1] as number]
    : [0.5, 0.5];

  return {
    u_image: image,
    u_imageAspectRatio: imageAspectRatio,
    u_strength: (params.strength as number) ?? 0.5,
    u_center: center,
  };
}

export const fisheyeShader: ShaderDefinition = {
  id: "fisheye",
  name: "Fisheye",
  description: "Strong lens distortion",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    strength: 0.5,
    center: [0.5, 0.5],
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
        max: 1,
        step: 0.01,
        label: "Strength",
      },
      defaultValue: 0.5,
    },
    center: {
      control: {
        type: "number",
        label: "Center",
      },
      defaultValue: [0.5, 0.5],
      hidden: true,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.5,
        center: [0.5, 0.5],
      },
    },
    {
      name: "Subtle",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.3,
        center: [0.5, 0.5],
      },
    },
    {
      name: "Strong",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.7,
        center: [0.5, 0.5],
      },
    },
    {
      name: "Extreme",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 1.0,
        center: [0.5, 0.5],
      },
    },
  ],
  paramsToUniforms,
};
