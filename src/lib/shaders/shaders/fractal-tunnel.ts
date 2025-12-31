import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import { declarePI, colorBandingFix } from "../shader-utils";
import { colorToVec4 } from "../types";

// Fractal tunnel shader based on coyote => https://www.shadertoy.com/view/ltfGzS
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_colorBack;

in vec2 v_objectUV;
out vec4 fragColor;

${declarePI}

// Matrix rotation around Y axis
mat3 getRotYMat(float a) {
  return mat3(
    cos(a), 0., sin(a),
    0., 1., 0.,
    -sin(a), 0., cos(a)
  );
}

void main() {
  vec2 s = u_resolution.xy;
  float t = u_time * 0.2;
  float c, d, m;
  
  // Convert fragCoord to normalized coordinates centered at origin
  vec2 fragCoord = gl_FragCoord.xy;
  vec3 p = vec3((2. * fragCoord.xy - s) / s.x, 1.);
  vec3 r = p - p;
  vec3 q = r;
  
  // Apply rotation
  p *= getRotYMat(-t);
  q.zx += 10. + vec2(sin(t), cos(t)) * 3.;
  
  // Ray marching loop
  for (float i = 1.; i > 0.; i -= 0.01) {
    c = d = 0.;
    m = 1.;
    
    // Fractal iteration
    for (int j = 0; j < 3; j++) {
      r = max(r *= r *= r *= r = mod(q * m + 1., 2.) - 1., r.yzx);
      d = max(d, (0.29 - length(r) * 0.6) / m) * 0.8;
      m *= 1.1;
    }
    
    q += p * d;
    c = i;
    
    if (d < 1e-5) break;
  }
  
  // Color calculation
  float k = dot(r, r + 0.15);
  vec3 color = vec3(1., k, k / c) - 0.8;
  
  ${colorBandingFix}
  
  fragColor = vec4(color, 1.0);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  return {
    u_colorBack: colorToVec4((params.colorBack as string) || "#000000"),
  };
}

export const fractalTunnelShader: ShaderDefinition = {
  id: "fractal-tunnel",
  name: "Fractal Tunnel",
  description: "3D fractal tunnel effect with rotating perspective",
  category: "Effects",
  fragmentShader,
  defaultParams: {
    colorBack: "#000000",
  },
  paramDefinitions: {
    colorBack: {
      control: { type: "color", label: "Background" },
      defaultValue: "#000000",
      hidden: true,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        colorBack: "#000000",
      },
    },
  ],
  paramsToUniforms,
};
