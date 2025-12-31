import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";

// Bloom shader - adds glow to highlights
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_threshold;
uniform float u_intensity;
uniform float u_radius;

in vec2 v_imageUV;
out vec4 fragColor;

void main() {
    vec2 uv = v_imageUV;
    vec2 texelSize = 1.0 / u_resolution;
    
    vec4 originalColor = texture(u_image, uv);
    
    // Calculate luminance
    float luminance = dot(originalColor.rgb, vec3(0.299, 0.587, 0.114));
    
    // Extract bright areas
    float bright = max(0.0, luminance - u_threshold);
    bright = smoothstep(0.0, 0.1, bright);
    
    vec4 brightColor = originalColor * bright;
    
    // Blur the bright areas (simple box blur)
    vec4 blurColor = vec4(0.0);
    float totalWeight = 0.0;
    
    int radius = int(u_radius * u_pixelRatio);
    for (int y = -radius; y <= radius; y++) {
        for (int x = -radius; x <= radius; x++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            float dist = length(vec2(x, y));
            
            if (dist <= float(radius)) {
                vec4 sampleColor = texture(u_image, uv + offset);
                float sampleLum = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));
                float sampleBright = max(0.0, sampleLum - u_threshold);
                sampleBright = smoothstep(0.0, 0.1, sampleBright);
                
                float weight = 1.0 - (dist / float(radius));
                blurColor += sampleColor * sampleBright * weight;
                totalWeight += weight;
            }
        }
    }
    
    if (totalWeight > 0.0) {
        blurColor /= totalWeight;
    }
    
    // Combine original with bloom
    vec4 result = originalColor + blurColor * u_intensity;
    
    fragColor = vec4(result.rgb, originalColor.a);
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
    u_threshold: (params.threshold as number) ?? 0.7,
    u_intensity: (params.intensity as number) ?? 0.5,
    u_radius: (params.radius as number) ?? 5.0,
  };
}

export const bloomShader: ShaderDefinition = {
  id: "bloom",
  name: "Bloom",
  description: "Adds glow to highlights",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    threshold: 0.7,
    intensity: 0.5,
    radius: 5.0,
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
      defaultValue: 0.7,
    },
    intensity: {
      control: {
        type: "slider",
        min: 0,
        max: 2,
        step: 0.05,
        label: "Intensity",
      },
      defaultValue: 0.5,
    },
    radius: {
      control: {
        type: "slider",
        min: 1,
        max: 20,
        step: 1,
        label: "Radius",
      },
      defaultValue: 5.0,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        threshold: 0.7,
        intensity: 0.5,
        radius: 5.0,
      },
    },
    {
      name: "Subtle",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        threshold: 0.8,
        intensity: 0.3,
        radius: 3.0,
      },
    },
    {
      name: "Strong",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        threshold: 0.6,
        intensity: 1.0,
        radius: 8.0,
      },
    },
    {
      name: "Glowing",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        threshold: 0.5,
        intensity: 1.5,
        radius: 12.0,
      },
    },
  ],
  paramsToUniforms,
};
