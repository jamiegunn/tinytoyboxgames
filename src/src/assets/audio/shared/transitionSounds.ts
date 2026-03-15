/**
 * Shared scene-transition sound effects for the Whimsical Toybox World.
 * All sounds are procedurally generated via Web Audio — no audio files.
 */

import { playFreqSweep, playFilteredNoiseBurst, createNoiseBuffer, applyAR } from '@app/assets/audio/utils/synthHelpers';

/** Minimum fade-in time in seconds to avoid clicks (per spec). */
const MIN_ATTACK_S = 0.005;

/**
 * Plays a scene-exit whoosh sweep sound.
 * Duration: 0.5–0.8s. Combines a descending sine sweep with a
 * bandpass-filtered noise layer sweeping downward for a breezy feel.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedTransitionWhoosh(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // Sine sweep layer: 400Hz down to 100Hz
  const sweepAttack = 0.05;
  const sweepRelease = 0.55;
  const sweepGain = 0.2;
  playFreqSweep(ctx, dest, 'sine', 400, 100, sweepAttack, sweepRelease, sweepGain, now);

  // Noise sweep layer: bandpass filter sweeping from high to low
  const noiseDuration = 0.7;
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(ctx, noiseDuration + 0.05);

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.Q.value = 3;
  noiseFilter.frequency.setValueAtTime(2000, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(200, now + noiseDuration);

  const noiseEnv = ctx.createGain();
  applyAR(ctx, noiseEnv, MIN_ATTACK_S, noiseDuration, now, 0.12);

  noiseSource.connect(noiseFilter).connect(noiseEnv).connect(dest);
  noiseSource.start(now);
  noiseSource.stop(now + noiseDuration + 0.05);
}

/**
 * Plays a wonder/arrival sound for entering a new scene.
 * Duration: 0.4–0.6s. Combines an ascending sine sweep with a
 * gentle high-frequency sparkle noise layer.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedTransitionArrive(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // Ascending sine sweep: 300Hz up to 800Hz
  const sweepAttack = 0.05;
  const sweepRelease = 0.45;
  const sweepGain = 0.2;
  playFreqSweep(ctx, dest, 'sine', 300, 800, sweepAttack, sweepRelease, sweepGain, now);

  // Sparkle layer: soft high-frequency filtered noise
  const sparkleDuration = 0.5;
  const sparkleFreq = 4000;
  const sparkleQ = 4;
  const sparkleGain = 0.08;
  playFilteredNoiseBurst(ctx, dest, sparkleFreq, sparkleQ, MIN_ATTACK_S, sparkleDuration, sparkleGain, now);
}
