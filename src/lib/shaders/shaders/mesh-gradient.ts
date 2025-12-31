import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import { declarePI, rotation2, proceduralHash21 } from "../shader-utils";
import { colorToVec4 } from "../types";

const maxColorCount = 10;

// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec4 u_colors[${maxColorCount}];
uniform float u_colorsCount;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_grainMixer;
uniform float u_grainOverlay;

in vec2 v_objectUV;
out vec4 fragColor;

${declarePI}
${rotation2}
${proceduralHash21}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float noise(vec2 n, vec2 seedOffset) {
  return valueNoise(n + seedOffset);
}

vec2 getPosition(int i, float t) {
  float a = float(i) * .37;
  float b = .6 + fract(float(i) / 3.) * .9;
  float c = .8 + fract(float(i + 1) / 4.);

  float x = sin(t * b + a);
  float y = cos(t * c + a * 1.5);

  return .5 + .5 * vec2(x, y);
}

void main() {
  vec2 uv = v_objectUV;
  uv += .5;
  vec2 grainUV = uv * 1000.;

  float grain = noise(grainUV, vec2(0.));
  float mixerGrain = .4 * u_grainMixer * (grain - .5);

  const float firstFrameOffset = 41.5;
  float t = .5 * (u_time + firstFrameOffset);

  float radius = smoothstep(0., 1., length(uv - .5));
  float center = 1. - radius;
  for (float i = 1.; i <= 2.; i++) {
    uv.x += u_distortion * center / i * sin(t + i * .4 * smoothstep(.0, 1., uv.y)) * cos(.2 * t + i * 2.4 * smoothstep(.0, 1., uv.y));
    uv.y += u_distortion * center / i * cos(t + i * 2. * smoothstep(.0, 1., uv.x));
  }

  vec2 uvRotated = uv;
  uvRotated -= vec2(.5);
  float angle = 3. * u_swirl * radius;
  uvRotated = rotate(uvRotated, -angle);
  uvRotated += vec2(.5);

  vec3 color = vec3(0.);
  float opacity = 0.;
  float totalWeight = 0.;

  for (int i = 0; i < ${maxColorCount}; i++) {
    if (i >= int(u_colorsCount)) break;

    vec2 pos = getPosition(i, t) + mixerGrain;
    vec3 colorFraction = u_colors[i].rgb * u_colors[i].a;
    float opacityFraction = u_colors[i].a;

    float dist = length(uvRotated - pos);

    dist = pow(dist, 3.5);
    float weight = 1. / (dist + 1e-3);
    color += colorFraction * weight;
    opacity += opacityFraction * weight;
    totalWeight += weight;
  }

  color /= max(1e-4, totalWeight);
  opacity /= max(1e-4, totalWeight);

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_grainOverlay * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const colors = (params.colors as string[]) || ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"];
  const colorVecs = colors.map(colorToVec4);
  // Pad to maxColorCount
  while (colorVecs.length < maxColorCount) {
    colorVecs.push([0, 0, 0, 0]);
  }

  return {
    u_colors: colorVecs.flat(),
    u_colorsCount: colors.length,
    u_distortion: (params.distortion as number) ?? 0.8,
    u_swirl: (params.swirl as number) ?? 0.1,
    u_grainMixer: (params.grainMixer as number) ?? 0,
    u_grainOverlay: (params.grainOverlay as number) ?? 0,
  };
}

export const meshGradientShader: ShaderDefinition = {
  id: "meshGradient",
  name: "Mesh Gradient",
  description: "A flowing composition of color spots moving along distinct trajectories",
  category: "Effects",
  fragmentShader,
  defaultParams: {
    colors: ["#667eea", "#764ba2", "#f093fb", "#4facfe"],
    distortion: 0.6,
    swirl: 0.15,
    grainMixer: 0.05,
    grainOverlay: 0.02,
  },
  paramDefinitions: {
    colors: {
      control: { type: "colorArray", label: "Colors" },
      defaultValue: ["#667eea", "#764ba2", "#f093fb", "#4facfe"],
    },
    distortion: {
      control: {
        type: "slider",
        min: 0,
        max: 2,
        step: 0.01,
      },
      defaultValue: 0.6,
    },
    swirl: {
      control: {
        type: "slider",
        min: 0,
        max: 2,
        step: 0.01,
      },
      defaultValue: 0.15,
    },
    grainMixer: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      defaultValue: 0.05,
    },
    grainOverlay: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      defaultValue: 0.02,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        colors: ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"],
        distortion: 0.8,
        swirl: 0.1,
        grainMixer: 0,
        grainOverlay: 0,
      },
    },
    {
      name: "Purple",
      params: {
        colors: ["#aaa7d7", "#3c2b8e"],
        distortion: 1,
        swirl: 1,
        grainMixer: 0,
        grainOverlay: 0,
      },
    },
    {
      name: "Beach",
      params: {
        colors: ["#bcecf6", "#00aaff", "#00f7ff", "#ffd447"],
        distortion: 0.8,
        swirl: 0.35,
        grainMixer: 0,
        grainOverlay: 0,
      },
    },
    {
      name: "Ink",
      params: {
        colors: ["#ffffff", "#000000"],
        distortion: 1,
        swirl: 0.2,
        grainMixer: 0,
        grainOverlay: 0,
      },
    },
  ],
  paramsToUniforms,
};
