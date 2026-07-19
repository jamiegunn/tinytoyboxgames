/**
 * Shared celebration sound effects consumed by the minigame framework's
 * CelebrationSystem (`sfx_shared_pop/chime/fanfare/whoosh/chomp/splash`).
 * All sounds are procedurally generated via Web Audio — no audio files.
 *
 * These IDs were previously requested by every minigame but absent from the
 * registry, so every celebration played silently. Chomp/splash/fanfare are
 * ported from the (formerly orphaned) little-shark synth bank, rerouted
 * through the shared SFX bus instead of connecting directly to the
 * destination.
 */

import { playTone, playFreqSweep, playFilteredNoiseBurst, createNoiseBuffer, midiToFreq, rand } from '@app/assets/audio/utils/synthHelpers';

/** Minimum fade-in time in seconds to avoid clicks. */
const MIN_ATTACK_S = 0.005;

/**
 * Plays a soft, rounded toy "pop" — a quick downward sine chirp with a tiny
 * noise transient.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedPop(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const startFreq = 900 + rand(-120, 120);
  playFreqSweep(ctx, dest, 'sine', startFreq, startFreq * 0.45, MIN_ATTACK_S, 0.12, 0.16, now);
  playFilteredNoiseBurst(ctx, dest, 2200, 2, MIN_ATTACK_S, 0.05, 0.05, now);
}

/**
 * Plays a bright celebration chime — a bell-voiced C major triad tone with
 * soft harmonics.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedChime(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const triadMidi = [84, 88, 91];
  const base = midiToFreq(triadMidi[Math.floor(rand(0, triadMidi.length))]);
  playTone(ctx, dest, 'triangle', base, MIN_ATTACK_S, 0.4, 0.18, now);
  playTone(ctx, dest, 'sine', base * 2, MIN_ATTACK_S, 0.3, 0.06, now);
  playTone(ctx, dest, 'sine', base * 3, MIN_ATTACK_S, 0.2, 0.03, now);
}

/**
 * Plays a celebratory ascending arpeggio (C5-E5-G5-C6) with a gentle
 * lowpass-rounded timbre.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedFanfare(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 2000;
  lowpass.connect(dest);

  const notes = [523, 659, 784, 1047];
  const noteLength = 0.14;
  for (let i = 0; i < notes.length; i++) {
    const noteStart = now + i * (noteLength - 0.02);
    playTone(ctx, lowpass, 'triangle', notes[i], 0.01, noteLength + 0.1, 0.18, noteStart);
    playTone(ctx, lowpass, 'sine', notes[i] * 2, 0.01, noteLength * 0.6, 0.05, noteStart);
  }
}

/**
 * Plays a soft whoosh — band-pass filtered noise with a rising-falling sweep.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedWhoosh(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const dur = 0.4;
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, dur + 0.1);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(250, now);
  bp.frequency.exponentialRampToValueAtTime(1100, now + dur * 0.5);
  bp.frequency.exponentialRampToValueAtTime(250, now + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.14, now + 0.05);
  env.gain.setValueAtTime(0.14, now + dur * 0.7);
  env.gain.linearRampToValueAtTime(0, now + dur);

  source.connect(bp).connect(env).connect(dest);
  source.start(now);
  source.stop(now + dur + 0.1);
}

/**
 * Plays a satisfying cartoon chomp — a band-passed noise bite plus a low
 * sine thump.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedChomp(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // Noise bite
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, 0.12);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 300;
  bp.Q.value = 2;
  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, now);
  noiseEnv.gain.linearRampToValueAtTime(0.22, now + MIN_ATTACK_S);
  noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  source.connect(bp).connect(noiseEnv).connect(dest);
  source.start(now);
  source.stop(now + 0.12);

  // Low thump
  playTone(ctx, dest, 'sine', 80, 0.01, 0.11, 0.22, now + 0.03);
}

/**
 * Plays a light water splash — high-passed noise sweeping downward.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedSplash(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const dur = 0.15;
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, dur + 0.05);

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(3000, now);
  hp.frequency.exponentialRampToValueAtTime(1000, now + 0.1);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.14, now + MIN_ATTACK_S);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  source.connect(hp).connect(env).connect(dest);
  source.start(now);
  source.stop(now + dur + 0.05);
}
