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
 *
 * NOT HERE DELIBERATELY: `utils/lighting/index.ts`, the public-surface barrel.
 * Deleted at 0 live importers.
 *
 * This module has two live importers and they are the two hubs: `sceneHelpers`
 * for scenes and `minigames/shared/sceneSetup` for games. `createGameLighting`,
 * named above as one of the two rigs this replaced, is not a survivor — it now
 * builds its lights by calling `createLightingRig` and keeps its old signature
 * for its 5 game-side callers. The paragraph above is therefore true, and the
 * import count that would seem to test it (2) has nothing to do with why.
 *
 * Do not read a low importer count here as an unadopted migration, and do not
 * read a high one as an adopted one. The counts and what they mean are in
 * noAbandonedMigrations.test.mjs.
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
   * Optional second directional light — a bounce card. Same convention as
   * `key.direction`: the direction the light travels. Casts no shadow, because
   * a second shadow-caster costs a second map and reads as two suns.
   *
   * This exists because one directional light leaves every surface facing away
   * from it lit by the flat terms only, and in the three house rooms that
   * surface is a whole wall. All three set a key travelling toward −X while
   * `LEFT_WALL_FACE_X` is positive, so the left wall's Lambert term is exactly
   * `max(0, dot((-1,0,0), (0.45, 0.82, -0.35))) = 0`. Measured in the linear
   * domain — where light adds up, unlike in the sRGB bytes, which understated
   * this by more than half — the Kitchen's left wall sat at 23% of the right
   * wall's luminance and 40% of its colourfulness. It did not shade what was
   * placed on it, it drained it.
   *
   * A bounce is NOT interchangeable with raising `fill.intensity` or
   * `scene.environmentIntensity`, and is deliberately not a way to walk those
   * back: both are flat in every channel and were cut hard in `bc4d01f`
   * precisely because they carried 73% of a room's luminance while shaping
   * nothing. This has a direction, so it shades.
   *
   * Point it wherever a scene needs, but negating the key's horizontal
   * components and keeping its Y is the construction that can be checked rather
   * than trusted: the bounce's Lambert term is then exactly zero on every face
   * the key already lights, which makes those faces usable as negative controls
   * when measuring what it did.
   */
  bounce?: { direction: Vector3; intensity: number; color: Color };
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
  /** The bounce, when the descriptor asked for one. `null` otherwise. */
  bounce: DirectionalLight | null;
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

  // Optional bounce. Built exactly like the key minus the shadow config, and
  // placed on its own target rather than reusing the key's, because two lights
  // sharing one target object is a coupling that only shows itself when someone
  // later animates one of them.
  let bounce: DirectionalLight | null = null;
  if (d.bounce) {
    bounce = new DirectionalLight(d.bounce.color, d.bounce.intensity);
    bounce.position.copy(d.bounce.direction.clone().normalize()).multiplyScalar(-KEY_DISTANCE);
    bounce.target.position.set(0, 0, 0);
    scene.add(bounce);
    scene.add(bounce.target);
    scope.object3D(bounce);
    const b = bounce;
    scope.add(() => b.target.removeFromParent());
  }

  // Hemisphere fill (flat when sky === ground).
  const fill = new HemisphereLight(d.fill.skyColor, d.fill.groundColor, d.fill.intensity);
  scene.add(fill);
  scope.object3D(fill);

  // Point accents. The `?? 0` is documentation, not a guard: three.js defaults
  // `distance` to 0 for undefined, for an explicit 0, and for an omitted third
  // argument alike, so all three constructions are identical. It is written out
  // because 0 is three.js's sentinel for "no falloff", which is worth saying.
  // Do not read it as load-bearing — mutating it away changes no behaviour, and
  // no test can pin it (see the mutation note in lightingRig.test.mjs).
  const accents = (d.accents ?? []).map((a) => {
    const light = new PointLight(a.color, a.intensity, a.distance ?? 0);
    light.position.copy(a.position);
    scene.add(light);
    scope.object3D(light);
    return light;
  });

  return { key, bounce, fill, accents };
}
