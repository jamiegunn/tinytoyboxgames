import gsap from 'gsap';
import { Vector3, Color } from 'three';
import type { Object3D } from 'three';

/**
 * A simplified animation keyframe with type-safe values.
 */
export interface AnimKey {
  /** Frame number in the animation timeline. */
  frame: number;
  /** Value at this keyframe — number, Vector3, or Color. */
  value: number | Vector3 | Color;
}

/**
 * Options for {@link playAnimation} and {@link playAnimations}.
 */
export interface PlayAnimationOptions {
  /** Whether to loop the animation. @default false */
  loop?: boolean;
  /** Playback speed ratio. @default 1 */
  speed?: number;
  /** Callback when animation completes (non-looping only). */
  onEnd?: () => void;
  /** Frame rate. @default 60 */
  fps?: number;
  /** Whether to stop current animations on the target first. @default true */
  stopCurrent?: boolean;
}

/**
 * Handle returned by {@link startIdleLoop} for controlling a looping animation.
 */
export interface IdleHandle {
  /** Stops the idle animation. */
  stop(): void;
  /** Restarts the idle animation from the beginning. */
  restart(): void;
}

/**
 * Animation definition for a single property, used in {@link playAnimations}.
 */
export interface PropertyAnimation {
  /** The animated property path (e.g. 'position.y', 'scaling'). */
  property: string;
  /** Keyframes for this property. */
  keys: AnimKey[];
  /** Optional animation name override. */
  name?: string;
}

/**
 * Resolves a dotted property path on an object to a { target, prop } pair.
 * e.g. 'position.y' on a Mesh returns { target: mesh.position, prop: 'y' }.
 *
 * @param obj - The root object.
 * @param path - Dotted property path.
 * @returns The leaf target object and property name.
 */
function resolvePath(obj: unknown, path: string): { target: Record<string, unknown>; prop: string } {
  const parts = path.split('.');
  let current = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]] as Record<string, unknown>;
  }
  return { target: current, prop: parts[parts.length - 1] };
}

/**
 * Converts frame-based keyframes to GSAP-compatible time-based timeline entries.
 *
 * @param keys - Frame-based keyframes.
 * @param fps - Frames per second.
 * @returns Array of { time, value } pairs in seconds.
 */
function keysToTimeline(keys: AnimKey[], fps: number): { time: number; value: number | Vector3 | Color }[] {
  return keys.map((k) => ({ time: k.frame / fps, value: k.value }));
}

/**
 * Plays a single-property animation on a target node using GSAP.
 *
 * @param target - The Object3D to animate.
 * @param property - The animated property path (e.g. 'position.y', 'scale.x').
 * @param keys - Array of keyframes.
 * @param opts - Playback options.
 */
export function playAnimation(target: Object3D, property: string, keys: AnimKey[], opts?: PlayAnimationOptions): void {
  playAnimations(target, [{ property, keys }], opts);
}

/**
 * Plays multiple property animations on a target node simultaneously using GSAP.
 *
 * @param target - The Object3D to animate.
 * @param animations - Array of property animation definitions.
 * @param opts - Playback options.
 */
export function playAnimations(target: Object3D, animations: PropertyAnimation[], opts?: PlayAnimationOptions): void {
  const fps = opts?.fps ?? 60;
  const speed = opts?.speed ?? 1;
  const loop = opts?.loop ?? false;

  if (opts?.stopCurrent !== false) {
    gsap.killTweensOf(target);
    // Also kill tweens on sub-properties
    if (target.position) gsap.killTweensOf(target.position);
    if (target.rotation) gsap.killTweensOf(target.rotation);
    if (target.scale) gsap.killTweensOf(target.scale);
  }

  const tl = gsap.timeline({
    repeat: loop ? -1 : 0,
    timeScale: speed,
    onComplete: !loop ? opts?.onEnd : undefined,
  });

  for (const anim of animations) {
    const timeline = keysToTimeline(anim.keys, fps);
    const resolved = resolvePath(target, anim.property);

    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const curr = timeline[i];
      const duration = curr.time - prev.time;

      if (typeof curr.value === 'number') {
        tl.to(resolved.target, { [resolved.prop]: curr.value, duration, ease: 'none' }, prev.time);
      } else if (curr.value instanceof Vector3) {
        // Animate the sub-object (e.g. mesh.position) not the parent
        const vecTarget = resolved.target[resolved.prop] as Record<string, unknown>;
        tl.to(vecTarget, { x: curr.value.x, y: curr.value.y, z: curr.value.z, duration, ease: 'none' }, prev.time);
      } else if (curr.value instanceof Color) {
        const colTarget = resolved.target[resolved.prop] as Record<string, unknown>;
        tl.to(colTarget, { r: curr.value.r, g: curr.value.g, b: curr.value.b, duration, ease: 'none' }, prev.time);
      }
    }
  }
}

/**
 * Starts a looping idle animation and returns a handle to stop and restart it.
 *
 * @param target - The Object3D to animate.
 * @param property - The animated property path.
 * @param keys - Keyframes for the idle loop.
 * @param opts - Optional name and frame rate overrides.
 * @returns An {@link IdleHandle} to control the loop.
 */
export function startIdleLoop(target: Object3D, property: string, keys: AnimKey[], opts?: { name?: string; fps?: number }): IdleHandle {
  const fps = opts?.fps ?? 60;
  let tl: gsap.core.Timeline | null = null;

  const restart = () => {
    if (tl) tl.kill();

    const timeline = keysToTimeline(keys, fps);
    const resolved = resolvePath(target, property);

    tl = gsap.timeline({ repeat: -1 });

    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const curr = timeline[i];
      const duration = curr.time - prev.time;

      if (typeof curr.value === 'number') {
        tl.to(resolved.target, { [resolved.prop]: curr.value, duration, ease: 'none' }, prev.time);
      } else if (curr.value instanceof Vector3) {
        const vecTarget = resolved.target[resolved.prop] as Record<string, unknown>;
        tl.to(vecTarget, { x: curr.value.x, y: curr.value.y, z: curr.value.z, duration, ease: 'none' }, prev.time);
      } else if (curr.value instanceof Color) {
        const colTarget = resolved.target[resolved.prop] as Record<string, unknown>;
        tl.to(colTarget, { r: curr.value.r, g: curr.value.g, b: curr.value.b, duration, ease: 'none' }, prev.time);
      }
    }
  };

  const stop = () => {
    if (tl) {
      tl.kill();
      tl = null;
    }
  };

  restart();

  return { stop, restart };
}
