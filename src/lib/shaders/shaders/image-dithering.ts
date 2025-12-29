import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import { proceduralHash21 } from "../shader-utils";
import { colorToVec4 } from "../types";

// Image Dithering shader - requires image input
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform vec4 u_colorFront;
uniform vec4 u_colorBack;
uniform vec4 u_colorHighlight;
uniform sampler2D u_image;
uniform float u_imageAspectRatio;
uniform float u_type;
uniform float u_pxSize;
uniform bool u_originalColors;
uniform float u_colorSteps;

in vec2 v_imageUV;
out vec4 fragColor;

${proceduralHash21}

float getUvFrame(vec2 uv, vec2 pad) {
  float aa = 0.0001;

  float left   = smoothstep(-pad.x, -pad.x + aa, uv.x);
  float right  = smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x);
  float bottom = smoothstep(-pad.y, -pad.y + aa, uv.y);
  float top    = smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);

  return left * right * bottom * top;
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
  float pxSize = u_pxSize * u_pixelRatio;
  vec2 pxSizeUV = gl_FragCoord.xy - .5 * u_resolution;
  pxSizeUV /= pxSize;
  vec2 canvasPixelizedUV = (floor(pxSizeUV) + .5) * pxSize;
  vec2 normalizedUV = canvasPixelizedUV / u_resolution;

  // Use v_imageUV directly (simplified from Paper's getImageUV)
  vec2 imageUV = v_imageUV;
  vec2 ditheringNoiseUV = canvasPixelizedUV;
  vec4 image = texture(u_image, imageUV);
  float frame = getUvFrame(imageUV, pxSize / u_resolution);

  int type = int(floor(u_type));
  float dithering = 0.0;

  float lum = dot(vec3(.2126, .7152, .0722), image.rgb);

  switch (type) {
    case 1: {
      dithering = step(hash21(ditheringNoiseUV), lum);
    } break;
    case 2:
    dithering = getBayerValue(pxSizeUV, 2);
    break;
    case 3:
    dithering = getBayerValue(pxSizeUV, 4);
    break;
    default :
    dithering = getBayerValue(pxSizeUV, 8);
    break;
  }

  float colorSteps = max(floor(u_colorSteps), 1.);
  vec3 color = vec3(0.0);
  float opacity = 1.;

  dithering -= .5;
  float brightness = clamp(lum + dithering / colorSteps, 0.0, 1.0);
  brightness = mix(0.0, brightness, frame);
  brightness = mix(0.0, brightness, image.a);
  float quantLum = floor(brightness * colorSteps + 0.5) / colorSteps;
  quantLum = mix(0.0, quantLum, frame);

  if (u_originalColors == true) {
    vec3 normColor = image.rgb / max(lum, 0.001);
    color = normColor * quantLum;

    float quantAlpha = floor(image.a * colorSteps + 0.5) / colorSteps;
    opacity = mix(quantLum, 1., quantAlpha);
  } else {
    vec3 fgColor = u_colorFront.rgb * u_colorFront.a;
    float fgOpacity = u_colorFront.a;
    vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
    float bgOpacity = u_colorBack.a;
    vec3 hlColor = u_colorHighlight.rgb * u_colorHighlight.a;
    float hlOpacity = u_colorHighlight.a;

    fgColor = mix(fgColor, hlColor, step(1.02 - .02 * u_colorSteps, brightness));
    fgOpacity = mix(fgOpacity, hlOpacity, step(1.02 - .02 * u_colorSteps, brightness));

    color = fgColor * quantLum;
    opacity = fgOpacity * quantLum;
    color += bgColor * (1.0 - opacity);
    opacity += bgOpacity * (1.0 - opacity);
  }

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

  const typeMap: Record<string, number> = {
    random: 1,
    "2x2": 2,
    "4x4": 3,
    "8x8": 4,
  };

  return {
    u_colorFront: colorToVec4((params.colorFront as string) || "#94ffaf"),
    u_colorBack: colorToVec4((params.colorBack as string) || "#000c38"),
    u_colorHighlight: colorToVec4((params.colorHighlight as string) || "#eaff94"),
    u_image: image,
    u_imageAspectRatio: imageAspectRatio,
    u_type: typeMap[(params.type as string) || "8x8"] ?? 4,
    u_pxSize: (params.size as number) ?? (params.pxSize as number) ?? 2,
    u_colorSteps: (params.colorSteps as number) ?? 2,
    u_originalColors: (params.originalColors as boolean) ?? false,
  };
}

export const imageDitheringShader: ShaderDefinition = {
  id: "image-dithering",
  name: "Image Dithering",
  description: "Pixelated dithering effect on images",
  category: "Image filters",
  fragmentShader,
  defaultParams: {
    image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
    colorFront: "#94ffaf",
    colorBack: "#000c38",
    colorHighlight: "#eaff94",
    type: "8x8",
    size: 2,
    colorSteps: 2,
    originalColors: false,
  },
  paramDefinitions: {
    image: {
      control: { type: "imageUrl", label: "Image" },
      defaultValue: "",
    },
    colorFront: {
      control: { type: "color", label: "Foreground" },
      defaultValue: "#94ffaf",
    },
    colorBack: {
      control: { type: "color", label: "Background" },
      defaultValue: "#000c38",
    },
    colorHighlight: {
      control: { type: "color", label: "Highlight" },
      defaultValue: "#eaff94",
    },
    type: {
      control: {
        type: "enum",
        options: ["random", "2x2", "4x4", "8x8"],
        label: "Type",
      },
      defaultValue: "8x8",
    },
    size: {
      control: {
        type: "slider",
        min: 1,
        max: 10,
        step: 0.5,
      },
      defaultValue: 2,
    },
    colorSteps: {
      control: {
        type: "slider",
        min: 1,
        max: 10,
        step: 1,
      },
      defaultValue: 2,
    },
    originalColors: {
      control: {
        type: "boolean",
        label: "Original Colors",
      },
      defaultValue: false,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        colorFront: "#94ffaf",
        colorBack: "#000c38",
        colorHighlight: "#eaff94",
        type: "8x8",
        size: 2,
        colorSteps: 2,
        originalColors: false,
      },
    },
    {
      name: "Retro",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        colorFront: "#eeeeee",
        colorBack: "#5452ff",
        colorHighlight: "#eeeeee",
        type: "2x2",
        size: 3,
        colorSteps: 1,
        originalColors: true,
      },
    },
    {
      name: "Noise",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        colorFront: "#a2997c",
        colorBack: "#000000",
        colorHighlight: "#ededed",
        type: "random",
        size: 1,
        colorSteps: 1,
        originalColors: false,
      },
    },
    {
      name: "Natural",
      params: {
        image: "https://pbs.twimg.com/profile_images/1945653061814218752/dFO6qg7z_400x400.jpg",
        colorFront: "#ffffff",
        colorBack: "#000000",
        colorHighlight: "#ffffff",
        type: "8x8",
        size: 2,
        colorSteps: 5,
        originalColors: true,
      },
    },
  ],
  paramsToUniforms,
};
