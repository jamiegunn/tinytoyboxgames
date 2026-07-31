import { Box3, Color, DirectionalLight, AmbientLight, HemisphereLight, Light, PointLight, Vector3, Mesh, PlaneGeometry, type Scene } from 'three';
import { createFeltMaterial, createPlasticMaterial, createWoodMaterial } from './materialFactory';
import { getParticleEngine } from './particles/registry';
import { PARTICLES } from './particles/presets';
import { createLightingRig, type LightingDescriptor } from './lighting/lightingRig';
import { createDisposalScope, type DisposalScope } from './disposal';
import { DEFAULT_ENV_INTENSITY } from './rendererFactory';
import { createOwlCompanion, type OwlCompanion } from '@app/entities/owl';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { OwlFlightBounds } from '@app/entities/owl/types';
import type { WorldTapDispatcher } from './worldTapDispatcher';

// Shadow configuration now lives in the unified lighting rig
// (utils/lighting/lightingRig.ts — see architecture-standards.md#lightingrig).

// NOT HERE DELIBERATELY: scatterDecoratives(config) — utils/scatterDecoratives.ts,
// 40 lines, zero callers, deleted.
//
// Its docstring said it "Replaces the copy-pasted scatter loops found in every
// world scene's index.ts". Those files are 32, 32 and 34 lines and contain zero
// loops and zero calls to Math.random between them; the thing it claimed to
// replace was not there. That is worth more than the deletion: the sentence was
// a description of a refactor nobody had checked, and it read as evidence the
// refactor had happened.
//
// Where scatter loops DO exist — naturescene's toadstools, ferns, acorns, moss,
// leaf litter, grass, treeline — they call `seededRng(placementSeed(position,
// tag))`, so a given prop lands in the same spot on every load. This helper
// scattered with bare Math.random(). Adopting it would have been a regression
// that only showed up as decor twitching between reloads, and the docstring
// would have made that look like tidying up.
//
// If a scatter helper is wanted, take the seed from utils/seededRng.ts and put
// it there, not here.

// ── Scene Lighting ────────────────────────────────────────────────────────────

/** Data-driven configuration for a world scene's lighting rig. */
export interface LightingConfig {
  /** Direction of the key (directional) light. */
  keyDirection: Vector3;
  /** Intensity of the key light. */
  keyIntensity: number;
  /** Colour of the key light. */
  keyColor: Color;

  /**
   * Optional bounce — a second directional light with no shadow. See
   * {@link LightingDescriptor.bounce}, which is where the reasoning lives.
   *
   * Omit `bounceDirection` to get the default construction, the key's
   * horizontal components negated with its Y kept, which lights exactly the
   * faces the key misses and is exactly zero on the ones it hits. Scenes should
   * normally take the default and set only `bounceIntensity`: choosing a
   * direction by hand gives up the negative controls that construction buys.
   *
   * Omit `bounceIntensity` — or leave it at 0 — and no bounce light is built at
   * all, so every scene that has not asked for one is bit-for-bit unchanged.
   */
  bounceIntensity?: number;
  /** Colour of the bounce. @default `keyColor` */
  bounceColor?: Color;
  /** Direction the bounce travels. @default `keyDirection` with X and Z negated */
  bounceDirection?: Vector3;

  /** Intensity of the ambient fill light. */
  fillIntensity: number;
  /** Colour of the fill light. */
  fillColor: Color;

  /** Optional colour for the ground fill (used by some world scenes). */
  fillGroundColor?: Color;

  /**
   * Optional override for `scene.environmentIntensity` — the image-based fill
   * from the shared PMREM room environment.
   *
   * This belongs here, next to the other three intensities, because it is one of
   * them in every respect that matters and was previously the only one you could
   * not see from a scene's own environment file. `applyDefaultEnvironment`
   * applies 0.24 to every world scene, and measurement showed that term alone
   * carries **73% of the kitchen's luminance**: rendering the room with
   * `keyIntensity`, `fillIntensity` and every accent set to zero still produced a
   * fully lit room, retaining 77% of the luminance on the wall the key does not
   * reach. Tuning the values above while the dominant term lived in another file
   * moved the room's shadow coverage by three points and then stopped.
   *
   * The environment is a PMREM of three.js's `RoomEnvironment`, a white studio
   * box, so its contribution is flat in every channel — little-shark's rig
   * derivation already wrote that down as `env = environmentIntensity * E, flat
   * in every channel`. Flat in every channel is what makes an interior read as a
   * photographic backdrop rather than a room with a window in it. Two minigames
   * found this independently and dialled the default down locally (little-shark
   * 0.012, star-catcher 0.06); the room scenes inherited 0.24, because nothing in
   * a room's environment file mentioned that there was anything to inherit.
   *
   * Omit to keep the shared default.
   */
  environmentIntensity?: number;

  /** Position of the accent (point) light. Omit to skip accent light. */
  accentPosition?: Vector3;
  /** Intensity of the accent light. */
  accentIntensity?: number;
  /** Colour of the accent light. */
  accentColor?: Color;

  /** Additional point lights used by room scenes that need a slightly richer rig. */
  extraPointLights?: ReadonlyArray<{
    /** Position of the authored point light. */
    position: Vector3;
    /** Intensity of the point light. */
    intensity: number;
    /** Colour of the point light. */
    color: Color;
    /** Optional distance falloff. */
    distance?: number;
  }>;
}

/** The lighting objects returned by createSceneLighting. */
export interface SceneLighting {
  keyLight: DirectionalLight;
  fillLight: AmbientLight | HemisphereLight;
  accentLight: PointLight | null;
  extraLights: PointLight[];
}

/**
 * Creates a scene's lighting by mapping the legacy {@link LightingConfig} onto
 * the unified {@link createLightingRig} (see architecture-standards.md#lightingrig).
 * This is a thin vocabulary adapter — the actual light/shadow construction lives
 * in the one rig. A flat fill (no `fillGroundColor`) becomes a hemisphere with
 * `sky === ground`, which is visually identical to the old AmbientLight.
 *
 * @param scene - The Three.js scene to add lights to.
 * @param config - Colour, intensity, and position values for each light.
 * @param scope - Disposal scope that frees the lights (and shadow maps) on teardown.
 * @returns The lighting objects (only `keyLight` is consumed downstream).
 */
export function createSceneLighting(scene: Scene, config: LightingConfig, scope: DisposalScope): SceneLighting {
  // ALWAYS assigned, never left alone when the config omits it. SceneFrame
  // builds ONE Scene at mount and reuses it for every world scene, so a
  // conditional assignment would let the last room that set a value keep
  // dimming every scene the player walked into afterwards — a lighting change
  // that only shows up after navigation, in scenes that never asked for it.
  scene.environmentIntensity = config.environmentIntensity ?? DEFAULT_ENV_INTENSITY;

  const accents: LightingDescriptor['accents'] = [];
  if (config.accentPosition) {
    accents.push({ position: config.accentPosition, intensity: config.accentIntensity ?? 0.15, color: config.accentColor ?? new Color(1, 1, 1) });
  }
  const extraStart = accents.length;
  for (const l of config.extraPointLights ?? []) {
    accents.push({ position: l.position, intensity: l.intensity, color: l.color, distance: l.distance });
  }

  const rig = createLightingRig(
    scene,
    {
      key: { direction: config.keyDirection, intensity: config.keyIntensity, color: config.keyColor },
      bounce: config.bounceIntensity
        ? {
            direction: config.bounceDirection ?? new Vector3(-config.keyDirection.x, config.keyDirection.y, -config.keyDirection.z),
            intensity: config.bounceIntensity,
            color: config.bounceColor ?? config.keyColor,
          }
        : undefined,
      // No ground colour → sky === ground → a flat fill identical to the old AmbientLight.
      fill: { skyColor: config.fillColor, groundColor: config.fillGroundColor ?? config.fillColor, intensity: config.fillIntensity },
      accents,
    },
    scope,
  );

  return {
    keyLight: rig.key,
    fillLight: rig.fill,
    accentLight: config.accentPosition ? rig.accents[0] : null,
    extraLights: rig.accents.slice(extraStart),
  };
}

// ── Scene Base (ground + sky) ─────────────────────────────────────────────────

/** Configuration for a world scene's ground plane and optional sky backdrop. */
export interface SceneBaseConfig {
  /** Ground material type. */
  groundMaterial: 'felt' | 'wood';
  /** Base colour for the ground material. */
  groundColor: Color;
  /** Ground width. @default 12 */
  groundWidth?: number;
  /** Ground depth. @default 10 */
  groundDepth?: number;
  /** If provided, a sky backdrop plane is created with this base colour. */
  skyColor?: Color;
  /** Emissive tint for the sky material. @default Color(0.1, 0.15, 0.2) */
  skyEmissive?: Color;
}

/** Result of building the scene base. */
export interface SceneBase {
  ground: Mesh;
  sky: Mesh | null;
}

/**
 * Builds the ground plane (with shadows enabled) and optional sky backdrop.
 *
 * @param scene - The Three.js scene.
 * @param config - Ground/sky configuration.
 * @returns The ground mesh and optional sky mesh.
 */
export function buildSceneBase(scene: Scene, config: SceneBaseConfig): SceneBase {
  const w = config.groundWidth ?? 12;
  const d = config.groundDepth ?? 10;

  const groundGeo = new PlaneGeometry(w, d);
  groundGeo.rotateX(-Math.PI / 2); // Lay flat
  const matFactory = config.groundMaterial === 'wood' ? createWoodMaterial : createFeltMaterial;
  const groundMat = matFactory('groundMat', config.groundColor);
  const ground = new Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  let sky: Mesh | null = null;
  if (config.skyColor) {
    const skyGeo = new PlaneGeometry(20, 8);
    const skyMat = createPlasticMaterial('skyMat', config.skyColor);
    skyMat.emissive = config.skyEmissive ?? new Color(0.1, 0.15, 0.2);
    sky = new Mesh(skyGeo, skyMat);
    sky.position.set(0, 4, -5);
    scene.add(sky);
  }

  return { ground, sky };
}

// ── Floor Tap + Owl Wiring ────────────────────────────────────────────────────

/** Configuration for floor-tap first-tap fallback and owl wiring. */
export interface FloorTapConfig {
  /** World-space spawn position for the owl companion. */
  owlPosition: Vector3;
  /** Optional perch rotation override for scenes whose camera faces a different direction. */
  owlFacingY?: number;
  /** Optional authored flight bounds override when the tap target is not a good proxy for the room volume. */
  flightBounds?: OwlFlightBounds;
  /** Interior inset applied when deriving owl flight bounds from the floor mesh. */
  owlBoundsMargin?: number;
  /** Scene-authored vertical clamp used to keep the owl arc inside the shell. */
  ceilingY?: number;
  /** Optional sound played the first time the floor tap path is used. */
  firstTapSoundId?: string;
  /** Particle effect to play on first tap. @default a sceneSparkle burst via getParticleEngine */
  particleFn?: (scene: Scene, point: Vector3) => void;
}

/**
 * Wires the first-tap fallback pattern and owl companion to a ground mesh
 * via the centralized world tap dispatcher.
 *
 * @param scene - The Three.js scene.
 * @param dispatcher - The world tap dispatcher.
 * @param groundTargets - One or more tappable floor targets used for owl movement.
 * @param config - Owl position and optional particle function override.
 * @param existingOwl - Optional pre-built owl used by room scenes that need the companion earlier in composition.
 * @returns The OwlCompanion handle and a cleanup function.
 */
export function wireFloorTap(
  scene: Scene,
  dispatcher: WorldTapDispatcher,
  groundTargets: Mesh | readonly Mesh[],
  config: FloorTapConfig,
  existingOwl?: OwlCompanion,
): { owl: OwlCompanion; cleanup: () => void } {
  const targets = Array.isArray(groundTargets) ? [...groundTargets] : [groundTargets];
  const primaryTarget = targets[0];

  primaryTarget.updateWorldMatrix(true, false);
  const groundBounds = new Box3().setFromObject(primaryTarget);
  const margin = config.owlBoundsMargin ?? 0.5;
  const maxInsetX = Math.max(0, (groundBounds.max.x - groundBounds.min.x) / 2 - 0.1);
  const maxInsetZ = Math.max(0, (groundBounds.max.z - groundBounds.min.z) / 2 - 0.1);
  const insetX = Math.min(margin, maxInsetX);
  const insetZ = Math.min(margin, maxInsetZ);

  const flightBounds = config.flightBounds ?? {
    minX: groundBounds.min.x + insetX,
    maxX: groundBounds.max.x - insetX,
    minZ: groundBounds.min.z + insetZ,
    maxZ: groundBounds.max.z - insetZ,
    minY: 0.3,
    maxY: Math.max(config.owlPosition.y, (config.ceilingY ?? 6.0) - 1.0),
  };

  const owl =
    existingOwl ??
    createOwlCompanion(scene, config.owlPosition, {
      restFacingY: config.owlFacingY,
      flightBounds,
    });
  const emitParticle = config.particleFn ?? ((s: Scene, position: Vector3) => getParticleEngine(s).emit(PARTICLES.sceneSparkle, position));

  let firstTapHandled = false;

  // THERE IS NO `repeatTapSoundId`, AND ITS REMOVAL IS THE POINT OF THIS COMMENT.
  //
  // All three rooms used to set it to `sfx_shared_tap_fallback`, and so did the
  // room-scene template, so every room built from the generator would have
  // inherited it. Measured in `.probe/render/r2-floor.mjs` across Playroom,
  // Living Room and Kitchen, the effect was identical in all three: the floor's
  // first tap answered with `sfx_shared_sparkle_burst` and a burst, and every tap
  // after it answered with the generic acknowledgement chirp and NO PARTICLES AT
  // ALL.
  //
  // That is worse than it sounds, twice over. The floor is registered
  // `background: true` and is one plane the size of the whole room, so it is the
  // likeliest thing a child hits — and from the second tap onward it said exactly
  // what empty space says. soul.md's Sound World clause makes the visual half the
  // load-bearing one ("a muted experience must be fully playable and emotionally
  // complete"): on a muted device the room's largest tap target did nothing,
  // permanently, after one tap.
  //
  // AND IT DEFEATED THE CONTROLLER'S OWN SAFETY NET, which is the part worth
  // remembering. `interactionController.fire` answers a handler that made no
  // sound, and it detects that by counting sounds. A handler that plays the
  // acknowledgement chirp ITSELF ticks that counter, so the controller concludes
  // the prop answered for itself and correctly withholds the shared sparkle. The
  // handler bought the cue at the price of the picture. Removing the option lets
  // the repeat tap fall through silent, which is precisely the case the controller
  // exists to catch: it now supplies the same chirp (no audible change) AND the
  // sparkle (new), from one place, for every scene at once.
  //
  // Nature is the control that shows this was a deviation rather than a house
  // style: it sets neither sound id, has always fallen through to the shared
  // acknowledgement, and is the only floor that was already right.
  const onFloorTap = (point: Vector3) => {
    if (!firstTapHandled) {
      firstTapHandled = true;
      if (config.firstTapSoundId) {
        triggerSound(config.firstTapSoundId);
      }
      emitParticle(scene, point);
    }
    owl.flyTo(point);
  };

  // `background: true` is load-bearing, not cosmetic. The floor is one plane the
  // size of the whole world — 28 x 32 in Nature — so registering it normally put
  // a mesh under almost every pixel and, because `pickRegistered` returns on the
  // first hit, silently switched OFF the small-target proximity forgiveness for
  // every prop standing on it. Measured before the flag: the ground answered
  // 52-62% of the canvas at the nine shipping viewports and a flower's entire
  // catchment was its own 36 px^2 cap. The floor still fires and the owl still
  // flies; it just no longer outranks the thing the child was reaching for.
  const unregisters = targets.map((target) => dispatcher.registerWithPoint(target, onFloorTap, { background: true }));

  const cleanup = () => {
    unregisters.forEach((unregister) => unregister());
    if (!existingOwl) {
      owl.dispose();
    }
  };

  return { owl, cleanup };
}

/**
 * Disposes Three.js geometries and materials owned by a scene graph.
 *
 * @param scene - The scene whose mesh resources should be released.
 */
export function disposeSceneResources(scene: Scene): void {
  scene.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((material) => material.dispose());
      } else {
        obj.material?.dispose();
      }
    } else if (obj instanceof Light) {
      // Frees shadow-map render targets — the hub renderer persists across
      // scene switches, so undisposed lights leaked one depth target each.
      obj.dispose();
    }
  });
}

// ── Dispose Collector ─────────────────────────────────────────────────────────

/** A simple interface for objects that can be disposed. */
export interface Disposable {
  dispose: () => void;
}

/**
 * Creates a disposal collector that aggregates disposable resources.
 * Call disposeAll() during scene teardown to clean up everything at once.
 *
 * @returns An `add` function to register disposables, and a `disposeAll` for cleanup.
 */
export function createDisposeCollector(): {
  add: (...items: Disposable[]) => void;
  disposeAll: () => void;
} {
  // Delegates to the canonical DisposalScope so this legacy collector shares its
  // semantics — LIFO teardown, idempotent disposeAll, and exception isolation
  // (one throwing cleanup no longer aborts the rest). See #disposalscope.
  const scope = createDisposalScope();
  return {
    add: (...items: Disposable[]) => {
      for (const item of items) scope.add(() => item.dispose());
    },
    disposeAll: () => scope.dispose(),
  };
}
