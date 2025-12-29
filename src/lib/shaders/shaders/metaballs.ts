import type { ShaderDefinition, ShaderParams, ShaderUniforms } from "../types";
import { declarePI, proceduralNoise1D, colorBandingFix } from "../shader-utils";
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
${proceduralNoise1D}

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
    float noiseX = noise(angle * 10. + float(i) + t * speed);
    float noiseY = noise(angle * 20. + float(i) - t * speed);

    vec2 pos = vec2(.5) + 1e-4 + .9 * (vec2(noiseX, noiseY) - .5);

    int safeIndex = i % int(u_colorsCount + 0.5);
    vec4 ballColor = u_colors[safeIndex];
    ballColor.rgb *= ballColor.a;

    float sizeFrac = 1.;
    if (float(i) > floor(u_count - 1.)) {
      sizeFrac *= fract(u_count);
    }

    float shape = getBallShape(shape_uv, pos, 45. - 30. * u_size * sizeFrac);
    shape *= pow(u_size, .2);
    shape = smoothstep(0., 1., shape);

    totalColor += ballColor.rgb * shape;
    totalShape += shape;
    totalOpacity += ballColor.a * shape;
  }

  totalColor /= max(totalShape, 1e-4);
  totalOpacity /= max(totalShape, 1e-4);

  float edge_width = fwidth(totalShape);
  float finalShape = smoothstep(.4, .4 + edge_width, totalShape);

  vec3 color = totalColor * finalShape;
  float opacity = totalOpacity * finalShape;

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1. - opacity);
  opacity = opacity + u_colorBack.a * (1. - opacity);

  ${colorBandingFix}

  fragColor = vec4(color, opacity);
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
  category: "Effects",
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
    {
      name: "Solar",
      params: {
        colors: ["#ffc800", "#ff5500", "#ffc105"],
        colorBack: "#102f84",
        size: 0.75,
        count: 7,
      },
    },
    {
      name: "Ink Drops",
      params: {
        colors: ["#000000"],
        colorBack: "#ffffff",
        size: 0.1,
        count: 18,
      },
    },
    {
      name: "Background",
      params: {
        colors: ["#ae00ff", "#00ff95", "#ffc105"],
        colorBack: "#2a273f",
        size: 0.81,
        count: 13,
      },
    },
  ],
  paramsToUniforms,
};
