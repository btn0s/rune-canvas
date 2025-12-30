import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import { declarePI, rotation2, colorBandingFix } from "../shader-utils";
import { colorToVec4 } from "../types";

const maxColorCount = 10;

// Heatmap shader adapted from paper-design/shaders
// A glowing gradient of colors flowing through an input shape
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform float u_time;
uniform float u_imageAspectRatio;

uniform vec4 u_colorBack;
uniform vec4 u_colors[${maxColorCount}];
uniform float u_colorsCount;

uniform float u_angle;
uniform float u_noise;
uniform float u_innerGlow;
uniform float u_outerGlow;
uniform float u_contour;

uniform bool u_isImage;

in vec2 v_imageUV;
in vec2 v_objectUV;
out vec4 fragColor;

${declarePI}
${rotation2}

float getImgFrame(vec2 uv, float th) {
  float frame = 1.;
  frame *= smoothstep(0., th, uv.y);
  frame *= 1. - smoothstep(1. - th, 1., uv.y);
  frame *= smoothstep(0., th, uv.x);
  frame *= 1. - smoothstep(1. - th, 1., uv.x);
  return frame;
}

float circle(vec2 uv, vec2 c, vec2 r) {
  return 1. - smoothstep(r[0], r[1], length(uv - c));
}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float sst(float edge0, float edge1, float x) {
  return smoothstep(edge0, edge1, x);
}

float shadowShape(vec2 uv, float t, float contour) {
  vec2 scaledUV = uv;

  // base shape trajectory
  float posY = mix(-1., 2., t);

  // scaleX when it's moving down
  scaledUV.y -= .5;
  float mainCircleScale = sst(0., .8, posY) * lst(1.4, .9, posY);
  scaledUV *= vec2(1., 1. + 1.5 * mainCircleScale);
  scaledUV.y += .5;

  // base shape
  float innerR = .4;
  float outerR = 1. - .3 * (sst(.1, .2, t) * (1. - sst(.2, .5, t)));
  float s = circle(scaledUV, vec2(.5, posY - .2), vec2(innerR, outerR));
  float shapeSizing = sst(.2, .3, t) * sst(.6, .3, t);
  s = pow(s, 1.4);
  s *= 1.2;

  // flat gradient to take over the shadow shape
  float topFlattener = 0.;
  {
    float pos = posY - uv.y;
    float edge = 1.2;
    topFlattener = lst(-.4, 0., pos) * (1. - sst(.0, edge, pos));
    topFlattener = pow(topFlattener, 3.);
    float topFlattenerMixer = (1. - sst(.0, .3, pos));
    s = mix(topFlattener, s, topFlattenerMixer);
  }

  // apple right circle
  {
    float visibility = sst(.6, .7, t) * (1. - sst(.8, .9, t));
    float angle = -2. -t * TWO_PI;
    float rightCircle = circle(uv, vec2(.95 - .2 * cos(angle), .4 - .1 * sin(angle)), vec2(.15, .3));
    rightCircle *= visibility;
    s = mix(s, 0., rightCircle);
  }

  // apple top circle
  {
    float topCircle = circle(uv, vec2(.5, .19), vec2(.05, .25));
    topCircle += 2. * contour * circle(uv, vec2(.5, .19), vec2(.2, .5));
    float visibility = .55 * sst(.2, .3, t) * (1. - sst(.3, .45, t));
    topCircle *= visibility;
    s = mix(s, 0., topCircle);
  }

  float leafMask = circle(uv, vec2(.53, .13), vec2(.08, .19));
  leafMask = mix(leafMask, 0., 1. - sst(.4, .54, uv.x));
  leafMask = mix(0., leafMask, sst(.0, .2, uv.y));
  leafMask *= (sst(.5, 1.1, posY) * sst(1.5, 1.3, posY));
  s += leafMask;

  // apple bottom circle
  {
    float visibility = sst(.0, .4, t) * (1. - sst(.6, .8, t));
    s = mix(s, 0., visibility * circle(uv, vec2(.52, .92), vec2(.09, .25)));
  }

  // random balls that are invisible if apple logo is selected
  {
    float pos = sst(.0, .6, t) * (1. - sst(.6, 1., t));
    s = mix(s, .5, circle(uv, vec2(.0, 1.2 - .5 * pos), vec2(.1, .3)));
    s = mix(s, .0, circle(uv, vec2(1., .5 + .5 * pos), vec2(.1, .3)));

    s = mix(s, 1., circle(uv, vec2(.95, .2 + .2 * sst(.3, .4, t) * sst(.7, .5, t)), vec2(.07, .22)));
    s = mix(s, 1., circle(uv, vec2(.95, .2 + .2 * sst(.3, .4, t) * (1. - sst(.5, .7, t))), vec2(.07, .22)));
    s /= max(1e-4, sst(1., .85, uv.y));
  }

  s = clamp(0., 1., s);
  return s;
}

float blurEdge3x3(sampler2D tex, vec2 uv, vec2 dudx, vec2 dudy, float radius, float centerSample) {
  vec2 texel = 1.0 / vec2(textureSize(tex, 0));
  vec2 r = radius * texel;

  float w1 = 1.0, w2 = 2.0, w4 = 4.0;
  float norm = 16.0;
  float sum = w4 * centerSample;

  sum += w2 * textureGrad(tex, uv + vec2(0.0, -r.y), dudx, dudy).g;
  sum += w2 * textureGrad(tex, uv + vec2(0.0, r.y), dudx, dudy).g;
  sum += w2 * textureGrad(tex, uv + vec2(-r.x, 0.0), dudx, dudy).g;
  sum += w2 * textureGrad(tex, uv + vec2(r.x, 0.0), dudx, dudy).g;

  sum += w1 * textureGrad(tex, uv + vec2(-r.x, -r.y), dudx, dudy).g;
  sum += w1 * textureGrad(tex, uv + vec2(r.x, -r.y), dudx, dudy).g;
  sum += w1 * textureGrad(tex, uv + vec2(-r.x, r.y), dudx, dudy).g;
  sum += w1 * textureGrad(tex, uv + vec2(r.x, r.y), dudx, dudy).g;

  return sum / norm;
}

// Diamond SDF for procedural shape
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

void main() {
  vec2 uv = v_objectUV + .5;
  uv.y = 1. - uv.y;

  float t = .1 * u_time;
  t -= .3;

  float tCopy = t + 1. / 3.;
  float tCopy2 = t + 2. / 3.;

  t = mod(t, 1.);
  tCopy = mod(tCopy, 1.);
  tCopy2 = mod(tCopy2, 1.);

  float shape = 0.;
  float outerBlur = 0.;
  float innerBlur = 0.;
  float contour = 0.;
  float imgSoftFrame = 1.;
  vec2 animationUV = uv;

  if (u_isImage == true) {
    // Image-based mode
    // v_imageUV is already properly centered and scaled by the vertex shader
    vec2 imgUV = v_imageUV;
    imgSoftFrame = getImgFrame(imgUV, .03);

    vec4 img = texture(u_image, imgUV);
    vec2 dudx = dFdx(imgUV);
    vec2 dudy = dFdy(imgUV);

    if (img.a == 0.) {
      fragColor = u_colorBack;
      return;
    }

    animationUV = imgUV - vec2(.5);
    float angle = -u_angle * PI / 180.;
    float cosA = cos(angle);
    float sinA = sin(angle);
    animationUV = vec2(
      animationUV.x * cosA - animationUV.y * sinA,
      animationUV.x * sinA + animationUV.y * cosA
    ) + vec2(.5);

    shape = img[0];
    img[1] = blurEdge3x3(u_image, imgUV, dudx, dudy, 8., img[1]);

    outerBlur = 1. - mix(1., img[1], shape);
    innerBlur = mix(img[1], 0., shape);
    contour = mix(img[2], 0., shape);

    outerBlur *= imgSoftFrame;
  } else {
    // Procedural diamond shape mode
    shape = diamondSDF(uv);
    
    // Calculate edge distance for glow effects
    float edgeDist = 1. - shape;
    
    // Anti-alias the edge using fwidth for smoother transitions
    float edgeAA = fwidth(edgeDist);
    outerBlur = pow(edgeDist, .8);
    innerBlur = pow(shape, 1.2);
    contour = smoothstep(.9 - edgeAA, .9 + edgeAA, edgeDist);

    animationUV = uv - vec2(.5);
    float angle = -u_angle * PI / 180.;
    float cosA = cos(angle);
    float sinA = sin(angle);
    animationUV = vec2(
      animationUV.x * cosA - animationUV.y * sinA,
      animationUV.x * sinA + animationUV.y * cosA
    ) + vec2(.5);
  }

  float shadow = shadowShape(animationUV, t, innerBlur);
  float shadowCopy = shadowShape(animationUV, tCopy, innerBlur);
  float shadowCopy2 = shadowShape(animationUV, tCopy2, innerBlur);

  float inner = .8 + .8 * innerBlur;
  inner = mix(inner, 0., shadow);
  inner = mix(inner, 0., shadowCopy);
  inner = mix(inner, 0., shadowCopy2);

  inner *= mix(0., 2., u_innerGlow);

  inner += (u_contour * 2.) * contour;
  inner = min(1., inner);
  inner *= (1. - shape);

  float outer = 0.;
  {
    float animT = t * 3.;
    animT = mod(animT - .1, 1.);

    outer = .9 * pow(outerBlur, .8);
    float y = mod(animationUV.y - animT, 1.);
    float animatedMask = sst(.3, .65, y) * (1. - sst(.65, 1., y));
    animatedMask = .5 + animatedMask;
    outer *= animatedMask;
    outer *= mix(0., 5., pow(u_outerGlow, 2.));
    if (u_isImage == true) {
      outer *= imgSoftFrame;
    }
  }

  inner = pow(inner, 1.2);
  float heat = clamp(inner + outer, 0., 1.);

  heat += (.005 + .35 * u_noise) * (fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453123) - .5);

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

export function toProcessedHeatmap(
  file: File | string
): Promise<{ blob: Blob }> {
  const canvas = document.createElement("canvas");
  const canvasSize = 1000;
  const isBlob = typeof file === "string" && file.startsWith("blob:");

  return new Promise((resolve, reject) => {
    const blobContentTypePromise =
      isBlob && fetch(file).then((res) => res.headers.get("Content-Type"));
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.addEventListener("load", async () => {
      let isSVG;

      const blobContentType = await blobContentTypePromise;

      if (blobContentType) {
        isSVG = blobContentType === "image/svg+xml";
      } else if (typeof file === "string") {
        isSVG = file.endsWith(".svg") || file.startsWith("data:image/svg+xml");
      } else {
        isSVG = file.type === "image/svg+xml";
      }

      let ratio = image.naturalWidth / image.naturalHeight;
      
      if (isSVG) {
        // Force SVG to load at high fidelity size
        // Handle SVGs without explicit dimensions
        if (image.naturalWidth === 0 || image.naturalHeight === 0 || !isFinite(ratio)) {
          image.width = canvasSize;
          image.height = canvasSize;
          ratio = 1;
        } else {
          // Preserve aspect ratio for SVG
          if (ratio > 1) {
            image.width = canvasSize;
            image.height = canvasSize / ratio;
          } else {
            image.width = canvasSize * ratio;
            image.height = canvasSize;
          }
        }
      }

      // Use set dimensions if natural dimensions are unavailable
      if (!isFinite(ratio) || ratio === 0) {
        ratio = (image.width || canvasSize) / (image.height || canvasSize);
      }

      const maxBlur = Math.floor(canvasSize * 0.15);
      const padding = Math.ceil(maxBlur * 2.5);
      let imgWidth = canvasSize;
      let imgHeight = canvasSize;
      if (ratio > 1) {
        imgHeight = Math.floor(canvasSize / ratio);
      } else {
        imgWidth = Math.floor(canvasSize * ratio);
      }

      canvas.width = imgWidth + 2 * padding;
      canvas.height = imgHeight + 2 * padding;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        throw new Error("Failed to get canvas 2d context");
      }

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, padding, padding, imgWidth, imgHeight);

      const { width, height } = canvas;
      const srcImageData = ctx.getImageData(0, 0, width, height);
      const src = srcImageData.data;

      const totalPixels = width * height;
      const gray = new Uint8ClampedArray(totalPixels);
      for (let i = 0; i < totalPixels; i++) {
        const px = i * 4;
        const r = src[px] ?? 0;
        const g = src[px + 1] ?? 0;
        const b = src[px + 2] ?? 0;
        gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
      }

      const bigBlurRadius = maxBlur;
      const innerBlurRadius = Math.max(1, Math.round(0.12 * maxBlur));
      const contourRadius = 5;

      const bigBlurGray = multiPassBlurGray(
        gray,
        width,
        height,
        bigBlurRadius,
        3
      );
      const innerBlurGray = multiPassBlurGray(
        gray,
        width,
        height,
        innerBlurRadius,
        3
      );
      const contourGray = multiPassBlurGray(
        gray,
        width,
        height,
        contourRadius,
        1
      );

      const processedImageData = ctx.createImageData(width, height);
      const dst = processedImageData.data;

      for (let i = 0; i < totalPixels; i++) {
        const px = i * 4;
        dst[px] = contourGray[i] ?? 0;
        dst[px + 1] = bigBlurGray[i] ?? 0;
        dst[px + 2] = innerBlurGray[i] ?? 0;
        dst[px + 3] = 255;
      }

      ctx.putImageData(processedImageData, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create PNG blob"));
          return;
        }
        resolve({ blob });
      }, "image/png");
    });

    image.addEventListener("error", () => {
      reject(new Error("Failed to load image"));
    });

    image.src = typeof file === "string" ? file : URL.createObjectURL(file);
  });
}

function blurGray(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  if (radius <= 0) {
    return gray.slice();
  }

  const out = new Uint8ClampedArray(width * height);
  const integral = new Uint32Array(width * height);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const v = gray[idx] ?? 0;
      rowSum += v;
      integral[idx] = rowSum + (y > 0 ? integral[idx - width] ?? 0 : 0);
    }
  }

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(width - 1, x + radius);

      const idxA = y2 * width + x2;
      const idxB = y2 * width + (x1 - 1);
      const idxC = (y1 - 1) * width + x2;
      const idxD = (y1 - 1) * width + (x1 - 1);

      const A = integral[idxA] ?? 0;
      const B = x1 > 0 ? integral[idxB] ?? 0 : 0;
      const C = y1 > 0 ? integral[idxC] ?? 0 : 0;
      const D = x1 > 0 && y1 > 0 ? integral[idxD] ?? 0 : 0;

      const sum = A - B - C + D;
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      out[y * width + x] = Math.round(sum / area);
    }
  }

  return out;
}

function multiPassBlurGray(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  passes: number
): Uint8ClampedArray {
  if (radius <= 0 || passes <= 1) {
    return blurGray(gray, width, height, radius);
  }

  let input = gray;
  let tmp: Uint8ClampedArray = gray;

  for (let p = 0; p < passes; p++) {
    tmp = blurGray(input, width, height, radius);
    input = tmp;
  }

  return tmp;
}

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const image = params.image as HTMLImageElement | string | undefined;
  let imageAspectRatio = 1;
  if (image instanceof HTMLImageElement) {
    imageAspectRatio = image.naturalWidth / image.naturalHeight;
  }

  const isImage = image !== undefined && image !== "";

  const colors = (params.colors as string[]) || [
    "#0000ff",
    "#00ffff",
    "#ff8800",
    "#ff0000",
  ];
  const colorVecs = colors.map(colorToVec4);
  while (colorVecs.length < maxColorCount) {
    colorVecs.push([0, 0, 0, 0]);
  }

  return {
    u_image: image,
    u_imageAspectRatio: imageAspectRatio,
    u_colors: colorVecs.flat(),
    u_colorsCount: colors.length,
    u_colorBack: colorToVec4((params.colorBack as string) || "#000000"),
    u_angle: (params.angle as number) ?? 0,
    u_noise: (params.noise as number) ?? 0.1,
    u_innerGlow: (params.innerGlow as number) ?? 0.5,
    u_outerGlow: (params.outerGlow as number) ?? 0.3,
    u_contour: (params.contour as number) ?? 0.5,
    u_isImage: isImage,
  };
}

export const heatmapShader: ShaderDefinition = {
  id: "heatmap",
  name: "Heatmap",
  description:
    "A glowing gradient of colors flowing through an input shape. Uses diamond shape by default or custom image.",
  category: "Logo animations",
  fragmentShader,
  defaultParams: {
    image: "",
    shape: "diamond",
    colors: ["#0000ff", "#00ffff", "#ff8800", "#ff0000"],
    colorBack: "#000000",
    angle: 0,
    noise: 0.1,
    innerGlow: 0.5,
    outerGlow: 0.3,
    contour: 0.5,
  },
  paramDefinitions: {
    image: {
      control: { type: "imageUrl", label: "Image" },
      defaultValue: "",
      stickyOnPresetApply: true,
    },
    shape: {
      control: {
        type: "enum",
        options: ["diamond"],
        label: "Shape",
      },
      defaultValue: "diamond",
    },
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
        image: "",
        shape: "diamond",
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
        image: "",
        shape: "diamond",
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
        image: "",
        shape: "diamond",
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
        image: "",
        shape: "diamond",
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
