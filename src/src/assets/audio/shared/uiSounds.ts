/**
 * Shared UI sound effects for the Whimsical Toybox World.
 * All sounds are procedurally generated via Web Audio — no audio files.
 */

import { playTone, playFilteredNoiseBurst, rand } from '@app/assets/audio/utils/synthHelpers';

/** Minimum fade-in time in seconds to avoid clicks (per spec). */
const MIN_ATTACK_S = 0.005;

/**
 * Plays a gentle acknowledgement chirp for tap-fallback feedback.
 * Duration: 0.1–0.2s. Includes 3 variations via frequency randomization.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedTapFallback(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const baseFreq = 800;
  const freqVariation = rand(-50, 50);
  const freq = baseFreq + freqVariation;
  const attack = MIN_ATTACK_S;
  const release = 0.1;
  const gain = 0.15;

  playTone(ctx, dest, 'sine', freq, attack, release, gain, now);
}

/**
 * Plays a soft friendly click sound for button presses.
 * Duration: ~0.1s. Includes 2 variations via frequency randomization.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedButtonPress(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const baseFreq = 2000;
  const freqVariation = rand(-200, 200);
  const freq = baseFreq + freqVariation;
  const attack = MIN_ATTACK_S;
  const release = 0.08;
  const gain = 0.15;
  const q = 5;

  playFilteredNoiseBurst(ctx, dest, freq, q, attack, release, gain, now);
}
