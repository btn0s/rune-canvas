import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";

// Tilt Shift shader - popular miniature effect
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_position;
uniform float u_blurSize;
uniform float u_blurAmount;
uniform float u_saturation;

in vec2 v_imageUV;
out vec4 fragColor;

void main() {
    vec2 uv = v_imageUV;
    
    // Calculate distance from focus line
    float focusPos = u_position;
    float dist = abs(uv.y - focusPos);
    
    // Create blur mask (sharp in middle, blurred at edges)
    float blurMask = smoothstep(0.0, u_blurSize, dist);
    
    // Apply blur based on distance
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;
    
    int radius = int(u_blurAmount * blurMask * u_pixelRatio);
    radius = max(1, radius);
    
    vec2 texelSize = 1.0 / u_resolution;
    
    for (int y = -radius; y <= radius; y++) {
        for (int x = -radius; x <= radius; x++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            float sampleDist = length(vec2(x, y));
            
            if (sampleDist <= float(radius)) {
                float weight = 1.0 - (sampleDist / float(radius));
                color += texture(u_image, uv + offset) * weight;
                totalWeight += weight;
            }
        }
    }
    
    if (totalWeight > 0.0) {
        color /= totalWeight;
    } else {
        color = texture(u_image, uv);
    }
    
    // Enhance saturation for miniature effect
    float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 saturated = mix(vec3(luminance), color.rgb, u_saturation);
    
    fragColor = vec4(saturated, color.a);
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
    u_position: (params.position as number) ?? 0.5,
    u_blurSize: (params.blurSize as number) ?? 0.3,
    u_blurAmount: (params.blurAmount as number) ?? 10.0,
    u_saturation: (params.saturation as number) ?? 1.2,
  };
}

export const tiltShiftShader: ShaderDefinition = {
  id: "tilt-shift",
  name: "Tilt Shift",
  description: "Popular miniature effect",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    position: 0.5,
    blurSize: 0.3,
    blurAmount: 10.0,
    saturation: 1.2,
  },
  paramDefinitions: {
    image: {
      control: { type: "imageUrl", label: "Image" },
      defaultValue: "",
      stickyOnPresetApply: true,
    },
    position: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
        label: "Focus Position",
      },
      defaultValue: 0.5,
    },
    blurSize: {
      control: {
        type: "slider",
        min: 0.1,
        max: 0.8,
        step: 0.01,
        label: "Blur Size",
      },
      defaultValue: 0.3,
    },
    blurAmount: {
      control: {
        type: "slider",
        min: 1,
        max: 30,
        step: 1,
        label: "Blur Amount",
      },
      defaultValue: 10.0,
    },
    saturation: {
      control: {
        type: "slider",
        min: 0,
        max: 2,
        step: 0.1,
        label: "Saturation",
      },
      defaultValue: 1.2,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        position: 0.5,
        blurSize: 0.3,
        blurAmount: 10.0,
        saturation: 1.2,
      },
    },
    {
      name: "Top Focus",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        position: 0.3,
        blurSize: 0.25,
        blurAmount: 15.0,
        saturation: 1.3,
      },
    },
    {
      name: "Bottom Focus",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        position: 0.7,
        blurSize: 0.25,
        blurAmount: 15.0,
        saturation: 1.3,
      },
    },
    {
      name: "Strong",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        position: 0.5,
        blurSize: 0.2,
        blurAmount: 20.0,
        saturation: 1.5,
      },
    },
  ],
  paramsToUniforms,
};
