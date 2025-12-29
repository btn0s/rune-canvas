import type { ShaderDefinition, ShaderParams, ShaderUniforms } from "../types";
import { rotation2 } from "../shader-utils";
import { colorToVec4 } from "../types";

// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec4 u_colorFront;
uniform vec4 u_colorMid;
uniform vec4 u_colorBack;
uniform float u_brightness;
uniform float u_contrast;

in vec2 v_patternUV;
out vec4 fragColor;

${rotation2}

float neuroShape(vec2 uv, float t) {
  vec2 sine_acc = vec2(0.);
  vec2 res = vec2(0.);
  float scale = 8.;

  for (int j = 0; j < 15; j++) {
    uv = rotate(uv, 1.);
    sine_acc = rotate(sine_acc, 1.);
    vec2 layer = uv * scale + float(j) + sine_acc - t;
    sine_acc += sin(layer);
    res += (.5 + .5 * cos(layer)) / scale;
    scale *= (1.2);
  }
  return res.x + res.y;
}

void main() {
  vec2 shape_uv = v_patternUV;
  shape_uv *= .13;

  float t = .5 * u_time;

  float noise = neuroShape(shape_uv, t);

  noise = (1. + u_brightness) * noise * noise;
  noise = pow(noise, .7 + 6. * u_contrast);
  noise = min(1.4, noise);

  float blend = smoothstep(0.7, 1.4, noise);

  vec4 frontC = u_colorFront;
  frontC.rgb *= frontC.a;
  vec4 midC = u_colorMid;
  midC.rgb *= midC.a;
  vec4 blendFront = mix(midC, frontC, blend);

  float safeNoise = max(noise, 0.0);
  vec3 color = blendFront.rgb * safeNoise;
  float opacity = clamp(blendFront.a * safeNoise, 0., 1.);

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1. - opacity);
  opacity = opacity + u_colorBack.a * (1. - opacity);

  fragColor = vec4(color, opacity);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  return {
    u_colorFront: colorToVec4((params.colorFront as string) || "#ffffff"),
    u_colorMid: colorToVec4((params.colorMid as string) || "#47a6ff"),
    u_colorBack: colorToVec4((params.colorBack as string) || "#000000"),
    u_brightness: (params.brightness as number) ?? 0.05,
    u_contrast: (params.contrast as number) ?? 0.3,
  };
}

export const neuroNoiseShader: ShaderDefinition = {
  id: "neuroNoise",
  name: "Neuro Noise",
  description: "A glowing, web-like structure of fluid lines and soft intersections",
  category: "Effects",
  fragmentShader,
  defaultParams: {
    colorFront: "#ffffff",
    colorMid: "#8b5cf6",
    colorBack: "#0f172a",
    brightness: 0.08,
    contrast: 0.4,
  },
  presets: [
    {
      name: "Default",
      params: {
        colorFront: "#ffffff",
        colorMid: "#47a6ff",
        colorBack: "#000000",
        brightness: 0.05,
        contrast: 0.3,
      },
    },
    {
      name: "Sensation",
      params: {
        colorFront: "#00c8ff",
        colorMid: "#fbff00",
        colorBack: "#8b42ff",
        brightness: 0.19,
        contrast: 0.12,
      },
    },
  ],
  paramsToUniforms,
};
