/**
 * Cannonball Splash minigame sounds. The game fires `sfx_cannonball_fire` on
 * every shot; it was previously unregistered, so the flagship interaction was
 * silent. This is a friendly toy cannon: a soft low thump with a "poomp"
 * sweep — no harsh transients for small ears.
 */

import { playTone, playFreqSweep, playFilteredNoiseBurst, rand, midiToFreq } from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';
import { scheduleConcertinaNote, scheduleBassNote } from '@app/assets/audio/utils/instruments';

/** Minimum fade-in time in seconds to avoid clicks. */
const MIN_ATTACK_S = 0.005;

/**
 * Plays a soft toy-cannon fire: low sine thump, downward "poomp" sweep, and a
 * gentle air-puff of filtered noise.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxCannonballFire(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // Low body thump
  playTone(ctx, dest, 'sine', 90 + rand(-10, 10), 0.01, 0.16, 0.2, now);

  // "Poomp" sweep
  playFreqSweep(ctx, dest, 'sine', 380 + rand(-40, 40), 140, MIN_ATTACK_S, 0.18, 0.12, now);

  // Air puff
  playFilteredNoiseBurst(ctx, dest, 600, 1, MIN_ATTACK_S, 0.12, 0.07, now);
}

// ── Background music: "Deck Dance" ─────────────────────────────────────────

/** Duration of one eighth note in seconds — brisker than the cove tune. */
const EIGHTH_S = 0.2;

/** Eighths per bar in 6/8. */
const EIGHTHS_PER_BAR = 6;

/** Melody gain. */
const MELODY_GAIN = 0.1;

/** Accompaniment gain. */
const ACCOMP_GAIN = 0.055;

/** One bar of melody: MIDI notes with durations in eighths, over a chord. */
interface Bar {
  notes: Array<{ midi: number; eighths: number }>;
  chord: number[];
}

// An 8-bar jig, brighter and bouncier than the cove's tune but in the same
// concertina voice and C-major family: two skipping phrases, a lift through
// F, and a leading-tone cadence home.
const TUNE: Bar[] = [
  {
    notes: [
      { midi: 72, eighths: 2 },
      { midi: 76, eighths: 1 },
      { midi: 79, eighths: 2 },
      { midi: 76, eighths: 1 },
    ],
    chord: [60, 64, 67], // C
  },
  {
    notes: [
      { midi: 74, eighths: 2 },
      { midi: 76, eighths: 1 },
      { midi: 74, eighths: 2 },
      { midi: 71, eighths: 1 },
    ],
    chord: [55, 59, 62], // G
  },
  {
    notes: [
      { midi: 72, eighths: 2 },
      { midi: 76, eighths: 1 },
      { midi: 79, eighths: 2 },
      { midi: 81, eighths: 1 },
    ],
    chord: [60, 64, 67], // C
  },
  { notes: [{ midi: 79, eighths: 6 }], chord: [60, 64, 67] }, // C — held high G
  {
    notes: [
      { midi: 81, eighths: 2 },
      { midi: 81, eighths: 1 },
      { midi: 79, eighths: 2 },
      { midi: 76, eighths: 1 },
    ],
    chord: [53, 57, 60], // F
  },
  {
    notes: [
      { midi: 79, eighths: 2 },
      { midi: 79, eighths: 1 },
      { midi: 76, eighths: 2 },
      { midi: 72, eighths: 1 },
    ],
    chord: [60, 64, 67], // C
  },
  {
    notes: [
      { midi: 74, eighths: 2 },
      { midi: 76, eighths: 1 },
      { midi: 74, eighths: 2 },
      { midi: 71, eighths: 1 },
    ],
    chord: [55, 59, 62], // G — leading tone under B4
  },
  { notes: [{ midi: 72, eighths: 6 }], chord: [60, 64, 67] }, // C — home
];

/** Total cycle length in seconds. */
const CYCLE_S = TUNE.length * EIGHTHS_PER_BAR * EIGHTH_S;

/**
 * Plays the looping Deck Dance for Cannonball Splash: a brisk 6/8 concertina
 * jig with oom-pah accompaniment. Same instrument family as Pirate Cove's
 * shore tune so entering the game feels like the same world, dancing.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A cleanup function that stops the loop
 */
export function playMusCannonballSplashBackground(ctx: AudioContext, dest: AudioNode): () => void {
  return startAudioLoop(ctx, CYCLE_S, (startTime) => {
    let barStart = startTime;
    for (const bar of TUNE) {
      // Oom: bass on each dotted-quarter beat.
      scheduleBassNote(ctx, dest, bar.chord[0] - 12, barStart, EIGHTH_S * 2.4, ACCOMP_GAIN);
      scheduleBassNote(ctx, dest, bar.chord[0] - 12, barStart + 3 * EIGHTH_S, EIGHTH_S * 2.4, ACCOMP_GAIN * 0.8);

      // Pah: chord dab on the second eighth of each beat group.
      for (const beatOffset of [1, 4]) {
        for (const midi of bar.chord) {
          playTone(ctx, dest, 'triangle', midiToFreq(midi), 0.015, EIGHTH_S * 1.1, ACCOMP_GAIN * 0.4, barStart + beatOffset * EIGHTH_S);
        }
      }

      // Melody.
      let offset = 0;
      for (const note of bar.notes) {
        const durS = note.eighths * EIGHTH_S;
        scheduleConcertinaNote(ctx, dest, midiToFreq(note.midi), barStart + offset, durS, MELODY_GAIN);
        offset += durS;
      }

      barStart += EIGHTHS_PER_BAR * EIGHTH_S;
    }
  });
}
