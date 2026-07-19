/**
 * Lookahead loop scheduler for procedural music and ambient beds.
 *
 * Music loops must be scheduled against the audio clock (`ctx.currentTime`),
 * not the wall clock: `setInterval` drifts and is throttled in background
 * tabs, which causes audible gaps or overlapping cycles at loop seams.
 *
 * This module implements the standard Web Audio pattern: a frequent, cheap
 * timer tick that schedules any cycle falling inside a short lookahead
 * horizon, accumulating `nextCycleTime += cycleSeconds` on the audio clock so
 * seams are sample-accurate regardless of timer jitter.
 */

/** How far ahead (seconds, audio clock) cycles are scheduled. */
const LOOKAHEAD_HORIZON_S = 0.3;

/** How often (ms, wall clock) the scheduler tick runs. */
const TICK_INTERVAL_MS = 100;

/**
 * Starts a sample-accurate audio loop.
 *
 * @param ctx - The Web Audio context providing the audio clock.
 * @param cycleSeconds - Exact duration of one cycle. Must match the content scheduled by `scheduleCycle`.
 * @param scheduleCycle - Callback that schedules one full cycle of audio events starting at the given audio-clock time.
 * @returns A stop function that halts the loop (already-scheduled events will still play out).
 */
export function startAudioLoop(ctx: AudioContext, cycleSeconds: number, scheduleCycle: (startTime: number) => void): () => void {
  let stopped = false;
  let nextCycleTime = ctx.currentTime + 0.05;

  const tick = () => {
    if (stopped) return;
    while (nextCycleTime < ctx.currentTime + LOOKAHEAD_HORIZON_S) {
      scheduleCycle(nextCycleTime);
      nextCycleTime += cycleSeconds;
    }
  };

  tick();
  const intervalId = setInterval(tick, TICK_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
