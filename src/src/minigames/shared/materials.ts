import { MeshStandardMaterial, Color, DoubleSide } from 'three';

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

/**
 * Creates a MeshStandardMaterial simulating a soft rubber surface for balloons and rubber ducks.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the rubber surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.4.
 */
export function createRubberMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.4,
    emissive: color.clone().multiplyScalar(0.05),
  });
}

/**
 * Creates a MeshStandardMaterial simulating transparent glass for jars and bubbles.
 *
 * @param name - Unique material identifier.
 * @param color - Base color tint for the glass surface.
 * @param alpha - Opacity value from 0 (invisible) to 1 (opaque). Defaults to 0.35.
 * @returns A configured MeshStandardMaterial with metalness=0.1 and roughness=0.05.
 */
export function createGlassMaterial(name: string, color: Color, alpha = 0.35): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: alpha,
    side: DoubleSide,
  });
}

// The soap-bubble shader used to live here. It had exactly one consumer,
// bubble-pop, and its opacity term (`uAlpha * (0.1 + 0.5 * fresnel)`) made
// bubbles 5-30% opaque against a near-black sky — the game's own subject
// matter was close to invisible. The corrected shader now lives with its
// only caller at minigames/games/bubble-pop/bubbles/bubbleMaterial.ts.
// Keeping a second copy here would only create the trap where someone
// fixes "the" bubble material and sees nothing change on screen.

/**
 * Creates a MeshStandardMaterial simulating a water surface with slight reflectivity.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the water surface.
 * @param alpha - Opacity value from 0 (invisible) to 1 (opaque). Defaults to 0.7.
 * @returns A configured MeshStandardMaterial with metalness=0.2 and roughness=0.1.
 */
export function createWaterMaterial(name: string, color: Color, alpha = 0.7): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.2,
    roughness: 0.1,
    transparent: true,
    opacity: alpha,
    emissive: color.clone().multiplyScalar(0.08),
  });
}

/**
 * Creates a MeshStandardMaterial simulating soft animal fur.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the fur surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.92.
 */
export function createFurMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.92,
    emissive: color.clone().multiplyScalar(0.03),
  });
}

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
 * Creates a MeshStandardMaterial simulating a dusty chalk or crayon surface.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the chalk surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.98.
 */
export function createChalkMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0, roughness: 0.98 });
}

/**
 * Creates a MeshStandardMaterial simulating a glazed ceramic surface for bowls and pots.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the ceramic glaze.
 * @returns A configured MeshStandardMaterial with metalness=0.05 and roughness=0.2.
 */
export function createCeramicMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0.05, roughness: 0.2 });
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
 * Creates a MeshStandardMaterial simulating a sandy ground or beach surface.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the sand surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.95.
 */
export function createSandMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.95,
    emissive: color.clone().multiplyScalar(0.02),
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
 * Creates a MeshStandardMaterial for inner ear surfaces.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the inner ear (typically pink).
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.6.
 */
export function createInnerEarMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0,
    roughness: 0.6,
    emissive: color.clone().multiplyScalar(0.05),
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

/**
 * Creates a MeshStandardMaterial for glossy collars and accessories.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the accessory.
 * @returns A configured MeshStandardMaterial with metalness=0.1 and roughness=0.25.
 */
export function createAccessoryMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.1,
    roughness: 0.25,
    emissive: color.clone().multiplyScalar(0.05),
  });
}
