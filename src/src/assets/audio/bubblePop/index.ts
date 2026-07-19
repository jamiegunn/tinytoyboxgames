/**
 * Bubble Pop mini-game procedural audio modules.
 * All sounds are generated via Web Audio synthesis — no audio files.
 * Themed around gentle bubbles, night sky ambience, and dreamy lullaby tones.
 */

import { playTone, playFilteredNoiseBurst, playFreqSweep, rand, midiToFreq } from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';
import { scheduleMusicBoxNote, schedulePadChord, scheduleBassNote } from '@app/assets/audio/utils/instruments';

/** Minimum fade-in time in seconds to avoid clicks. */
const MIN_ATTACK_S = 0.005;

/** Pitch configurations for bubble pop size variants. */
const POP_VARIANTS = [
  { freq: 1800, q: 2.5, gain: 0.12 }, // 0 = small: high/bright
  { freq: 1100, q: 2.0, gain: 0.15 }, // 1 = medium: mid
  { freq: 600, q: 1.5, gain: 0.18 }, // 2 = large: low/deep
] as const;

/**
 * Internal pop sound implementation. Filtered noise burst with gentle pitch envelope.
 * Short, round, and satisfying.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @param sizeVariant - 0 = small (high/bright), 1 = medium (mid), 2 = large (low/deep)
 */
function playSfxBubblePopPop(ctx: AudioContext, dest: AudioNode, sizeVariant: number): void {
  const variant = POP_VARIANTS[sizeVariant] ?? POP_VARIANTS[1];
  const now = ctx.currentTime;
  const freqJitter = rand(-40, 40);

  // Primary filtered noise burst for the pop body
  playFilteredNoiseBurst(ctx, dest, variant.freq + freqJitter, variant.q, MIN_ATTACK_S, 0.08, variant.gain, now);

  // Gentle sine pitch envelope for roundness: quick sweep down
  const sweepStart = variant.freq * 1.3;
  const sweepEnd = variant.freq * 0.6;
  playFreqSweep(ctx, dest, 'sine', sweepStart, sweepEnd, MIN_ATTACK_S, 0.06, variant.gain * 0.5, now);
}

/**
 * Plays a small bubble pop sound — high-pitched and bright.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxBubblePopPopSmall(ctx: AudioContext, dest: AudioNode): void {
  playSfxBubblePopPop(ctx, dest, 0);
}

/**
 * Plays a medium bubble pop sound — balanced mid-range tone.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxBubblePopPopMedium(ctx: AudioContext, dest: AudioNode): void {
  playSfxBubblePopPop(ctx, dest, 1);
}

/**
 * Plays a large bubble pop sound — low and deep.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxBubblePopPopLarge(ctx: AudioContext, dest: AudioNode): void {
  playSfxBubblePopPop(ctx, dest, 2);
}

/**
 * Plays a soft "blup" sound when a bubble spawns.
 * Sine wave with quick pitch drop from ~600Hz to ~200Hz over 0.1s. Very soft.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxBubblePopAppear(ctx: AudioContext, dest: AudioNode): void {
  playFreqSweep(ctx, dest, 'sine', 600 + rand(-30, 30), 200 + rand(-20, 20), MIN_ATTACK_S, 0.1, 0.08);
}

/**
 * Plays a chain-reaction pop sound — higher pitched and brighter than the normal pop,
 * with a tiny sparkle harmonic layered on top.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxBubblePopChainPop(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // Brighter, higher-pitched noise pop
  playFilteredNoiseBurst(ctx, dest, 2200 + rand(-100, 100), 3.0, MIN_ATTACK_S, 0.06, 0.14, now);

  // Quick pitch-down sweep for body
  playFreqSweep(ctx, dest, 'sine', 2800, 1400, MIN_ATTACK_S, 0.05, 0.08, now);

  // Tiny sparkle harmonic on top
  playTone(ctx, dest, 'sine', 4000 + rand(-200, 200), MIN_ATTACK_S, 0.08, 0.05, now + 0.01);
  playTone(ctx, dest, 'sine', 5200 + rand(-300, 300), MIN_ATTACK_S, 0.06, 0.03, now + 0.025);
}

/**
 * Plays a gentle sparkle for first-tap fallback when tapping empty space.
 * Very soft, high-frequency sine, short duration.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxBubblePopTwinkle(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const freq = 3000 + rand(-200, 200);
  playTone(ctx, dest, 'sine', freq, MIN_ATTACK_S, 0.1, 0.06, now);
  playTone(ctx, dest, 'sine', freq * 1.5, MIN_ATTACK_S, 0.08, 0.03, now + 0.03);
}

/**
 * Plays a soft ambient night-sky bed for the Bubble Pop mini-game.
 * Low sine drone (~80Hz) with gentle high-frequency shimmer (slow LFO-modulated sine).
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A stop function that halts playback and cleans up resources
 */
export function playAmbBubblePopNightSky(ctx: AudioContext, dest: AudioNode): () => void {
  // Low drone oscillator (~80Hz)
  const drone = ctx.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 80;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.06;

  drone.connect(droneGain).connect(dest);

  // High-frequency shimmer oscillator (~3500Hz)
  const shimmer = ctx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.value = 3500;
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0.015;

  // Slow LFO to modulate shimmer gain for gentle pulsing
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.3; // ~3.3s period
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.01;

  lfo.connect(lfoDepth).connect(shimmerGain.gain);
  shimmer.connect(shimmerGain).connect(dest);

  drone.start();
  shimmer.start();
  lfo.start();

  return () => {
    try {
      drone.stop();
      shimmer.stop();
      lfo.stop();
    } catch {
      // Already stopped
    }
    drone.disconnect();
    droneGain.disconnect();
    shimmer.disconnect();
    shimmerGain.disconnect();
    lfo.disconnect();
    lfoDepth.disconnect();
  };
}

/** Duration of one lullaby bar in seconds — slow and dreamy. */
const LULLABY_BAR_S = 4;

/** One lullaby bar: chord voicing, bass root, and sparse melody events. */
interface LullabyBar {
  /** Pad chord voicing (MIDI). */
  chord: number[];
  /** Bass root (MIDI, bass register). */
  bassMidi: number;
  /** Melody notes as [midi, barOffsetSeconds, durationSeconds]. */
  melody: Array<[number, number, number]>;
}

// A 4-bar night lullaby: Cmaj7-family colors drifting Am7 -> Fmaj7 -> G and
// resolving home, with a sparse music-box melody floating above like bubbles.
const LULLABY_BARS: LullabyBar[] = [
  {
    chord: [60, 64, 67, 71], // Cmaj7
    bassMidi: 48,
    melody: [
      [79, 0.4, 1.8], // G5
      [76, 2.6, 1.2], // E5
    ],
  },
  {
    chord: [57, 60, 64, 67], // Am7
    bassMidi: 45,
    melody: [
      [81, 0.8, 1.8], // A5
      [84, 3.0, 0.9], // C6
    ],
  },
  {
    chord: [53, 57, 60, 64], // Fmaj7
    bassMidi: 41,
    melody: [
      [81, 0.5, 1.4], // A5
      [77, 2.4, 1.4], // F5
    ],
  },
  {
    chord: [55, 59, 62], // G
    bassMidi: 43,
    melody: [
      [74, 0.8, 1.4], // D5
      [72, 2.6, 1.3], // C5 — resolution home
    ],
  },
];

/** Total lullaby cycle length in seconds. */
const LULLABY_CYCLE_S = LULLABY_BARS.length * LULLABY_BAR_S;

/**
 * Plays the dreamy night lullaby for the Bubble Pop mini-game: a slow
 * seventh-chord pad through a dark lowpass, a deep bass root, and a sparse
 * music-box melody drifting above. The melody rests every other cycle so the
 * night sky stays spacious. Scheduled sample-accurately via the shared
 * lookahead loop scheduler.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A stop function that halts playback and cleans up resources
 */
export function playMusBubblePopBackground(ctx: AudioContext, dest: AudioNode): () => void {
  let cycleIndex = 0;
  return startAudioLoop(ctx, LULLABY_CYCLE_S, (startTime) => {
    const withMelody = cycleIndex % 2 === 0;
    let barStart = startTime;

    for (const bar of LULLABY_BARS) {
      schedulePadChord(ctx, dest, bar.chord, barStart, LULLABY_BAR_S, { gain: 0.035, lowpassHz: 700, detuneCents: 5 });
      scheduleBassNote(ctx, dest, bar.bassMidi, barStart, LULLABY_BAR_S, 0.055);

      if (withMelody) {
        for (const [midi, offset, dur] of bar.melody) {
          scheduleMusicBoxNote(ctx, dest, midiToFreq(midi), barStart + offset, dur, 0.08);
        }
      }

      barStart += LULLABY_BAR_S;
    }

    cycleIndex++;
  });
}
