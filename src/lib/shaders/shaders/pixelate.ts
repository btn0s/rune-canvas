import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";

// Pixelate shader - pixelation effect
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_pixelSize;

in vec2 v_imageUV;
out vec4 fragColor;

void main() {
    vec2 uv = v_imageUV;
    
    // Calculate pixel size in UV space
    float pixelSizeUV = u_pixelSize * u_pixelRatio / min(u_resolution.x, u_resolution.y);
    
    // Quantize UV coordinates
    vec2 pixelatedUV = floor(uv / pixelSizeUV) * pixelSizeUV;
    
    // Sample center of pixel
    pixelatedUV += pixelSizeUV * 0.5;
    
    fragColor = texture(u_image, pixelatedUV);
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
    u_pixelSize: (params.pixelSize as number) ?? 4.0,
  };
}

export const pixelateShader: ShaderDefinition = {
  id: "pixelate",
  name: "Pixelate",
  description: "Pixelation effect",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    pixelSize: 6,
  },
  paramDefinitions: {
    image: {
      control: { type: "imageUrl", label: "Image" },
      defaultValue: "",
      stickyOnPresetApply: true,
    },
    pixelSize: {
      control: {
        type: "slider",
        min: 1,
        max: 50,
        step: 1,
      },
      defaultValue: 6,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        pixelSize: 4,
      },
    },
    {
      name: "Small",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        pixelSize: 2,
      },
    },
    {
      name: "Medium",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        pixelSize: 8,
      },
    },
    {
      name: "Large",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        pixelSize: 16,
      },
    },
  ],
  paramsToUniforms,
};
