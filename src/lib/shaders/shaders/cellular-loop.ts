import type {
  ShaderDefinition,
  ShaderParams,
  ShaderUniforms,
  ParamDefinitions,
} from "../types";
import { declarePI, proceduralHash21, colorBandingFix } from "../shader-utils";
import { colorToVec4 } from "../types";

// Cellular loop shader - animated cellular/voronoi-like pattern
// language=GLSL
const fragmentShader = `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_speed;
uniform float u_intensity;

in vec2 v_objectUV;
out vec4 fragColor;

${declarePI}
${proceduralHash21}

// Procedural dithering texture replacement
float ditherTexture(vec2 uv) {
  return hash21(floor(uv * 1024.0));
}

float loop(vec2 sqr_pos, out int cell_id, out float d, out float ocenter) {
    float center, 
          anim = u_time * u_speed,
       mindist = 1.,
  sec_min_dist = 1.;    
    for(float ii = 0.0; ii < 64.0; ii++)
    {
        float i = ii - floor(anim * 50.0),
              r = 0.02 * i + anim,
           dist = length( sqr_pos - r * vec2(cos(2.39996 * i + vec2(0.0, 11.0))) );
        if( ii < 4.0 )
            dist /= ( ii + fract(anim * 50.0) ) / 4.0;

        if( dist < mindist )
        {
            sec_min_dist = mindist;
            mindist = dist;
             center = r;
            cell_id = int(ii);
        }
        else if( dist < sec_min_dist )
            sec_min_dist = dist;
    }
    
    d = sec_min_dist - mindist;
    ocenter = center;
    return center;
}

void main() {
    vec2 R = u_resolution.xy;
    vec2 u = gl_FragCoord.xy;
    vec2 U = (u + u - R) / R.y; 
    float lenU = length(U);
    if (lenU > 0.0) {
        U *= smoothstep(-0.1, 1.0, lenU) / lenU;
    }
    
    float polar = dot(U, U);
    lenU = length(U);
    if (lenU > 0.0) {
        U /= lenU;
    }

    int cell_id, newcellid;
    float d, c, a, oc;
    float center = loop(U * polar, cell_id, d, oc);

    polar += smoothstep(0.6, 0.8, center) * 0.8;
    center = loop(U * polar, newcellid, d, oc);
    
    vec3 color = vec3(0.0);
    float opacity = 0.0;
    
    if( newcellid == cell_id )
    {
      c = ( exp(-40.0 * d) - exp(-45.0 * d) )
        * pow(smoothstep(-0.15, 0.1, (polar - center) / sqrt(center)), 4.0)
        * sqrt(smoothstep(0.0, 0.15, polar));
      c = max(c, 1e-8)
        * smoothstep(0.9, 0.7, center)
        * 8.0 * u_intensity;
      a = 1.0 - exp(-50.0 * d);
      a = max(a, max(smoothstep(0.5, 0.4, oc), 1.0 - pow(smoothstep(-0.15 * pow(center, 0.5), 0.1 * pow(center, 0.5), polar - center), 4.0)));
      a *= smoothstep(0.9, 0.6, center);
      
      // Use procedural dithering instead of texture
      float dither = ditherTexture(u / 1024.0);
      color = vec3(c > dither);
      opacity = a;
    }
    
    ${colorBandingFix}
    
    fragColor = vec4(color, opacity);
}
`;

function paramsToUniforms(params: ShaderParams): ShaderUniforms {
  return {
    u_speed: (params.speed as number) ?? 0.05,
    u_intensity: (params.intensity as number) ?? 1.0,
  };
}

export const cellularLoopShader: ShaderDefinition = {
  id: "cellular-loop",
  name: "Cellular Loop",
  description: "Animated cellular pattern with looping cells",
  category: "Effects",
  fragmentShader,
  defaultParams: {
    speed: 0.05,
    intensity: 1.0,
  },
  paramDefinitions: {
    speed: {
      control: {
        type: "slider",
        min: 0,
        max: 0.2,
        step: 0.001,
        label: "Speed",
      },
      defaultValue: 0.05,
    },
    intensity: {
      control: {
        type: "slider",
        min: 0,
        max: 2,
        step: 0.01,
        label: "Intensity",
      },
      defaultValue: 1.0,
    },
  } as ParamDefinitions,
  presets: [
    {
      name: "Default",
      params: {
        speed: 0.05,
        intensity: 1.0,
      },
    },
    {
      name: "Fast",
      params: {
        speed: 0.1,
        intensity: 1.2,
      },
    },
    {
      name: "Slow",
      params: {
        speed: 0.02,
        intensity: 0.8,
      },
    },
    {
      name: "Intense",
      params: {
        speed: 0.05,
        intensity: 1.5,
      },
    },
  ],
  paramsToUniforms,
};
