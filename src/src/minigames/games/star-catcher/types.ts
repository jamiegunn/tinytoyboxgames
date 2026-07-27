/**
 * Local type surface for the generated Star Catcher minigame.
 *
 * This file is intentionally small. It collects the tiny game-specific
 * contracts that multiple modules need to share so the rest of the template
 * can stay explicit without duplicating shape definitions.
 */

import type { Mesh, Object3D, Texture, TorusGeometry, Vector3 } from 'three';
import type { GameLightingRig } from '@app/minigames/shared/sceneSetup';

/** The baseline template supports a normal target and a higher-value bonus target. */
export type TemplateTargetKind = 'standard' | 'bonus';

/**
 * What a target is currently doing.
 *
 * `falling` and `resting` are both catchable. `resting` is the settled star
 * lying in the grass after it lands: it keeps glowing, keeps bobbing and stays
 * tappable for a couple of seconds before it sinks away. That phase is what
 * puts catchable content in the lower third of the frame, which previously held
 * none at all, and it gives a slow three-year-old a second chance at a star
 * they were still reaching for.
 *
 * `caught` and `fading` are the two short despawn animations that play *before*
 * the star is handed back to the pool — catching used to hard-hide the mesh and
 * teleport it to (0, -10, 0) in the same frame, so the single most important
 * moment in the game had no animation at all (defect 2).
 */
export type TemplateTargetPhase = 'falling' | 'resting' | 'caught' | 'fading';

/** Runtime state tracked for each tappable target in the scene. */
export interface TemplateTargetState {
  mesh: Mesh;
  active: boolean;
  kind: TemplateTargetKind;
  phase: TemplateTargetPhase;
  /** Seconds elapsed inside the current non-falling phase. */
  phaseTime: number;
  points: number;
  bobPhase: number;
  /** Downward speed in world units per second. Stars fall; they used to rise. */
  fallSpeed: number;
  /**
   * World X travelled per world unit of fall.
   *
   * A constant world X is *not* a constant screen column for this camera: the
   * view depth of a point grows as it descends, so an untouched star slides
   * toward the centre of the frame as it falls. This is solved once at spawn so
   * the star tracks a straight vertical line on screen, which is the only
   * trajectory a small child can lead.
   */
  driftX: number;
  /** World Y of the patch of hillside this star is aimed at. */
  landingY: number;
  rotationSpeed: number;
  lifetimeRemaining: number;
}

/**
 * Play-space envelope, authored in normalized device coordinates.
 *
 * Screen space, not world space, is the honest coordinate system here: what
 * matters is that stars enter above the top edge, occupy the full width, and
 * land spread down the lower half of the frame. The world positions that
 * produce that are derived per spawn from the live camera in `view.ts`.
 */
export interface PlayFieldBounds {
  /** Half-width of the column span stars fall down, in NDC X. */
  ndcHalfWidth: number;
  /** Lowest landing row, in NDC Y (-1 is the bottom edge of the frame). */
  landingNdcMin: number;
  /** Highest landing row, in NDC Y. */
  landingNdcMax: number;
  /** World-space clearance above the top edge at which stars appear. */
  spawnClearance: number;
}

/**
 * Minimal canvas rectangle used to project world positions into the same
 * coordinate space the shell reports taps in. A `DOMRect` satisfies it.
 */
export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Temporary pulse effect shown when the player taps but misses everything. */
export interface TransientPulseState {
  mesh: Mesh;
  age: number;
  duration: number;
  /** Scale at age 0. */
  startScale: number;
  /** Scale at the end of the pulse. */
  endScale: number;
  /** Opacity at age 0; fades linearly to zero. */
  startOpacity: number;
}

/**
 * Pooled resources behind the miss pulse.
 *
 * Defect 8: the miss ring used to allocate a fresh `TorusGeometry` *and* a fresh
 * `MeshStandardMaterial` on every single miss and dispose them 0.45s later. The
 * geometry is now built once per run and the ring meshes are recycled.
 */
export interface TransientEffectRig {
  /** The one ring geometry every pulse mesh shares. */
  ringGeometry: TorusGeometry;
  /** Pulses currently animating in the scene. */
  active: TransientPulseState[];
  /** Ring meshes parked out of the scene, ready for the next miss. */
  idle: Mesh[];
}

/** A decorative night-sky object that answers a tap with a friendly twinkle. */
export interface AmbientTwinklePoint {
  /** World-space position the sparkle burst is emitted at. */
  position: Vector3;
  /** Generous screen-space tap radius, in CSS pixels. */
  radiusPx: number;
  /** How many sparkle particles this object is worth. */
  sparkleCount: number;
}

/** Environment objects created during setup and reused for update / teardown. */
export interface TemplateEnvironmentRig {
  lights: GameLightingRig;
  floor: Mesh;
  backdrop: Mesh;
  accents: Object3D[];
  /**
   * Canvas textures the environment allocated. `disposeMeshDeep` frees
   * geometries and materials but not textures, so teardown has to walk these
   * itself or they leak for the lifetime of the page.
   */
  textures: Texture[];
  /** Screen-space tap targets for the moon and the background starfield. */
  twinklePoints: AmbientTwinklePoint[];
}
