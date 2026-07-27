import { Color, PointLight, type Scene, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import type { GameLightingRig } from '@app/minigames/shared/sceneSetup';
import { JAR_BODY_HEIGHT, JAR_SCALE } from './types';

/** Target values for a single illumination tier. */
interface TierValues {
  directionalIntensity: number;
  ambientIntensity: number;
  /** `scene.environmentIntensity` — the image-based ambient light. */
  envIntensity: number;
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
 * Tier 0 — Dark:       Moonlit silhouettes. The jar is barely a shape.
 * Tier 1 — Dim:        Moon brightens. Tree outlines and grass separate out.
 * Tier 2 — Awakening:  Flowers begin a faint bioluminescent pulse.
 * Tier 3 — Glowing:    Jar projects warm light. Trees get rim lighting.
 * Tier 4 — Radiant:    Full moonlight. Garden alive with color.
 * Tier 5 — Enchanted:  Everything glows. The jar is a beacon.
 *
 * EVERY axis is strictly monotonically increasing tier over tier. It used not
 * to be: tier 1 was darker than tier 0 on all seven axes (directional
 * 0.18→0.08, ambient 0.12→0.04, moon 0.6→0.25, ground 0.05→0.01, jar light
 * 0.25→0.0, jar emissive 0.35→0.05), so the third catch made the world dimmer
 * and it did not recover until the fifteenth. Succeeding must never make the
 * picture worse. Resulting per-axis progression, tier 0 → 5:
 *
 *   directional  0.08 → 0.13 → 0.19 → 0.26 → 0.34 → 0.44   (x5.5)
 *   ambient      0.05 → 0.08 → 0.12 → 0.16 → 0.21 → 0.27   (x5.4)
 *   env          0.05 → 0.068 → 0.094 → 0.128 → 0.175 → 0.24 (x4.8)
 *   moon         0.35 → 0.50 → 0.66 → 0.83 → 1.00 → 1.20   (x3.4)
 *   ground       0.02 → 0.032 → 0.046 → 0.062 → 0.082 → 0.105 (x5.3)
 *   flower       0.00 → 0.05 → 0.11 → 0.18 → 0.25 → 0.33   (off → glowing)
 *   jar light    0.10 → 0.28 → 0.50 → 0.75 → 1.05 → 1.40   (x14)
 *   jar emissive 0.10 → 0.18 → 0.28 → 0.42 → 0.58 → 0.78   (x7.8)
 *
 * The dirColor entries walk from cold moon-blue to warm lantern-white over the
 * same span, so the garden reads as *warming up*, not just brightening.
 *
 * The `env` axis is the one that decides whether tier 0 reads as night at all.
 * The shell applies a PMREM RoomEnvironment IBL to every mini-game with
 * `scene.environmentIntensity = 0.24` (utils/rendererFactory.ts:24, applied
 * from MiniGameShell.tsx). That is a bright, neutral, omnidirectional room —
 * with an estimated irradiance around 1.24 it delivered roughly 0.30 to the
 * meadow floor against 0.115 from this game's own tier-0 rig, i.e. the shared
 * default was contributing about 2.6x the game's own lighting and no amount of
 * tuning the axes below could get out from under it. That is why the "moonlit
 * meadow" rendered as a bright daytime field. This game now owns the value:
 * tier 0 drops it to 0.05 and it climbs geometrically (ratio (0.24/0.05)^(1/5)
 * = 1.369 per tier) back to exactly the app default by tier 5, so the top tier
 * still looks like everything else in the app. The original value is captured
 * at construction and restored on dispose(), so nothing leaks to the next game.
 */
const TIERS: IlluminationTierDef[] = [
  {
    threshold: 0,
    values: {
      directionalIntensity: 0.08,
      ambientIntensity: 0.05,
      envIntensity: 0.05,
      moonEmissive: 0.35,
      groundEmissive: 0.02,
      flowerEmissive: 0.0,
      jarLightIntensity: 0.1,
      jarEmissive: 0.1,
      dirColor: [0.5, 0.56, 0.86],
    },
  },
  {
    threshold: 3,
    values: {
      directionalIntensity: 0.13,
      ambientIntensity: 0.08,
      envIntensity: 0.068,
      moonEmissive: 0.5,
      groundEmissive: 0.032,
      flowerEmissive: 0.05,
      jarLightIntensity: 0.28,
      jarEmissive: 0.18,
      dirColor: [0.58, 0.62, 0.86],
    },
  },
  {
    threshold: 8,
    values: {
      directionalIntensity: 0.19,
      ambientIntensity: 0.12,
      envIntensity: 0.094,
      moonEmissive: 0.66,
      groundEmissive: 0.046,
      flowerEmissive: 0.11,
      jarLightIntensity: 0.5,
      jarEmissive: 0.28,
      dirColor: [0.68, 0.7, 0.85],
    },
  },
  {
    threshold: 15,
    values: {
      directionalIntensity: 0.26,
      ambientIntensity: 0.16,
      envIntensity: 0.128,
      moonEmissive: 0.83,
      groundEmissive: 0.062,
      flowerEmissive: 0.18,
      jarLightIntensity: 0.75,
      jarEmissive: 0.42,
      dirColor: [0.78, 0.77, 0.84],
    },
  },
  {
    threshold: 25,
    values: {
      directionalIntensity: 0.34,
      ambientIntensity: 0.21,
      envIntensity: 0.175,
      moonEmissive: 1.0,
      groundEmissive: 0.082,
      flowerEmissive: 0.25,
      jarLightIntensity: 1.05,
      jarEmissive: 0.58,
      dirColor: [0.88, 0.84, 0.82],
    },
  },
  {
    threshold: 40,
    values: {
      directionalIntensity: 0.44,
      ambientIntensity: 0.27,
      envIntensity: 0.24,
      moonEmissive: 1.2,
      groundEmissive: 0.105,
      flowerEmissive: 0.33,
      jarLightIntensity: 1.4,
      jarEmissive: 0.78,
      dirColor: [0.97, 0.91, 0.82],
    },
  },
];

/** Exponential lerp rate — controls how fast transitions feel. ~80% in 1s. */
const TRANSITION_SPEED = 2.0;

/** Warm amber color for the jar interior point light. */
const JAR_LIGHT_COLOR = new Color(1.0, 0.85, 0.5);

/** Base moon emissive color (warm yellow-white). */
const MOON_BASE_COLOR = new Color(0.95, 0.9, 0.6);

/**
 * Base ground emissive color.
 *
 * Was (0.3, 0.5, 0.15), a warm green. The meadow's albedo is now a cold
 * blue-green, and an emissive of a different hue fights it: the ground read as
 * grey-green where the two mixed. This is the same hue family as the albedo so
 * the self-lit term deepens the meadow rather than washing the colour out.
 */
const GROUND_BASE_COLOR = new Color(0.18, 0.42, 0.34);

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
  envIntensity: number;
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
  // Create jar interior point light, centred in the *scaled* jar. The offset
  // used to be a hard-coded +0.6, which was near the top of the jar at the old
  // scale and floats well above the cork at the new one. JAR_BODY_HEIGHT is the
  // unscaled profile height; 0.55 of the scaled height puts the light just
  // above the middle of the glass, where the fill dots sit.
  const jarLight = new PointLight(JAR_LIGHT_COLOR, 0, 6.0);
  jarLight.name = 'fireflies_jar_interior_light';
  jarLight.position.set(jarPosition.x, jarPosition.y + JAR_BODY_HEIGHT * JAR_SCALE * 0.55, jarPosition.z);
  scene.add(jarLight);

  // The shell's default IBL intensity, restored on dispose so this game's night
  // setting cannot leak into whatever mounts next.
  const baseEnvIntensity = scene.environmentIntensity;

  // Ensure main lights are in the scene
  if (!refs.lights.directionalLight.parent) scene.add(refs.lights.directionalLight);
  if (!refs.lights.ambientLight.parent) scene.add(refs.lights.ambientLight);
  if (!refs.lights.pointLight.parent) scene.add(refs.lights.pointLight);

  // Initialize lerp state to Tier 0 values
  const t0 = TIERS[0].values;
  const state: LerpState = {
    directionalIntensity: t0.directionalIntensity,
    ambientIntensity: t0.ambientIntensity,
    envIntensity: t0.envIntensity,
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

    // Image-based ambient. This is the dominant light source at the shell's
    // default of 0.24 and has to move with the tiers, or the "dark" tiers are
    // dark only in the lights this controller happens to own.
    scene.environmentIntensity = s.envIntensity;

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
      state.envIntensity += (target.envIntensity - state.envIntensity) * alpha;
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
      scene.environmentIntensity = baseEnvIntensity;
    },
  };
}
