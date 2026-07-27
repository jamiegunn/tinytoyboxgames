import { type Object3D, type Mesh, Scene, Vector3, Color } from 'three';
import { getParticleEngine } from '@app/utils/particles/registry';
import { PARTICLES } from '@app/utils/particles/presets';
import type { SharkAnimState } from './shark';
import { triggerBarrelRoll } from './shark';
import type { MiniGameContext } from '../../framework/types';

// Returns the world position of a tapped mesh.
//
// Every handler below used `mesh.position`, which is the mesh's position in its
// PARENT's space. Corals and plants are Groups placed out on the reef with their
// sub-meshes at small local offsets, so a coral 30 units from the origin emitted
// its bonk puff about 0.3 units from the world origin — off-camera, behind the
// shark, every time. Anemones and the chest are added straight to the scene so
// the two agreed there; this makes it right for all of them.
function worldPositionOf(mesh: Object3D): Vector3 {
  return mesh.getWorldPosition(new Vector3());
}

// Walks up from a picked sub-mesh to the prop root that was added to the scene.
function propRootOf(mesh: Object3D): Object3D {
  let node = mesh;
  while (node.parent && !(node.parent as Scene).isScene) node = node.parent;
  return node;
}

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
  /** Ducks an anemone's tentacles and puffs colored plankton on tap. */
  handleAnemoneTap(mesh: Object3D, scene: Scene, audio: MiniGameContext['audio']): void;
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
    // Defect 10: the wiggle was 0.087 rad (5 degrees) at 40 rad/s for 0.3s —
    // fast enough and small enough to be invisible at any sane frame rate.
    // 0.3 rad (17 degrees) over 0.55s at a slower beat actually reads as a bonk.
    enqueueTapAnimation(mesh, 'z', mesh.rotation.z, 18, 0.3, 0.55);
    getParticleEngine(scene).emit(PARTICLES.bubblePop, worldPositionOf(mesh), { colors: [new Color(0.5, 0.4, 0.3)], count: 12 });
    audio.playSound('coral-bonk');
  }

  function handleAnemoneTap(mesh: Object3D, scene: Scene, audio: MiniGameContext['audio']): void {
    // Defect 8: anemones matched no classifyPickedMesh prefix, so tapping one
    // fell through to the 'water' case and the shark lunged at the seabed. They
    // now get their own response: the tapped tentacle ducks and springs back,
    // with a puff tinted to the anemone's own color.
    enqueueTapAnimation(mesh, 'x', mesh.rotation.x, 12, 0.5, 0.7);
    const tint = new Color(0.95, 0.5, 0.75);
    const mat = (mesh as { material?: { color?: Color } }).material;
    if (mat?.color) tint.copy(mat.color);
    getParticleEngine(scene).emit(PARTICLES.sparkle, worldPositionOf(mesh), { colors: [tint], count: 10 });
    audio.playSound('seaweed-rustle');
  }

  function handleSeaweedTap(mesh: Object3D, audio: MiniGameContext['audio']): void {
    // Defect 4: the boost this records is now actually consumed by
    // updateSeaweedSway. 1.2s so the child sees the whole thrash, not a blink.
    //
    // It has to be keyed on the plant's root, not the mesh the ray hit.
    // updateSeaweedSway iterates `env.seaweeds`, which holds the Group that
    // setup.ts added to the scene, and looks each one up in this map — so
    // recording the sub-mesh under the child's finger meant the lookup never
    // matched and the boost was silently dropped on every tap.
    seaweedBoostTimers.set(propRootOf(mesh), 1.2);
    audio.playSound('seaweed-rustle');
  }

  function handleTreasureChestTap(mesh: Object3D, scene: Scene, audio: MiniGameContext['audio']): void {
    enqueueTapAnimation(mesh, 'x', 0, 15, 0.175, 0.4);
    getParticleEngine(scene).emit(PARTICLES.sparkle, worldPositionOf(mesh), { colors: [new Color(1.0, 0.85, 0.2)], count: 15 });
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

  return { handleCoralTap, handleAnemoneTap, handleSeaweedTap, handleTreasureChestTap, update, clear };
}

/** Categories a picked mesh can resolve to. */
export type PickedKind = 'fish' | 'golden' | 'shark' | 'coral' | 'anemone' | 'seaweed' | 'treasure' | 'rock' | 'water';

/**
 * Classifies a picked mesh name into a tap-target category.
 * @param meshName - The name of the picked mesh.
 * @returns The category of the tapped object.
 */
export function classifyPickedMesh(meshName: string): PickedKind {
  if (meshName.includes('golden_')) return 'golden';
  if (meshName.includes('fish_')) return 'fish';
  if (meshName.includes('shark_')) return 'shark';
  if (meshName.includes('coral_')) return 'coral';
  // Defect 8: all eight anemones (anemone_base_*, anemone_tent_*, anemone_tip_*)
  // matched nothing here and silently fell through to 'water'.
  if (meshName.includes('anemone_')) return 'anemone';
  if (meshName.includes('seaweed_')) return 'seaweed';
  if (meshName.includes('treasure_')) return 'treasure';
  if (meshName.includes('rock_')) return 'rock';
  return 'water';
}

/**
 * Acknowledges a tap that hit nothing at all with a small bubble puff.
 *
 * Defect 5: a ray that missed every mesh used to return silently from `onTap`.
 * A 3-year-old cannot tell "you missed" from "the game is broken", so every tap
 * now gets an answer — just a quieter one than a hit.
 *
 * @param scene - The Three.js scene.
 * @param worldPos - Approximate world position under the tap.
 * @param audio - Audio context for sound playback.
 */
export function handleMissedTap(scene: Scene, worldPos: Vector3, audio: MiniGameContext['audio']): void {
  getParticleEngine(scene).emit(PARTICLES.bubblePop, worldPos, { colors: [new Color(0.7, 0.9, 1.0)], count: 6 });
  audio.playSound('water-bloop');
}

/**
 * Creates a ripple ring and plays a water sound when tapping empty water.
 * @param scene - The Three.js scene.
 * @param worldPos - World position of the tap.
 * @param audio - Audio context for sound playback.
 */
export function handleWaterTap(scene: Scene, worldPos: Vector3, audio: MiniGameContext['audio']): void {
  getParticleEngine(scene).emit(PARTICLES.bubblePop, worldPos, { colors: [new Color(0.5, 0.7, 1.0)], count: 10 });
  audio.playSound('water-bloop');
}

/**
 * Creates a small dust puff when tapping a rock.
 * @param mesh - The tapped rock mesh.
 * @param scene - The Three.js scene.
 * @param audio - Audio context for sound playback.
 */
export function handleRockTap(mesh: Object3D, scene: Scene, audio: MiniGameContext['audio']): void {
  getParticleEngine(scene).emit(PARTICLES.bubblePop, mesh.position.clone(), { colors: [new Color(0.5, 0.5, 0.5)], count: 5 });
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
    getParticleEngine(scene).emit(PARTICLES.bubblePop, sharkRoot.position.clone(), { colors: [new Color(0.4, 0.7, 1.0)], count: 15 });
    audio.playSound('shark-barrel-roll');
  }
  return rolled;
}
