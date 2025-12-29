import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";

// Radial Blur shader - blur radiating from center
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_strength;
uniform vec2 u_center;
uniform int u_samples;

in vec2 v_imageUV;
out vec4 fragColor;

void main() {
    vec2 uv = v_imageUV;
    vec2 center = u_center;
    
    // Direction from center
    vec2 dir = uv - center;
    float dist = length(dir);
    
    // Normalize direction
    if (dist > 0.0) {
        dir /= dist;
    } else {
        // At center, sample directly
        fragColor = texture(u_image, uv);
        return;
    }
    
    // Accumulate samples along the radial direction
    vec4 color = vec4(0.0);
    int numSamples = min(u_samples, 16);
    float sampleCount = float(numSamples);
    
    // Sample along the radial direction (towards center)
    for (int i = 0; i < 16; i++) {
        if (i >= numSamples) break;
        
        float t = float(i) / max(sampleCount - 1.0, 1.0);
        // Offset towards center (negative direction)
        float offset = t * u_strength * dist;
        vec2 sampleUV = uv - dir * offset;
        
        // Clamp to valid UV range
        sampleUV = clamp(sampleUV, vec2(0.0), vec2(1.0));
        
        color += texture(u_image, sampleUV);
    }
    
    color /= sampleCount;
    fragColor = color;
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const image = params.image as HTMLImageElement | string | undefined;
  let imageAspectRatio = 1;
  if (image instanceof HTMLImageElement) {
    imageAspectRatio = image.naturalWidth / image.naturalHeight;
  }

  const center = params.center as [number, number] | undefined;
  const centerX = center ? center[0] : 0.5;
  const centerY = center ? center[1] : 0.5;

  return {
    u_image: image,
    u_imageAspectRatio: imageAspectRatio,
    u_strength: (params.strength as number) ?? 0.1,
    u_center: [centerX, centerY],
    u_samples: Math.round((params.samples as number) ?? 8),
  };
}

export const radialBlurShader: ShaderDefinition = {
  id: "radial-blur",
  name: "Radial Blur",
  description: "Blur radiating from center point",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    strength: 0.08,
    center: [0.5, 0.5],
    samples: 10,
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
        max: 0.5,
        step: 0.01,
      },
      defaultValue: 0.08,
    },
    samples: {
      control: {
        type: "slider",
        min: 2,
        max: 16,
        step: 1,
      },
      defaultValue: 10,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.1,
        center: [0.5, 0.5],
        samples: 8,
      },
    },
    {
      name: "Strong",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.2,
        center: [0.5, 0.5],
        samples: 12,
      },
    },
    {
      name: "Subtle",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.05,
        center: [0.5, 0.5],
        samples: 6,
      },
    },
    {
      name: "Top Center",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        strength: 0.15,
        center: [0.5, 0.3],
        samples: 10,
      },
    },
  ],
  paramsToUniforms,
};
