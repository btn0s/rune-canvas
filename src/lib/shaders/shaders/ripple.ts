import type { ShaderDefinition, ShaderParams, ShaderUniforms } from "../types";
import { colorToVec4 } from "../types";

// Ripple distortion shader - circular wave distortion
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_frequency;
uniform float u_amplitude;
uniform float u_speed;
uniform vec2 u_center;
uniform float u_waveCount;

in vec2 v_imageUV;
out vec4 fragColor;

#define PI 3.14159265358979323846
#define TWO_PI 6.28318530718

void main() {
    vec2 uv = v_imageUV;
    vec2 center = u_center;
    
    // Distance from center
    vec2 coord = uv - center;
    float dist = length(coord);
    
    // Create ripple effect
    float ripple = sin(dist * u_frequency * TWO_PI - u_time * u_speed) * u_amplitude;
    
    // Multiple waves
    float totalRipple = 0.0;
    for (int i = 0; i < 3; i++) {
        if (float(i) >= u_waveCount) break;
        float waveDist = dist * u_frequency * TWO_PI * (1.0 + float(i) * 0.5);
        float waveTime = u_time * u_speed * (1.0 + float(i) * 0.3);
        totalRipple += sin(waveDist - waveTime) * u_amplitude / (1.0 + float(i));
    }
    
    // Apply distortion
    vec2 dir = normalize(coord);
    vec2 distortedUV = uv + dir * totalRipple;
    
    // Sample texture
    fragColor = texture(u_image, distortedUV);
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
    u_frequency: (params.frequency as number) ?? 10.0,
    u_amplitude: (params.amplitude as number) ?? 0.01,
    u_speed: (params.speed as number) ?? 2.0,
    u_center: [centerX, centerY],
    u_waveCount: (params.waveCount as number) ?? 1.0,
  };
}

export const rippleShader: ShaderDefinition = {
  id: "ripple",
  name: "Ripple",
  description: "Circular wave distortion effect",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    frequency: 10,
    amplitude: 0.01,
    speed: 2,
    center: [0.5, 0.5],
    waveCount: 1,
  },
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        frequency: 10,
        amplitude: 0.01,
        speed: 2,
        center: [0.5, 0.5],
        waveCount: 1,
      },
    },
    {
      name: "Strong",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        frequency: 15,
        amplitude: 0.02,
        speed: 3,
        center: [0.5, 0.5],
        waveCount: 1,
      },
    },
    {
      name: "Multiple Waves",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        frequency: 8,
        amplitude: 0.015,
        speed: 2,
        center: [0.5, 0.5],
        waveCount: 3,
      },
    },
    {
      name: "Slow",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        frequency: 10,
        amplitude: 0.01,
        speed: 0.5,
        center: [0.5, 0.5],
        waveCount: 1,
      },
    },
  ],
  paramsToUniforms,
};
