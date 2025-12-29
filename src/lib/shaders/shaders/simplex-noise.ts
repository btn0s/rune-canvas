import type { ShaderDefinition, ShaderParams, ShaderUniforms } from "../types";
import { simplexNoise } from "../shader-utils";
import { colorToVec4 } from "../types";

const maxColorCount = 10;

// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform float u_scale;
uniform vec4 u_colors[${maxColorCount}];
uniform float u_colorsCount;
uniform float u_stepsPerColor;
uniform float u_softness;

in vec2 v_patternUV;
out vec4 fragColor;

${simplexNoise}

float getNoise(vec2 uv, float t) {
  float noise = .5 * snoise(uv - vec2(0., .3 * t));
  noise += .5 * snoise(2. * uv + vec2(0., .32 * t));
  return noise;
}

float steppedSmooth(float m, float steps, float softness) {
  float stepT = floor(m * steps) / steps;
  float f = m * steps - floor(m * steps);
  float fw = steps * fwidth(m);
  float smoothed = smoothstep(.5 - softness, min(1., .5 + softness + fw), f);
  return stepT + smoothed / steps;
}

void main() {
  vec2 shape_uv = v_patternUV;
  shape_uv *= .1;

  float t = .2 * u_time;

  float shape = .5 + .5 * getNoise(shape_uv, t);

  float steps = u_colorsCount * u_stepsPerColor;
  shape = steppedSmooth(shape, steps, u_softness);

  float colorIndex = floor(shape * steps);
  colorIndex = clamp(colorIndex, 0., steps - 1.);
  int idx = int(colorIndex / u_stepsPerColor);
  idx = min(idx, int(u_colorsCount) - 1);

  vec4 color = u_colors[idx];
  color.rgb *= color.a;

  fragColor = vec4(color.rgb, color.a);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const colors = (params.colors as string[]) || ["#ff0000", "#00ff00", "#0000ff"];
  const colorVecs = colors.map(colorToVec4);
  while (colorVecs.length < maxColorCount) {
    colorVecs.push([0, 0, 0, 0]);
  }

  return {
    u_colors: colorVecs.flat(),
    u_colorsCount: colors.length,
    u_stepsPerColor: (params.stepsPerColor as number) ?? 1,
    u_softness: (params.softness as number) ?? 0.5,
  };
}

export const simplexNoiseShader: ShaderDefinition = {
  id: "simplexNoise",
  name: "Simplex Noise",
  description: "A multi-color gradient mapped into smooth, animated curves",
  category: "Effects",
  fragmentShader,
  defaultParams: {
    colors: ["#667eea", "#764ba2", "#f093fb"],
    stepsPerColor: 2,
    softness: 0.3,
  },
  presets: [
    {
      name: "Default",
      params: {
        colors: ["#ff0000", "#00ff00", "#0000ff"],
        stepsPerColor: 1,
        softness: 0.5,
      },
    },
    {
      name: "Smooth",
      params: {
        colors: ["#ff6b6b", "#4ecdc4", "#45b7d1", "#f7b731"],
        stepsPerColor: 2,
        softness: 0.8,
      },
    },
    {
      name: "Sharp",
      params: {
        colors: ["#000000", "#ffffff"],
        stepsPerColor: 1,
        softness: 0.1,
      },
    },
  ],
  paramsToUniforms,
};
