import { type Object3D, type Mesh, Scene, Vector3, Color } from 'three';
import { createBubblePopEffect, createSparkleBurst } from '@app/minigames/shared/particleFx';
import type { SharkAnimState } from './shark';
import { triggerBarrelRoll } from './shark';
import type { MiniGameContext } from '../../framework/types';

/** A queued tap animation that ticks via the game update loop. */
interface TapAnimation {
  /** The mesh being animated. */
  mesh: Object3D;
  /** Which rotation axis to animate ('x' or 'z'). */
  axis: 'x' | 'z';
  /** The rotation value to restore when the animation completes. */
  originalValue: number;
  /** Oscillation frequency (radians per second multiplier). */
  frequency: number;
  /** Peak amplitude in radians. */
  amplitude: number;
  /** Total duration of the animation in seconds. */
  duration: number;
  /** Elapsed time in seconds. */
  elapsed: number;
}

/** Session-scoped interaction state that owns tap animations and seaweed boosts. */
export interface InteractionState {
  /** Wobbles a coral and creates a sediment puff on tap. */
  handleCoralTap(mesh: Object3D, scene: Scene, audio: MiniGameContext['audio']): void;
  /** Amplifies seaweed sway temporarily on tap. */
  handleSeaweedTap(mesh: Object3D, audio: MiniGameContext['audio']): void;
  /** Animates a treasure chest lid bounce and creates golden sparkles. */
  handleTreasureChestTap(mesh: Object3D, scene: Scene, audio: MiniGameContext['audio']): void;
  /**
   * Ticks all active tap animations and seaweed boost timers.
   * @param dt - Frame delta time in seconds.
   * @returns Map of boosted seaweed meshes to their remaining boost time.
   */
  update(dt: number): Map<Object3D, number>;
  /** Resets all animations and timers for teardown. */
  clear(): void;
}

/**
 * Creates session-scoped interaction state for tap animations and seaweed boosts.
 * Call once per game session; the returned object owns all stateful animation data
 * so nothing leaks between sessions.
 * @returns An interaction state with handlers, an update tick, and a clear method.
 */
export function createInteractionState(): InteractionState {
  const tapAnimations: TapAnimation[] = [];
  const seaweedBoostTimers = new Map<Object3D, number>();

  /**
   * Adds a rotation-oscillation animation to the queue.
   * @param mesh - Mesh to animate.
   * @param axis - Rotation axis ('x' or 'z').
   * @param originalValue - Rotation value to restore on completion.
   * @param frequency - Oscillation frequency multiplier.
   * @param amplitude - Peak amplitude in radians.
   * @param duration - Animation duration in seconds.
   */
  function enqueueTapAnimation(mesh: Object3D, axis: 'x' | 'z', originalValue: number, frequency: number, amplitude: number, duration: number): void {
    tapAnimations.push({ mesh, axis, originalValue, frequency, amplitude, duration, elapsed: 0 });
  }

  function handleCoralTap(mesh: Object3D, scene: Scene, audio: MiniGameContext['audio']): void {
    enqueueTapAnimation(mesh, 'z', mesh.rotation.z, 40, 0.087, 0.3);
    createBubblePopEffect(scene, mesh.position.clone(), new Color(0.5, 0.4, 0.3), 6);
    audio.playSound('coral-bonk');
  }

  function handleSeaweedTap(mesh: Object3D, audio: MiniGameContext['audio']): void {
    seaweedBoostTimers.set(mesh, 0.5);
    audio.playSound('seaweed-rustle');
  }

  function handleTreasureChestTap(mesh: Object3D, scene: Scene, audio: MiniGameContext['audio']): void {
    enqueueTapAnimation(mesh, 'x', 0, 15, 0.175, 0.4);
    createSparkleBurst(scene, mesh.position.clone(), new Color(1.0, 0.85, 0.2), 15);
    audio.playSound('treasure-jingle');
  }

  /**
   * Ticks all active tap animations and seaweed boost timers.
   * @param dt - Frame delta time in seconds.
   * @returns Map of boosted seaweed meshes to remaining boost time.
   */
  function update(dt: number): Map<Object3D, number> {
    // Tick tap animations in reverse so splice doesn't skip entries
    for (let i = tapAnimations.length - 1; i >= 0; i--) {
      const anim = tapAnimations[i];
      anim.elapsed += dt;

      if (anim.elapsed < anim.duration) {
        const decay = 1 - anim.elapsed / anim.duration;
        const offset = Math.sin(anim.elapsed * anim.frequency) * anim.amplitude * decay;
        if (anim.axis === 'z') {
          anim.mesh.rotation.z = anim.originalValue + offset;
        } else {
          anim.mesh.rotation.x = anim.originalValue + offset;
        }
      } else {
        // Restore original value and remove
        if (anim.axis === 'z') {
          anim.mesh.rotation.z = anim.originalValue;
        } else {
          anim.mesh.rotation.x = anim.originalValue;
        }
        tapAnimations.splice(i, 1);
      }
    }

    // Tick seaweed boost timers
    for (const [mesh, timer] of seaweedBoostTimers) {
      const remaining = timer - dt;
      if (remaining <= 0) {
        seaweedBoostTimers.delete(mesh);
      } else {
        seaweedBoostTimers.set(mesh, remaining);
      }
    }

    return seaweedBoostTimers;
  }

  /** Resets all animations and timers for teardown. */
  function clear(): void {
    // Restore original rotations before clearing
    for (const anim of tapAnimations) {
      if (anim.axis === 'z') {
        anim.mesh.rotation.z = anim.originalValue;
      } else {
        anim.mesh.rotation.x = anim.originalValue;
      }
    }
    tapAnimations.length = 0;
    seaweedBoostTimers.clear();
  }

  return { handleCoralTap, handleSeaweedTap, handleTreasureChestTap, update, clear };
}

/**
 * Classifies a picked mesh name into a tap-target category.
 * @param meshName - The name of the picked mesh.
 * @returns The category of the tapped object.
 */
export function classifyPickedMesh(meshName: string): 'fish' | 'golden' | 'shark' | 'coral' | 'seaweed' | 'treasure' | 'rock' | 'water' {
  if (meshName.includes('golden_')) return 'golden';
  if (meshName.includes('fish_')) return 'fish';
  if (meshName.includes('shark_')) return 'shark';
  if (meshName.includes('coral_')) return 'coral';
  if (meshName.includes('seaweed_')) return 'seaweed';
  if (meshName.includes('treasure_')) return 'treasure';
  if (meshName.includes('rock_')) return 'rock';
  return 'water';
}

/**
 * Creates a ripple ring and plays a water sound when tapping empty water.
 * @param scene - The Three.js scene.
 * @param worldPos - World position of the tap.
 * @param audio - Audio context for sound playback.
 */
export function handleWaterTap(scene: Scene, worldPos: Vector3, audio: MiniGameContext['audio']): void {
  createBubblePopEffect(scene, worldPos, new Color(0.5, 0.7, 1.0), 10);
  audio.playSound('water-bloop');
}

/**
 * Creates a small dust puff when tapping a rock.
 * @param mesh - The tapped rock mesh.
 * @param scene - The Three.js scene.
 * @param audio - Audio context for sound playback.
 */
export function handleRockTap(mesh: Object3D, scene: Scene, audio: MiniGameContext['audio']): void {
  createBubblePopEffect(scene, mesh.position.clone(), new Color(0.5, 0.5, 0.5), 5);
  audio.playSound('crab-skitter');
}

/**
 * Triggers a happy wiggle when tapping the shark.
 * @param sharkAnim - Shark animation state.
 * @param scene - The Three.js scene.
 * @param sharkRoot - The shark root mesh.
 * @param audio - Audio context for sound playback.
 * @returns Whether the wiggle was triggered (false if on cooldown).
 */
export function handleSharkTap(sharkAnim: SharkAnimState, scene: Scene, sharkRoot: Mesh, audio: MiniGameContext['audio']): boolean {
  const rolled = triggerBarrelRoll(sharkAnim);
  if (rolled) {
    createBubblePopEffect(scene, sharkRoot.position.clone(), new Color(0.4, 0.7, 1.0), 15);
    audio.playSound('shark-barrel-roll');
  }
  return rolled;
}
