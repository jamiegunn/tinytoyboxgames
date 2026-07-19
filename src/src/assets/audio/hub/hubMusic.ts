/**
 * Hub background music module for the Whimsical Toybox World.
 * Procedurally generates a gentle music-box lullaby via Web Audio synthesis — no audio files.
 *
 * Arrangement (three layers, per docs/ai-guidance/audio-standards.md):
 * - Music-box melody in the C5 register where music boxes actually live.
 * - Chord pad following a I-vi-IV-V progression with common-tone voicings.
 * - Bass an octave below each chord root.
 *
 * The melody is a 4-phrase AABA tune that cadences properly (B4 leading tone
 * resolving to C5 over G -> C), scheduled sample-accurately via the shared
 * lookahead loop scheduler. Every other cycle drops the pad for variety.
 */

import { midiToFreq } from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';
import { scheduleMusicBoxNote, schedulePadChord, scheduleBassNote } from '@app/assets/audio/utils/instruments';

/** Base duration of one melody step in seconds. */
const STEP_S = 0.4;

/** Melody peak gain (soft background level; bus gain does the rest). */
const MELODY_GAIN = 0.13;

/** Pad per-voice gain. */
const PAD_GAIN = 0.045;

/** Bass note gain. */
const BASS_GAIN = 0.06;

/**
 * One melodic phrase: MIDI notes plus per-note duration multipliers.
 * The final note of each phrase is held for two steps to let it breathe.
 */
interface Phrase {
  notes: number[];
  beats: number[];
}

// MIDI reference: C5 = 72.
const PHRASE_A: Phrase = {
  notes: [72, 76, 79, 81, 79, 76, 74, 72],
  beats: [1, 1, 1, 1, 1, 1, 1, 2],
};

const PHRASE_B: Phrase = {
  notes: [76, 79, 81, 84, 81, 79, 76, 74],
  beats: [1, 1, 1, 1, 1, 1, 1, 2],
};

/** Closing phrase: walks down to the leading tone and resolves home. */
const PHRASE_A_CADENCE: Phrase = {
  notes: [72, 76, 79, 81, 79, 74, 71, 72],
  beats: [1, 1, 1, 1, 1, 1, 1, 2],
};

/** AABA form. */
const PHRASES: Phrase[] = [PHRASE_A, PHRASE_A, PHRASE_B, PHRASE_A_CADENCE];

/** Chord voicings (MIDI) — two chords per phrase, half a phrase each. */
const PHRASE_CHORDS: Array<[number[], number[]]> = [
  [
    [60, 64, 67], // C
    [57, 60, 64], // Am
  ],
  [
    [53, 57, 60], // F
    [55, 59, 62], // G
  ],
  [
    [57, 60, 64], // Am
    [53, 57, 60], // F
  ],
  [
    [55, 59, 62], // G
    [60, 64, 67], // C — resolution under the melodic cadence
  ],
];

/**
 * Seconds in one phrase (sum of beats * step).
 *
 * @param phrase - The phrase whose duration to compute.
 * @returns Phrase duration in seconds.
 */
function phraseSeconds(phrase: Phrase): number {
  return phrase.beats.reduce((sum, b) => sum + b, 0) * STEP_S;
}

/** Total cycle length in seconds. */
const CYCLE_S = PHRASES.reduce((sum, p) => sum + phraseSeconds(p), 0);

/**
 * Schedules one full AABA cycle: melody, pads, and bass.
 *
 * @param ctx - The Web Audio context.
 * @param destination - The destination AudioNode.
 * @param baseTime - Audio-clock time at which the cycle begins.
 * @param withPad - Whether to include the pad/bass layers this cycle.
 */
function scheduleCycle(ctx: AudioContext, destination: AudioNode, baseTime: number, withPad: boolean): void {
  let phraseStart = baseTime;

  for (let p = 0; p < PHRASES.length; p++) {
    const phrase = PHRASES[p];
    const phraseDur = phraseSeconds(phrase);

    // Harmony: two chords per phrase, each covering half the phrase.
    if (withPad) {
      const [chordA, chordB] = PHRASE_CHORDS[p];
      schedulePadChord(ctx, destination, chordA, phraseStart, phraseDur / 2, { gain: PAD_GAIN });
      schedulePadChord(ctx, destination, chordB, phraseStart + phraseDur / 2, phraseDur / 2, { gain: PAD_GAIN });
      scheduleBassNote(ctx, destination, chordA[0] - 12, phraseStart, phraseDur / 2, BASS_GAIN);
      scheduleBassNote(ctx, destination, chordB[0] - 12, phraseStart + phraseDur / 2, phraseDur / 2, BASS_GAIN);
    }

    // Melody on top
    let offset = 0;
    for (let i = 0; i < phrase.notes.length; i++) {
      const noteDur = phrase.beats[i] * STEP_S;
      scheduleMusicBoxNote(ctx, destination, midiToFreq(phrase.notes[i]), phraseStart + offset, noteDur, MELODY_GAIN);
      offset += noteDur;
    }

    phraseStart += phraseDur;
  }
}

/**
 * Plays the looping music-box lullaby for the Playroom Hub.
 * Sample-accurate looping via the shared lookahead scheduler; the pad and
 * bass layers rest every other cycle so the piece breathes over time.
 *
 * @param ctx - The Web Audio context
 * @param destination - The destination AudioNode to connect output to
 * @returns A cleanup function that stops the loop
 */
export function playMusHubBackground(ctx: AudioContext, destination: AudioNode): () => void {
  let cycleIndex = 0;
  return startAudioLoop(ctx, CYCLE_S, (startTime) => {
    const withPad = cycleIndex % 2 === 0;
    scheduleCycle(ctx, destination, startTime, withPad);
    cycleIndex++;
  });
}
