/**
 * IdleAnimator — scoped "gently alive" motion for decor, critters, and props.
 *
 * See architecture-standards.md#idleanimator. Roughly a dozen decor files start
 * raw `gsap` `repeat: -1` tweens and never kill them; because the hub renderer
 * persists across scene switches, those immortal tweens accumulate, animating
 * detached objects forever. This is a thin registry over GSAP bound to a
 * {@link DisposalScope}: every looping tween it starts is registered for
 * `kill()` on `scope.dispose()`, so the leak class becomes structurally
 * impossible, and the common idles get a named vocabulary instead of bespoke
 * gsap at each site.
 *
 * The five presets are sinusoidal idles realised with gsap `yoyo` + `sine.inOut`
 * (a true sinusoid): `value(t) = base + amplitude·sin(2π·t/period + phase)`, with
 * `phase` randomised per instance so a shelf of toys never pulses in lockstep.
 * `spin` is the one linear preset (continuous rotation). For multi-keyframe idle
 * loops (a hopping chick, a breathing owl), `loop()` builds a registered
 * `repeat: -1` timeline, and `register()` adopts any existing killable tween —
 * both get the same scoped teardown.
 */

import gsap from 'gsap';
import type { Object3D, MeshStandardMaterial } from 'three';
import type { DisposalScope } from '@app/utils/disposal';
import { randomRange } from '@app/utils/math';

/** Axis of a transform channel. */
export type Axis = 'x' | 'y' | 'z';

/** Common options shared by the sinusoidal presets. */
interface SinusoidOpts {
  /** Oscillation period in seconds (one full there-and-back cycle). */
  period: number;
  /**
   * Phase as a fraction of the period `[0, 1)`. Defaults to a random phase so
   * sibling props do not pulse in lockstep. Realised as a gsap start delay.
   */
  phase?: number;
}

/** Options for {@link IdleAnimator.breathe}. */
export interface BreatheOpts extends SinusoidOpts {
  /** Peak scale change as a fraction of the base scale (e.g. 0.05 = ±5%). */
  amplitude: number;
  /** Which scale axes to pulse. Defaults to all three (uniform breathing). */
  axes?: Axis[];
}

/** Options for {@link IdleAnimator.sway} (rotation) and {@link IdleAnimator.bob} (position.y). */
export interface SwingOpts extends SinusoidOpts {
  /** Peak offset added to the base value (radians for sway, world units for bob). */
  amplitude: number;
  /** Channel axis: rotation axis for `sway` (default `'z'`), position axis for `bob` (default `'y'`). */
  axis?: Axis;
}

/** Options for {@link IdleAnimator.spin}. */
export interface SpinOpts {
  /** Seconds for one full revolution. */
  period: number;
  /** Rotation axis. Defaults to `'y'`. */
  axis?: Axis;
  /** `1` for positive rotation, `-1` for reverse. Defaults to `1`. */
  direction?: 1 | -1;
  /**
   * Starting rotation offset as a fraction of a revolution `[0, 1)`. Defaults to
   * a random phase so sibling spinners don't rotate in lockstep.
   */
  phase?: number;
}

/** Options for {@link IdleAnimator.flicker}. */
export interface FlickerOpts extends SinusoidOpts {
  /** Peak emissive-intensity change added to the base intensity. */
  amplitude: number;
}

/** A handle to stop a single idle animation early (it is also stopped on scope disposal). */
export interface IdleHandle {
  /** Kills this idle's tween(s) now. Idempotent. */
  stop(): void;
}

/** Scoped factory for looping idle animations. */
export interface IdleAnimator {
  /** Uniform (or per-axis) scale pulse — a breathing/pulsing idle. */
  breathe(target: Object3D, opts: BreatheOpts): IdleHandle;
  /** Rotation.z rocking, e.g. a swaying plant or hanging toy. */
  sway(target: Object3D, opts: SwingOpts): IdleHandle;
  /** Position.y bobbing, e.g. a floating balloon or duck. */
  bob(target: Object3D, opts: SwingOpts): IdleHandle;
  /** Continuous rotation about an axis, e.g. a spinning top or mobile. */
  spin(target: Object3D, opts: SpinOpts): IdleHandle;
  /** Emissive-intensity oscillation, e.g. a flickering fire or glowing gem. */
  flicker(material: MeshStandardMaterial, opts: FlickerOpts): IdleHandle;
  /**
   * Builds a registered `repeat: -1` timeline for a multi-keyframe idle loop.
   * The builder receives the fresh timeline to add keyframes to.
   */
  loop(build: (tl: gsap.core.Timeline) => void): IdleHandle;
  /** Adopts an existing gsap tween/timeline so it is killed on scope disposal. */
  register<T extends { kill: () => void }>(tween: T): T;
}

/**
 * Resolves the phase as a fraction of the cycle `[0, 1)` (random if unset).
 *
 * @param phase - Optional explicit phase fraction.
 * @returns The phase fraction.
 */
function phaseFraction(phase?: number): number {
  return phase ?? randomRange(0, 1);
}

/**
 * Creates an idle animator whose every looping tween is killed on scope disposal.
 *
 * @param scope - The disposal scope that owns teardown (a scene/game lifecycle).
 * @returns An {@link IdleAnimator}.
 */
export function createIdleAnimator(scope: DisposalScope): IdleAnimator {
  /**
   * Registers a killable on the scope and returns an {@link IdleHandle}.
   *
   * @param tween - The gsap tween or timeline to own.
   * @returns A handle that can stop it early.
   */
  const handleFor = (tween: { kill: () => void }): IdleHandle => {
    scope.tween(tween);
    let stopped = false;
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        tween.kill();
      },
    };
  };

  /**
   * Seeds a sinusoidal tween's phase by seeking it partway through its cycle
   * (so siblings desync without a frozen startup delay), then registers it.
   *
   * @param tween - The freshly created looping tween.
   * @param cycleSeconds - The full there-and-back cycle length in seconds.
   * @param phase - Optional explicit phase fraction `[0, 1)`.
   * @returns A stop handle.
   */
  const seeded = (tween: gsap.core.Tween, cycleSeconds: number, phase?: number): IdleHandle => {
    tween.seek(phaseFraction(phase) * cycleSeconds);
    return handleFor(tween);
  };

  return {
    breathe(target, opts): IdleHandle {
      const axes = opts.axes ?? (['x', 'y', 'z'] as Axis[]);
      const vars: gsap.TweenVars = { duration: opts.period / 2, ease: 'sine.inOut', yoyo: true, repeat: -1 };
      for (const axis of axes) vars[axis] = target.scale[axis] * (1 + opts.amplitude);
      return seeded(gsap.to(target.scale, vars), opts.period, opts.phase);
    },
    sway(target, opts): IdleHandle {
      const axis = opts.axis ?? 'z';
      return seeded(
        gsap.to(target.rotation, {
          [axis]: target.rotation[axis] + opts.amplitude,
          duration: opts.period / 2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        }),
        opts.period,
        opts.phase,
      );
    },
    bob(target, opts): IdleHandle {
      const axis = opts.axis ?? 'y';
      return seeded(
        gsap.to(target.position, {
          [axis]: target.position[axis] + opts.amplitude,
          duration: opts.period / 2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        }),
        opts.period,
        opts.phase,
      );
    },
    spin(target, opts): IdleHandle {
      const axis = opts.axis ?? 'y';
      const direction = opts.direction ?? 1;
      return seeded(
        gsap.to(target.rotation, {
          [axis]: target.rotation[axis] + direction * Math.PI * 2,
          duration: opts.period,
          ease: 'none',
          repeat: -1,
        }),
        opts.period,
        opts.phase,
      );
    },
    flicker(material, opts): IdleHandle {
      return seeded(
        gsap.to(material, {
          emissiveIntensity: material.emissiveIntensity + opts.amplitude,
          duration: opts.period / 2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        }),
        opts.period,
        opts.phase,
      );
    },
    loop(build): IdleHandle {
      const tl = gsap.timeline({ repeat: -1 });
      build(tl);
      return handleFor(tl);
    },
    register<T extends { kill: () => void }>(tween: T): T {
      scope.tween(tween);
      return tween;
    },
  };
}
