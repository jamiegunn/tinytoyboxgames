/**
 * Procedural surface detail for the toybox materials.
 *
 * soul.md: "the soul lives in the materials — wood grain, felt nap, glossy
 * paint, paper fibre." The base factories only set a flat colour + roughness,
 * so wood and felt render identically. This module injects asset-free,
 * world-space procedural surface into any `MeshStandardMaterial` via
 * `onBeforeCompile`: a small value-noise field drives (1) subtle albedo
 * variation, (2) roughness variation so the sheen isn't uniform, and (3) a
 * derivative-based bump so the surface catches the key light as relief — all
 * without a single texture asset or UV set (it samples world position, so it
 * works on the primitive geometry the scenes are built from).
 *
 * One shared program: the pattern/frequency/amplitudes are uniforms, so every
 * material compiles to the same shader (custom cache key `procsurf`) and only
 * the per-material uniforms differ — cheap on mobile.
 */

import type { MeshStandardMaterial } from 'three';

/** Surface families the toybox uses. */
export type SurfaceKind = 'wood' | 'felt' | 'woven' | 'paper' | 'plastic' | 'metal' | 'paint';

/** Per-kind tuning: noise frequency (per world unit) and detail amplitudes. */
interface SurfaceParams {
  pattern: number;
  freq: number;
  albedo: number;
  rough: number;
  bump: number;
}

const PARAMS: Record<SurfaceKind, SurfaceParams> = {
  // pattern ids: 1 wood, 2 felt, 3 woven, 4 paper, 5 micro (plastic/metal/paint)
  // Tuned to read as tactile grain/nap/weave, not as a noise texture: you
  // should have to look to see it, but it breaks flatness and catches the key.
  wood: { pattern: 1, freq: 0.7, albedo: 0.1, rough: 0.09, bump: 0.16 },
  felt: { pattern: 2, freq: 2.3, albedo: 0.06, rough: 0.06, bump: 0.1 },
  woven: { pattern: 3, freq: 1.9, albedo: 0.1, rough: 0.08, bump: 0.22 },
  paper: { pattern: 4, freq: 1.2, albedo: 0.07, rough: 0.05, bump: 0.11 },
  plastic: { pattern: 5, freq: 1.0, albedo: 0.03, rough: 0.03, bump: 0.05 },
  metal: { pattern: 5, freq: 1.5, albedo: 0.04, rough: 0.1, bump: 0.09 },
  paint: { pattern: 5, freq: 1.0, albedo: 0.035, rough: 0.04, bump: 0.06 },
};

/** GLSL prelude: uniforms + value noise + per-pattern height field. */
const FRAG_PRELUDE = /* glsl */ `
varying vec3 vSurfPos;
uniform float uSurfFreq;
uniform float uSurfAlbedo;
uniform float uSurfRough;
uniform float uSurfBump;
uniform float uSurfPattern;
float ps_hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ps_vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ps_hash(i + vec3(0,0,0)), ps_hash(i + vec3(1,0,0)), f.x),
                 mix(ps_hash(i + vec3(0,1,0)), ps_hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(ps_hash(i + vec3(0,0,1)), ps_hash(i + vec3(1,0,1)), f.x),
                 mix(ps_hash(i + vec3(0,1,1)), ps_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float ps_fbm(vec3 p){ float a = 0.5; float s = 0.0; for(int i = 0; i < 3; i++){ s += a * ps_vnoise(p); p *= 2.0; a *= 0.5; } return s; }
float ps_height(vec3 p){
  float f = uSurfFreq;
  if(uSurfPattern < 1.5){ // wood grain — directional plank lines (fine across, stretched along)
    float g = ps_fbm(vec3(p.x * f * 0.55, p.y * f * 0.6, p.z * f * 5.0));
    float rings = abs(fract(g * 3.0) - 0.5) * 2.0;
    return clamp(0.68 * g + 0.32 * rings, 0.0, 1.0);
  }
  if(uSurfPattern < 2.5){ // felt nap — fine isotropic speckle
    return ps_fbm(p * (f * 5.0));
  }
  if(uSurfPattern < 3.5){ // woven — perpendicular thread ridges
    float rx = 1.0 - abs(sin(p.x * f * 3.14159));
    float rz = 1.0 - abs(sin(p.z * f * 3.14159));
    return clamp(max(rx, rz), 0.0, 1.0);
  }
  if(uSurfPattern < 4.5){ // paper — faint long fibres over low noise
    float fib = 0.5 + 0.5 * sin(p.x * f * 20.0 + ps_fbm(p * f * 2.0) * 6.2831);
    return mix(ps_fbm(p * f * 3.0), fib, 0.35);
  }
  return ps_fbm(p * (f * 3.0)); // micro variation for plastic/metal/paint
}
`;

const ALBEDO_INJECT = /* glsl */ `
  diffuseColor.rgb *= (1.0 + uSurfAlbedo * (ps_height(vSurfPos) - 0.5));
`;

const ROUGH_INJECT = /* glsl */ `
  roughnessFactor = clamp(roughnessFactor + uSurfRough * (ps_height(vSurfPos) - 0.5), 0.03, 1.0);
`;

// Derivative bump on an unparametrised surface (Mikkelsen): perturbs the shading
// normal from the world-space height field, converted to view space via viewMatrix.
const BUMP_INJECT = /* glsl */ `
  {
    vec3 ps_posV = (viewMatrix * vec4(vSurfPos, 1.0)).xyz;
    float ps_H = ps_height(vSurfPos);
    vec3 ps_sx = dFdx(ps_posV);
    vec3 ps_sy = dFdy(ps_posV);
    float ps_dHx = dFdx(ps_H);
    float ps_dHy = dFdy(ps_H);
    vec3 ps_vN = normal;
    vec3 ps_R1 = cross(ps_sy, ps_vN);
    vec3 ps_R2 = cross(ps_vN, ps_sx);
    float ps_det = dot(ps_sx, ps_R1);
    vec3 ps_grad = sign(ps_det) * (ps_dHx * ps_R1 + ps_dHy * ps_R2);
    normal = normalize(abs(ps_det) * ps_vN - uSurfBump * ps_grad);
  }
`;

/**
 * Injects procedural surface detail into a MeshStandardMaterial (or subclass).
 * Idempotent per material; safe to call once at construction.
 *
 * @param mat - The material to enrich.
 * @param kind - The surface family driving the pattern and amplitudes.
 * @returns The same material, for chaining.
 */
export function applyProceduralSurface<T extends MeshStandardMaterial>(mat: T, kind: SurfaceKind): T {
  const p = PARAMS[kind];
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSurfFreq = { value: p.freq };
    shader.uniforms.uSurfAlbedo = { value: p.albedo };
    shader.uniforms.uSurfRough = { value: p.rough };
    shader.uniforms.uSurfBump = { value: p.bump };
    shader.uniforms.uSurfPattern = { value: p.pattern };

    shader.vertexShader =
      'varying vec3 vSurfPos;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSurfPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');

    shader.fragmentShader =
      FRAG_PRELUDE +
      shader.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>' + ALBEDO_INJECT)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>' + ROUGH_INJECT)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>' + BUMP_INJECT);
  };
  // One program per surface kind: materials of the same kind share the compiled
  // shader (and identical surface uniforms); different kinds get their own so
  // their onBeforeCompile actually runs and sets the right pattern/amplitudes.
  mat.customProgramCacheKey = () => `procsurf-${kind}`;
  return mat;
}
