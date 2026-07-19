/**
 * Shared reward and celebration sound effects for the Whimsical Toybox World.
 * All sounds are procedurally generated via Web Audio — no audio files.
 */

import { playTone, rand, midiToFreq, pentatonicScale } from '@app/assets/audio/utils/synthHelpers';

/** Minimum fade-in time in seconds to avoid clicks (per spec). */
const MIN_ATTACK_S = 0.005;

/** Stagger interval in seconds between sparkle tones. */
const SPARKLE_STAGGER_S = 0.05;

/** Number of sparkle tones in a burst. */
const SPARKLE_TONE_COUNT = 4;

/**
 * Sparkle note pool: C major pentatonic across C6-C7. Quantizing the burst to
 * a scale keeps the game's most-played reward sound consonant with every
 * scene's music instead of producing a random inharmonic cluster.
 */
const SPARKLE_FREQS: number[] = [...pentatonicScale(84), 96].map((midi) => midiToFreq(midi));

/**
 * Plays a delightful sparkle burst for triumph/delight moments.
 * Duration: 0.4–0.6s. Layers quick high sine tones with staggered start
 * times for a cascading sparkle effect. Notes are drawn from a pentatonic
 * pool and always cascade upward, so every burst is musical.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedSparkleBurst(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const attack = MIN_ATTACK_S;
  const release = 0.15;
  const gain = 0.12;

  // Ascending run: random starting degree, then upward through the pool.
  const startIndex = Math.floor(rand(0, SPARKLE_FREQS.length - SPARKLE_TONE_COUNT + 1));
  for (let i = 0; i < SPARKLE_TONE_COUNT; i++) {
    const freq = SPARKLE_FREQS[Math.min(startIndex + i, SPARKLE_FREQS.length - 1)];
    const startOffset = i * SPARKLE_STAGGER_S;
    playTone(ctx, dest, 'sine', freq, attack, release, gain, now + startOffset);
  }
}

/**
 * Plays a bright magical chime for star/reward collection.
 * Duration: 0.3–0.5s. Triangle wave fundamental with soft upper harmonics
 * for a bell-like quality. Includes 2 variations through frequency randomization.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedStarChime(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  // Root drawn from C major triad tones (C6/E6/G6) so chimes always harmonize.
  const triadMidi = [84, 88, 91];
  const baseFreq = midiToFreq(triadMidi[Math.floor(rand(0, triadMidi.length))]);
  const attack = MIN_ATTACK_S;
  const release = 0.35;

  // Fundamental tone
  const fundamentalGain = 0.2;
  playTone(ctx, dest, 'triangle', baseFreq, attack, release, fundamentalGain, now);

  // Second harmonic (2x frequency), softer
  const secondHarmonicGain = 0.08;
  playTone(ctx, dest, 'triangle', baseFreq * 2, attack, release * 0.8, secondHarmonicGain, now);

  // Third harmonic (3x frequency), very soft
  const thirdHarmonicGain = 0.04;
  playTone(ctx, dest, 'triangle', baseFreq * 3, attack, release * 0.6, thirdHarmonicGain, now);
}
