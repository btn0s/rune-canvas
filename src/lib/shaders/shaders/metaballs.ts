import type { ShaderDefinition, ShaderParams, ShaderUniforms } from "../types";
import { declarePI } from "../shader-utils";
import { colorToVec4 } from "../types";

const maxColorCount = 8;
const maxBallsCount = 20;

// Simplified metaballs shader without texture dependency
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec4 u_colorBack;
uniform vec4 u_colors[${maxColorCount}];
uniform float u_colorsCount;
uniform float u_size;
uniform float u_count;

in vec2 v_objectUV;
out vec4 fragColor;

${declarePI}

float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

float noise(vec2 p) {
  return hash(p.x + hash(p.y));
}

float getBallShape(vec2 uv, vec2 c, float p) {
  float s = .5 * length(uv - c);
  s = 1. - clamp(s, 0., 1.);
  s = pow(s, p);
  return s;
}

void main() {
  vec2 shape_uv = v_objectUV;
  shape_uv += .5;

  const float firstFrameOffset = 2503.4;
  float t = .2 * (u_time + firstFrameOffset);

  vec3 totalColor = vec3(0.);
  float totalShape = 0.;
  float totalOpacity = 0.;

  for (int i = 0; i < ${maxBallsCount}; i++) {
    if (i >= int(ceil(u_count))) break;

    float idxFract = float(i) / float(${maxBallsCount});
    float angle = TWO_PI * idxFract;

    float speed = 1. - .2 * idxFract;
    float noiseX = noise(vec2(angle * 10. + float(i) + t * speed, 0.));
    float noiseY = noise(vec2(angle * 20. + float(i) - t * speed, 0.));

    vec2 pos = vec2(.5) + 1e-4 + .9 * (vec2(noiseX, noiseY) - .5);

    int colorIdx = i % int(u_colorsCount);
    vec4 ballColor = u_colors[colorIdx];
    float ballSize = u_size * (0.8 + 0.4 * noise(vec2(float(i), 1.)));

    float shape = getBallShape(shape_uv, pos, 1.5 / ballSize);
    totalShape += shape;
    totalColor += ballColor.rgb * ballColor.a * shape;
    totalOpacity += ballColor.a * shape;
  }

  float finalShape = smoothstep(0.3, 0.7, totalShape);
  vec3 finalColor = totalColor / max(totalShape, 1e-4);
  float finalOpacity = clamp(totalOpacity / max(totalShape, 1e-4), 0., 1.);

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  finalColor = mix(bgColor, finalColor, finalShape);
  finalOpacity = mix(u_colorBack.a, finalOpacity, finalShape);

  fragColor = vec4(finalColor, finalOpacity);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const colors = (params.colors as string[]) || ["#ff6b6b", "#4ecdc4", "#45b7d1"];
  const colorVecs = colors.map(colorToVec4);
  while (colorVecs.length < maxColorCount) {
    colorVecs.push([0, 0, 0, 0]);
  }

  return {
    u_colors: colorVecs.flat(),
    u_colorsCount: colors.length,
    u_colorBack: colorToVec4((params.colorBack as string) || "#000000"),
    u_size: (params.size as number) ?? 0.3,
    u_count: (params.count as number) ?? 8,
  };
}

export const metaballsShader: ShaderDefinition = {
  id: "metaballs",
  name: "Metaballs",
  description: "Gooey colored balls moving around and merging into smooth organic shapes",
  fragmentShader,
  defaultParams: {
    colors: ["#ff6b6b", "#4ecdc4", "#45b7d1"],
    colorBack: "#000000",
    size: 0.3,
    count: 8,
  },
  presets: [
    {
      name: "Default",
      params: {
        colors: ["#ff6b6b", "#4ecdc4", "#45b7d1"],
        colorBack: "#000000",
        size: 0.3,
        count: 8,
      },
    },
  ],
  paramsToUniforms,
};
