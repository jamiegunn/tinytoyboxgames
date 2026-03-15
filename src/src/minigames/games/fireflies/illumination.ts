import { Color, PointLight, type Scene, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import type { GameLightingRig } from '@app/minigames/shared/sceneSetup';

/** Target values for a single illumination tier. */
interface TierValues {
  directionalIntensity: number;
  ambientIntensity: number;
  /** Multiplier applied to the base moon emissive color. */
  moonEmissive: number;
  /** Multiplier applied to the base ground emissive color. */
  groundEmissive: number;
  /** Emissive intensity for flower materials. */
  flowerEmissive: number;
  /** Jar interior point light intensity. */
  jarLightIntensity: number;
  /** Jar material emissive multiplier. */
  jarEmissive: number;
  /** Directional light color (shifts from cold blue to warm white). */
  dirColor: [number, number, number];
}

/** Illumination tier definition with collected-count threshold. */
interface IlluminationTierDef {
  threshold: number;
  values: TierValues;
}

/**
 * The six illumination tiers that define how the garden transforms
 * as the player catches more fireflies.
 *
 * Tier 0 — Dark:       Near-black. Silhouettes only.
 * Tier 1 — Dim:        Moon brightens. Tree outlines visible.
 * Tier 2 — Awakening:  Flowers begin faint bioluminescent pulse.
 * Tier 3 — Glowing:    Jar projects warm light. Trees get rim lighting.
 * Tier 4 — Radiant:    Full moonlight. Garden alive with color.
 * Tier 5 — Enchanted:  Everything glows. The jar is a beacon.
 */
const TIERS: IlluminationTierDef[] = [
  {
    threshold: 0,
    values: {
      directionalIntensity: 0.18,
      ambientIntensity: 0.12,
      moonEmissive: 0.6,
      groundEmissive: 0.05,
      flowerEmissive: 0.0,
      jarLightIntensity: 0.25,
      jarEmissive: 0.35,
      dirColor: [0.55, 0.6, 0.85],
    },
  },
  {
    threshold: 3,
    values: {
      directionalIntensity: 0.08,
      ambientIntensity: 0.04,
      moonEmissive: 0.25,
      groundEmissive: 0.01,
      flowerEmissive: 0.0,
      jarLightIntensity: 0.0,
      jarEmissive: 0.05,
      dirColor: [0.6, 0.65, 0.85],
    },
  },
  {
    threshold: 8,
    values: {
      directionalIntensity: 0.14,
      ambientIntensity: 0.07,
      moonEmissive: 0.45,
      groundEmissive: 0.02,
      flowerEmissive: 0.06,
      jarLightIntensity: 0.1,
      jarEmissive: 0.15,
      dirColor: [0.7, 0.7, 0.85],
    },
  },
  {
    threshold: 15,
    values: {
      directionalIntensity: 0.22,
      ambientIntensity: 0.12,
      moonEmissive: 0.7,
      groundEmissive: 0.04,
      flowerEmissive: 0.14,
      jarLightIntensity: 0.4,
      jarEmissive: 0.35,
      dirColor: [0.8, 0.78, 0.82],
    },
  },
  {
    threshold: 25,
    values: {
      directionalIntensity: 0.32,
      ambientIntensity: 0.18,
      moonEmissive: 0.9,
      groundEmissive: 0.07,
      flowerEmissive: 0.22,
      jarLightIntensity: 0.8,
      jarEmissive: 0.55,
      dirColor: [0.9, 0.85, 0.8],
    },
  },
  {
    threshold: 40,
    values: {
      directionalIntensity: 0.4,
      ambientIntensity: 0.25,
      moonEmissive: 1.1,
      groundEmissive: 0.1,
      flowerEmissive: 0.3,
      jarLightIntensity: 1.2,
      jarEmissive: 0.75,
      dirColor: [0.95, 0.9, 0.82],
    },
  },
];

/** Exponential lerp rate — controls how fast transitions feel. ~80% in 1s. */
const TRANSITION_SPEED = 2.0;

/** Warm amber color for the jar interior point light. */
const JAR_LIGHT_COLOR = new Color(1.0, 0.85, 0.5);

/** Base moon emissive color (warm yellow-white). */
const MOON_BASE_COLOR = new Color(0.95, 0.9, 0.6);

/** Base ground emissive color (warm green). */
const GROUND_BASE_COLOR = new Color(0.3, 0.5, 0.15);

/** Base jar emissive color (warm amber-green). */
const JAR_BASE_COLOR = new Color(0.6, 0.8, 0.3);

/** Scene element references needed by the illumination controller. */
export interface IlluminationRefs {
  lights: GameLightingRig;
  moonMaterial: MeshStandardMaterial;
  groundMaterial: MeshStandardMaterial;
  jarMaterial: MeshStandardMaterial;
  flowerMaterials: MeshStandardMaterial[];
}

/** Mutable interpolation state for smooth tier transitions. */
interface LerpState {
  directionalIntensity: number;
  ambientIntensity: number;
  moonEmissive: number;
  groundEmissive: number;
  flowerEmissive: number;
  jarLightIntensity: number;
  jarEmissive: number;
  dirColorR: number;
  dirColorG: number;
  dirColorB: number;
}

export interface IlluminationController {
  /** Call each frame with current collected count and delta time. */
  update(collectedCount: number, deltaTime: number): void;
  /** Returns the current tier index (0-5). */
  getCurrentTier(): number;
  /** Dispose the jar interior light. */
  dispose(): void;
}

/**
 * Collects all MeshStandardMaterial instances from an Object3D hierarchy.
 * Used to find flower petal/stem materials for emissive control.
 * @param objects - Array of root Object3D nodes to traverse.
 * @returns Array of unique MeshStandardMaterial instances found.
 */
export function collectMaterials(objects: Object3D[]): MeshStandardMaterial[] {
  const mats: MeshStandardMaterial[] = [];
  for (const obj of objects) {
    obj.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
        if (!mats.includes(child.material)) {
          mats.push(child.material);
        }
      }
    });
  }
  return mats;
}

/**
 * Determines the target tier for a given collected count.
 * Returns the highest tier whose threshold has been met.
 * @param collectedCount - Number of fireflies collected so far.
 * @returns The index of the highest reached illumination tier.
 */
function getTargetTier(collectedCount: number): number {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (collectedCount >= TIERS[i].threshold) return i;
  }
  return 0;
}

/**
 * Creates the illumination controller that drives progressive scene transformation.
 * The controller smoothly interpolates all scene lighting and material properties
 * between illumination tiers as the player catches fireflies.
 *
 * @param scene - The Three.js scene (jar light is added here).
 * @param refs - References to scene elements the controller will modify.
 * @param jarPosition - World position of the jar (for interior light placement).
 * @returns An IlluminationController with update and dispose methods.
 */
export function createIlluminationController(scene: Scene, refs: IlluminationRefs, jarPosition: { x: number; y: number; z: number }): IlluminationController {
  // Create jar interior point light (centered within the scaled-down jar)
  const jarLight = new PointLight(JAR_LIGHT_COLOR, 0, 6.0);
  jarLight.name = 'fireflies_jar_interior_light';
  jarLight.position.set(jarPosition.x, jarPosition.y + 0.6, jarPosition.z);
  scene.add(jarLight);

  // Ensure main lights are in the scene
  if (!refs.lights.directionalLight.parent) scene.add(refs.lights.directionalLight);
  if (!refs.lights.ambientLight.parent) scene.add(refs.lights.ambientLight);
  if (!refs.lights.pointLight.parent) scene.add(refs.lights.pointLight);

  // Initialize lerp state to Tier 0 values
  const t0 = TIERS[0].values;
  const state: LerpState = {
    directionalIntensity: t0.directionalIntensity,
    ambientIntensity: t0.ambientIntensity,
    moonEmissive: t0.moonEmissive,
    groundEmissive: t0.groundEmissive,
    flowerEmissive: t0.flowerEmissive,
    jarLightIntensity: t0.jarLightIntensity,
    jarEmissive: t0.jarEmissive,
    dirColorR: t0.dirColor[0],
    dirColorG: t0.dirColor[1],
    dirColorB: t0.dirColor[2],
  };

  // Apply Tier 0 values immediately so scene starts dark
  applyState(state, refs, jarLight);

  let currentTierIndex = 0;

  function applyState(s: LerpState, r: IlluminationRefs, jl: PointLight): void {
    // Lighting rig
    r.lights.directionalLight.intensity = s.directionalIntensity;
    r.lights.directionalLight.color.setRGB(s.dirColorR, s.dirColorG, s.dirColorB);
    r.lights.ambientLight.intensity = s.ambientIntensity;

    // Moon emissive
    r.moonMaterial.emissive.copy(MOON_BASE_COLOR).multiplyScalar(s.moonEmissive);

    // Ground emissive
    r.groundMaterial.emissive.copy(GROUND_BASE_COLOR).multiplyScalar(s.groundEmissive);

    // Jar material emissive
    r.jarMaterial.emissive.copy(JAR_BASE_COLOR).multiplyScalar(s.jarEmissive);

    // Jar interior light
    jl.intensity = s.jarLightIntensity;

    // Flower emissive — apply to all flower materials
    for (const mat of r.flowerMaterials) {
      // Preserve the flower's base color hue but scale emissive intensity
      mat.emissive.copy(mat.color).multiplyScalar(s.flowerEmissive);
    }
  }

  return {
    update(collectedCount: number, deltaTime: number): void {
      const targetIdx = getTargetTier(collectedCount);
      currentTierIndex = targetIdx;
      const target = TIERS[targetIdx].values;

      // Exponential interpolation toward target values
      const alpha = 1 - Math.exp(-deltaTime * TRANSITION_SPEED);

      state.directionalIntensity += (target.directionalIntensity - state.directionalIntensity) * alpha;
      state.ambientIntensity += (target.ambientIntensity - state.ambientIntensity) * alpha;
      state.moonEmissive += (target.moonEmissive - state.moonEmissive) * alpha;
      state.groundEmissive += (target.groundEmissive - state.groundEmissive) * alpha;
      state.flowerEmissive += (target.flowerEmissive - state.flowerEmissive) * alpha;
      state.jarLightIntensity += (target.jarLightIntensity - state.jarLightIntensity) * alpha;
      state.jarEmissive += (target.jarEmissive - state.jarEmissive) * alpha;
      state.dirColorR += (target.dirColor[0] - state.dirColorR) * alpha;
      state.dirColorG += (target.dirColor[1] - state.dirColorG) * alpha;
      state.dirColorB += (target.dirColor[2] - state.dirColorB) * alpha;

      applyState(state, refs, jarLight);
    },

    getCurrentTier(): number {
      return currentTierIndex;
    },

    dispose(): void {
      jarLight.removeFromParent();
    },
  };
}
