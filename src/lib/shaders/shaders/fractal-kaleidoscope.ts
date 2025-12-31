import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import { declarePI, colorBandingFix } from "../shader-utils";
import { colorToVec4 } from "../types";

// Fractal Kaleidoscope shader by Frostbyte
// Licensed under CC BY-NC-SA 4.0
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_colorBack;
uniform float u_fractalType;
uniform float u_rotationSpeed;
uniform float u_intensity;

in vec2 v_objectUV;
out vec4 fragColor;

${declarePI}

// 2D rotation matrix
vec2 rotate2D(vec2 v, float t) {
  float s = sin(t);
  float c = cos(t);
  return mat2(c, -s, s, c) * v;
}

// knighty https://www.shadertoy.com/view/XlX3zB
vec3 fold(vec3 p) {
  vec3 nc = vec3(-0.5, -0.809017, 0.309017);
  for (int i = 0; i < 5; i++) {
    p.xy = abs(p.xy);
    p -= 2. * min(0., dot(p, nc)) * nc;
  }
  return p - vec3(0., 0., 1.275);
}

// ACES tonemap http://www.oscars.org/science-technology/sci-tech-projects/aces
vec3 aces(vec3 c) {
  mat3 m1 = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777
  );
  mat3 m2 = mat3(
    1.60475, -0.10208, -0.00327,
    -0.53108, 1.10813, -0.07276,
    -0.07367, -0.00605, 1.07602
  );
  vec3 v = m1 * c;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return m2 * (a / b);
}

// Color palette
vec3 palette(float t) {
  vec3 a = vec3(0.1, 0.5, 0.9);
  vec3 b = vec3(0.98, 0.58, 0.1);
  vec3 c = vec3(0.37, 0.16, 0.39);
  vec3 d = vec3(0.27, 0.19, 0.1);
  return a + b * cos(TWO_PI * (c * t + d));
}

// Dot noise by Xor
float dot_noise(vec3 p) {
  const float PHI = 1.618033988;
  const mat3 GOLD = mat3(
    -0.571464913, +0.814921382, +0.096597072,
    -0.278044873, -0.303026659, +0.911518454,
    +0.772087367, +0.494042493, +0.399753815
  );
  return dot(cos(GOLD * p), sin(PHI * p * GOLD));
}

// Distance field
float dist(vec3 p) {
  p = fold(p) - vec3(u_fractalType);
  p.xy = rotate2D(sin(p.xy * 1.), u_time * u_rotationSpeed);
  float n = dot_noise(p * 12.) / 12. - dot_noise(p) - p.x * 0.01;
  return 0.001 + abs(n) * 0.15;
}

void main() {
  // Convert to screen coordinates (matching original shader)
  vec2 fragCoord = gl_FragCoord.xy;
  
  // Create ray direction (matching original: vec3(3.*u-iResolution.xy,iResolution.y))
  vec3 d = normalize(vec3(3. * fragCoord - u_resolution.xy, u_resolution.y));
  
  // Ray marching
  vec3 p;
  vec3 l = vec3(0.);
  p.z = u_time * 1.;
  
  for (float i = 0.; i < 200.; i++) {
    float s = dist(p);
    s = max(s, 0.5 - length(p.xy));
    s += abs(sin(p.z + u_time * 1.)) * 0.01;
    p += d * s;
    l += (1. + 1.5 * palette(s * 0.1 + length(p.xy) * 0.2 + 3.)) / s;
  }
  
  vec3 color = aces(l * l / 5e8) * 1.1 * u_intensity;
  
  ${colorBandingFix}
  
  fragColor = vec4(color, 1.0);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  return {
    u_colorBack: colorToVec4((params.colorBack as string) || "#000000"),
    u_fractalType: (params.fractalType as number) ?? 2.0,
    u_rotationSpeed: (params.rotationSpeed as number) ?? 0.25,
    u_intensity: (params.intensity as number) ?? 1.0,
  };
}

export const fractalKaleidoscopeShader: ShaderDefinition = {
  id: "fractal-kaleidoscope",
  name: "Fractal Kaleidoscope",
  description: "Fractal kaleidoscope pattern with ACES tonemapping",
  category: "Effects",
  fragmentShader,
  defaultParams: {
    colorBack: "#000000",
    fractalType: 2.0,
    rotationSpeed: 0.25,
    intensity: 1.0,
  },
  paramDefinitions: {
    colorBack: {
      control: { type: "color", label: "Background" },
      defaultValue: "#000000",
      hidden: true,
    },
    fractalType: {
      control: {
        type: "slider",
        min: 0,
        max: 10,
        step: 0.1,
        label: "Fractal Type",
      },
      defaultValue: 2.0,
    },
    rotationSpeed: {
      control: {
        type: "slider",
        min: 0,
        max: 3,
        step: 0.01,
        label: "Rotation Speed",
      },
      defaultValue: 0.25,
    },
    intensity: {
      control: {
        type: "slider",
        min: 0,
        max: 2,
        step: 0.01,
        label: "Intensity",
      },
      defaultValue: 1.0,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        colorBack: "#000000",
        fractalType: 2.0,
        rotationSpeed: 0.25,
        intensity: 1.0,
      },
    },
    {
      name: "Fast Rotation",
      params: {
        colorBack: "#000000",
        fractalType: 2.0,
        rotationSpeed: 1.0,
        intensity: 1.2,
      },
    },
    {
      name: "Slow Rotation",
      params: {
        colorBack: "#000000",
        fractalType: 3.0,
        rotationSpeed: 0.1,
        intensity: 0.8,
      },
    },
  ],
  paramsToUniforms,
};
