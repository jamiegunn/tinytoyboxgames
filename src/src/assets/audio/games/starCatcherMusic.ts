/**
 * Star Catcher background music — "Starlight Ostinato".
 *
 * A twinkling perpetual-motion piece: a steady eighth-note music-box
 * ostinato arpeggiating each chord (velocity humanization keeps it alive),
 * over a slow I - vi - IV - V pad and bass. The ostinato climbs to the
 * chord's octave mid-bar and falls back — a little starfield shimmer.
 * Star chimes are rooted on C6/E6/G6, so every catch lands in key.
 */

import { midiToFreq } from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';
import { scheduleMusicBoxNote, schedulePadChord, scheduleBassNote } from '@app/assets/audio/utils/instruments';

/** Duration of one ostinato eighth note in seconds. */
const EIGHTH_S = 0.25;

/** Eighths per bar. */
const EIGHTHS_PER_BAR = 8;

/** Ostinato gain — texture, not lead. */
const OSTINATO_GAIN = 0.085;

/** One bar: the chord that shapes both ostinato and pad. */
interface Bar {
  /** Pad voicing (MIDI). */
  chord: number[];
  /** Ostinato pattern for the bar (MIDI), one note per eighth. */
  pattern: number[];
}

const BARS: Bar[] = [
  {
    chord: [60, 64, 67], // C
    pattern: [72, 76, 79, 81, 84, 81, 79, 76],
  },
  {
    chord: [57, 60, 64], // Am
    pattern: [69, 72, 76, 79, 81, 79, 76, 72],
  },
  {
    chord: [53, 57, 60], // F
    pattern: [69, 72, 77, 81, 84, 81, 77, 72],
  },
  {
    chord: [55, 59, 62], // G
    pattern: [67, 71, 74, 79, 83, 79, 74, 71],
  },
];

/** Total cycle length in seconds. */
const CYCLE_S = BARS.length * EIGHTHS_PER_BAR * EIGHTH_S;

/**
 * Plays the looping Starlight Ostinato.
 *
 * @param ctx - The Web Audio context
 * @param destination - The destination AudioNode to connect output to
 * @returns A cleanup function that stops the loop
 */
export function playMusStarCatcherBackground(ctx: AudioContext, destination: AudioNode): () => void {
  let cycleIndex = 0;
  return startAudioLoop(ctx, CYCLE_S, (startTime) => {
    const withPad = cycleIndex % 2 === 0;
    let barStart = startTime;

    for (const bar of BARS) {
      const barDur = EIGHTHS_PER_BAR * EIGHTH_S;

      if (withPad) {
        schedulePadChord(ctx, destination, bar.chord, barStart, barDur, { gain: 0.032, lowpassHz: 800 });
      }
      scheduleBassNote(ctx, destination, bar.chord[0] - 12, barStart, barDur, 0.05);

      for (let i = 0; i < bar.pattern.length; i++) {
        scheduleMusicBoxNote(ctx, destination, midiToFreq(bar.pattern[i]), barStart + i * EIGHTH_S, EIGHTH_S, OSTINATO_GAIN);
      }

      barStart += barDur;
    }

    cycleIndex++;
  });
}
