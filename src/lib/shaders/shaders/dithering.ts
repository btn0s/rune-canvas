import type { ShaderDefinition, ShaderParams, ShaderUniforms } from "../types";
import { declarePI, simplexNoise, proceduralHash11, proceduralHash21, colorBandingFix } from "../shader-utils";
import { colorToVec4 } from "../types";

// Dithering shader with shape and type parameters
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_shape;
uniform float u_type;
uniform float u_scale;
uniform float u_pxSize;

in vec2 v_objectUV;
out vec4 fragColor;

${declarePI}
${simplexNoise}
${proceduralHash11}
${proceduralHash21}

float getSimplexNoise(vec2 uv, float t) {
  float noise = .5 * snoise(uv - vec2(0., .3 * t));
  noise += .5 * snoise(2. * uv + vec2(0., .32 * t));
  return noise;
}

const int bayer2x2[4] = int[4](0, 2, 3, 1);
const int bayer4x4[16] = int[16](
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5
);
const int bayer8x8[64] = int[64](
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
);

float getBayerValue(vec2 uv, int size) {
  ivec2 pos = ivec2(fract(uv / float(size)) * float(size));
  int index = pos.y * size + pos.x;
  if (size == 2) {
    return float(bayer2x2[index]) / 4.0;
  } else if (size == 4) {
    return float(bayer4x4[index]) / 16.0;
  } else if (size == 8) {
    return float(bayer8x8[index]) / 64.0;
  }
  return 0.0;
}

void main() {
  float t = .5 * u_time;
  
  // Calculate pixelized UV for dithering (matches Paper's approach exactly)
  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
  pxSizeUV /= pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 normalizedUV = canvasPixelizedUV / u_resolution;
  
  vec2 ditheringNoiseUV = canvasPixelizedUV;
  vec2 shapeUV = normalizedUV;
  
  // Paper uses different UV calculations based on shape type
  // For shapes > 3.5: uses object box sizing (square, fits without stretching)
  // For shapes <= 3.5: uses pattern box sizing (respects aspect ratio)
  
  if (u_shape > 3.5) {
    // Object box sizing - ensures square fit without stretching
    // Paper: objectBoxSize.x = min(boxSize.x, boxSize.y) - keeps it square
    // This ensures the pattern fits without stretching, centered
    float minDim = min(u_resolution.x, u_resolution.y);
    vec2 objectBoxSize = vec2(minDim, minDim);
    vec2 objectWorldScale = u_resolution.xy / objectBoxSize;
    
    shapeUV *= objectWorldScale;
    shapeUV /= u_scale;
    // shapeUV is now centered at origin (no +.5 added) - ranges from negative to positive
  } else {
    // Pattern box sizing - respects aspect ratio, no stretching
    // Paper: patternBoxSize respects the aspect ratio of the given box size
    // For simplicity, we use the actual resolution aspect ratio
    float aspectRatio = u_resolution.x / u_resolution.y;
    float minDim = min(u_resolution.x / aspectRatio, u_resolution.y);
    vec2 patternBoxSize = vec2(aspectRatio * minDim, minDim);
    vec2 patternWorldScale = u_resolution.xy / patternBoxSize;
    
    shapeUV *= patternWorldScale;
    shapeUV /= u_scale;
    shapeUV += .5; // Paper adds .5 at the end for pattern box sizing - now [0, 1]
  }

  float shape = 0.;
  if (u_shape < 1.5) {
    // Simplex noise (value 1)
    // Paper: pattern box sizing, shapeUV ends in [0, 1] range
    shapeUV *= .001;
    shape = 0.5 + 0.5 * getSimplexNoise(shapeUV, t);
    shape = smoothstep(0.3, 0.9, shape);
  } else if (u_shape < 2.5) {
    // Warp (value 2)
    shapeUV *= .003;
    for (float i = 1.0; i < 6.0; i++) {
      shapeUV.x += 0.6 / i * cos(i * 2.5 * shapeUV.y + t);
      shapeUV.y += 0.6 / i * cos(i * 1.5 * shapeUV.x + t);
    }
    shape = .15 / max(0.001, abs(sin(t - shapeUV.y - shapeUV.x)));
    shape = smoothstep(0.02, 1., shape);
  } else if (u_shape < 3.5) {
    // Dots (value 3)
    shapeUV *= .05;
    float stripeIdx = floor(2. * shapeUV.x / TWO_PI);
    float rand = hash11(stripeIdx * 10.);
    rand = sign(rand - .5) * pow(.1 + abs(rand), .4);
    shape = sin(shapeUV.x) * cos(shapeUV.y - 5. * rand * t);
    shape = pow(abs(shape), 6.);
  } else if (u_shape < 4.5) {
    // Sine wave (value 4)
    // Paper: object box sizing, shapeUV is centered at origin (no +.5)
    shapeUV *= 4.;
    float wave = cos(.5 * shapeUV.x - 2. * t) * sin(1.5 * shapeUV.x + t) * (.75 + .25 * cos(3. * t));
    shape = 1. - smoothstep(-1., 1., shapeUV.y + wave);
  } else if (u_shape < 5.5) {
    // Ripple (value 5)
    // Paper: object box sizing, shapeUV is centered at origin (no +.5)
    float dist = length(shapeUV);
    float waves = sin(pow(dist, 1.7) * 7. - 3. * t) * .5 + .5;
    shape = waves;
  } else if (u_shape < 6.5) {
    // Swirl (value 6)
    // Paper: object box sizing, shapeUV is centered at origin (no +.5)
    float l = length(shapeUV);
    float angle = 6. * atan(shapeUV.y, shapeUV.x) + 4. * t;
    float twist = 1.2;
    float offset = 1. / pow(max(l, 1e-6), twist) + angle / TWO_PI;
    float mid = smoothstep(0., 1., pow(l, twist));
    shape = mix(0., fract(offset), mid);
  } else {
    // Sphere (value 7)
    // Paper: object box sizing, shapeUV is centered at origin (no +.5)
    shapeUV *= 2.;
    float d = 1. - pow(length(shapeUV), 2.);
    vec3 pos = vec3(shapeUV, sqrt(max(0., d)));
    vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));
    shape = .5 + .5 * dot(lightPos, pos);
    shape *= step(0., d);
  }

  int type = int(floor(u_type));
  float dithering = 0.0;

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoiseUV), shape);
    } break;
    case 2:
      dithering = getBayerValue(pxSizeUV, 2);
      break;
    case 3:
      dithering = getBayerValue(pxSizeUV, 4);
      break;
    default:
      dithering = getBayerValue(pxSizeUV, 8);
      break;
  }

  dithering -= .5;
  float res = step(.5, shape + dithering);

  vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
  float fgOpacity = u_colorFront.a;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  float bgOpacity = u_colorBack.a;

  vec3 color = fgColor * res;
  float opacity = fgOpacity * res;

  color += bgColor * (1. - opacity);
  opacity += bgOpacity * (1. - opacity);

  ${colorBandingFix}

  fragColor = vec4(color, opacity);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  // Match Paper's shape mapping: simplex=1, warp=2, dots=3, wave=4, ripple=5, swirl=6, sphere=7
  const shapeMap: Record<string, number> = {
    simplex: 1,
    warp: 2,
    dots: 3,
    wave: 4,
    ripple: 5,
    swirl: 6,
    sphere: 7,
  };
  const typeMap: Record<string, number> = {
    random: 1,
    "2x2": 2,
    "4x4": 3,
    "8x8": 4,
  };

  return {
    u_colorBack: colorToVec4((params.colorBack as string) || "#000000"),
    u_colorFront: colorToVec4((params.colorFront as string) || "#ffffff"),
    u_shape: shapeMap[(params.shape as string) || "simplex"] ?? 1,
    u_type: typeMap[(params.type as string) || "8x8"] ?? 4,
    u_scale: (params.scale as number) ?? 1,
    u_pxSize: (params.size as number) ?? (params.pxSize as number) ?? 2,
  };
}

export const ditheringShader: ShaderDefinition = {
  id: "dithering",
  name: "Dithering",
  description: "Pixelated patterns with various dithering algorithms",
  category: "Effects",
  fragmentShader,
  defaultParams: {
    colorBack: "#000000",
    colorFront: "#00b2ff",
    shape: "sphere",
    type: "4x4",
    scale: 0.6,
    size: 2,
  },
  presets: [
    {
      name: "Default",
      params: {
        colorBack: "#000000",
        colorFront: "#00b2ff",
        shape: "sphere",
        type: "4x4",
        scale: 0.6,
        size: 2,
      },
    },
    {
      name: "Warp",
      params: {
        colorBack: "#301c2a",
        colorFront: "#56ae6c",
        shape: "warp",
        type: "4x4",
        scale: 1,
        size: 2.5,
      },
    },
    {
      name: "Sine Wave",
      params: {
        colorBack: "#730d54",
        colorFront: "#00becc",
        shape: "wave",
        type: "4x4",
        scale: 1.2,
        size: 11,
      },
    },
    {
      name: "Ripple",
      params: {
        colorBack: "#603520",
        colorFront: "#c67953",
        shape: "ripple",
        type: "2x2",
        scale: 1,
        size: 3,
      },
    },
    {
      name: "Bugs",
      params: {
        colorBack: "#000000",
        colorFront: "#008000",
        shape: "dots",
        type: "random",
        scale: 1,
        size: 9,
      },
    },
    {
      name: "Swirl",
      params: {
        colorBack: "#00000000",
        colorFront: "#47a8e1",
        shape: "swirl",
        type: "8x8",
        scale: 1,
        size: 2,
      },
    },
  ],
  paramsToUniforms,
};
