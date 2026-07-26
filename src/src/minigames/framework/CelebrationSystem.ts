/**
 * CelebrationSystem — the shared "you did it" feedback channel for every
 * minigame.
 *
 * Until now `confetti()` played a sound and rendered nothing (it carried a
 * "will be added when integrated with Babylon.js" note, from a renderer this
 * project never shipped). Because all five games route both their per-success
 * feedback *and* their milestones through it, every celebration in the product
 * was audio-only. This module now emits real particles through the scene's
 * ParticleEngine. See architecture-standards.md#particleengine.
 *
 * Coordinate handling: games call `confetti(screenX, screenY)` with CSS pixels
 * relative to the canvas (what `InputDispatcher` hands them). Those are
 * unprojected onto the plane through the world origin whose normal is the
 * camera's forward axis — the plane every game's action actually sits on — so
 * the burst lands under the child's finger regardless of camera descriptor.
 * Call sites that already know a world position should prefer `burstAt`, which
 * skips the round trip and is exact.
 */

import { Vector3, type Camera, type Scene } from 'three';
import { CELEBRATION_CONFETTI, CELEBRATION_FLASH, getParticleEngine } from '@app/utils/particles';
import type { CelebrationIntensity, CelebrationSystem } from './types';

/** Maps celebration sound types to their procedural audio module IDs. */
const SOUND_MAP: Record<string, string> = {
  pop: 'sfx_shared_pop',
  chime: 'sfx_shared_chime',
  fanfare: 'sfx_shared_fanfare',
  whoosh: 'sfx_shared_whoosh',
  chomp: 'sfx_shared_chomp',
  splash: 'sfx_shared_splash',
};

/**
 * Particle counts per intensity tier. `large` is a milestone, not a routine
 * pop, so the tiers must stay strictly increasing — a child has to be able to
 * tell "good" from "amazing" without reading a number. Exported so the
 * contract test can pin that ordering.
 */
export const CELEBRATION_INTENSITY: Record<CelebrationIntensity, { confetti: number; flash: number }> = {
  small: { confetti: 10, flash: 5 },
  medium: { confetti: 22, flash: 10 },
  large: { confetti: 44, flash: 20 },
};

/** How many extra bursts a milestone rains across the top of the view. */
const MILESTONE_SHOWER_POINTS = 5;

/** Clamps for the unprojected ray distance, so a degenerate camera can't fling a burst to infinity. */
const MIN_DEPTH = 0.5;
const MAX_DEPTH = 60;

/** Dependencies the system needs in order to draw, supplied by MiniGameShell. */
export interface CelebrationDeps {
  /** The game's scene — its registered ParticleEngine receives every burst. */
  scene: Scene;
  /** The game's camera, used to unproject screen coordinates. */
  camera: Camera;
  /** The render canvas, whose client size defines the screen coordinate space. */
  canvas: HTMLCanvasElement;
  /** Fires a sound effect by its procedural audio ID. */
  playSound: (id: string) => void;
}

/**
 * Converts canvas-relative CSS pixels to a world point on the plane through the
 * world origin whose normal is the camera's forward axis.
 *
 * Exported for the contract test: this is the one piece of real math in the
 * module, and if it drifts every celebration in the product lands in the wrong
 * place — visibly, but silently as far as the build is concerned.
 *
 * @param camera - The game camera.
 * @param canvas - The render canvas, defining the CSS-pixel space.
 * @param screenX - Horizontal position in CSS pixels.
 * @param screenY - Vertical position in CSS pixels.
 * @param out - Caller-owned scratch vector; receives and is returned as the result.
 * @param forward - Caller-owned scratch vector for the camera's forward axis.
 * @returns `out`, holding the world position.
 */
export function screenToWorld(camera: Camera, canvas: HTMLCanvasElement, screenX: number, screenY: number, out: Vector3, forward: Vector3): Vector3 {
  const width = canvas.clientWidth || 1;
  const height = canvas.clientHeight || 1;
  const ndcX = (screenX / width) * 2 - 1;
  const ndcY = -((screenY / height) * 2 - 1);

  // Unproject a mid-depth NDC point, then take the ray camera → that point.
  out.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();

  // Intersect that ray with the plane { p · forward = 0 }: t = -(c·f) / (d·f).
  forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const denom = out.dot(forward);
  const raw = Math.abs(denom) > 1e-4 ? -camera.position.dot(forward) / denom : camera.position.length();
  const t = Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, raw));

  return out.multiplyScalar(t).add(camera.position);
}

/**
 * Creates the celebration system for one minigame instance.
 *
 * @param deps - Scene, camera, canvas, and the sound bridge.
 * @returns A live CelebrationSystem.
 */
export function createCelebrationSystem(deps: CelebrationDeps): CelebrationSystem {
  const { scene, camera, canvas, playSound } = deps;
  // Reused across calls — celebrations fire on the hot path (every pop).
  const point = new Vector3();
  const forward = new Vector3();
  const showerPoint = new Vector3();

  // Emits the two-layer burst (instant additive flash + slower falling
  // confetti) at a world position.
  function emitAt(position: Vector3, intensity: CelebrationIntensity): void {
    const engine = getParticleEngine(scene);
    const counts = CELEBRATION_INTENSITY[intensity] ?? CELEBRATION_INTENSITY.medium;
    engine.emit(CELEBRATION_FLASH, position, { count: counts.flash });
    engine.emit(CELEBRATION_CONFETTI, position, { count: counts.confetti });
  }

  const system: CelebrationSystem = {
    confetti(screenX: number, screenY: number, intensity: CelebrationIntensity = 'medium'): void {
      emitAt(screenToWorld(camera, canvas, screenX, screenY, point, forward), intensity);
      playSound('sfx_shared_sparkle_burst');
    },

    burstAt(worldPosition: Vector3, intensity: CelebrationIntensity = 'medium'): void {
      emitAt(worldPosition, intensity);
      playSound('sfx_shared_sparkle_burst');
    },

    celebrationSound(type: 'pop' | 'chime' | 'fanfare' | 'whoosh' | 'chomp' | 'splash'): void {
      const soundId = SOUND_MAP[type];
      if (soundId) {
        playSound(soundId);
      }
    },

    milestone(screenX: number, screenY: number, intensity: CelebrationIntensity = 'medium'): void {
      // The focal burst, at the point that earned it.
      emitAt(screenToWorld(camera, canvas, screenX, screenY, point, forward), intensity);

      // Plus a shower across the top of the view, so a milestone is visibly
      // bigger than a good tap rather than merely louder.
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      const engine = getParticleEngine(scene);
      for (let i = 0; i < MILESTONE_SHOWER_POINTS; i += 1) {
        const x = (width * (i + 0.5)) / MILESTONE_SHOWER_POINTS;
        screenToWorld(camera, canvas, x, height * 0.12, showerPoint, forward);
        engine.emit(CELEBRATION_CONFETTI, showerPoint, { count: 14 });
      }

      system.celebrationSound('fanfare');
    },
  };

  return system;
}
