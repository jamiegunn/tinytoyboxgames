import { MeshStandardMaterial, Color, DoubleSide } from 'three';

/** Global material cache — prevents duplicate materials with the same name. */
const materialCache = new Map<string, MeshStandardMaterial>();

/**
 * Returns an existing material by name if one already exists,
 * otherwise invokes the factory to create and cache a new one.
 *
 * @param name - Unique material identifier.
 * @param createFn - Factory function called only when no material with this name exists.
 * @returns The existing or newly created MeshStandardMaterial.
 */
export function getOrCreateMaterial(name: string, createFn: () => MeshStandardMaterial): MeshStandardMaterial {
  const existing = materialCache.get(name);
  if (existing) return existing;
  const mat = createFn();
  mat.name = name;
  materialCache.set(name, mat);
  return mat;
}

/**
 * Clears the material cache. Call when tearing down the entire application
 * or when switching between isolated scenes that should not share materials.
 */
export function clearMaterialCache(): void {
  materialCache.forEach((mat) => mat.dispose());
  materialCache.clear();
}

/**
 * Creates a MeshStandardMaterial with a matte wood-like surface.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the wood surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.7.
 */
export function createWoodMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0, roughness: 0.7 });
}

/**
 * Creates a MeshStandardMaterial simulating soft felt fabric.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the felt surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.95.
 */
export function createFeltMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0, roughness: 0.95 });
}

/**
 * Creates a MeshStandardMaterial with a shiny glossy paint finish.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the painted surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.25.
 */
export function createGlossyPaintMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0, roughness: 0.25 });
}

/**
 * Creates a MeshStandardMaterial with a smooth plastic-like finish.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the plastic surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.35.
 */
export function createPlasticMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0, roughness: 0.35 });
}

/**
 * Creates a MeshStandardMaterial simulating a child-safe toy metal surface.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the metallic surface.
 * @returns A configured MeshStandardMaterial with metalness=0.35 and roughness=0.5.
 */
export function createToyMetalMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0.35, roughness: 0.5 });
}

/**
 * Creates a MeshStandardMaterial with partial transparency for glass-like or jelly-like surfaces.
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the translucent surface.
 * @param alpha - Opacity value from 0 (invisible) to 1 (opaque). Defaults to 0.6.
 * @returns A configured MeshStandardMaterial with metalness=0.05, roughness=0.15, and the given opacity.
 */
export function createTranslucentMaterial(name: string, color: Color, alpha = 0.6): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name,
    color,
    metalness: 0.05,
    roughness: 0.15,
    transparent: true,
    opacity: alpha,
    side: DoubleSide,
  });
}

/**
 * Creates a MeshStandardMaterial simulating a woven fabric surface (rug, upholstery).
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the woven surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.85.
 */
export function createWovenMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0, roughness: 0.85 });
}

/**
 * Creates a MeshStandardMaterial simulating a matte paper surface (origami, drawings, posters).
 *
 * @param name - Unique material identifier.
 * @param color - Base color for the paper surface.
 * @returns A configured MeshStandardMaterial with metalness=0 and roughness=0.6.
 */
export function createPaperMaterial(name: string, color: Color): MeshStandardMaterial {
  return new MeshStandardMaterial({ name, color, metalness: 0, roughness: 0.6 });
}
