/**
 * Local type surface for the generated Star Catcher minigame.
 *
 * This file is intentionally small. It collects the tiny game-specific
 * contracts that multiple modules need to share so the rest of the template
 * can stay explicit without duplicating shape definitions.
 */

import type { Mesh, PerspectiveCamera, Object3D } from 'three';
import type { GameLightingRig } from '@app/minigames/shared/sceneSetup';

/** The baseline template supports a normal target and a higher-value bonus target. */
export type TemplateTargetKind = 'standard' | 'bonus';

/** Runtime state tracked for each tappable target in the scene. */
export interface TemplateTargetState {
  mesh: Mesh;
  active: boolean;
  kind: TemplateTargetKind;
  points: number;
  bobPhase: number;
  driftSpeed: number;
  rotationSpeed: number;
  lifetimeRemaining: number;
}

/** Authored bounds used when spawning or projecting template entities. */
export interface SpawnBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

/** Minimal viewport snapshot used by miss-tap fallback placement. */
export interface RuntimeViewportSnapshot {
  width: number;
  height: number;
}

/** Temporary pulse effect shown when the player taps but misses a target. */
export interface TransientPulseState {
  mesh: Mesh;
  age: number;
  duration: number;
}

/** Environment objects created during setup and reused for update / teardown. */
export interface TemplateEnvironmentRig {
  authoredCamera: PerspectiveCamera;
  lights: GameLightingRig;
  floor: Mesh;
  backdrop: Mesh;
  accents: Object3D[];
}
