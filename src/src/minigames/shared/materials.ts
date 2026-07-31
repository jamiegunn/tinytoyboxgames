import { MeshStandardMaterial, Color } from 'three';

// NOT HERE DELIBERATELY: createRubberMaterial, createGlassMaterial,
// createWaterMaterial, createChalkMaterial, createCeramicMaterial,
// createSandMaterial -- and, in a second pass, createFurMaterial,
// createInnerEarMaterial, createAccessoryMaterial.
//
// The first six had no caller at all. The last three had exactly one caller
// between them: the nine dead animal builders in animalBuilder.ts, which is why
// they only became visible as dead after those were removed. Dead code hides
// dead code, and a single sweep will not find the second layer -- the guard has
// to be re-run until it stops finding anything, which is how these three were
// caught.
//
// A material here is a look, not a utility. Adding one back means having a
// surface in the game that wants it, and looking at that surface under the
// scene's own lighting rig -- not restoring a plausible-sounding factory.

// Re-export all base material factories for convenience
export {
  createWoodMaterial,
  createFeltMaterial,
  createGlossyPaintMaterial,
  createPlasticMaterial,
  createToyMetalMaterial,
  createTranslucentMaterial,
  createWovenMaterial,
  createPaperMaterial,
} from '@app/utils/materialFactory';

// The soap-bubble shader used to live here. It had exactly one consumer,
// bubble-pop, and its opacity term (`uAlpha * (0.1 + 0.5 * fresnel)`) made
// bubbles 5-30% opaque against a near-black sky — the game's own subject
// matter was close to invisible. The corrected shader now lives with its
// only caller at minigames/games/bubble-pop/bubbles/bubbleMaterial.ts.
// Keeping a second copy here would only create the trap where someone
// fixes "the" bubble material and sees nothing change on screen.

/**
 * Creates a MeshStandardMaterial simulating animal skin (elephants, sharks, frogs).
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the skin surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.55.
 */
export function createSkinMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.55,
    emissive: color.clone().multiplyScalar(0.04),
  });
}

/**
 * Creates a MeshStandardMaterial for cartoon-style eye sclera (whites of the eyes).
 *
 * @param name - Unique material identifier.
 * @returns A configured MeshStandardMaterial with white base, metalness=0.05, and roughness=0.1.
 */
export function createCartoonEyeWhiteMaterial(name: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color: new Color(1, 1, 1),
    metalness: 0.05,
    roughness: 0.1,
    emissive: new Color(0.15, 0.15, 0.15),
  });
}

/**
 * Creates a MeshStandardMaterial for cartoon-style eye pupils.
 *
 * @param name - Unique material identifier.
 * @returns A configured MeshStandardMaterial with near-black base, metalness=0.1, and roughness=0.08.
 */
export function createCartoonPupilMaterial(name: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color: new Color(0.02, 0.02, 0.02),
    metalness: 0.1,
    roughness: 0.08,
  });
}

/**
 * Creates a MeshStandardMaterial for cartoon-style animal noses.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the nose surface.
 * @returns A configured MeshStandardMaterial with metalness=0.05 and roughness=0.15.
 */
export function createCartoonNoseMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0.05, roughness: 0.15 });
}

/**
 * Creates a MeshStandardMaterial simulating polished metal for collectible stars and coins.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the metal surface.
 * @returns A configured MeshStandardMaterial with metalness=0.85 and roughness=0.2.
 */
export function createMetalMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.85,
    roughness: 0.2,
    emissive: color.clone().multiplyScalar(0.1),
  });
}

/**
 * Creates a MeshStandardMaterial simulating leaves and grass.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the leaf surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.6.
 */
export function createLeafMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.6,
    emissive: color.clone().multiplyScalar(0.06),
  });
}

/**
 * Creates a MeshStandardMaterial simulating underwater coral with bioluminescent glow.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the coral surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.7.
 */
export function createCoralMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.7,
    emissive: color.clone().multiplyScalar(0.08),
  });
}

/**
 * Creates a MeshStandardMaterial for colored eye irises.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the iris.
 * @returns A configured MeshStandardMaterial with metalness=0.05 and roughness=0.15.
 */
export function createIrisMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.05,
    roughness: 0.15,
    emissive: color.clone().multiplyScalar(0.05),
  });
}
