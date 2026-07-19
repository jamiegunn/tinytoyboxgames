/**
 * Kitchen background music — "Teatime Waltz".
 *
 * A cozy 3/4 music-box waltz: oom-pah-pah accompaniment (bass root on the
 * downbeat, soft chord dabs on beats two and three), an 8-bar melody with a
 * proper half-cadence and resolution home, and a sustained pad that joins on
 * alternate cycles so the piece breathes. Same C-major family as the rest of
 * the toybox so reward chimes always harmonize.
 */

import { midiToFreq } from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';
import { scheduleMusicBoxNote, schedulePadChord, scheduleBassNote } from '@app/assets/audio/utils/instruments';

/** Duration of one waltz beat in seconds (3/4 at a relaxed lilt). */
const BEAT_S = 0.5;

/** Beats per bar. */
const BEATS_PER_BAR = 3;

/** Melody gain. */
const MELODY_GAIN = 0.12;

/** Chord-dab gain per voice. */
const DAB_GAIN = 0.028;

/** Bass gain. */
const BASS_GAIN = 0.06;

/** One bar: melody notes (MIDI + beats) over a chord voicing. */
interface Bar {
  notes: Array<{ midi: number; beats: number }>;
  chord: number[];
}

// An 8-bar waltz: statement, answer to a half cadence on G, then a reprise
// that resolves home through the leading tone.
const TUNE: Bar[] = [
  {
    notes: [
      { midi: 79, beats: 2 },
      { midi: 76, beats: 1 },
    ],
    chord: [60, 64, 67], // C
  },
  {
    notes: [
      { midi: 81, beats: 2 },
      { midi: 77, beats: 1 },
    ],
    chord: [53, 57, 60], // F
  },
  {
    notes: [
      { midi: 79, beats: 1 },
      { midi: 77, beats: 1 },
      { midi: 74, beats: 1 },
    ],
    chord: [55, 59, 62], // G
  },
  { notes: [{ midi: 76, beats: 3 }], chord: [60, 64, 67] }, // C — phrase rest
  {
    notes: [
      { midi: 81, beats: 2 },
      { midi: 84, beats: 1 },
    ],
    chord: [57, 60, 64], // Am
  },
  {
    notes: [
      { midi: 77, beats: 2 },
      { midi: 81, beats: 1 },
    ],
    chord: [50, 53, 57], // Dm
  },
  {
    notes: [
      { midi: 79, beats: 1 },
      { midi: 76, beats: 1 },
      { midi: 71, beats: 1 },
    ],
    chord: [55, 59, 62], // G — leading tone under the melody's B4
  },
  { notes: [{ midi: 72, beats: 3 }], chord: [60, 64, 67] }, // C — home
];

/** Total cycle length in seconds. */
const CYCLE_S = TUNE.length * BEATS_PER_BAR * BEAT_S;

/**
 * Schedules one full waltz cycle.
 *
 * @param ctx - The Web Audio context.
 * @param destination - The destination AudioNode.
 * @param startTime - Audio-clock time the cycle begins.
 * @param withPad - Whether the sustained pad layer joins this cycle.
 */
function scheduleCycle(ctx: AudioContext, destination: AudioNode, startTime: number, withPad: boolean): void {
  let barStart = startTime;

  for (const bar of TUNE) {
    // Oom: bass root on the downbeat.
    scheduleBassNote(ctx, destination, bar.chord[0] - 12, barStart, BEAT_S * 2.6, BASS_GAIN);

    // Pah-pah: soft chord dabs on beats two and three.
    for (const beat of [1, 2]) {
      for (const midi of bar.chord) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midiToFreq(midi);
        const env = ctx.createGain();
        const t = barStart + beat * BEAT_S;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(DAB_GAIN, t + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, t + BEAT_S * 0.8);
        osc.connect(env).connect(destination);
        osc.start(t);
        osc.stop(t + BEAT_S);
      }
    }

    // Sustained pad on alternate cycles for warmth.
    if (withPad) {
      schedulePadChord(ctx, destination, bar.chord, barStart, BEATS_PER_BAR * BEAT_S, { gain: 0.03, lowpassHz: 750 });
    }

    // Melody.
    let offset = 0;
    for (const note of bar.notes) {
      const durS = note.beats * BEAT_S;
      scheduleMusicBoxNote(ctx, destination, midiToFreq(note.midi), barStart + offset, durS, MELODY_GAIN);
      offset += durS;
    }

    barStart += BEATS_PER_BAR * BEAT_S;
  }
}

/**
 * Plays the looping Teatime Waltz for the Kitchen.
 *
 * @param ctx - The Web Audio context
 * @param destination - The destination AudioNode to connect output to
 * @returns A cleanup function that stops the loop
 */
export function playMusKitchenBackground(ctx: AudioContext, destination: AudioNode): () => void {
  let cycleIndex = 0;
  return startAudioLoop(ctx, CYCLE_S, (startTime) => {
    scheduleCycle(ctx, destination, startTime, cycleIndex % 2 === 1);
    cycleIndex++;
  });
}
