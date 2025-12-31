import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import { declarePI, rotation2, simplexNoise } from "../shader-utils";
import { colorToVec4 } from "../types";

// Water shader - requires image input
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform vec4 u_colorBack;
uniform vec4 u_colorHighlight;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_size;
uniform float u_highlights;
uniform float u_layering;
uniform float u_edges;
uniform float u_caustic;
uniform float u_waves;
uniform vec2 u_mouse;

in vec2 v_imageUV;
out vec4 fragColor;

${declarePI}
${rotation2}
${simplexNoise}

float getUvFrame(vec2 uv) {
  float aax = 2. * fwidth(uv.x);
  float aay = 2. * fwidth(uv.y);

  float left   = smoothstep(0., aax, uv.x);
  float right = 1.0 - smoothstep(1. - aax, 1., uv.x);
  float bottom = smoothstep(0., aay, uv.y);
  float top = 1.0 - smoothstep(1. - aay, 1., uv.y);

  return left * right * bottom * top;
}

mat2 rotate2D(float r) {
  return mat2(cos(r), sin(r), -sin(r), cos(r));
}

float getCausticNoise(vec2 uv, float t, float scale) {
  vec2 n = vec2(.1);
  vec2 N = vec2(.1);
  mat2 m = rotate2D(.5);
  for (int j = 0; j < 6; j++) {
    uv *= m;
    n *= m;
    vec2 q = uv * scale + float(j) + n + (.5 + .5 * float(j)) * (mod(float(j), 2.) - 1.) * t;
    n += sin(q);
    N += cos(q) / scale;
    scale *= 1.1;
  }
  return (N.x + N.y + 1.);
}

void main() {
  vec2 imageUV = v_imageUV;
  vec2 patternUV = v_imageUV - .5;
  patternUV = (patternUV * vec2(u_imageAspectRatio, 1.));
  patternUV /= (.01 + .09 * u_size);

  float t = u_time;

  // Interactive ripple effect from mouse position
  // Only create ripples if mouse is not at default center position (0.5, 0.5)
  float ripple = 0.0;
  float mouseDistFromCenter = distance(u_mouse, vec2(0.5));
  if (mouseDistFromCenter > 0.01) {
    vec2 mouseUV = (u_mouse - vec2(0.5)) * vec2(u_imageAspectRatio, 1.0);
    mouseUV /= (.01 + .09 * u_size);
    vec2 mouseDist = patternUV - mouseUV;
    float mouseDistLen = length(mouseDist);
    
    // Create ripple effect that fades over time
    if (mouseDistLen < 2.0) {
      // Ripple effect: sin wave that expands outward
      float ripplePhase = mouseDistLen * 3.0 - t * 2.0;
      ripple = sin(ripplePhase) * exp(-mouseDistLen * 0.5) * 0.3;
      // Add distortion based on ripple
      patternUV += normalize(mouseDist) * ripple * 0.5;
    }
  }

  float wavesNoise = snoise((.3 + .1 * sin(t)) * .1 * patternUV + vec2(0., .4 * t));

  float causticNoise = getCausticNoise(patternUV + u_waves * vec2(1., -1.) * wavesNoise, 2. * t, 1.5);

  causticNoise += u_layering * getCausticNoise(patternUV + 2. * u_waves * vec2(1., -1.) * wavesNoise, 1.5 * t, 2.);
  causticNoise = causticNoise * causticNoise;

  float edgesDistortion = smoothstep(0., .1, imageUV.x);
  edgesDistortion *= smoothstep(0., .1, imageUV.y);
  edgesDistortion *= (smoothstep(1., 1.1, imageUV.x) + (1.0 - smoothstep(.8, .95, imageUV.x)));
  edgesDistortion *= (1.0 - smoothstep(.9, 1., imageUV.y));
  edgesDistortion = mix(edgesDistortion, 1., u_edges);

  float causticNoiseDistortion = .02 * causticNoise * edgesDistortion;

  float wavesDistortion = .1 * u_waves * wavesNoise;

  imageUV += vec2(wavesDistortion, -wavesDistortion);
  imageUV += (u_caustic * causticNoiseDistortion);

  float frame = getUvFrame(imageUV);

  vec4 image = texture(u_image, imageUV);
  vec4 backColor = u_colorBack;
  backColor.rgb *= backColor.a;

  vec3 color = mix(backColor.rgb, image.rgb, image.a * frame);
  float opacity = backColor.a + image.a * frame;

  causticNoise = max(-.2, causticNoise);

  float hightlight = .025 * u_highlights * causticNoise;
  hightlight *= u_colorHighlight.a;
  color = mix(color, u_colorHighlight.rgb, .05 * u_highlights * causticNoise);
  opacity += hightlight;

  color += hightlight * (.5 + .5 * wavesNoise);
  opacity += hightlight * (.5 + .5 * wavesNoise);

  opacity = clamp(opacity, 0., 1.);

  fragColor = vec4(color, opacity);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  // Get image and calculate aspect ratio
  const image = params.image as HTMLImageElement | string | undefined;
  let imageAspectRatio = 1;
  if (image instanceof HTMLImageElement) {
    imageAspectRatio = image.naturalWidth / image.naturalHeight;
  }

  return {
    u_colorBack: colorToVec4((params.colorBack as string) || "#909090"),
    u_colorHighlight: colorToVec4((params.colorHighlight as string) || "#ffffff"),
    u_image: image,
    u_imageAspectRatio: imageAspectRatio,
    u_highlights: (params.highlights as number) ?? 0.07,
    u_layering: (params.layering as number) ?? 0.5,
    u_edges: (params.edges as number) ?? 0.8,
    u_waves: (params.waves as number) ?? 0.3,
    u_caustic: (params.caustic as number) ?? 0.1,
    u_size: (params.size as number) ?? 1,
  };
}

export const waterShader: ShaderDefinition = {
  id: "water",
  name: "Water",
  description: "Water distortion effect with caustics and waves - interactive ripples on mouse hover",
  category: "Interactive",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    colorBack: "#909090",
    colorHighlight: "#ffffff",
    highlights: 0.07,
    layering: 0.5,
    edges: 0.8,
    waves: 0.3,
    caustic: 0.1,
    size: 1,
  },
  paramDefinitions: {
    image: {
      control: { type: "imageUrl", label: "Image" },
      defaultValue: "",
      stickyOnPresetApply: true,
    },
    colorBack: {
      control: { type: "color", label: "Background" },
      defaultValue: "#909090",
      hidden: true,
    },
    colorHighlight: {
      control: { type: "color", label: "Highlight" },
      defaultValue: "#ffffff",
    },
    highlights: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      defaultValue: 0.07,
    },
    layering: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      defaultValue: 0.5,
    },
    edges: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      defaultValue: 0.8,
    },
    waves: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      defaultValue: 0.3,
    },
    caustic: {
      control: {
        type: "slider",
        min: 0,
        max: 1,
        step: 0.01,
      },
      defaultValue: 0.1,
    },
    size: {
      control: {
        type: "slider",
        min: 0.1,
        max: 2,
        step: 0.01,
      },
      defaultValue: 1,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        colorBack: "#909090",
        colorHighlight: "#ffffff",
        highlights: 0.07,
        layering: 0.5,
        edges: 0.8,
        waves: 0.3,
        caustic: 0.1,
        size: 1,
      },
    },
    {
      name: "Abstract",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        colorBack: "#909090",
        colorHighlight: "#ffffff",
        highlights: 0,
        layering: 0,
        edges: 1,
        waves: 1,
        caustic: 0.4,
        size: 0.15,
      },
    },
    {
      name: "Streaming",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        colorBack: "#909090",
        colorHighlight: "#ffffff",
        highlights: 0,
        layering: 0,
        edges: 0,
        waves: 0.5,
        caustic: 0,
        size: 0.5,
      },
    },
    {
      name: "Slow-mo",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        colorBack: "#909090",
        colorHighlight: "#ffffff",
        highlights: 0.4,
        layering: 0,
        edges: 0,
        waves: 0,
        caustic: 0.2,
        size: 0.7,
      },
    },
  ],
  paramsToUniforms,
};
