import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import { declarePI, rotation2, colorBandingFix } from "../shader-utils";
import { colorToVec4 } from "../types";

const maxColorCount = 10;

// Procedural heatmap shader - flowing heat animation on diamond shape
// Inspired by paper-design/shaders but simplified for procedural shapes
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec4 u_colorBack;
uniform vec4 u_colors[${maxColorCount}];
uniform float u_colorsCount;
uniform float u_angle;
uniform float u_noise;
uniform float u_innerGlow;
uniform float u_outerGlow;
uniform float u_contour;

in vec2 v_objectUV;
out vec4 fragColor;

${declarePI}
${rotation2}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float sst(float edge0, float edge1, float x) {
  return smoothstep(edge0, edge1, x);
}

// Diamond SDF - returns distance from edge (positive inside, negative outside)
float diamondSDF(vec2 uv) {
  vec2 shapeUV = uv - vec2(.5);
  shapeUV = rotate(shapeUV, .25 * PI);
  shapeUV *= 1.42;
  shapeUV += vec2(.5);
  vec2 mask = min(shapeUV, 1. - shapeUV);
  vec2 pixel_thickness = vec2(.15);
  float maskX = smoothstep(0.0, pixel_thickness.x, mask.x);
  float maskY = smoothstep(0.0, pixel_thickness.y, mask.y);
  maskX = pow(maskX, .25);
  maskY = pow(maskY, .25);
  return clamp(1. - maskX * maskY, 0., 1.);
}

// Animated heat wave function - creates flowing effect
float heatWave(vec2 uv, float t, float angle) {
  vec2 animUV = uv - vec2(.5);
  float angleRad = -angle * PI / 180.;
  float cosA = cos(angleRad);
  float sinA = sin(angleRad);
  animUV = vec2(
    animUV.x * cosA - animUV.y * sinA,
    animUV.x * sinA + animUV.y * cosA
  ) + vec2(.5);
  
  // Create wave pattern flowing along the angle direction
  float wave = animUV.y - t;
  wave = mod(wave, 1.);
  float waveMask = sst(.3, .65, wave) * (1. - sst(.65, 1., wave));
  return .5 + waveMask;
}

void main() {
  vec2 uv = v_objectUV + .5;
  uv.y = 1. - uv.y;

  float t = .1 * u_time;
  t -= .3;
  
  // Create multiple offset waves for layered animation
  float tCopy = t + 1. / 3.;
  float tCopy2 = t + 2. / 3.;
  
  t = mod(t, 1.);
  tCopy = mod(tCopy, 1.);
  tCopy2 = mod(tCopy2, 1.);

  // Get diamond shape
  float shape = diamondSDF(uv);
  
  // Calculate edge distance for glow effects
  float edgeDist = 1. - shape;
  float outerBlur = pow(edgeDist, .8);
  float innerBlur = pow(shape, 1.2);
  float contour = smoothstep(.9, 1., edgeDist);

  // Animated heat waves
  float wave1 = heatWave(uv, t, u_angle);
  float wave2 = heatWave(uv, tCopy, u_angle);
  float wave3 = heatWave(uv, tCopy2, u_angle);

  // Combine waves - subtract them from inner area to create flowing effect
  float inner = .8 + .8 * innerBlur;
  inner = mix(inner, 0., wave1 * .3);
  inner = mix(inner, 0., wave2 * .3);
  inner = mix(inner, 0., wave3 * .3);
  
  inner *= mix(0., 2., u_innerGlow);
  inner += (u_contour * 2.) * contour;
  inner = min(1., inner);
  inner *= (1. - shape);

  // Outer glow with animated mask
  float outer = 0.;
  {
    float animT = t * 3.;
    animT = mod(animT - .1, 1.);
    
    outer = .9 * pow(outerBlur, .8);
    vec2 animUV = uv - vec2(.5);
    float angleRad = -u_angle * PI / 180.;
    float cosA = cos(angleRad);
    float sinA = sin(angleRad);
    animUV = vec2(
      animUV.x * cosA - animUV.y * sinA,
      animUV.x * sinA + animUV.y * cosA
    ) + vec2(.5);
    
    float y = mod(animUV.y - animT, 1.);
    float animatedMask = sst(.3, .65, y) * (1. - sst(.65, 1., y));
    animatedMask = .5 + animatedMask;
    outer *= animatedMask;
    outer *= mix(0., 5., pow(u_outerGlow, 2.));
  }

  inner = pow(inner, 1.2);
  float heat = clamp(inner + outer, 0., 1.);

  // Add noise grain
  heat += (.005 + .35 * u_noise) * (fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453123) - .5);

  // Map heat to color gradient
  float mixer = heat * u_colorsCount;
  vec4 gradient = u_colors[0];
  gradient.rgb *= gradient.a;
  float outerShape = 0.;
  
  for (int i = 1; i < ${maxColorCount + 1}; i++) {
    if (i > int(u_colorsCount)) break;
    float m = clamp(mixer - float(i - 1), 0., 1.);
    if (i == 1) {
      outerShape = m;
    }
    vec4 c = u_colors[i - 1];
    c.rgb *= c.a;
    gradient = mix(gradient, c, m);
  }

  vec3 color = gradient.rgb * outerShape;
  float opacity = gradient.a * outerShape;

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1.0 - opacity);
  opacity = opacity + u_colorBack.a * (1.0 - opacity);

  color += .02 * (fract(sin(dot(uv + 1., vec2(12.9898, 78.233))) * 43758.5453123) - .5);

  ${colorBandingFix}

  fragColor = vec4(color, opacity);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const colors =
    (params.colors as string[]) ||
    ["#0000ff", "#00ffff", "#ff8800", "#ff0000"];
  const colorVecs = colors.map(colorToVec4);
  while (colorVecs.length < maxColorCount) {
    colorVecs.push([0, 0, 0, 0]);
  }

  return {
    u_colors: colorVecs.flat(),
    u_colorsCount: colors.length,
    u_colorBack: colorToVec4((params.colorBack as string) || "#000000"),
    u_angle: (params.angle as number) ?? 0,
    u_noise: (params.noise as number) ?? 0.1,
    u_innerGlow: (params.innerGlow as number) ?? 0.5,
    u_outerGlow: (params.outerGlow as number) ?? 0.3,
    u_contour: (params.contour as number) ?? 0.5,
  };
}

export const heatmapShader: ShaderDefinition = {
  id: "heatmap",
  name: "Heatmap",
  description: "Flowing heat animation with thermal color gradient on diamond shape",
  category: "Logo animations",
  fragmentShader,
  defaultParams: {
    colors: ["#0000ff", "#00ffff", "#ff8800", "#ff0000"],
    colorBack: "#000000",
    angle: 0,
    noise: 0.1,
    innerGlow: 0.5,
    outerGlow: 0.3,
    contour: 0.5,
  },
  paramDefinitions: {
    colors: {
      control: { type: "colorArray", label: "Colors" },
      defaultValue: ["#0000ff", "#00ffff", "#ff8800", "#ff0000"],
    },
    colorBack: {
      control: { type: "color", label: "Background" },
      defaultValue: "#000000",
      hidden: true,
    },
    angle: {
      control: {
        type: "slider",
        min: 0,
        max: 360,
        step: 1,
        label: "Angle",
      },
      defaultValue: 0,
    },
    noise: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
        label: "Noise",
      },
      defaultValue: 0.1,
    },
    innerGlow: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
        label: "Inner Glow",
      },
      defaultValue: 0.5,
    },
    outerGlow: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
        label: "Outer Glow",
      },
      defaultValue: 0.3,
    },
    contour: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
        label: "Contour",
      },
      defaultValue: 0.5,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        colors: ["#0000ff", "#00ffff", "#ff8800", "#ff0000"],
        colorBack: "#000000",
        angle: 0,
        noise: 0.1,
        innerGlow: 0.5,
        outerGlow: 0.3,
        contour: 0.5,
      },
    },
    {
      name: "Infrared",
      params: {
        colors: ["#4b0082", "#8b00ff", "#ff00ff", "#ffffff"],
        colorBack: "#000000",
        angle: 45,
        noise: 0.15,
        innerGlow: 0.6,
        outerGlow: 0.4,
        contour: 0.7,
      },
    },
    {
      name: "Arctic",
      params: {
        colors: ["#001122", "#0066cc", "#00ccff", "#88eeff"],
        colorBack: "#000011",
        angle: 90,
        noise: 0.05,
        innerGlow: 0.4,
        outerGlow: 0.5,
        contour: 0.3,
      },
    },
    {
      name: "Volcanic",
      params: {
        colors: ["#330000", "#cc0000", "#ff6600", "#ffff00"],
        colorBack: "#000000",
        angle: -45,
        noise: 0.2,
        innerGlow: 0.7,
        outerGlow: 0.4,
        contour: 0.8,
      },
    },
  ],
  paramsToUniforms,
};
