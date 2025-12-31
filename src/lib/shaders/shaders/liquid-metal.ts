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
// Supports both custom images and procedural shapes
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform float u_imageAspectRatio;

uniform vec2 u_resolution;
uniform float u_time;

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
uniform bool u_isImage;

in vec2 v_objectUV;
in vec2 v_imageUV;
out vec4 fragColor;

${declarePI}
${rotation2}
${simplexNoise}

float getColorChanges(float c1, float c2, float stripe_p, vec3 w, float blur, float bump, float tint) {
  float ch = mix(c2, c1, smoothstep(.0, 2. * blur, stripe_p));

  float border = w[0];
  ch = mix(ch, c2, smoothstep(border, border + 2. * blur, stripe_p));

  if (u_isImage == true) {
    bump = smoothstep(.2, .8, bump);
  }
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

float getImgFrame(vec2 uv, float th) {
  float frame = 1.;
  frame *= smoothstep(0., th, uv.y);
  frame *= 1.0 - smoothstep(1. - th, 1., uv.y);
  frame *= smoothstep(0., th, uv.x);
  frame *= 1.0 - smoothstep(1. - th, 1., uv.x);
  return frame;
}

float blurEdge3x3(sampler2D tex, vec2 uv, vec2 dudx, vec2 dudy, float radius, float centerSample) {
  vec2 texel = 1.0 / vec2(textureSize(tex, 0));
  vec2 r = radius * texel;

  float w1 = 1.0, w2 = 2.0, w4 = 4.0;
  float norm = 16.0;
  float sum = w4 * centerSample;

  sum += w2 * textureGrad(tex, uv + vec2(0.0, -r.y), dudx, dudy).r;
  sum += w2 * textureGrad(tex, uv + vec2(0.0, r.y), dudx, dudy).r;
  sum += w2 * textureGrad(tex, uv + vec2(-r.x, 0.0), dudx, dudy).r;
  sum += w2 * textureGrad(tex, uv + vec2(r.x, 0.0), dudx, dudy).r;

  sum += w1 * textureGrad(tex, uv + vec2(-r.x, -r.y), dudx, dudy).r;
  sum += w1 * textureGrad(tex, uv + vec2(r.x, -r.y), dudx, dudy).r;
  sum += w1 * textureGrad(tex, uv + vec2(-r.x, r.y), dudx, dudy).r;
  sum += w1 * textureGrad(tex, uv + vec2(r.x, r.y), dudx, dudy).r;

  return sum / norm;
}

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main() {
  const float firstFrameOffset = 2.8;
  float t = .3 * (u_time + firstFrameOffset);

  vec2 uv;
  vec2 dudx;
  vec2 dudy;
  vec4 img = vec4(0.);

  if (u_isImage == true) {
    uv = v_imageUV;
    dudx = dFdx(v_imageUV);
    dudy = dFdy(v_imageUV);
    img = textureGrad(u_image, uv, dudx, dudy);
  } else {
    uv = v_objectUV + .5;
    uv.y = 1. - uv.y;
  }

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

  if (u_isImage == true) {
    float edgeRaw = img.r;
    edge = blurEdge3x3(u_image, uv, dudx, dudy, 6., edgeRaw);
    edge = pow(edge, 1.6);
    edge *= mix(0.0, 1.0, smoothstep(0.0, 0.4, u_contour));
  } else {
    if (u_shape < 2.) {
      // circle
      vec2 shapeUV = uv - .5;
      shapeUV *= .67;
      float dist = 3. * length(shapeUV);
      // Anti-alias circle edge
      float aa = fwidth(dist);
      edge = pow(clamp(dist, 0., 1.), 18.);
      edge = smoothstep(1.0 - aa, 1.0 + aa, edge);
    } else if (u_shape < 3.) {
      // daisy
      vec2 shapeUV = uv - .5;
      shapeUV *= 1.68;

      float r = length(shapeUV) * 2.;
      float a = atan(shapeUV.y, shapeUV.x) + .2;
      r *= (1. + .05 * sin(3. * a + 2. * t));
      float f = abs(cos(a * 3.));
      // Anti-alias daisy edge
      float aa = fwidth(r);
      edge = smoothstep(f - aa, f + .7 + aa, r);
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
      // Anti-alias diamond edges
      vec2 aa = fwidth(mask);
      float maskX = smoothstep(0.0 - aa.x, pixel_thickness.x + aa.x, mask.x);
      float maskY = smoothstep(0.0 - aa.y, pixel_thickness.y + aa.y, mask.y);
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
      // Anti-alias metaballs edge
      float aa = fwidth(edge);
      edge = 1. - smoothstep(.65 - aa, .9 + aa, edge);
      edge = pow(edge, 4.);
    }

    // Apply anti-aliasing to final edge with contour control
    float edgeAA = fwidth(edge);
    edge = mix(smoothstep(.9 - 2. * edgeAA, .9 + 2. * edgeAA, edge), edge, smoothstep(0.0, 0.4, u_contour));
  }

  float opacity = 0.;
  if (u_isImage == true) {
    opacity = img.g;
    // Anti-alias image frame edges
    float frame = getImgFrame(v_imageUV, 0.);
    opacity *= frame;
  } else {
    // Improved anti-aliasing for procedural shapes
    float opacityAA = fwidth(edge);
    opacity = 1. - smoothstep(.9 - 2. * opacityAA, .9 + 2. * opacityAA, edge);
    if (u_shape < 2.) {
      edge = 1.2 * edge;
    } else if (u_shape < 5.) {
      edge = 1.8 * pow(edge, 1.5);
    }
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

  float blur = 0.;
  float rExtraBlur = 0.;
  float gExtraBlur = 0.;
  if (u_isImage == true) {
    float softness = 0.05 * u_softness;
    blur = softness + .5 * smoothstep(1., 10., u_repetition) * smoothstep(.0, 1., edge);
    float smallCanvasT = 1.0 - smoothstep(100., 500., min(u_resolution.x, u_resolution.y));
    blur += smallCanvasT * smoothstep(.0, 1., edge);
    rExtraBlur = softness * (0.05 + .1 * (u_shiftRed / 20.) * bump);
    gExtraBlur = softness * 0.05 / max(0.001, abs(1. - diagBLtoTR));
  } else {
    blur = u_softness / 15. + .3 * contour;
  }

  vec3 w = vec3(thin_strip_1_width, thin_strip_2_width, wide_strip_ratio);
  w[1] -= .02 * smoothstep(.0, 1., edge + bump);
  float stripe_r = fract(direction + dispersionRed);
  float r = getColorChanges(color1.r, color2.r, stripe_r, w, blur + fwidth(stripe_r) + rExtraBlur, bump, u_colorTint.r);
  float stripe_g = fract(direction);
  float g = getColorChanges(color1.g, color2.g, stripe_g, w, blur + fwidth(stripe_g) + gExtraBlur, bump, u_colorTint.g);
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

// Configuration for Poisson solver
const POISSON_CONFIG_OPTIMIZED = {
  measurePerformance: false,
  workingSize: 512,
  iterations: 40,
};

// Precomputed pixel data for sparse processing
interface SparsePixelData {
  interiorPixels: Uint32Array;
  boundaryPixels: Uint32Array;
  pixelCount: number;
  neighborIndices: Int32Array;
}

export function toProcessedLiquidMetal(
  file: File | string
): Promise<{ imageData: ImageData; pngBlob: Blob }> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const isBlob = typeof file === "string" && file.startsWith("blob:");

  return new Promise((resolve, reject) => {
    if (!file || !ctx) {
      reject(new Error("Invalid file or canvas context"));
      return;
    }

    const blobContentTypePromise =
      isBlob && fetch(file).then((res) => res.headers.get("Content-Type"));
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      let isSVG;

      const blobContentType = await blobContentTypePromise;

      if (blobContentType) {
        isSVG = blobContentType === "image/svg+xml";
      } else if (typeof file === "string") {
        isSVG = file.endsWith(".svg") || file.startsWith("data:image/svg+xml");
      } else {
        isSVG = file.type === "image/svg+xml";
      }

      let originalWidth = img.width || img.naturalWidth;
      let originalHeight = img.height || img.naturalHeight;

      if (isSVG) {
        const svgMaxSize = 4096;
        // Handle SVGs without explicit dimensions (default to square if dimensions are 0)
        if (originalWidth === 0 || originalHeight === 0) {
          originalWidth = svgMaxSize;
          originalHeight = svgMaxSize;
        } else {
          const aspectRatio = originalWidth / originalHeight;

          if (originalWidth > originalHeight) {
            originalWidth = svgMaxSize;
            originalHeight = svgMaxSize / aspectRatio;
          } else {
            originalHeight = svgMaxSize;
            originalWidth = svgMaxSize * aspectRatio;
          }
        }

        img.width = originalWidth;
        img.height = originalHeight;
      }

      const minDimension = Math.min(originalWidth, originalHeight);
      const targetSize = POISSON_CONFIG_OPTIMIZED.workingSize;

      const scaleFactor = targetSize / minDimension;
      const width = Math.round(originalWidth * scaleFactor);
      const height = Math.round(originalHeight * scaleFactor);

      canvas.width = originalWidth;
      canvas.height = originalHeight;

      const shapeCanvas = document.createElement("canvas");
      shapeCanvas.width = width;
      shapeCanvas.height = height;

      const shapeCtx = shapeCanvas.getContext("2d")!;
      shapeCtx.drawImage(img, 0, 0, width, height);

      const shapeImageData = shapeCtx.getImageData(0, 0, width, height);
      const data = shapeImageData.data;

      const shapeMask = new Uint8Array(width * height);
      const boundaryMask = new Uint8Array(width * height);

      let shapePixelCount = 0;
      for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
        const a = data[i + 3];
        const isShape = a === 0 ? 0 : 1;
        shapeMask[idx] = isShape;
        shapePixelCount += isShape;
      }

      const boundaryIndices: number[] = [];
      const interiorIndices: number[] = [];

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (!shapeMask[idx]) continue;

          let isBoundary = false;

          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            isBoundary = true;
          } else {
            isBoundary =
              !shapeMask[idx - 1] ||
              !shapeMask[idx + 1] ||
              !shapeMask[idx - width] ||
              !shapeMask[idx + width] ||
              !shapeMask[idx - width - 1] ||
              !shapeMask[idx - width + 1] ||
              !shapeMask[idx + width - 1] ||
              !shapeMask[idx + width + 1];
          }

          if (isBoundary) {
            boundaryMask[idx] = 1;
            boundaryIndices.push(idx);
          } else {
            interiorIndices.push(idx);
          }
        }
      }

      const sparseData = buildSparseData(
        shapeMask,
        new Uint32Array(interiorIndices),
        new Uint32Array(boundaryIndices),
        width,
        height
      );

      const u = solvePoissonSparse(
        sparseData,
        width,
        height
      );

      let maxVal = 0;
      let finalImageData: ImageData;

      for (let i = 0; i < interiorIndices.length; i++) {
        const idx = interiorIndices[i]!;
        if (u[idx]! > maxVal) maxVal = u[idx]!;
      }

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext("2d")!;

      const tempImg = tempCtx.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const px = idx * 4;

          if (!shapeMask[idx]) {
            tempImg.data[px] = 255;
            tempImg.data[px + 1] = 255;
            tempImg.data[px + 2] = 255;
            tempImg.data[px + 3] = 0;
          } else {
            const poissonRatio = u[idx]! / maxVal;
            const gray = 255 * (1 - poissonRatio);
            tempImg.data[px] = gray;
            tempImg.data[px + 1] = gray;
            tempImg.data[px + 2] = gray;
            tempImg.data[px + 3] = 255;
          }
        }
      }
      tempCtx.putImageData(tempImg, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        tempCanvas,
        0,
        0,
        width,
        height,
        0,
        0,
        originalWidth,
        originalHeight
      );

      const outImg = ctx.getImageData(0, 0, originalWidth, originalHeight);

      const originalCanvas = document.createElement("canvas");
      originalCanvas.width = originalWidth;
      originalCanvas.height = originalHeight;
      const originalCtx = originalCanvas.getContext("2d")!;
      originalCtx.drawImage(img, 0, 0, originalWidth, originalHeight);
      const originalData = originalCtx.getImageData(
        0,
        0,
        originalWidth,
        originalHeight
      );

      for (let i = 0; i < outImg.data.length; i += 4) {
        const a = originalData.data[i + 3]!;
        const upscaledAlpha = outImg.data[i + 3]!;
        if (a === 0) {
          outImg.data[i] = 255;
          outImg.data[i + 1] = 0;
        } else {
          outImg.data[i] = upscaledAlpha === 0 ? 0 : outImg.data[i]!;
          outImg.data[i + 1] = a;
        }

        outImg.data[i + 2] = 255;
        outImg.data[i + 3] = 255;
      }

      ctx.putImageData(outImg, 0, 0);
      finalImageData = outImg;
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create PNG blob"));
          return;
        }

        resolve({
          imageData: finalImageData,
          pngBlob: blob,
        });
      }, "image/png");
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = typeof file === "string" ? file : URL.createObjectURL(file);
  });
}

function buildSparseData(
  shapeMask: Uint8Array,
  interiorPixels: Uint32Array,
  boundaryPixels: Uint32Array,
  width: number,
  height: number
): SparsePixelData {
  const pixelCount = interiorPixels.length;

  const neighborIndices = new Int32Array(pixelCount * 4);

  for (let i = 0; i < pixelCount; i++) {
    const idx = interiorPixels[i]!;
    const x = idx % width;
    const y = Math.floor(idx / width);

    neighborIndices[i * 4 + 0] =
      x < width - 1 && shapeMask[idx + 1] ? idx + 1 : -1;
    neighborIndices[i * 4 + 1] = x > 0 && shapeMask[idx - 1] ? idx - 1 : -1;
    neighborIndices[i * 4 + 2] =
      y > 0 && shapeMask[idx - width] ? idx - width : -1;
    neighborIndices[i * 4 + 3] =
      y < height - 1 && shapeMask[idx + width] ? idx + width : -1;
  }

  return {
    interiorPixels,
    boundaryPixels,
    pixelCount,
    neighborIndices,
  };
}

function solvePoissonSparse(
  sparseData: SparsePixelData,
  width: number,
  height: number
): Float32Array {
  const ITERATIONS = POISSON_CONFIG_OPTIMIZED.iterations;
  const C = 0.01;

  const u = new Float32Array(width * height);
  const { interiorPixels, neighborIndices, pixelCount } = sparseData;

  const omega = 1.9;

  const redPixels: number[] = [];
  const blackPixels: number[] = [];

  for (let i = 0; i < pixelCount; i++) {
    const idx = interiorPixels[i]!;
    const x = idx % width;
    const y = Math.floor(idx / width);

    if ((x + y) % 2 === 0) {
      redPixels.push(i);
    } else {
      blackPixels.push(i);
    }
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const i of redPixels) {
      const idx = interiorPixels[i]!;

      const eastIdx = neighborIndices[i * 4 + 0]!;
      const westIdx = neighborIndices[i * 4 + 1]!;
      const northIdx = neighborIndices[i * 4 + 2]!;
      const southIdx = neighborIndices[i * 4 + 3]!;

      let sumN = 0;
      if (eastIdx >= 0) sumN += u[eastIdx]!;
      if (westIdx >= 0) sumN += u[westIdx]!;
      if (northIdx >= 0) sumN += u[northIdx]!;
      if (southIdx >= 0) sumN += u[southIdx]!;

      const newValue = (C + sumN) / 4;
      u[idx] = omega * newValue + (1 - omega) * u[idx]!;
    }

    for (const i of blackPixels) {
      const idx = interiorPixels[i]!;

      const eastIdx = neighborIndices[i * 4 + 0]!;
      const westIdx = neighborIndices[i * 4 + 1]!;
      const northIdx = neighborIndices[i * 4 + 2]!;
      const southIdx = neighborIndices[i * 4 + 3]!;

      let sumN = 0;
      if (eastIdx >= 0) sumN += u[eastIdx]!;
      if (westIdx >= 0) sumN += u[westIdx]!;
      if (northIdx >= 0) sumN += u[northIdx]!;
      if (southIdx >= 0) sumN += u[southIdx]!;

      const newValue = (C + sumN) / 4;
      u[idx] = omega * newValue + (1 - omega) * u[idx]!;
    }
  }

  return u;
}

const SHAPE_VALUES = {
  circle: 1,
  daisy: 2,
  diamond: 3,
  metaballs: 4,
} as const;

type ShapeType = keyof typeof SHAPE_VALUES;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  const image = params.image as HTMLImageElement | string | undefined;
  let imageAspectRatio = 1;
  if (image instanceof HTMLImageElement) {
    imageAspectRatio = image.naturalWidth / image.naturalHeight;
  }

  const isImage = image !== undefined && image !== "";
  const shape = (params.shape as ShapeType) || "diamond";
  const shapeValue = SHAPE_VALUES[shape] ?? SHAPE_VALUES.diamond;

  return {
    u_image: image,
    u_imageAspectRatio: imageAspectRatio,
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
    u_isImage: isImage,
  };
}

export const liquidMetalShader: ShaderDefinition = {
  id: "liquid-metal",
  name: "Liquid Metal",
  description:
    "Futuristic liquid metal material with animated stripe patterns. Supports custom images or procedural shapes.",
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
    image: {
      control: { type: "imageUrl", label: "Image" },
      defaultValue: "",
      stickyOnPresetApply: true,
    },
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
        options: ["circle", "daisy", "diamond", "metaballs"],
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
