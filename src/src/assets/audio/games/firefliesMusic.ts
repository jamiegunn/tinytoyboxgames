/**
 * Fireflies background music — "Firefly Nocturne".
 *
 * A hushed night piece designed to sit *under* the game's cricket-and-wind
 * ambience and pentatonic catch chimes rather than compete with them: a slow
 * Am - F - C - G pad through a dark lowpass, a deep bass root, and a very
 * sparse high music-box melody that twinkles like the fireflies themselves.
 * The melody voice rests every other cycle so the night stays spacious.
 * Catch chimes are C-pentatonic (C5 root), so every melody tone here is
 * chosen from the same family — chimes always land in key.
 */

import { midiToFreq } from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';
import { scheduleMusicBoxNote, schedulePadChord, scheduleBassNote } from '@app/assets/audio/utils/instruments';

/** Duration of one bar in seconds — slow, nocturnal. */
const BAR_S = 4;

/** Sparse high-melody gain — a twinkle, not a lead. */
const MELODY_GAIN = 0.07;

/** One bar: chord voicing, bass root, and sparse melody events. */
interface Bar {
  chord: number[];
  bassMidi: number;
  /** Melody notes as [midi, barOffsetSeconds, durationSeconds]. */
  melody: Array<[number, number, number]>;
}

const BARS: Bar[] = [
  {
    chord: [57, 60, 64], // Am
    bassMidi: 45,
    melody: [
      [81, 0.5, 1.6], // A5
      [88, 2.6, 1.2], // E6
    ],
  },
  {
    chord: [53, 57, 60], // F
    bassMidi: 41,
    melody: [[84, 1.2, 1.8]], // C6
  },
  {
    chord: [60, 64, 67], // C
    bassMidi: 48,
    melody: [
      [79, 0.8, 1.4], // G5
      [88, 3.0, 0.9], // E6
    ],
  },
  {
    chord: [55, 59, 62], // G
    bassMidi: 43,
    melody: [
      [83, 1.0, 1.2], // B5 — leading tone, pulls the loop home to Am/C
      [81, 2.8, 1.1], // A5
    ],
  },
];

/** Total cycle length in seconds. */
const CYCLE_S = BARS.length * BAR_S;

/**
 * Plays the looping Firefly Nocturne.
 *
 * @param ctx - The Web Audio context
 * @param destination - The destination AudioNode to connect output to
 * @returns A cleanup function that stops the loop
 */
export function playMusFirefliesBackground(ctx: AudioContext, destination: AudioNode): () => void {
  let cycleIndex = 0;
  return startAudioLoop(ctx, CYCLE_S, (startTime) => {
    const withMelody = cycleIndex % 2 === 0;
    let barStart = startTime;

    for (const bar of BARS) {
      schedulePadChord(ctx, destination, bar.chord, barStart, BAR_S, { gain: 0.035, lowpassHz: 600, detuneCents: 5 });
      scheduleBassNote(ctx, destination, bar.bassMidi, barStart, BAR_S, 0.05);

      if (withMelody) {
        for (const [midi, offset, dur] of bar.melody) {
          scheduleMusicBoxNote(ctx, destination, midiToFreq(midi), barStart + offset, dur, MELODY_GAIN);
        }
      }

      barStart += BAR_S;
    }

    cycleIndex++;
  });
}
