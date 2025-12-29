import type { ShaderDefinition, ShaderParams, ShaderUniforms } from "../types";
import { colorToVec4 } from "../types";

// Kaleidoscope shader - mirrors image in segments
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_segments;
uniform float u_rotation;
uniform float u_offset;

in vec2 v_imageUV;
out vec4 fragColor;

#define PI 3.14159265358979323846
#define TWO_PI 6.28318530718

void main() {
    vec2 uv = v_imageUV;
    
    // Center coordinates
    vec2 center = vec2(0.5);
    vec2 coord = uv - center;
    
    // Convert to polar coordinates
    float angle = atan(coord.y, coord.x);
    float radius = length(coord);
    
    // Apply rotation
    angle += u_rotation * PI / 180.0;
    
    // Mirror into segments
    float segmentAngle = TWO_PI / u_segments;
    angle = mod(angle, segmentAngle * 2.0);
    
    // Mirror every other segment
    if (angle > segmentAngle) {
        angle = segmentAngle * 2.0 - angle;
    }
    
    // Add offset
    angle += u_offset * PI / 180.0;
    
    // Convert back to cartesian
    vec2 mirrored = vec2(cos(angle), sin(angle)) * radius;
    vec2 finalUV = mirrored + center;
    
    // Sample texture
    fragColor = texture(u_image, finalUV);
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
    u_segments: (params.segments as number) ?? 6.0,
    u_rotation: (params.rotation as number) ?? 0.0,
    u_offset: (params.offset as number) ?? 0.0,
  };
}

export const kaleidoscopeShader: ShaderDefinition = {
  id: "kaleidoscope",
  name: "Kaleidoscope",
  description: "Mirrors image in radial segments",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    segments: 6,
    rotation: 0,
    offset: 0,
  },
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        segments: 6,
        rotation: 0,
        offset: 0,
      },
    },
    {
      name: "Hexagon",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        segments: 6,
        rotation: 30,
        offset: 0,
      },
    },
    {
      name: "Octagon",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        segments: 8,
        rotation: 0,
        offset: 0,
      },
    },
    {
      name: "Triangle",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        segments: 3,
        rotation: 0,
        offset: 0,
      },
    },
  ],
  paramsToUniforms,
};
