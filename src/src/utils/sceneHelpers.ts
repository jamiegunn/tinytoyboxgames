import { Box3, Color, DirectionalLight, AmbientLight, HemisphereLight, Light, PointLight, Vector3, Mesh, PlaneGeometry, type Scene } from 'three';
import { createFeltMaterial, createPlasticMaterial, createWoodMaterial } from './materialFactory';
import { getParticleEngine } from './particles/registry';
import { PARTICLES } from './particles/presets';
import { createLightingRig, type LightingDescriptor } from './lighting/lightingRig';
import { createDisposalScope, type DisposalScope } from './disposal';
import { createOwlCompanion, type OwlCompanion } from '@app/entities/owl';
import { triggerSound } from '@app/assets/audio/sceneBridge';
import type { OwlFlightBounds } from '@app/entities/owl/types';
import type { WorldTapDispatcher } from './worldTapDispatcher';

// Shadow configuration now lives in the unified lighting rig
// (utils/lighting/lightingRig.ts — see architecture-standards.md#lightingrig).

// ── Scene Lighting ────────────────────────────────────────────────────────────

/** Data-driven configuration for a world scene's lighting rig. */
export interface LightingConfig {
  /** Direction of the key (directional) light. */
  keyDirection: Vector3;
  /** Intensity of the key light. */
  keyIntensity: number;
  /** Colour of the key light. */
  keyColor: Color;

  /** Intensity of the ambient fill light. */
  fillIntensity: number;
  /** Colour of the fill light. */
  fillColor: Color;

  /** Optional colour for the ground fill (used by some world scenes). */
  fillGroundColor?: Color;

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
  /** Optional sound played on subsequent floor taps. */
  repeatTapSoundId?: string;
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

  const onFloorTap = (point: Vector3) => {
    if (!firstTapHandled) {
      firstTapHandled = true;
      if (config.firstTapSoundId) {
        triggerSound(config.firstTapSoundId);
      }
      emitParticle(scene, point);
    } else if (config.repeatTapSoundId) {
      triggerSound(config.repeatTapSoundId);
    }
    owl.flyTo(point);
  };

  const unregisters = targets.map((target) => dispatcher.registerWithPoint(target, onFloorTap));

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
