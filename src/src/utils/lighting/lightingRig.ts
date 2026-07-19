/**
 * LightingRig — one descriptor-driven lighting factory for every scene and game.
 *
 * See architecture-standards.md#lightingrig. Replaces the two divergent rigs:
 * `createSceneLighting` (`LightingConfig`, a real sky/ground hemisphere fill) and
 * `createGameLighting` (`GameLightingOptions`, a flat `AmbientLight` misnamed
 * "hemisphericIntensity" — a Babylon carry-over). Both become one
 * {@link LightingDescriptor}: a directional key, a hemisphere fill, optional
 * point accents, and a shadow config whose map size comes from `qualityTier`.
 *
 * A flat ambient fill is just a hemisphere with `skyColor === groundColor`, so
 * games migrate at visual parity by setting both to the same colour.
 *
 * Every light (and the key's target) is registered on the supplied
 * {@link DisposalScope}, so scene switches no longer leak directional-light
 * shadow-map render targets — the leak DisposalScope was built to kill.
 */

import { DirectionalLight, HemisphereLight, PointLight, Color, Vector3, type Scene } from 'three';
import type { DisposalScope } from '@app/utils/disposal';
import { getShadowMapSize } from '@app/utils/qualityTier';

/** Distance the key light is placed from the origin along its (negated) direction. */
const KEY_DISTANCE = 10;

/** Data description of a scene/game lighting rig. */
export interface LightingDescriptor {
  /** Directional key light. `direction` is the direction the light travels (need not be unit). */
  key: { direction: Vector3; intensity: number; color: Color };
  /**
   * Hemisphere fill. `skyColor === groundColor` reproduces a flat ambient fill
   * (how the mini-games were lit); different colours give the classic
   * sky-above / ground-bounce diorama fill the room/world scenes use.
   */
  fill: { skyColor: Color; groundColor: Color; intensity: number };
  /** Optional point accents (local glow). */
  accents?: Array<{ position: Vector3; intensity: number; color: Color; distance?: number }>;
  /** Shadow tuning. Map size always comes from `qualityTier`; these override the frustum/bias. */
  shadow?: { bias?: number; normalBias?: number; frustum?: number; near?: number; far?: number };
}

/** The live lights of a rig (all already added to the scene and scope-owned). */
export interface LightingRig {
  key: DirectionalLight;
  fill: HemisphereLight;
  accents: PointLight[];
}

/**
 * Configures shadow casting on the key light with project-standard defaults.
 *
 * @param key - The directional key light.
 * @param shadow - Optional frustum/bias overrides.
 */
function configureKeyShadow(key: DirectionalLight, shadow?: LightingDescriptor['shadow']): void {
  key.castShadow = true;
  const mapSize = getShadowMapSize();
  key.shadow.mapSize.set(mapSize, mapSize);
  key.shadow.bias = shadow?.bias ?? -0.001;
  // normalBias prevents shadow acne on the curved toy geometry; radius softens
  // the penumbra under PCFSoftShadowMap.
  key.shadow.normalBias = shadow?.normalBias ?? 0.03;
  key.shadow.radius = 4;
  key.shadow.camera.near = shadow?.near ?? 0.1;
  key.shadow.camera.far = shadow?.far ?? 50;
  const f = shadow?.frustum ?? 10;
  key.shadow.camera.left = -f;
  key.shadow.camera.right = f;
  key.shadow.camera.top = f;
  key.shadow.camera.bottom = -f;
}

/**
 * Builds a lighting rig from a descriptor, adds it to the scene, and registers
 * every light for disposal on the scope.
 *
 * @param scene - The scene to add the lights to.
 * @param d - The lighting descriptor.
 * @param scope - The disposal scope that frees the lights (and shadow maps) on teardown.
 * @returns The live {@link LightingRig}.
 */
export function createLightingRig(scene: Scene, d: LightingDescriptor, scope: DisposalScope): LightingRig {
  // Directional key. Lighting depends only on direction (position − target), so
  // normalising only affects where the shadow camera sits — safe.
  const key = new DirectionalLight(d.key.color, d.key.intensity);
  const dir = d.key.direction.clone().normalize();
  key.position.copy(dir).multiplyScalar(-KEY_DISTANCE);
  key.target.position.set(0, 0, 0);
  scene.add(key);
  scene.add(key.target);
  configureKeyShadow(key, d.shadow);
  scope.object3D(key);
  scope.add(() => key.target.removeFromParent());

  // Hemisphere fill (flat when sky === ground).
  const fill = new HemisphereLight(d.fill.skyColor, d.fill.groundColor, d.fill.intensity);
  scene.add(fill);
  scope.object3D(fill);

  // Point accents.
  const accents = (d.accents ?? []).map((a) => {
    const light = new PointLight(a.color, a.intensity, a.distance ?? 0);
    light.position.copy(a.position);
    scene.add(light);
    scope.object3D(light);
    return light;
  });

  return { key, fill, accents };
}
