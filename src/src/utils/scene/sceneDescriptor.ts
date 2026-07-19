/**
 * SceneDescriptor — one declarative schema for "how a screen is described".
 *
 * See architecture-standards.md#scenedescriptor. Every scene used to hand-write
 * an `environment.ts` with a slightly different shape (Nature's
 * `NATURE_ENVIRONMENT`, the rooms' world-factory configs, each game's bespoke
 * setup). This is the single schema those collapse into: a screen becomes data,
 * wired through the unified factories — {@link CameraDescriptor} (§7),
 * {@link LightingDescriptor} (§6), the sky rig (backdrop), the FrameClock and
 * DisposalScope, and the InteractionController — by one builder ({@link buildScene}).
 *
 * This file is deliberately import-light: everything from `@app/*` and `three`
 * is a *type-only* import, so the module carries no runtime dependency on the
 * rest of the app. That lets {@link validateSceneDescriptor} — the pure rule
 * the contract test enforces — load and run behaviourally under `node --test`.
 */

import type { Color, Vector3, PerspectiveCamera, Mesh } from 'three';
import type { CameraDescriptor } from '@app/utils/camera';
import type { LightingDescriptor, LightingRig } from '@app/utils/lighting';
import type { SkydomeOptions } from '@app/utils/skyRig';
import type { FrameClock } from '@app/utils/frameClock';
import type { DisposalScope } from '@app/utils/disposal';
import type { InteractionController, InteractionAudio } from '@app/utils/interaction';
import type { SceneId } from '@app/scenes/sceneCatalog';

/** The ground plane of a scene. */
export interface GroundDescriptor {
  /** Ground colour. */
  color: Color;
  /** Plane width along X, world units. */
  width: number;
  /** Plane depth along Z, world units. */
  depth: number;
  /** Ground Y position. @default 0 */
  y?: number;
}

/**
 * The backdrop skydome of a scene — the exact option set the shared sky rig
 * (`createGradientSkydome`) consumes. See scene-rendering-standards.md.
 */
export type SkyDescriptor = SkydomeOptions;

/** A portal that launches a mini-game from within a scene. */
export interface PortalDescriptor {
  /** The mini-game id this portal launches. */
  gameId: string;
  /** World-space position of the portal. */
  position: Vector3;
  /** Portal accent colour. */
  color: Color;
}

/** Scene-level music and ambient beds (audio-standards.md — both required). */
export interface SceneAudioDescriptor {
  /** Background music sound id. Must be non-empty and registered. */
  musicId: string;
  /** Ambient loop sound id. Must be non-empty and registered. */
  ambientId: string;
}

/** The whole declarative description of one navigable screen. */
export interface SceneDescriptor {
  /** Registered scene id (matches the catalog). */
  id: SceneId;
  /** Camera pose (§7). */
  camera: CameraDescriptor;
  /** Lighting rig (§6). */
  lighting: LightingDescriptor;
  /** Ground plane. */
  ground: GroundDescriptor;
  /** Optional gradient skydome backdrop (sky rig). */
  backdrop?: SkyDescriptor;
  /** Music + ambient beds (audio-standards.md). */
  audio: SceneAudioDescriptor;
  /** Optional mini-game portals. */
  portals?: PortalDescriptor[];
}

/** Runtime inputs the builder needs but that are not part of the description. */
export interface SceneBuildContext {
  /** The canvas the InteractionController listens on. */
  canvas: HTMLCanvasElement;
  /** Viewport aspect ratio (width / height). */
  aspect: number;
  /** Optional audio hooks enabling the no-dead-tap fallback. */
  audio?: InteractionAudio;
}

/** The live runtime a built scene exposes. */
export interface SceneRuntime {
  /** The scene's single per-frame pump. */
  clock: FrameClock;
  /** The scene's teardown registry (owns every resource the builder created). */
  scope: DisposalScope;
  /** The positioned camera. */
  camera: PerspectiveCamera;
  /** The live lighting rig. */
  lighting: LightingRig;
  /** The tappable-object controller. */
  interaction: InteractionController;
  /** The ground mesh. */
  ground: Mesh;
  /** The skydome mesh, or null when the descriptor declares no backdrop. */
  sky: Mesh | null;
  /** The scene's portals (pure data; prop builders own their meshes). */
  portals: PortalDescriptor[];
  /** Disposes the whole scene runtime (idempotent). */
  dispose(): void;
}

/**
 * True when `v` looks like a Vector3 with finite components.
 *
 * @param v - The candidate value.
 * @returns True when `v` has finite numeric x, y, and z.
 */
function isFiniteVec(v: unknown): v is Vector3 {
  const p = v as { x?: unknown; y?: unknown; z?: unknown } | null | undefined;
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

/**
 * True when `c` looks like a Color with finite channels.
 *
 * @param c - The candidate value.
 * @returns True when `c` has finite numeric r, g, and b.
 */
function isFiniteColor(c: unknown): c is Color {
  const p = c as { r?: unknown; g?: unknown; b?: unknown } | null | undefined;
  return !!p && Number.isFinite(p.r) && Number.isFinite(p.g) && Number.isFinite(p.b);
}

/**
 * Accumulates a validation problem when `ok` is false.
 *
 * @param problems - The list to append to.
 * @param ok - The condition; a problem is recorded when this is false.
 * @param message - The problem message to record.
 */
function check(problems: string[], ok: boolean, message: string): void {
  if (!ok) problems.push(message);
}

/**
 * Validates a scene descriptor against the load-bearing rules the capstone
 * guarantees: non-empty audio (audio-standards.md), a resolvable backdrop when
 * present, and a valid camera. Returns a list of human-readable problems; an
 * empty array means the descriptor is valid.
 *
 * Pure and dependency-free so the contract test runs the *actual* rule.
 *
 * @param d - The descriptor to validate.
 * @returns Problems found (empty when valid), each prefixed with the scene id.
 */
export function validateSceneDescriptor(d: SceneDescriptor): string[] {
  const problems: string[] = [];
  const id = typeof d?.id === 'string' && d.id.length > 0 ? d.id : '<no-id>';
  const at = (m: string): string => `[${id}] ${m}`;

  check(problems, typeof d?.id === 'string' && d.id.length > 0, at('id must be a non-empty string'));

  // Audio — every scene ships music AND ambient (audio-standards.md).
  check(problems, !!d?.audio && typeof d.audio.musicId === 'string' && d.audio.musicId.length > 0, at('audio.musicId must be non-empty'));
  check(problems, !!d?.audio && typeof d.audio.ambientId === 'string' && d.audio.ambientId.length > 0, at('audio.ambientId must be non-empty'));

  // Camera — valid pose and a sane fov.
  const cam = d?.camera;
  if (!cam) {
    problems.push(at('camera is required'));
  } else {
    check(problems, Number.isFinite(cam.fov) && cam.fov > 0 && cam.fov < 180, at('camera.fov must be in (0, 180) degrees'));
    if (cam.kind === 'orbit') {
      check(problems, isFiniteVec(cam.target), at('orbit camera.target must be a finite Vector3'));
      check(problems, Number.isFinite(cam.azimuth), at('orbit camera.azimuth must be finite'));
      check(problems, Number.isFinite(cam.polar) && cam.polar > 0 && cam.polar < Math.PI, at('orbit camera.polar must be in (0, π)'));
      check(problems, Number.isFinite(cam.distance) && cam.distance > 0, at('orbit camera.distance must be > 0'));
    } else if (cam.kind === 'fixed') {
      check(problems, isFiniteVec(cam.position), at('fixed camera.position must be a finite Vector3'));
      check(problems, isFiniteVec(cam.target), at('fixed camera.target must be a finite Vector3'));
    } else {
      problems.push(at('camera.kind must be "orbit" or "fixed"'));
    }
  }

  // Lighting — well-formed key + fill.
  const light = d?.lighting;
  if (!light) {
    problems.push(at('lighting is required'));
  } else {
    check(problems, !!light.key && isFiniteVec(light.key.direction), at('lighting.key.direction must be a finite Vector3'));
    check(problems, !!light.key && isFiniteVec(light.key.direction) && light.key.direction.lengthSq() > 0, at('lighting.key.direction must be non-zero'));
    check(problems, !!light.key && Number.isFinite(light.key.intensity) && light.key.intensity >= 0, at('lighting.key.intensity must be >= 0'));
    check(problems, !!light.key && isFiniteColor(light.key.color), at('lighting.key.color must be a finite Color'));
    check(problems, !!light.fill && isFiniteColor(light.fill.skyColor), at('lighting.fill.skyColor must be a finite Color'));
    check(problems, !!light.fill && isFiniteColor(light.fill.groundColor), at('lighting.fill.groundColor must be a finite Color'));
    check(problems, !!light.fill && Number.isFinite(light.fill.intensity) && light.fill.intensity >= 0, at('lighting.fill.intensity must be >= 0'));
  }

  // Ground — a real plane.
  const ground = d?.ground;
  if (!ground) {
    problems.push(at('ground is required'));
  } else {
    check(problems, isFiniteColor(ground.color), at('ground.color must be a finite Color'));
    check(problems, Number.isFinite(ground.width) && ground.width > 0, at('ground.width must be > 0'));
    check(problems, Number.isFinite(ground.depth) && ground.depth > 0, at('ground.depth must be > 0'));
  }

  // Backdrop — only when present; must resolve to a real skydome.
  if (d?.backdrop) {
    const b = d.backdrop;
    check(problems, Number.isFinite(b.radius) && b.radius > 0, at('backdrop.radius must be > 0'));
    check(problems, isFiniteVec(b.center), at('backdrop.center must be a finite Vector3'));
    check(problems, isFiniteColor(b.topColor), at('backdrop.topColor must be a finite Color'));
    check(problems, isFiniteColor(b.horizonColor), at('backdrop.horizonColor must be a finite Color'));
    check(problems, isFiniteColor(b.bottomColor), at('backdrop.bottomColor must be a finite Color'));
  }

  // Portals — data only, but each must name a game and sit somewhere real.
  for (const [i, p] of (d?.portals ?? []).entries()) {
    check(problems, typeof p.gameId === 'string' && p.gameId.length > 0, at(`portals[${i}].gameId must be non-empty`));
    check(problems, isFiniteVec(p.position), at(`portals[${i}].position must be a finite Vector3`));
    check(problems, isFiniteColor(p.color), at(`portals[${i}].color must be a finite Color`));
  }

  return problems;
}
