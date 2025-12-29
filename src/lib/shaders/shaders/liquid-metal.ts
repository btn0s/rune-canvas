import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import {
  declarePI,
  rotation2,
  simplexNoise,
  colorBandingFix,
} from "../shader-utils";
import { colorToVec4 } from "../types";

// Liquid metal shader adapted from paper-design/shaders
// Procedural shapes with animated metallic stripe patterns
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_colorBack;
uniform vec4 u_colorTint;
uniform float u_softness;
uniform float u_repetition;
uniform float u_shiftRed;
uniform float u_shiftBlue;
uniform float u_distortion;
uniform float u_contour;
uniform float u_angle;
uniform float u_shape;

in vec2 v_objectUV;
out vec4 fragColor;

${declarePI}
${rotation2}
${simplexNoise}

float getColorChanges(float c1, float c2, float stripe_p, vec3 w, float blur, float bump, float tint) {
  float ch = mix(c2, c1, smoothstep(.0, 2. * blur, stripe_p));

  float border = w[0];
  ch = mix(ch, c2, smoothstep(border, border + 2. * blur, stripe_p));

  bump = smoothstep(.2, .8, bump);
  border = w[0] + .4 * (1. - bump) * w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2. * blur, stripe_p));

  border = w[0] + .5 * (1. - bump) * w[1];
  ch = mix(ch, c2, smoothstep(border, border + 2. * blur, stripe_p));

  border = w[0] + w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2. * blur, stripe_p));

  float gradient_t = (stripe_p - w[0] - w[1]) / w[2];
  float gradient = mix(c1, c2, smoothstep(0., 1., gradient_t));
  ch = mix(ch, gradient, smoothstep(border, border + .5 * blur, stripe_p));

  // Tint color is applied with color burn blending
  ch = mix(ch, 1. - min(1., (1. - ch) / max(tint, 0.0001)), u_colorTint.a);
  return ch;
}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main() {
  const float firstFrameOffset = 2.8;
  float t = .3 * (u_time + firstFrameOffset);

  vec2 uv = v_objectUV + .5;
  uv.y = 1. - uv.y;

  float cycleWidth = u_repetition;
  float edge = 0.;
  float contOffset = 1.;

  vec2 rotatedUV = uv - vec2(.5);
  float angle = (-u_angle + 70.) * PI / 180.;
  float cosA = cos(angle);
  float sinA = sin(angle);
  rotatedUV = vec2(
    rotatedUV.x * cosA - rotatedUV.y * sinA,
    rotatedUV.x * sinA + rotatedUV.y * cosA
  ) + vec2(.5);

  // Procedural shapes
  if (u_shape < 1.) {
    // full-fill on canvas
    vec2 borderUV = uv;
    float ratio = u_resolution.x / u_resolution.y;
    vec2 mask = min(borderUV, 1. - borderUV);
    vec2 pixel_thickness = 250. / u_resolution;
    float maskX = smoothstep(0.0, pixel_thickness.x, mask.x);
    float maskY = smoothstep(0.0, pixel_thickness.y, mask.y);
    maskX = pow(maskX, .25);
    maskY = pow(maskY, .25);
    edge = clamp(1. - maskX * maskY, 0., 1.);

    if (ratio > 1.) {
      uv.y /= ratio;
    } else {
      uv.x *= ratio;
    }
    uv += .5;
    uv.y = 1. - uv.y;

    cycleWidth *= 2.;
    contOffset = 1.5;

  } else if (u_shape < 2.) {
    // circle
    vec2 shapeUV = uv - .5;
    shapeUV *= .67;
    edge = pow(clamp(3. * length(shapeUV), 0., 1.), 18.);
  } else if (u_shape < 3.) {
    // daisy
    vec2 shapeUV = uv - .5;
    shapeUV *= 1.68;

    float r = length(shapeUV) * 2.;
    float a = atan(shapeUV.y, shapeUV.x) + .2;
    r *= (1. + .05 * sin(3. * a + 2. * t));
    float f = abs(cos(a * 3.));
    edge = smoothstep(f, f + .7, r);
    edge *= edge;

    uv *= .8;
    cycleWidth *= 1.6;

  } else if (u_shape < 4.) {
    // diamond
    vec2 shapeUV = uv - .5;
    shapeUV = rotate(shapeUV, .25 * PI);
    shapeUV *= 1.42;
    shapeUV += .5;
    vec2 mask = min(shapeUV, 1. - shapeUV);
    vec2 pixel_thickness = vec2(.15);
    float maskX = smoothstep(0.0, pixel_thickness.x, mask.x);
    float maskY = smoothstep(0.0, pixel_thickness.y, mask.y);
    maskX = pow(maskX, .25);
    maskY = pow(maskY, .25);
    edge = clamp(1. - maskX * maskY, 0., 1.);
  } else if (u_shape < 5.) {
    // metaballs
    vec2 shapeUV = uv - .5;
    shapeUV *= 1.3;
    edge = 0.;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float speed = 1.5 + 2./3. * sin(fi * 12.345);
      float angle = -fi * 1.5;
      vec2 dir1 = vec2(cos(angle), sin(angle));
      vec2 dir2 = vec2(cos(angle + 1.57), sin(angle + 1.));
      vec2 traj = .4 * (dir1 * sin(t * speed + fi * 1.23) + dir2 * cos(t * (speed * 0.7) + fi * 2.17));
      float d = length(shapeUV + traj);
      edge += pow(1.0 - clamp(d, 0.0, 1.0), 4.0);
    }
    edge = 1. - smoothstep(.65, .9, edge);
    edge = pow(edge, 4.);
  }

  edge = mix(smoothstep(.9 - 2. * fwidth(edge), .9, edge), edge, smoothstep(0.0, 0.4, u_contour));

  float opacity = 1. - smoothstep(.9 - 2. * fwidth(edge), .9, edge);
  if (u_shape < 2.) {
    edge = 1.2 * edge;
  } else if (u_shape < 5.) {
    edge = 1.8 * pow(edge, 1.5);
  }

  float diagBLtoTR = rotatedUV.x - rotatedUV.y;
  float diagTLtoBR = rotatedUV.x + rotatedUV.y;

  vec3 color = vec3(0.);
  vec3 color1 = vec3(.98, 0.98, 1.);
  vec3 color2 = vec3(.1, .1, .1 + .1 * smoothstep(.7, 1.3, diagTLtoBR));

  vec2 grad_uv = uv - .5;

  float dist = length(grad_uv + vec2(0., .2 * diagBLtoTR));
  grad_uv = rotate(grad_uv, (.25 - .2 * diagBLtoTR) * PI);
  float direction = grad_uv.x;

  float bump = pow(1.8 * dist, 1.2);
  bump = 1. - bump;
  bump *= pow(uv.y, .3);

  float thin_strip_1_ratio = .12 / cycleWidth * (1. - .4 * bump);
  float thin_strip_2_ratio = .07 / cycleWidth * (1. + .4 * bump);
  float wide_strip_ratio = (1. - thin_strip_1_ratio - thin_strip_2_ratio);

  float thin_strip_1_width = cycleWidth * thin_strip_1_ratio;
  float thin_strip_2_width = cycleWidth * thin_strip_2_ratio;

  float noise = snoise(uv - t);

  edge += (1. - edge) * u_distortion * noise;

  direction += diagBLtoTR;
  float contour = 0.;
  direction -= 2. * noise * diagBLtoTR * (smoothstep(0., 1., edge) * (1.0 - smoothstep(0., 1., edge)));
  direction *= mix(1., 1. - edge, smoothstep(.5, 1., u_contour));
  direction -= 1.7 * edge * smoothstep(.5, 1., u_contour);
  direction += .2 * pow(u_contour, 4.) * (1.0 - smoothstep(0., 1., edge));

  bump *= clamp(pow(uv.y, .1), .3, 1.);
  direction *= (.1 + (1.1 - edge) * bump);

  direction *= (.4 + .6 * (1.0 - smoothstep(.5, 1., edge)));
  direction += .18 * (smoothstep(.1, .2, uv.y) * (1.0 - smoothstep(.2, .4, uv.y)));
  direction += .03 * (smoothstep(.1, .2, 1. - uv.y) * (1.0 - smoothstep(.2, .4, 1. - uv.y)));

  direction *= (.5 + .5 * pow(uv.y, 2.));
  direction *= cycleWidth;
  direction -= t;

  float colorDispersion = (1. - bump);
  colorDispersion = clamp(colorDispersion, 0., 1.);
  float dispersionRed = colorDispersion;
  dispersionRed += .03 * bump * noise;
  dispersionRed += 5. * (smoothstep(-.1, .2, uv.y) * (1.0 - smoothstep(.1, .5, uv.y))) * (smoothstep(.4, .6, bump) * (1.0 - smoothstep(.4, 1., bump)));
  dispersionRed -= diagBLtoTR;

  float dispersionBlue = colorDispersion;
  dispersionBlue *= 1.3;
  dispersionBlue += (smoothstep(0., .4, uv.y) * (1.0 - smoothstep(.1, .8, uv.y))) * (smoothstep(.4, .6, bump) * (1.0 - smoothstep(.4, .8, bump)));
  dispersionBlue -= .2 * edge;

  dispersionRed *= (u_shiftRed / 20.);
  dispersionBlue *= (u_shiftBlue / 20.);

  float blur = u_softness / 15. + .3 * contour;

  vec3 w = vec3(thin_strip_1_width, thin_strip_2_width, wide_strip_ratio);
  w[1] -= .02 * smoothstep(.0, 1., edge + bump);
  float stripe_r = fract(direction + dispersionRed);
  float r = getColorChanges(color1.r, color2.r, stripe_r, w, blur + fwidth(stripe_r), bump, u_colorTint.r);
  float stripe_g = fract(direction);
  float g = getColorChanges(color1.g, color2.g, stripe_g, w, blur + fwidth(stripe_g), bump, u_colorTint.g);
  float stripe_b = fract(direction - dispersionBlue);
  float b = getColorChanges(color1.b, color2.b, stripe_b, w, blur + fwidth(stripe_b), bump, u_colorTint.b);

  color = vec3(r, g, b);
  color *= opacity;

  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1. - opacity);
  opacity = opacity + u_colorBack.a * (1. - opacity);

  ${colorBandingFix}

  fragColor = vec4(color, opacity);
}
`;

const SHAPE_VALUES = {
  none: 0,
  circle: 1,
  daisy: 2,
  diamond: 3,
  metaballs: 4,
} as const;

type ShapeType = keyof typeof SHAPE_VALUES;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const shape = (params.shape as ShapeType) || "diamond";
  const shapeValue = SHAPE_VALUES[shape] ?? SHAPE_VALUES.diamond;

  return {
    u_colorBack: colorToVec4((params.colorBack as string) || "#808080"),
    u_colorTint: colorToVec4((params.colorTint as string) || "#ffffff"),
    u_repetition: (params.repetition as number) ?? 3.0,
    u_softness: (params.softness as number) ?? 0.3,
    u_shiftRed: (params.shiftRed as number) ?? 0,
    u_shiftBlue: (params.shiftBlue as number) ?? 0,
    u_distortion: (params.distortion as number) ?? 0.3,
    u_contour: (params.contour as number) ?? 0.5,
    u_angle: (params.angle as number) ?? 0,
    u_shape: shapeValue,
  };
}

export const liquidMetalShader: ShaderDefinition = {
  id: "liquid-metal",
  name: "Liquid Metal",
  description: "Futuristic liquid metal material with animated stripe patterns",
  category: "Logo animations",
  fragmentShader,
  defaultParams: {
    colorBack: "#808080",
    colorTint: "#ffffff",
    shape: "diamond",
    repetition: 3.0,
    softness: 0.3,
    shiftRed: 0,
    shiftBlue: 0,
    distortion: 0.3,
    contour: 0.5,
    angle: 0,
  },
  paramDefinitions: {
    colorBack: {
      control: { type: "color", label: "Background" },
      defaultValue: "#808080",
      hidden: true,
    },
    colorTint: {
      control: { type: "color", label: "Tint" },
      defaultValue: "#ffffff",
    },
    shape: {
      control: {
        type: "enum",
        options: ["none", "circle", "daisy", "diamond", "metaballs"],
        label: "Shape",
      },
      defaultValue: "diamond",
    },
    repetition: {
      control: {
        type: "slider",
        min: 1,
        max: 10,
        step: 0.1,
        label: "Repetition",
      },
      defaultValue: 3.0,
    },
    softness: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
        label: "Softness",
      },
      defaultValue: 0.3,
    },
    shiftRed: {
      control: {
        type: "slider",
        min: -1,
        max: 1,
        step: 0.01,
        label: "Shift Red",
      },
      defaultValue: 0,
    },
    shiftBlue: {
      control: {
        type: "slider",
        min: -1,
        max: 1,
        step: 0.01,
        label: "Shift Blue",
      },
      defaultValue: 0,
    },
    distortion: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
        label: "Distortion",
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
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        colorBack: "#808080",
        colorTint: "#ffffff",
        shape: "diamond",
        repetition: 3.0,
        softness: 0.3,
        shiftRed: 0,
        shiftBlue: 0,
        distortion: 0.3,
        contour: 0.5,
        angle: 0,
      },
    },
    {
      name: "Gold",
      params: {
        colorBack: "#808080",
        colorTint: "#ffd700",
        shape: "diamond",
        repetition: 4.0,
        softness: 0.25,
        shiftRed: 0.2,
        shiftBlue: -0.1,
        distortion: 0.4,
        contour: 0.6,
        angle: 45,
      },
    },
    {
      name: "Rose Gold",
      params: {
        colorBack: "#808080",
        colorTint: "#e8b4b8",
        shape: "diamond",
        repetition: 3.5,
        softness: 0.35,
        shiftRed: 0.3,
        shiftBlue: 0.1,
        distortion: 0.25,
        contour: 0.5,
        angle: -30,
      },
    },
    {
      name: "Dark Chrome",
      params: {
        colorBack: "#1a1a1a",
        colorTint: "#ffffff",
        shape: "diamond",
        repetition: 5.0,
        softness: 0.2,
        shiftRed: 0,
        shiftBlue: 0,
        distortion: 0.5,
        contour: 0.8,
        angle: 0,
      },
    },
  ],
  paramsToUniforms,
};
