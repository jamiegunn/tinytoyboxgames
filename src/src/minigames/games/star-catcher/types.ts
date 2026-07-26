/**
 * Local type surface for the generated Star Catcher minigame.
 *
 * This file is intentionally small. It collects the tiny game-specific
 * contracts that multiple modules need to share so the rest of the template
 * can stay explicit without duplicating shape definitions.
 */

import type { Mesh, Object3D, TorusGeometry, Vector3 } from 'three';
import type { GameLightingRig } from '@app/minigames/shared/sceneSetup';

/** The baseline template supports a normal target and a higher-value bonus target. */
export type TemplateTargetKind = 'standard' | 'bonus';

/**
 * What a target is currently doing.
 *
 * Only a `falling` star is catchable. `caught` and `fading` are the two short
 * despawn animations that play *before* the star is handed back to the pool —
 * catching used to hard-hide the mesh and teleport it to (0, -10, 0) in the same
 * frame, so the single most important moment in the game had no animation at
 * all (defect 2).
 */
export type TemplateTargetPhase = 'falling' | 'caught' | 'fading';

/** Runtime state tracked for each tappable target in the scene. */
export interface TemplateTargetState {
  mesh: Mesh;
  active: boolean;
  kind: TemplateTargetKind;
  phase: TemplateTargetPhase;
  /** Seconds elapsed inside the current despawn phase (unused while falling). */
  phaseTime: number;
  points: number;
  bobPhase: number;
  /** Downward speed in world units per second. Stars fall; they used to rise. */
  fallSpeed: number;
  rotationSpeed: number;
  lifetimeRemaining: number;
}

/** Authored play-space envelope used when spawning template entities. */
export interface SpawnBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Spawn altitude, above the top of the frame so stars fall into view. */
  y: number;
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
  /** Screen-space tap targets for the moon and the background starfield. */
  twinklePoints: AmbientTwinklePoint[];
}
