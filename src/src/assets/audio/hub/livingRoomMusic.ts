/**
 * Living Room background music — "Hearthside".
 *
 * A slow, warm 4/4 music-box piece for the hearth room. Three layers per
 * docs/ai-guidance/audio-standards.md: sustained pad chords over an
 * I-IV-vi-V-ish progression (C, F, Am, G) with a soft bass root-and-fifth
 * underneath every cycle, and a music-box melody that rests on alternate
 * cycles so the room breathes between tunes — pad and bass glow on alone like
 * embers. Eight bars with a half cadence at the midpoint and a leading-tone
 * resolution home (B4 under G resolving to C5). C-major family throughout so
 * the shared reward chimes always land in key, scheduled sample-accurately
 * through the shared lookahead loop scheduler.
 */

import { midiToFreq } from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';
import { scheduleMusicBoxNote, schedulePadChord, scheduleBassNote } from '@app/assets/audio/utils/instruments';

/** Duration of one beat in seconds (4/4 at a slow, cozy pace). */
const BEAT_S = 0.62;

/** Beats per bar. */
const BEATS_PER_BAR = 4;

/** Melody peak gain. */
const MELODY_GAIN = 0.11;

/** Pad per-voice gain. */
const PAD_GAIN = 0.034;

/** Bass gain. */
const BASS_GAIN = 0.055;

/** One bar: melody notes (MIDI + beats) over a chord voicing. */
interface Bar {
  notes: Array<{ midi: number; beats: number }>;
  chord: number[];
}

// Eight slow bars: statement over I-IV-vi with a half cadence on V, then an
// answering phrase that climbs and settles home through the leading tone.
const TUNE: Bar[] = [
  {
    notes: [
      { midi: 72, beats: 2 },
      { midi: 76, beats: 1 },
      { midi: 79, beats: 1 },
    ],
    chord: [60, 64, 67], // C
  },
  {
    notes: [
      { midi: 81, beats: 2 },
      { midi: 79, beats: 1 },
      { midi: 77, beats: 1 },
    ],
    chord: [53, 57, 60], // F
  },
  {
    notes: [
      { midi: 76, beats: 1 },
      { midi: 74, beats: 1 },
      { midi: 76, beats: 2 },
    ],
    chord: [57, 60, 64], // Am
  },
  { notes: [{ midi: 74, beats: 4 }], chord: [55, 59, 62] }, // G — half cadence
  {
    notes: [
      { midi: 79, beats: 2 },
      { midi: 76, beats: 1 },
      { midi: 72, beats: 1 },
    ],
    chord: [60, 64, 67], // C
  },
  {
    notes: [
      { midi: 81, beats: 2 },
      { midi: 84, beats: 2 },
    ],
    chord: [53, 57, 60], // F
  },
  {
    notes: [
      { midi: 81, beats: 1 },
      { midi: 79, beats: 1 },
      { midi: 74, beats: 1 },
      { midi: 71, beats: 1 },
    ],
    chord: [55, 59, 62], // G — leading tone under the melody's B4
  },
  { notes: [{ midi: 72, beats: 4 }], chord: [60, 64, 67] }, // C — home
];

/** Total cycle length in seconds. */
const CYCLE_S = TUNE.length * BEATS_PER_BAR * BEAT_S;

/**
 * Schedules one full Hearthside cycle.
 *
 * The pad and bass warm every cycle; the music-box melody joins only when
 * `withMelody` is set, resting on alternate cycles so the loop varies over
 * time instead of repeating identically.
 *
 * @param ctx - The Web Audio context.
 * @param destination - The destination AudioNode.
 * @param startTime - Audio-clock time the cycle begins.
 * @param withMelody - Whether the music-box melody plays this cycle.
 */
function scheduleCycle(ctx: AudioContext, destination: AudioNode, startTime: number, withMelody: boolean): void {
  let barStart = startTime;

  for (const bar of TUNE) {
    // Ember glow: one sustained pad chord per bar.
    schedulePadChord(ctx, destination, bar.chord, barStart, BEATS_PER_BAR * BEAT_S, { gain: PAD_GAIN, lowpassHz: 800 });

    // Bass foundation: root on the downbeat, chord fifth on beat three.
    scheduleBassNote(ctx, destination, bar.chord[0] - 12, barStart, BEAT_S * 2.4, BASS_GAIN);
    scheduleBassNote(ctx, destination, bar.chord[2] - 12, barStart + 2 * BEAT_S, BEAT_S * 1.8, BASS_GAIN * 0.8);

    // Music-box melody on alternate cycles.
    if (withMelody) {
      let offset = 0;
      for (const note of bar.notes) {
        const durS = note.beats * BEAT_S;
        scheduleMusicBoxNote(ctx, destination, midiToFreq(note.midi), barStart + offset, durS, MELODY_GAIN);
        offset += durS;
      }
    }

    barStart += BEATS_PER_BAR * BEAT_S;
  }
}

/**
 * Plays the looping Hearthside piece for the Living Room.
 *
 * @param ctx - The Web Audio context
 * @param destination - The destination AudioNode to connect output to
 * @returns A cleanup function that stops the loop
 */
export function playMusLivingRoomBackground(ctx: AudioContext, destination: AudioNode): () => void {
  let cycleIndex = 0;
  return startAudioLoop(ctx, CYCLE_S, (startTime) => {
    scheduleCycle(ctx, destination, startTime, cycleIndex % 2 === 0);
    cycleIndex++;
  });
}
