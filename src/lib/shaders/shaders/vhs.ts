import type { ShaderDefinition, ShaderParams, ShaderUniforms } from "../types";
import { proceduralHash21 } from "../shader-utils";
import { colorToVec4 } from "../types";

// VHS shader - retro VHS tape effects
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_scanlineIntensity;
uniform float u_noiseIntensity;
uniform float u_colorBleed;
uniform float u_vignette;
uniform float u_jitter;

in vec2 v_imageUV;
out vec4 fragColor;

${proceduralHash21}

void main() {
    vec2 uv = v_imageUV;
    
    // Scanlines
    float scanline = sin(uv.y * u_resolution.y * 0.5) * 0.5 + 0.5;
    scanline = pow(scanline, 10.0);
    scanline = 1.0 - scanline * u_scanlineIntensity;
    
    // Color bleeding (horizontal)
    vec2 bleedUV = uv;
    bleedUV.x += sin(uv.y * 20.0 + u_time * 2.0) * u_colorBleed * 0.01;
    
    vec4 color = texture(u_image, bleedUV);
    
    // RGB separation for chromatic aberration effect
    float offset = u_colorBleed * 0.005;
    float r = texture(u_image, vec2(bleedUV.x + offset, bleedUV.y)).r;
    float g = color.g;
    float b = texture(u_image, vec2(bleedUV.x - offset, bleedUV.y)).b;
    
    color = vec4(r, g, b, color.a);
    
    // Noise
    float noise = hash21(uv + u_time * 0.1) * 2.0 - 1.0;
    color.rgb += noise * u_noiseIntensity;
    
    // Jitter (vertical displacement)
    float jitter = hash21(vec2(floor(uv.y * 100.0), u_time * 10.0)) * 2.0 - 1.0;
    uv.x += jitter * u_jitter * 0.01;
    color = mix(color, texture(u_image, uv), 0.7);
    
    // Vignette
    vec2 center = vec2(0.5);
    float dist = length(uv - center);
    float vignette = 1.0 - smoothstep(0.3, 1.0, dist * u_vignette);
    color.rgb *= vignette;
    
    // Apply scanlines
    color.rgb *= scanline;
    
    // Slight desaturation for VHS look
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(color.rgb, vec3(gray), 0.1);
    
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
    u_scanlineIntensity: (params.scanlineIntensity as number) ?? 0.3,
    u_noiseIntensity: (params.noiseIntensity as number) ?? 0.1,
    u_colorBleed: (params.colorBleed as number) ?? 0.5,
    u_vignette: (params.vignette as number) ?? 1.2,
    u_jitter: (params.jitter as number) ?? 0.3,
  };
}

export const vhsShader: ShaderDefinition = {
  id: "vhs",
  name: "VHS",
  description: "Retro VHS tape effects with scanlines and noise",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    scanlineIntensity: 0.3,
    noiseIntensity: 0.1,
    colorBleed: 0.5,
    vignette: 1.2,
    jitter: 0.3,
  },
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        scanlineIntensity: 0.3,
        noiseIntensity: 0.1,
        colorBleed: 0.5,
        vignette: 1.2,
        jitter: 0.3,
      },
    },
    {
      name: "Heavy",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        scanlineIntensity: 0.6,
        noiseIntensity: 0.2,
        colorBleed: 0.8,
        vignette: 1.5,
        jitter: 0.5,
      },
    },
    {
      name: "Subtle",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        scanlineIntensity: 0.15,
        noiseIntensity: 0.05,
        colorBleed: 0.3,
        vignette: 1.0,
        jitter: 0.1,
      },
    },
    {
      name: "Classic",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        scanlineIntensity: 0.4,
        noiseIntensity: 0.15,
        colorBleed: 0.6,
        vignette: 1.3,
        jitter: 0.4,
      },
    },
  ],
  paramsToUniforms,
};
