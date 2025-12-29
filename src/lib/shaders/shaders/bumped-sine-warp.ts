import type { ShaderDefinition, ShaderParams, ShaderUniforms } from "../types";
import { colorToVec4 } from "../types";

// Bumped Sinusoidal Warp shader - creates 3D-like warped surface with bump mapping
// Based on Shadertoy "Bumped Sinusoidal Warp" by Shane
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_bumpFactor;
uniform float u_lightSpeed;
uniform float u_warpSpeed;
uniform float u_warpIntensity;
uniform float u_specularPower;
uniform float u_reflectionStrength;

in vec2 v_imageUV;
out vec4 fragColor;

#define PI 3.14159265358979323846

// Warp function - sinusoidal planar deformation
vec2 W(vec2 p, float t, float intensity) {
    p = (p + 3.) * 4.;

    // Layered, sinusoidal feedback, with time component
    for (int i = 0; i < 3; i++) {
        p += cos(p.yx * 3. + vec2(t, 1.57)) / 3.;
        p += sin(p.yx + t + vec2(1.57, 0)) / 2.;
        p *= 1.3;
    }

    // A bit of jitter to counter the high frequency sections
    p += fract(sin(p + vec2(13, 7)) * 5e5) * .03 - .015;

    return mod(p, 2.) - 1.; // Range: [vec2(-1), vec2(1)]
}

// Bump mapping function - returns the length of the sinusoidal warp function
float bumpFunc(vec2 p, float t, float intensity) { 
    return length(W(p, t, intensity)) * 0.7071; // Range: [0, 1]
}

vec3 smoothFract(vec3 x) { 
    x = fract(x); 
    return min(x, x * (1. - x) * 12.); 
}

void main() {
    // Screen coordinates - centered and aspect-corrected
    vec2 uv = (gl_FragCoord.xy - u_resolution.xy * 0.5) / u_resolution.y;
    
    // Time-based parameters
    float t = u_time * u_warpSpeed;
    float lightT = u_time * u_lightSpeed;
    
    // Vector setup - surface position, ray origin, unit direction vector, and light position
    vec3 sp = vec3(uv, 0); // Surface position - essentially a screen at the origin
    vec3 rd = normalize(vec3(uv, 1)); // Unit direction vector - from origin to screen plane
    vec3 lp = vec3(cos(lightT) * 0.5, sin(lightT) * 0.2, -1); // Light position - back from screen
    vec3 sn = vec3(0, 0, -1); // Plane normal - Z pointing toward viewer
    
    // Bump mapping - perturbing the normal
    vec2 eps = vec2(4.0 / u_resolution.y, 0);
    
    float f = bumpFunc(sp.xy, t, u_warpIntensity);
    float fx = bumpFunc(sp.xy - eps.xy, t, u_warpIntensity);
    float fy = bumpFunc(sp.xy - eps.yx, t, u_warpIntensity);
    
    // Calculate gradients
    fx = (fx - f) / eps.x;
    fy = (fy - f) / eps.x;
    
    // Perturb the normal using the gradient
    sn = normalize(sn + vec3(fx, fy, 0) * u_bumpFactor);
    
    // Lighting
    vec3 ld = lp - sp;
    float lDist = max(length(ld), 0.0001);
    ld /= lDist;
    
    // Light attenuation
    float atten = 1.0 / (1.0 + lDist * lDist * 0.15);
    
    // Using bump function to darken crevices for extra depth
    atten *= f * 0.9 + 0.1;
    
    // Diffuse value
    float diff = max(dot(sn, ld), 0.0);
    diff = pow(diff, 4.0) * 0.66 + pow(diff, 8.0) * 0.34;
    
    // Specular highlighting
    float spec = pow(max(dot(reflect(-ld, sn), -rd), 0.0), u_specularPower);
    
    // Texture color
    // Combine surface position with warped position to index into texture
    // The original uses screen-space coordinates directly, but we'll use v_imageUV
    // and apply a warp offset based on screen position
    vec2 warpOffset = W(sp.xy, t, u_warpIntensity) / 8.0;
    
    // Apply warp offset to texture UV coordinates
    // Scale the offset appropriately for UV space [0,1]
    vec2 texUV = v_imageUV + warpOffset * 0.05;
    
    vec3 texCol = texture(u_image, texUV).xyz;
    texCol *= texCol; // Rough sRGB to linear conversion
    texCol = smoothstep(0.05, 0.75, pow(texCol, vec3(0.75, 0.8, 0.85)));
    
    // Textureless fallback - simple procedural color
    // vec3 texCol = smoothFract(W(sp.xy, t, u_warpIntensity).xyy) * 0.1 + 0.2;
    
    // Final color
    vec3 col = (texCol * (diff * vec3(1, 0.97, 0.92) * 2.0 + 0.5) + vec3(1, 0.6, 0.2) * spec * 2.0) * atten;
    
    // Faux environment mapping
    float ref = max(dot(reflect(rd, sn), vec3(1)), 0.0);
    col += col * pow(ref, 4.0) * vec3(0.25, 0.5, 1) * u_reflectionStrength;
    
    // Gamma correction
    fragColor = vec4(sqrt(clamp(col, 0.0, 1.0)), 1.0);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  // Get image and calculate aspect ratio
  const image = params.image as HTMLImageElement | string | undefined;
  let imageAspectRatio = 1;
  if (image instanceof HTMLImageElement) {
    imageAspectRatio = image.naturalWidth / image.naturalHeight;
  }

  return {
    u_image: image,
    u_imageAspectRatio: imageAspectRatio,
    u_bumpFactor: (params.bumpFactor as number) ?? 0.05,
    u_lightSpeed: (params.lightSpeed as number) ?? 1.0,
    u_warpSpeed: (params.warpSpeed as number) ?? 0.5,
    u_warpIntensity: (params.warpIntensity as number) ?? 1.0,
    u_specularPower: (params.specularPower as number) ?? 12.0,
    u_reflectionStrength: (params.reflectionStrength as number) ?? 3.0,
  };
}

export const bumpedSineWarpShader: ShaderDefinition = {
  id: "bumped-sine-warp",
  name: "Bumped Sine Warp",
  description: "3D-like warped surface with bump mapping and lighting",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    bumpFactor: 0.06,
    lightSpeed: 0.8,
    warpSpeed: 0.4,
    warpIntensity: 0.9,
    specularPower: 14.0,
    reflectionStrength: 2.5,
  },
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        bumpFactor: 0.05,
        lightSpeed: 1.0,
        warpSpeed: 0.5,
        warpIntensity: 1.0,
        specularPower: 12.0,
        reflectionStrength: 3.0,
      },
    },
    {
      name: "Subtle",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        bumpFactor: 0.02,
        lightSpeed: 0.5,
        warpSpeed: 0.3,
        warpIntensity: 0.5,
        specularPower: 16.0,
        reflectionStrength: 2.0,
      },
    },
    {
      name: "Intense",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        bumpFactor: 0.1,
        lightSpeed: 2.0,
        warpSpeed: 1.0,
        warpIntensity: 1.5,
        specularPower: 8.0,
        reflectionStrength: 5.0,
      },
    },
    {
      name: "Slow Motion",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        bumpFactor: 0.05,
        lightSpeed: 0.2,
        warpSpeed: 0.1,
        warpIntensity: 1.0,
        specularPower: 20.0,
        reflectionStrength: 2.0,
      },
    },
  ],
  paramsToUniforms,
};
