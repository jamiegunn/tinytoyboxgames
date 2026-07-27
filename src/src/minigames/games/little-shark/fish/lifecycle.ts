import { Scene, Color, Vector3, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { buildShark as buildSharkMesh, buildFish as buildFishMesh } from '@app/minigames/shared/animalBuilder';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES, GLOW_TRAIL_RATE } from '@app/utils/particles/presets';
import type { StreamHandle } from '@app/utils/particles/engine';
import { disposeMeshDeep } from '@app/minigames/shared/disposal';
import type { FishState, FishKind } from '../types';
import {
  FISH_COLORS,
  GOLDEN_COLOR,
  GOLDEN_SCALE,
  FISH_BASE_SPEED_MIN,
  FISH_BASE_SPEED_MAX,
  MIN_SPAWN_DISTANCE,
  FISH_EMISSIVE_SCALAR,
  GOLDEN_EMISSIVE_SCALAR,
  STANDARD_FISH_SCALE,
} from '../types';
import { randomRange, randomPositionAwayFrom } from '../helpers';

/**
 * Fish entity lifecycle — creation, disposal, and shark construction.
 */

/** Counter for unique mesh naming. */
let meshIndex = 0;

/** Component handles returned by {@link buildSharkEntity}. */
export interface SharkComponents {
  sharkRoot: Mesh;
  sharkBody: Object3D | null;
  sharkGlowTrail: StreamHandle;
  /** Tail fin meshes (for wag animation). */
  tailFins: Object3D[];
  /** Eye white meshes (for blink animation). */
  eyes: Object3D[];
}

// Reef-shark palette for the animalBuilder shark.
//
// `buildShark` (minigames/shared/animalBuilder.ts) is shared with other games,
// so its colours cannot move; it builds the shark from linear (0.42, 0.56,
// 0.72) with a (0.96, 0.96, 0.97) belly. Under this scene's rig that body
// albedo has a luminance of 0.542 against reef sand at 0.691 — 20 sRGB levels
// apart before the fog lerp touches either of them, and the fog then multiplies
// the residual by 0.73. Measured on the shipped build, the shark rendered at
// rgb(119, 147, 168) against water at rgb(117, 142, 151): a delta of 5
// luminance levels. The shark was, literally, the same value as the sea.
//
// Slate (0.14, 0.23, 0.33) is the dark dorsal surface every real reef shark
// has, and it is a value the reef cannot produce: the frame model puts the
// shark at display luminance 72 against 136 for the sand behind it, a delta of
// 63. Counter-shading is the point — a dark back over a pale belly is exactly
// how a shark reads as a shark from above.
const SHARK_BODY_COLOR = new Color(0.14, 0.23, 0.33);

// The fins and the second body segment, one step darker so the silhouette has
// internal structure instead of reading as one flat cut-out.
const SHARK_DARK_COLOR = new Color(0.09, 0.15, 0.22);

// The counter-shaded underside. Held just below white so it has somewhere to go
// when the shark rolls into the key light.
const SHARK_BELLY_COLOR = new Color(0.86, 0.88, 0.9);

// Repaints the shared animalBuilder shark into this scene's palette.
//
// Keyed on the MATERIAL name, not the mesh name. `buildShark` allocates exactly
// three skin materials and shares each across several meshes — `_skinMat` covers
// the body, mid-body, peduncle, both pectorals and the ventral fin — so keying
// on mesh names would have had the mid-body's assignment overwrite the body's on
// the same material object. The eyes, iris, pupil, teeth, mouth and cheek blush
// have their own materials and are left exactly as built.
//
// The materials are per-shark (each `skinMat` call allocates), so writing to
// them here cannot leak into any other game that calls `buildShark`.
//
// Emissive is re-derived from the new albedo because animalBuilder sets it as a
// fraction of the colour it was built with; leaving it would have kept a
// blue-grey glow sitting on top of a slate body.
function recolourShark(root: Object3D): void {
  root.traverse((child) => {
    const mat = (child as Mesh).material as MeshStandardMaterial | undefined;
    if (!mat || !mat.color || typeof mat.name !== 'string') return;
    if (mat.name.endsWith('_darkSkinMat')) {
      mat.color.copy(SHARK_DARK_COLOR);
    } else if (mat.name.endsWith('_skinMat')) {
      mat.color.copy(SHARK_BODY_COLOR);
    } else if (mat.name.endsWith('_whiteSkin')) {
      mat.color.copy(SHARK_BELLY_COLOR);
    } else {
      return;
    }
    if (mat.emissive) mat.emissive.copy(mat.color).multiplyScalar(0.04);
  });
}

// Repaints every material tier `buildFish` derives from the body colour.
//
// This replaces a traverse that matched on the MESH name `_body` and assigned
// the palette Color straight onto that one material. Two bugs lived in those
// four lines.
//
// The first is that `buildFish` allocates FIVE materials from the body colour,
// not one: `_skinMat` (the body), `_darkerSkin` at 0.7x (both tail fins, the
// dorsal, the ventral and both side fins), `_lighterSkin` at 1.15x + 0.12 (the
// belly), and `_spotMat_1` / `_spotMat_2` at 1.35x (the scale discs). Recolouring
// only the body meant a pooled fish came back as a chimera — a magenta body
// still wearing the previous fish's green tail, green dorsal, green fins and
// green scales. Since fish are recycled constantly, most of the reef was
// wearing two colours at once, which is precisely the condition under which
// colour stops being an identifying feature at all.
//
// The second is that it assigned the shared palette `Color` INSTANCE by
// reference. Every fish that drew, say, red ended up pointing at the single
// `FISH_COLORS[0]` object, so anything that later mutated one fish's material
// colour would have silently repainted every other red fish and the palette
// entry itself. `.copy()` throughout.
//
// Emissive is re-derived per tier rather than copied, because
// `createSkinMaterial` sets it as a fraction of the colour the material was
// BUILT with; leaving it alone would have left the old hue glowing underneath
// the new one.
function recolourFish(root: Object3D, color: Color, emissiveScalar: number): void {
  const tiers: [string, Color][] = [
    ['_skinMat', color.clone()],
    ['_darkerSkin', color.clone().multiplyScalar(0.7)],
    [
      '_lighterSkin',
      color
        .clone()
        .multiplyScalar(1.15)
        .add(new Color(0.12, 0.12, 0.12)),
    ],
    ['_spotMat_1', color.clone().multiplyScalar(1.35)],
    ['_spotMat_2', color.clone().multiplyScalar(1.35)],
  ];
  root.traverse((child) => {
    const mat = (child as Mesh).material as MeshStandardMaterial | undefined;
    if (!mat || !mat.color || typeof mat.name !== 'string') return;
    for (const [suffix, tint] of tiers) {
      if (!mat.name.endsWith(suffix)) continue;
      mat.color.copy(tint);
      if (mat.emissive) mat.emissive.copy(tint).multiplyScalar(emissiveScalar);
      return;
    }
  });
}

/**
 * Builds the player shark entity with glow trail and explicit component handles.
 * @param scene - The Three.js scene.
 * @param sharkPos - Initial shark world position.
 * @returns Shark root mesh, body child mesh, glow trail, and component arrays.
 */
export function buildSharkEntity(scene: Scene, sharkPos: Vector3): SharkComponents {
  const sharkGroup = buildSharkMesh(`shark_${meshIndex++}`, sharkPos.clone());
  scene.add(sharkGroup);
  const sharkRoot = sharkGroup as unknown as Mesh;

  let sharkBody: Object3D | null = null;
  const tailFins: Object3D[] = [];
  const eyes: Object3D[] = [];
  sharkRoot.traverse((child) => {
    if (child.name.includes('_body')) sharkBody = child;
    if (child.name.includes('tailFin')) tailFins.push(child);
    if (child.name.includes('eyeWhite')) eyes.push(child);
  });
  recolourShark(sharkRoot);

  const sharkGlowTrail = getParticleEngine(scene).stream(PARTICLES.glowTrail, sharkRoot, GLOW_TRAIL_RATE, {
    colors: [new Color(0.3, 0.6, 1.0)],
  });

  return { sharkRoot, sharkBody, sharkGlowTrail, tailFins, eyes };
}

/**
 * Creates a fish entity using the shared animalBuilder.
 * @param scene - The Three.js scene.
 * @param sharkPos - Current shark position (used to spawn away from).
 * @param kind - The fish kind to create.
 * @param spawnAt - Explicit spawn position. When omitted, a point is chosen at
 *   random anywhere in the play area at least MIN_SPAWN_DISTANCE from the shark.
 *   The golden fish now passes one: left to the random placement it landed a
 *   median of 40 units away in a reef the camera can only see about 15 units
 *   into, so the special fish was on screen roughly 5% of the time it existed.
 * @returns A fresh FishState.
 */
export function createFish(scene: Scene, sharkPos: Vector3, kind: FishKind, spawnAt?: [number, number]): FishState {
  const prefix = kind === 'golden' ? 'golden' : 'fish';
  const color = kind === 'golden' ? GOLDEN_COLOR : FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)];

  const [spawnX, spawnZ] = spawnAt ?? randomPositionAwayFrom(sharkPos.x, sharkPos.z, MIN_SPAWN_DISTANCE);
  const fishGroup = buildFishMesh(`${prefix}_${meshIndex++}`, new Vector3(spawnX, 0, spawnZ), color);
  scene.add(fishGroup);
  const root = fishGroup as unknown as Mesh;

  // Standard fish are much smaller than the shark. The scalar lives in types.ts
  // because it is a legibility decision, not a modelling one, and because it was
  // previously written here, in resetFishForSpawn and in effects.ts — three
  // copies that a single change would have silently split.
  if (kind === 'standard') {
    root.scale.setScalar(STANDARD_FISH_SCALE);
  }

  if (kind === 'golden') {
    root.scale.setScalar(GOLDEN_SCALE * 0.6);
  }

  recolourFish(root, color, kind === 'golden' ? GOLDEN_EMISSIVE_SCALAR : FISH_EMISSIVE_SCALAR);

  let bodyPickMesh: Object3D | null = null;
  root.traverse((child) => {
    if (child.name.includes('_body')) bodyPickMesh = child;
  });

  return {
    root,
    bodyPickMesh: bodyPickMesh ?? root,
    kind,
    color: color.clone(),
    active: true,
    driftPhaseX: Math.random() * Math.PI * 2,
    driftPhaseZ: Math.random() * Math.PI * 2,
    driftSpeed: randomRange(FISH_BASE_SPEED_MIN, FISH_BASE_SPEED_MAX),
    driftCenterX: spawnX,
    driftCenterZ: spawnZ,
    despawnTimer: -1,
    dodgeCount: 0,
    dodgeCooldown: 0,
    dodgeTimer: -1,
    dodgeDirX: 0,
    dodgeDirZ: 0,
    isTargeted: false,
    spawning: false,
    spawnTimer: 0,
    spawnEdgeX: 0,
    spawnEdgeZ: 0,
  };
}

/**
 * Resets a pooled fish for reuse.
 * @param fish - The fish state to reset.
 * @param sharkPos - Current shark position.
 */
export function resetFishForSpawn(fish: FishState, sharkPos: Vector3): void {
  const [spawnX, spawnZ] = randomPositionAwayFrom(sharkPos.x, sharkPos.z, MIN_SPAWN_DISTANCE);
  fish.root.position.set(spawnX, 0, spawnZ);
  fish.root.scale.setScalar(STANDARD_FISH_SCALE);
  fish.root.visible = true;

  // Randomize color, across every tier the builder derived from it.
  const color = FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)];
  recolourFish(fish.root, color, FISH_EMISSIVE_SCALAR);
  fish.color.copy(color);

  fish.active = true;
  fish.driftPhaseX = Math.random() * Math.PI * 2;
  fish.driftPhaseZ = Math.random() * Math.PI * 2;
  fish.driftSpeed = randomRange(FISH_BASE_SPEED_MIN, FISH_BASE_SPEED_MAX);
  fish.driftCenterX = spawnX;
  fish.driftCenterZ = spawnZ;
  fish.despawnTimer = -1;
  fish.dodgeCount = 0;
  fish.dodgeCooldown = 0;
  fish.dodgeTimer = -1;
  fish.dodgeDirX = 0;
  fish.dodgeDirZ = 0;
  fish.isTargeted = false;
  fish.spawning = false;
  fish.spawnTimer = 0;
  fish.spawnEdgeX = 0;
  fish.spawnEdgeZ = 0;
}

/**
 * Hides a fish and marks it inactive for pooling.
 * @param fish - The fish to deactivate.
 */
export function deactivateFish(fish: FishState): void {
  fish.active = false;
  fish.root.visible = false;
}

/**
 * Disposes a fish entity permanently.
 * @param fish - The fish to dispose.
 */
export function disposeFish(fish: FishState): void {
  disposeMeshDeep(fish.root);
}

/**
 * Resets the mesh index counter.
 */
export function resetMeshIndex(): void {
  meshIndex = 0;
}
