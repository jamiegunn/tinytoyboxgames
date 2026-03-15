import { ShaderMaterial, DoubleSide, FrontSide } from 'three';
import barkVert from './shaders/bark.vert.glsl?raw';
import barkFrag from './shaders/bark.frag.glsl?raw';
import canopyVert from './shaders/canopy.vert.glsl?raw';
import canopyFrag from './shaders/canopy.frag.glsl?raw';
import { BARK_COLOR, BARK_DARK_COLOR, BARK_MOSS_COLOR, LEAF_LIGHT_COLOR, LEAF_MID_COLOR, LEAF_DARK_COLOR } from './constants';

export interface TreeMaterials {
  bark: ShaderMaterial;
  canopy: ShaderMaterial;
}

function createBarkMaterial(seed: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: barkVert,
    fragmentShader: barkFrag,
    uniforms: {
      uBarkColor: { value: BARK_COLOR.clone() },
      uBarkDark: { value: BARK_DARK_COLOR.clone() },
      uMossColor: { value: BARK_MOSS_COLOR.clone() },
      uSeed: { value: seed },
    },
    side: FrontSide,
  });
}

function createCanopyMaterial(seed: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: canopyVert,
    fragmentShader: canopyFrag,
    uniforms: {
      uLeafLight: { value: LEAF_LIGHT_COLOR.clone() },
      uLeafMid: { value: LEAF_MID_COLOR.clone() },
      uLeafDark: { value: LEAF_DARK_COLOR.clone() },
      uSeed: { value: seed },
    },
    side: DoubleSide,
  });
}

/**
 * Creates the bark and canopy shader materials shared by one procedural tree.
 *
 * @param seed - Deterministic seed used by both shader materials.
 * @returns The bark and canopy materials for one tree instance.
 */
export function createTreeMaterials(seed: number): TreeMaterials {
  return {
    bark: createBarkMaterial(seed),
    canopy: createCanopyMaterial(seed),
  };
}
