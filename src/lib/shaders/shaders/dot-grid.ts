import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import { declarePI, simplexNoise } from "../shader-utils";
import { colorToVec4 } from "../types";

// Simplified dot grid shader
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec4 u_colorBack;
uniform vec4 u_colorFill;
uniform vec4 u_colorStroke;
uniform float u_dotSize;
uniform float u_gapX;
uniform float u_gapY;
uniform float u_strokeWidth;
uniform float u_sizeRange;
uniform float u_opacityRange;
uniform float u_shape;

in vec2 v_patternUV;
out vec4 fragColor;

${declarePI}
${simplexNoise}

float polygon(vec2 p, float N, float rot) {
  float a = atan(p.x, p.y) + rot;
  float r = TWO_PI / float(N);
  return cos(floor(.5 + a / r) * r - a) * length(p);
}

void main() {
  // x100 is a default multiplier between vertex and fragment shaders
  // we use it to avoid UV precision issues
  vec2 shape_uv = 100. * v_patternUV;

  vec2 gap = max(abs(vec2(u_gapX, u_gapY)), vec2(1e-6));
  vec2 grid = fract(shape_uv / gap) + 1e-4;
  vec2 grid_idx = floor(shape_uv / gap);
  float sizeRandomizer = .5 + .8 * snoise(2. * vec2(grid_idx.x * 100., grid_idx.y));
  float opacity_randomizer = .5 + .7 * snoise(2. * vec2(grid_idx.y, grid_idx.x));

  vec2 center = vec2(0.5) - 1e-3;
  vec2 p = (grid - center) * vec2(u_gapX, u_gapY);

  float baseSize = u_dotSize * (1. - sizeRandomizer * u_sizeRange);
  float strokeWidth = u_strokeWidth * (1. - sizeRandomizer * u_sizeRange);

  float dist;
  if (u_shape < 0.5) {
    // Circle
    dist = length(p);
  } else if (u_shape < 1.5) {
    // Diamond
    strokeWidth *= 1.5;
    dist = polygon(1.5 * p, 4., .25 * PI);
  } else if (u_shape < 2.5) {
    // Square
    dist = polygon(1.03 * p, 4., 1e-3);
  } else {
    // Triangle
    strokeWidth *= 1.5;
    p = p * 2. - 1.;
    p *= .9;
    p.y = 1. - p.y;
    p.y -= .75 * baseSize;
    dist = polygon(p, 3., 1e-3);
  }

  float edgeWidth = fwidth(dist);
  float shapeOuter = 1. - smoothstep(baseSize - edgeWidth, baseSize + edgeWidth, dist - strokeWidth);
  float shapeInner = 1. - smoothstep(baseSize - edgeWidth, baseSize + edgeWidth, dist);
  float stroke = shapeOuter - shapeInner;

  float dotOpacity = max(0., 1. - opacity_randomizer * u_opacityRange);
  stroke *= dotOpacity;
  shapeInner *= dotOpacity;

  stroke *= u_colorStroke.a;
  shapeInner *= u_colorFill.a;

  vec3 color = vec3(0.);
  color += stroke * u_colorStroke.rgb;
  color += shapeInner * u_colorFill.rgb;
  color += (1. - shapeInner - stroke) * u_colorBack.rgb * u_colorBack.a;

  float opacity = 0.;
  opacity += stroke;
  opacity += shapeInner;
  opacity += (1. - opacity) * u_colorBack.a;

  fragColor = vec4(color, opacity);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const shapeMap: Record<string, number> = {
    circle: 0,
    diamond: 1,
    square: 2,
    triangle: 3,
  };

  return {
    u_colorBack: colorToVec4((params.colorBack as string) || "#000000"),
    u_colorFill: colorToVec4((params.colorFill as string) || "#ffffff"),
    u_colorStroke: colorToVec4((params.colorStroke as string) || "#000000"),
    u_dotSize: (params.dotSize as number) ?? 0.3,
    u_gapX: (params.gapX as number) ?? 0.1,
    u_gapY: (params.gapY as number) ?? 0.1,
    u_strokeWidth: (params.strokeWidth as number) ?? 0.05,
    u_sizeRange: (params.sizeRange as number) ?? 0.3,
    u_opacityRange: (params.opacityRange as number) ?? 0.5,
    u_shape: shapeMap[(params.shape as string) || "circle"] ?? 0,
  };
}

export const dotGridShader: ShaderDefinition = {
  id: "dotGrid",
  name: "Dot Grid",
  description: "Grid of dots with various shapes and randomized properties",
  category: "Effects",
  fragmentShader,
  defaultParams: {
    colorBack: "#ffffff",
    colorFill: "#3b82f6",
    colorStroke: "#1e40af",
    dotSize: 0.25,
    gapX: 0.08,
    gapY: 0.08,
    strokeWidth: 0.03,
    sizeRange: 0.2,
    opacityRange: 0.3,
    shape: "circle",
  },
  paramDefinitions: {
    colorBack: {
      control: { type: "color", label: "Background" },
      defaultValue: "#ffffff",
    },
    colorFill: {
      control: { type: "color", label: "Fill" },
      defaultValue: "#3b82f6",
    },
    colorStroke: {
      control: { type: "color", label: "Stroke" },
      defaultValue: "#1e40af",
    },
    dotSize: {
      control: {
        type: "slider",
        min: 0.05,
        max: 0.5,
        step: 0.01,
      },
      defaultValue: 0.25,
    },
    gapX: {
      control: {
        type: "slider",
        min: 0.01,
        max: 0.3,
        step: 0.01,
      },
      defaultValue: 0.08,
    },
    gapY: {
      control: {
        type: "slider",
        min: 0.01,
        max: 0.3,
        step: 0.01,
      },
      defaultValue: 0.08,
    },
    strokeWidth: {
      control: {
        type: "slider",
        min: 0,
        max: 0.1,
        step: 0.01,
      },
      defaultValue: 0.03,
    },
    sizeRange: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      defaultValue: 0.2,
    },
    opacityRange: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      defaultValue: 0.3,
    },
    shape: {
      control: {
        type: "enum",
        options: ["circle", "diamond", "square", "triangle"],
        label: "Shape",
      },
      defaultValue: "circle",
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        colorBack: "#000000",
        colorFill: "#ffffff",
        colorStroke: "#000000",
        dotSize: 0.3,
        gapX: 0.1,
        gapY: 0.1,
        strokeWidth: 0.05,
        sizeRange: 0.3,
        opacityRange: 0.5,
        shape: "circle",
      },
    },
    {
      name: "Diamonds",
      params: {
        colorBack: "#1a1a2e",
        colorFill: "#0f3460",
        colorStroke: "#e94560",
        dotSize: 0.25,
        gapX: 0.12,
        gapY: 0.12,
        strokeWidth: 0.08,
        sizeRange: 0.4,
        opacityRange: 0.6,
        shape: "diamond",
      },
    },
    {
      name: "Squares",
      params: {
        colorBack: "#2d3436",
        colorFill: "#636e72",
        colorStroke: "#dfe6e9",
        dotSize: 0.35,
        gapX: 0.15,
        gapY: 0.15,
        strokeWidth: 0.03,
        sizeRange: 0.2,
        opacityRange: 0.3,
        shape: "square",
      },
    },
  ],
  paramsToUniforms,
};
