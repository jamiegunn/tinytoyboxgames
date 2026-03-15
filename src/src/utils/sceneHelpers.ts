import { Box3, Color, DirectionalLight, AmbientLight, PointLight, Vector3, Mesh, PlaneGeometry, type Scene } from 'three';
import { createFeltMaterial, createPlasticMaterial, createWoodMaterial } from './materialFactory';
import { createSparkleBurst } from './particles';
import { createOwlCompanion, type OwlCompanion } from '@app/entities/owl';
import type { WorldTapDispatcher } from './worldTapDispatcher';

// ── Shadow Configuration ──────────────────────────────────────────────────────

/** Configuration for shadow mapping on a directional light. */
export interface ShadowConfig {
  /** Shadow map resolution. @default 1024 */
  mapSize?: number;
  /** Shadow bias to prevent acne. @default -0.001 */
  bias?: number;
}

/**
 * Configures shadow mapping on a directional light with project-standard defaults.
 *
 * @param keyLight - The directional light that casts shadows.
 * @param config - Optional overrides for map size and bias.
 */
export function configureShadows(keyLight: DirectionalLight, config?: ShadowConfig): void {
  const mapSize = config?.mapSize ?? 1024;
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(mapSize, mapSize);
  keyLight.shadow.bias = config?.bias ?? -0.001;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 50;
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -10;
}

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
}

/** The lighting objects returned by createSceneLighting. */
export interface SceneLighting {
  keyLight: DirectionalLight;
  fillLight: AmbientLight;
  accentLight: PointLight | null;
}

/**
 * Creates a complete lighting rig (directional key + ambient fill + point accent)
 * and configures shadows on the key light.
 *
 * @param scene - The Three.js scene to add lights to.
 * @param config - Colour, intensity, and position values for each light.
 * @param shadowConfig - Optional overrides for the shadow configuration.
 * @returns The lighting objects.
 */
export function createSceneLighting(scene: Scene, config: LightingConfig, shadowConfig?: ShadowConfig): SceneLighting {
  const keyLight = new DirectionalLight(config.keyColor, config.keyIntensity);
  keyLight.position.copy(config.keyDirection.clone().negate().multiplyScalar(10));
  keyLight.target.position.set(0, 0, 0);
  scene.add(keyLight);
  scene.add(keyLight.target);
  configureShadows(keyLight, shadowConfig);

  const fillLight = new AmbientLight(config.fillColor, config.fillIntensity);
  scene.add(fillLight);

  let accentLight: PointLight | null = null;
  if (config.accentPosition) {
    accentLight = new PointLight(config.accentColor ?? new Color(1, 1, 1), config.accentIntensity ?? 0.15);
    accentLight.position.copy(config.accentPosition);
    scene.add(accentLight);
  }

  return { keyLight, fillLight, accentLight };
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
  /** Interior inset applied when deriving owl flight bounds from the floor mesh. */
  owlBoundsMargin?: number;
  /** Scene-authored vertical clamp used to keep the owl arc inside the shell. */
  ceilingY?: number;
  /** Particle effect to play on first tap. @default createSparkleBurst */
  particleFn?: (scene: Scene, point: Vector3) => void;
}

/**
 * Wires the first-tap fallback pattern and owl companion to a ground mesh
 * via the centralized world tap dispatcher.
 *
 * @param scene - The Three.js scene.
 * @param dispatcher - The world tap dispatcher.
 * @param ground - The ground mesh to attach the pick trigger to.
 * @param config - Owl position and optional particle function override.
 * @returns The OwlCompanion handle and a cleanup function.
 */
export function wireFloorTap(scene: Scene, dispatcher: WorldTapDispatcher, ground: Mesh, config: FloorTapConfig): { owl: OwlCompanion; cleanup: () => void } {
  ground.updateWorldMatrix(true, false);
  const groundBounds = new Box3().setFromObject(ground);
  const margin = config.owlBoundsMargin ?? 0.5;
  const maxInsetX = Math.max(0, (groundBounds.max.x - groundBounds.min.x) / 2 - 0.1);
  const maxInsetZ = Math.max(0, (groundBounds.max.z - groundBounds.min.z) / 2 - 0.1);
  const insetX = Math.min(margin, maxInsetX);
  const insetZ = Math.min(margin, maxInsetZ);

  const owl = createOwlCompanion(scene, config.owlPosition, {
    restFacingY: config.owlFacingY,
    flightBounds: {
      minX: groundBounds.min.x + insetX,
      maxX: groundBounds.max.x - insetX,
      minZ: groundBounds.min.z + insetZ,
      maxZ: groundBounds.max.z - insetZ,
      minY: 0.3,
      maxY: Math.max(config.owlPosition.y, (config.ceilingY ?? 6.0) - 1.0),
    },
  });
  const emitParticle = config.particleFn ?? createSparkleBurst;

  let firstTapHandled = false;

  const unregister = dispatcher.registerWithPoint(ground, (point: Vector3) => {
    if (!firstTapHandled) {
      firstTapHandled = true;
      emitParticle(scene, point);
    }
    owl.flyTo(point);
  });

  const cleanup = () => {
    unregister();
    owl.dispose();
  };

  return { owl, cleanup };
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
  const items: Disposable[] = [];

  const disposeAll = () => {
    for (const item of items) {
      item.dispose();
    }
    items.length = 0;
  };

  return {
    add: (...newItems: Disposable[]) => {
      items.push(...newItems);
    },
    disposeAll,
  };
}
