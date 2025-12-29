import type { ShaderDefinition, ShaderParams, ShaderUniforms } from "../types";
import { declarePI, simplexNoise, colorBandingFix } from "../shader-utils";
import { colorToVec4 } from "../types";

// Simplified spiral shader
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec4 u_colorBack;
uniform vec4 u_colorFront;
uniform float u_density;
uniform float u_distortion;
uniform float u_strokeWidth;
uniform float u_strokeCap;
uniform float u_strokeTaper;
uniform float u_noise;
uniform float u_noiseFrequency;
uniform float u_softness;

in vec2 v_patternUV;
out vec4 fragColor;

${declarePI}
${simplexNoise}

void main() {
  // Center v_patternUV (which is [0, 100]) and scale to match Paper's coordinate system
  vec2 uv = 2. * (v_patternUV - 50.0);

  float t = u_time;
  float l = length(uv);
  float density = clamp(u_density, 0., 1.);
  l = pow(max(l, 1e-6), density);
  float angle = atan(uv.y, uv.x) - t;
  float angleNormalised = angle / TWO_PI;

  angleNormalised += .125 * u_noise * snoise(16. * pow(u_noiseFrequency, 3.) * uv);

  float offset = l + angleNormalised;
  offset -= u_distortion * (sin(4. * l - .5 * t) * cos(PI + l + .5 * t));
  float stripe = fract(offset);

  float shape = 2. * abs(stripe - .5);
  float width = 1. - clamp(u_strokeWidth, .005 * u_strokeTaper, 1.);

  float wCap = mix(width, (1. - stripe) * (1. - step(.5, stripe)), (1. - clamp(l, 0., 1.)));
  width = mix(width, wCap, u_strokeCap);
  width *= (1. - clamp(u_strokeTaper, 0., 1.) * l);

  float fw = fwidth(offset);
  float fwMult = 4. - 3. * (smoothstep(.05, .4, 2. * u_strokeWidth) * smoothstep(.05, .4, 2. * (1. - u_strokeWidth)));
  float pixelSize = mix(fwMult * fw, fwidth(shape), clamp(fw, 0., 1.));
  pixelSize = mix(pixelSize, .002, u_strokeCap * (1. - clamp(l, 0., 1.)));

  float res = smoothstep(width - pixelSize - u_softness, width + pixelSize + u_softness, shape);

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
  return {
    u_colorBack: colorToVec4((params.colorBack as string) || "#001429"),
    u_colorFront: colorToVec4((params.colorFront as string) || "#79D1FF"),
    u_density: (params.density as number) ?? 1,
    u_distortion: (params.distortion as number) ?? 0,
    u_strokeWidth: (params.strokeWidth as number) ?? 0.5,
    u_strokeTaper: (params.strokeTaper as number) ?? 0,
    u_strokeCap: (params.strokeCap as number) ?? 0,
    u_noise: (params.noise as number) ?? 0,
    u_noiseFrequency: (params.noiseFrequency as number) ?? 0,
    u_softness: (params.softness as number) ?? 0,
  };
}

export const spiralShader: ShaderDefinition = {
  id: "spiral",
  name: "Spiral",
  description: "Animated spiral patterns with customizable stroke and distortion",
  category: "Effects",
  fragmentShader,
  defaultParams: {
    colorBack: "#0a0e27",
    colorFront: "#60a5fa",
    density: 0.25,
    distortion: 0.15,
    strokeWidth: 0.6,
    strokeTaper: 0.1,
    strokeCap: 0.2,
    noise: 0.3,
    noiseFrequency: 0.2,
    softness: 0.1,
  },
  presets: [
    {
      name: "Default",
      params: {
        colorBack: "#001429",
        colorFront: "#79D1FF",
        density: 1,
        distortion: 0,
        strokeWidth: 0.5,
        strokeTaper: 0,
        strokeCap: 0,
        noise: 0,
        noiseFrequency: 0,
        softness: 0,
      },
    },
    {
      name: "Droplet",
      params: {
        colorBack: "#effafe",
        colorFront: "#bf40a0",
        density: 0.9,
        distortion: 0,
        strokeWidth: 0.75,
        strokeTaper: 0.18,
        strokeCap: 1,
        noise: 0.74,
        noiseFrequency: 0.33,
        softness: 0.02,
      },
    },
    {
      name: "Jungle",
      params: {
        colorBack: "#a0ef2a",
        colorFront: "#288b18",
        density: 0.5,
        distortion: 0,
        strokeWidth: 0.5,
        strokeTaper: 0,
        strokeCap: 0,
        noise: 1,
        noiseFrequency: 0.25,
        softness: 0,
      },
    },
    {
      name: "Swirl",
      params: {
        colorBack: "#b3e6d9",
        colorFront: "#1a2b4d",
        density: 0.2,
        distortion: 0,
        strokeWidth: 0.5,
        strokeTaper: 0,
        strokeCap: 0,
        noise: 0,
        noiseFrequency: 0.3,
        softness: 0.5,
      },
    },
  ],
  paramsToUniforms,
};
