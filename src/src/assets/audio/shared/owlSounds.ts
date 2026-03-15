/**
 * Owl companion sound effects for the Whimsical Toybox World.
 * All sounds are procedurally generated via Web Audio — no audio files.
 */

import { playTone, playFreqSweep, rand } from '@app/assets/audio/utils/synthHelpers';

/** Minimum fade-in time in seconds to avoid clicks (per spec). */
const MIN_ATTACK_S = 0.005;

/** Vibrato rate in Hz for the owl hoot. */
const VIBRATO_RATE_HZ = 5;

/** Vibrato depth in cents for the owl hoot. */
const VIBRATO_DEPTH_CENTS = 15;

/**
 * Plays a warm, friendly owl hoot sound.
 * Duration: 0.5–1.0s. Two overlapping sine tones with slow attack,
 * medium release, and gentle vibrato via detune modulation.
 * Includes 4 variations through frequency randomization (±20Hz).
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedOwlHoot(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const freqOffset1 = rand(-20, 20);
  const freqOffset2 = rand(-20, 20);
  const baseFreqLow = 250 + freqOffset1;
  const baseFreqHigh = 300 + freqOffset2;
  const attack = 0.08;
  const release = 0.5;
  const gain = 0.18;
  const duration = attack + release;

  // Low tone with vibrato
  const oscLow = playTone(ctx, dest, 'sine', baseFreqLow, attack, release, gain, now);
  addVibrato(ctx, oscLow, now, duration);

  // High tone with vibrato, slightly softer
  const oscHigh = playTone(ctx, dest, 'sine', baseFreqHigh, attack, release, gain * 0.7, now);
  addVibrato(ctx, oscHigh, now, duration);
}

/**
 * Adds vibrato (detune modulation) to an oscillator node.
 *
 * @param ctx - The Web Audio context
 * @param osc - The oscillator to modulate
 * @param startTime - When to start the vibrato
 * @param duration - How long the vibrato lasts
 */
function addVibrato(ctx: AudioContext, osc: OscillatorNode, startTime: number, duration: number): void {
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = VIBRATO_RATE_HZ;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = VIBRATO_DEPTH_CENTS;

  lfo.connect(lfoGain).connect(osc.detune);
  lfo.start(startTime);
  lfo.stop(startTime + duration + 0.02);
}

/**
 * Plays a delighted/surprised chirp for the owl companion.
 * Duration: 0.3–0.5s. Two quick ascending sine tones played in sequence.
 * Includes 3 variations through frequency randomization.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedOwlHappyChirp(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const variation = rand(-30, 30);
  const firstFreq = 500 + variation;
  const secondFreq = 700 + variation;
  const noteAttack = MIN_ATTACK_S;
  const noteRelease = 0.095;
  const gain = 0.2;

  // First note
  playTone(ctx, dest, 'sine', firstFreq, noteAttack, noteRelease, gain, now);

  // Second note, 100ms later
  const secondNoteDelay = 0.1;
  playTone(ctx, dest, 'sine', secondFreq, noteAttack, noteRelease, gain, now + secondNoteDelay);
}

/**
 * Plays a gentle curiosity prompt sound for the owl companion (P1).
 * Duration: ~0.3s. Single soft sine tone with quick decay.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedOwlPoint(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const freq = 600;
  const attack = MIN_ATTACK_S;
  const release = 0.25;
  const gain = 0.15;

  playTone(ctx, dest, 'sine', freq, attack, release, gain, now);
}

/**
 * Plays a cozy, drowsy sound for the owl companion (P2).
 * Duration: 0.8–1.2s. Slow descending sine sweep from 400Hz to 200Hz.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedOwlSleepy(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const startFreq = 400;
  const endFreq = 200;
  const attack = 0.1;
  const release = 0.8;
  const gain = 0.12;

  playFreqSweep(ctx, dest, 'sine', startFreq, endFreq, attack, release, gain, now);
}
