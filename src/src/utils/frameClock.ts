/**
 * FrameClock — one per-frame pump per rendering surface.
 *
 * See architecture-standards.md#frameclock. Effects (particles, idle
 * animation) subscribe to a scene's single FrameClock instead of each starting
 * their own `requestAnimationFrame`. The surface's existing render loop
 * (`SceneFrame` / `MiniGameShell`) ticks it once per frame. This removes the
 * self-driven rAF loops that outlived teardown, drifted, and burned battery.
 */

/** The maximum delta-time (seconds) a single tick may advance. */
export const MAX_DELTA_SECONDS = 0.1;

/** A per-frame subscription pump driven by the owning render loop. */
export interface FrameClock {
  /**
   * Subscribes a per-frame callback.
   *
   * @param cb - Invoked each tick with clamped delta and accumulated elapsed time (seconds).
   * @returns An unsubscribe function.
   */
  subscribe(cb: (dtSeconds: number, elapsedSeconds: number) => void): () => void;
  /**
   * Advances the clock by one frame. Called by the owning render loop.
   *
   * The delta is clamped to {@link MAX_DELTA_SECONDS} so a large `rawDt` (after
   * a tab switch or GC pause) cannot teleport particles/physics.
   *
   * @param rawDtSeconds - Unclamped seconds since the previous frame.
   */
  tick(rawDtSeconds: number): void;
  /** Seconds accumulated since creation (sum of clamped deltas). */
  readonly elapsed: number;
}

/**
 * Creates a new frame clock.
 *
 * @returns A fresh {@link FrameClock}.
 */
export function createFrameClock(): FrameClock {
  const subscribers = new Set<(dt: number, elapsed: number) => void>();
  let elapsed = 0;

  return {
    subscribe(cb: (dtSeconds: number, elapsedSeconds: number) => void): () => void {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    tick(rawDtSeconds: number): void {
      const dt = rawDtSeconds < MAX_DELTA_SECONDS ? rawDtSeconds : MAX_DELTA_SECONDS;
      elapsed += dt;
      // Snapshot so a callback that unsubscribes mid-iteration is safe.
      for (const cb of [...subscribers]) {
        try {
          cb(dt, elapsed);
        } catch {
          // One misbehaving subscriber must not stall the frame.
        }
      }
    },
    get elapsed(): number {
      return elapsed;
    },
  };
}
