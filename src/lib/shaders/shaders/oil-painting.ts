import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";

// Oil Painting shader - distinctive painterly look
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_radius;
uniform float u_intensity;

in vec2 v_imageUV;
out vec4 fragColor;

void main() {
    vec2 uv = v_imageUV;
    vec2 texelSize = 1.0 / u_resolution;
    
    float radius = u_radius * u_pixelRatio;
    float intensity = u_intensity;
    
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;
    
    // Sample neighboring pixels in a circular pattern
    int samples = int(radius * 2.0);
    for (int y = -samples; y <= samples; y++) {
        for (int x = -samples; x <= samples; x++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            float dist = length(vec2(x, y));
            
            if (dist <= radius) {
                vec4 sampleColor = texture(u_image, uv + offset);
                
                // Calculate weight based on distance and color similarity
                float weight = 1.0 - (dist / radius);
                weight = pow(weight, intensity);
                
                // Color similarity factor
                vec4 centerColor = texture(u_image, uv);
                float colorDiff = length(sampleColor.rgb - centerColor.rgb);
                float similarity = 1.0 - smoothstep(0.0, 0.3, colorDiff);
                
                weight *= similarity;
                
                color += sampleColor * weight;
                totalWeight += weight;
            }
        }
    }
    
    if (totalWeight > 0.0) {
        color /= totalWeight;
    } else {
        color = texture(u_image, uv);
    }
    
    fragColor = color;
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
    u_radius: (params.radius as number) ?? 3.0,
    u_intensity: (params.intensity as number) ?? 2.0,
  };
}

export const oilPaintingShader: ShaderDefinition = {
  id: "oil-painting",
  name: "Oil Painting",
  description: "Distinctive painterly look",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    radius: 3.0,
    intensity: 2.0,
  },
  paramDefinitions: {
    image: {
      control: { type: "imageUrl", label: "Image" },
      defaultValue: "",
      stickyOnPresetApply: true,
    },
    radius: {
      control: {
        type: "slider",
        min: 1,
        max: 10,
        step: 0.5,
        label: "Brush Size",
      },
      defaultValue: 3.0,
    },
    intensity: {
      control: {
        type: "slider",
        min: 1,
        max: 5,
        step: 0.1,
        label: "Intensity",
      },
      defaultValue: 2.0,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        radius: 3.0,
        intensity: 2.0,
      },
    },
    {
      name: "Subtle",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        radius: 2.0,
        intensity: 1.5,
      },
    },
    {
      name: "Strong",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        radius: 5.0,
        intensity: 3.0,
      },
    },
    {
      name: "Heavy",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        radius: 8.0,
        intensity: 4.0,
      },
    },
  ],
  paramsToUniforms,
};
