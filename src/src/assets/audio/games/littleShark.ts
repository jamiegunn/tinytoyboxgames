/**
 * Little Shark minigame sounds, registered under the exact IDs the game
 * requests. Ported from the formerly orphaned `sharkSynth.ts` bank (which was
 * never imported and connected straight to `ctx.destination`, bypassing the
 * mix bus) and expanded to cover every interaction call site:
 *
 * SFX: coral-bonk, seaweed-rustle, treasure-jingle, water-bloop, crab-skitter,
 *      shark-barrel-roll, shark-gulp, golden-catch, shark-happy
 * Music: ocean-ambient (looping underwater pad)
 */

import { playTone, playFreqSweep, playFilteredNoiseBurst, createNoiseBuffer, midiToFreq, pentatonicScale, rand } from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';
import { scheduleMarimbaNote, scheduleBassNote } from '@app/assets/audio/utils/instruments';

/** Minimum fade-in time in seconds to avoid clicks. */
const MIN_ATTACK_S = 0.005;

/** C major pentatonic at C5 for treasure/reward tones. */
const REWARD_PENTA = pentatonicScale(72);

/**
 * Plays a rubbery coral bonk — a quick downward sine boing.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharkCoralBonk(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const start = 420 + rand(-60, 60);
  playFreqSweep(ctx, dest, 'sine', start, start * 0.55, MIN_ATTACK_S, 0.18, 0.16, now);
}

/**
 * Plays a soft seaweed rustle — filtered noise brushing.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharkSeaweedRustle(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  playFilteredNoiseBurst(ctx, dest, 1800 + rand(-300, 300), 1.5, 0.02, 0.2, 0.09, now);
  playFilteredNoiseBurst(ctx, dest, 2400, 2, 0.02, 0.12, 0.05, now + 0.08);
}

/**
 * Plays a treasure jingle — three ascending pentatonic bell tones.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharkTreasureJingle(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const startIdx = Math.floor(rand(0, 2));
  for (let i = 0; i < 3; i++) {
    const midi = REWARD_PENTA[(startIdx + i) % REWARD_PENTA.length] + 12;
    playTone(ctx, dest, 'triangle', midiToFreq(midi), MIN_ATTACK_S, 0.3, 0.14, now + i * 0.07);
  }
}

/**
 * Plays a round water bloop — a rising sine bubble.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharkWaterBloop(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const start = 220 + rand(-30, 30);
  playFreqSweep(ctx, dest, 'sine', start, start * 2.2, MIN_ATTACK_S, 0.14, 0.14, now);
}

/**
 * Plays a crab skitter — a rapid series of tiny filtered noise ticks.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharkCrabSkitter(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  for (let i = 0; i < 5; i++) {
    playFilteredNoiseBurst(ctx, dest, 3000 + rand(-400, 400), 4, MIN_ATTACK_S, 0.03, 0.06, now + i * 0.05);
  }
}

/**
 * Plays a playful barrel-roll whoosh — a sine sweep up and back down.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharkBarrelRoll(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  playFreqSweep(ctx, dest, 'sine', 300, 700, 0.02, 0.18, 0.1, now);
  playFreqSweep(ctx, dest, 'sine', 700, 320, 0.02, 0.18, 0.1, now + 0.18);
  playFilteredNoiseBurst(ctx, dest, 800, 1, 0.03, 0.3, 0.06, now);
}

/**
 * Plays a satisfying shark gulp — noise bite plus low thump (the ported chomp).
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharkGulp(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, 0.12);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 300;
  bp.Q.value = 2;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.2, now + MIN_ATTACK_S);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  source.connect(bp).connect(env).connect(dest);
  source.start(now);
  source.stop(now + 0.12);

  playTone(ctx, dest, 'sine', 85, 0.01, 0.12, 0.2, now + 0.03);
  // Tiny swallow bloop after the bite
  playFreqSweep(ctx, dest, 'sine', 260, 150, MIN_ATTACK_S, 0.1, 0.08, now + 0.12);
}

/**
 * Plays a golden-catch chime — harmonically related bells with long decay
 * (the ported golden chime).
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharkGoldenCatch(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const freqs = [880, 1320, 1760];
  const detunes = [-3, 0, 3];
  for (let i = 0; i < freqs.length; i++) {
    playTone(ctx, dest, 'sine', freqs[i], 0.01, 0.8, 0.16, now, detunes[i]);
  }
}

/**
 * Plays a happy shark reaction — two quick rising chirps.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharkHappy(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  playFreqSweep(ctx, dest, 'sine', 500, 850, MIN_ATTACK_S, 0.1, 0.12, now);
  playFreqSweep(ctx, dest, 'sine', 620, 1050, MIN_ATTACK_S, 0.12, 0.12, now + 0.14);
}

/** Underwater pad cycle length in seconds. */
const OCEAN_CYCLE_S = 6;

/**
 * Lazy marimba motif floated over the underwater pad on alternate cycles —
 * C-pentatonic, mid register, like light glinting through the water.
 * Times are [midi, cycleOffsetSeconds] pairs.
 */
const OCEAN_MOTIF: Array<[number, number]> = [
  [60, 0.6], // C4
  [64, 1.5], // E4
  [67, 2.4], // G4
  [69, 3.4], // A4
  [67, 4.4], // G4
  [64, 5.2], // E4
];

/** Answering phrase used every fourth cycle for variation. */
const OCEAN_MOTIF_ANSWER: Array<[number, number]> = [
  [69, 0.6], // A4
  [67, 1.6], // G4
  [64, 2.6], // E4
  [62, 3.6], // D4
  [60, 4.6], // C4 — home
];

/**
 * Plays the looping underwater music bed for Little Shark: two slow
 * LFO-modulated low sines plus low-passed water-texture noise, a soft bass
 * root, and a lazy pentatonic marimba motif drifting in and out on alternate
 * cycles. Scheduled sample-accurately with overlapping cycles for a seamless
 * bed.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A cleanup function that stops the loop
 */
export function playMusLittleSharkBackground(ctx: AudioContext, dest: AudioNode): () => void {
  let cycleIndex = 0;

  const scheduleCycle = (startTime: number) => {
    // Melodic layer: motif on even cycles, answering phrase every fourth,
    // silence on odd cycles so the ocean stays calm.
    if (cycleIndex % 2 === 0) {
      const phrase = cycleIndex % 4 === 2 ? OCEAN_MOTIF_ANSWER : OCEAN_MOTIF;
      for (const [midi, offset] of phrase) {
        scheduleMarimbaNote(ctx, dest, midiToFreq(midi), startTime + offset, 0.06);
      }
      scheduleBassNote(ctx, dest, 36, startTime, OCEAN_CYCLE_S, 0.04);
    }
    cycleIndex++;
    const dur = OCEAN_CYCLE_S + 1.5; // overlap so crossing cycles blend

    for (const freq of [60, 90]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.4;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.3 + rand(0, 0.4);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.25;
      lfo.connect(lfoGain).connect(oscGain.gain);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(0.5, startTime + 1.5);
      env.gain.setValueAtTime(0.5, startTime + dur - 1.5);
      env.gain.linearRampToValueAtTime(0, startTime + dur);

      osc.connect(oscGain).connect(env).connect(dest);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.05);
      lfo.start(startTime);
      lfo.stop(startTime + dur + 0.05);
    }

    // Water texture layer
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, dur + 0.1);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0, startTime);
    noiseEnv.gain.linearRampToValueAtTime(0.16, startTime + 1.5);
    noiseEnv.gain.setValueAtTime(0.16, startTime + dur - 1.5);
    noiseEnv.gain.linearRampToValueAtTime(0, startTime + dur);
    noise.connect(lp).connect(noiseEnv).connect(dest);
    noise.start(startTime);
    noise.stop(startTime + dur + 0.05);
  };

  return startAudioLoop(ctx, OCEAN_CYCLE_S, scheduleCycle);
}

/**
 * Back-compat alias for the `ocean-ambient` registry id.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A cleanup function that stops the loop
 */
export function playMusOceanAmbient(ctx: AudioContext, dest: AudioNode): () => void {
  return playMusLittleSharkBackground(ctx, dest);
}
