/**
 * Pirate Cove procedural audio modules.
 * All sounds are generated via Web Audio synthesis — no audio files.
 * Themed as a friendly toy pirate island: a lilting 6/8 concertina tune and a
 * gentle shore ambient with soft wave washes and distant gulls.
 */

import { playTone, playFreqSweep, playFilteredNoiseBurst, createPinkNoiseBuffer, midiToFreq, rand } from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';
import { scheduleConcertinaNote } from '@app/assets/audio/utils/instruments';

/** Duration of one eighth note in seconds (6/8 at a gentle lilt). */
const EIGHTH_S = 0.24;

/** Eighths per bar in 6/8. */
const EIGHTHS_PER_BAR = 6;

/** Melody gain. */
const MELODY_GAIN = 0.1;

/** Bass/chord accompaniment gain. */
const ACCOMP_GAIN = 0.06;

/** One bar of melody: MIDI notes with durations in eighths. */
interface Bar {
  notes: Array<{ midi: number; eighths: number }>;
  /** Chord voicing (MIDI) accompanying the bar. */
  chord: number[];
}

// An 8-bar lilting tune in C, shanty-shaped but soft: statement, answer,
// rise, and a proper cadence home.
const TUNE: Bar[] = [
  {
    notes: [
      { midi: 76, eighths: 3 },
      { midi: 74, eighths: 1 },
      { midi: 72, eighths: 2 },
    ],
    chord: [60, 64, 67],
  }, // C
  {
    notes: [
      { midi: 74, eighths: 3 },
      { midi: 76, eighths: 3 },
    ],
    chord: [55, 59, 62],
  }, // G
  {
    notes: [
      { midi: 79, eighths: 3 },
      { midi: 76, eighths: 1 },
      { midi: 74, eighths: 2 },
    ],
    chord: [60, 64, 67],
  }, // C
  { notes: [{ midi: 72, eighths: 6 }], chord: [60, 64, 67] }, // C
  {
    notes: [
      { midi: 76, eighths: 3 },
      { midi: 79, eighths: 3 },
    ],
    chord: [57, 60, 64],
  }, // Am
  {
    notes: [
      { midi: 81, eighths: 3 },
      { midi: 79, eighths: 1 },
      { midi: 76, eighths: 2 },
    ],
    chord: [53, 57, 60],
  }, // F
  {
    notes: [
      { midi: 74, eighths: 3 },
      { midi: 76, eighths: 1 },
      { midi: 74, eighths: 2 },
    ],
    chord: [55, 59, 62],
  }, // G
  { notes: [{ midi: 72, eighths: 6 }], chord: [60, 64, 67] }, // C
];

/** Total cycle length in seconds. */
const CYCLE_S = TUNE.length * EIGHTHS_PER_BAR * EIGHTH_S;

/**
 * Plays the looping Pirate Cove tune: concertina melody with an oom-pah
 * 6/8 accompaniment (bass on the downbeats, chord dab on beat two).
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A cleanup function that stops the loop
 */
export function playMusPirateCoveBackground(ctx: AudioContext, dest: AudioNode): () => void {
  const scheduleCycle = (startTime: number) => {
    let barStart = startTime;
    for (const bar of TUNE) {
      // Oom (bass root) on each dotted-quarter beat
      const bassMidi = bar.chord[0] - 12;
      playTone(ctx, dest, 'sine', midiToFreq(bassMidi), 0.02, EIGHTH_S * 2.4, ACCOMP_GAIN, barStart);
      playTone(ctx, dest, 'sine', midiToFreq(bassMidi), 0.02, EIGHTH_S * 2.4, ACCOMP_GAIN * 0.8, barStart + 3 * EIGHTH_S);

      // Pah (chord dab) on the second eighth of each beat group
      for (const beatOffset of [1, 4]) {
        for (const midi of bar.chord) {
          playTone(ctx, dest, 'triangle', midiToFreq(midi), 0.015, EIGHTH_S * 1.1, ACCOMP_GAIN * 0.45, barStart + beatOffset * EIGHTH_S);
        }
      }

      // Melody
      let offset = 0;
      for (const note of bar.notes) {
        const durS = note.eighths * EIGHTH_S;
        scheduleConcertinaNote(ctx, dest, midiToFreq(note.midi), barStart + offset, durS, MELODY_GAIN);
        offset += durS;
      }

      barStart += EIGHTHS_PER_BAR * EIGHTH_S;
    }
  };

  return startAudioLoop(ctx, CYCLE_S, scheduleCycle);
}

/** Shore ambient cycle length in seconds. */
const SHORE_CYCLE_S = 7;

/**
 * Schedules one soft wave wash: pink noise through a slowly sweeping lowpass.
 *
 * @param ctx - The Web Audio context.
 * @param dest - The destination AudioNode.
 * @param startTime - Audio-clock start time.
 */
function scheduleWaveWash(ctx: AudioContext, dest: AudioNode, startTime: number): void {
  const dur = 4 + rand(0, 1.5);
  const noise = ctx.createBufferSource();
  noise.buffer = createPinkNoiseBuffer(ctx, dur + 0.2);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400, startTime);
  lp.frequency.linearRampToValueAtTime(1400, startTime + dur * 0.35);
  lp.frequency.linearRampToValueAtTime(300, startTime + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(0.14, startTime + dur * 0.35);
  env.gain.linearRampToValueAtTime(0, startTime + dur);

  noise.connect(lp).connect(env).connect(dest);
  noise.start(startTime);
  noise.stop(startTime + dur + 0.2);
}

/**
 * Schedules a distant, friendly gull cry: two soft downward chirps.
 *
 * @param ctx - The Web Audio context.
 * @param dest - The destination AudioNode.
 * @param startTime - Audio-clock start time.
 */
function scheduleGull(ctx: AudioContext, dest: AudioNode, startTime: number): void {
  const base = 900 + rand(-100, 100);
  playFreqSweep(ctx, dest, 'sine', base * 1.3, base, 0.03, 0.25, 0.035, startTime);
  playFreqSweep(ctx, dest, 'sine', base * 1.25, base * 0.95, 0.03, 0.3, 0.03, startTime + 0.35);
}

/**
 * Plays the looping Pirate Cove shore ambient: overlapping wave washes with
 * an occasional distant gull.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A cleanup function that stops the loop
 */
export function playAmbPirateCoveShore(ctx: AudioContext, dest: AudioNode): () => void {
  return startAudioLoop(ctx, SHORE_CYCLE_S, (startTime) => {
    scheduleWaveWash(ctx, dest, startTime);
    scheduleWaveWash(ctx, dest, startTime + SHORE_CYCLE_S * 0.5 + rand(-0.5, 0.5));
    if (Math.random() < 0.4) {
      scheduleGull(ctx, dest, startTime + rand(1, SHORE_CYCLE_S - 1.5));
    }
  });
}

/**
 * Plays the ship wheel's creak: the sound its own docblock has promised since it
 * was written, and which the code did not play until Round 3.
 *
 * The wheel previously called `sfx_shared_tap_fallback` — the cue the controller
 * plays when a tap finds nothing at all. Measured in `.probe/render/r3-cove.mjs`:
 * a tap on the wheel and a tap on empty sky produced the identical sound, while
 * four of the cove's six other answers had a voice of their own.
 *
 * WHY THIS IS SYNTHESISED RATHER THAN BORROWED. Nothing in the shared catalogue
 * creaks. `sfx_shared_whoosh` was the nearest fit and is disqualified twice over:
 * the sail already uses it eight metres away, so the wheel would answer in another
 * prop's voice, and a whoosh is air, not wood under load. A creak is a rising,
 * slightly detuned squeak riding a low woody knock, so that is what this builds.
 *
 * Three layers, each doing one job:
 *   - a low knock, the wheel's weight taking up on its axle;
 *   - a rising detuned squeak, two sines a beat apart, which is what makes dry
 *     wood sound like wood rather than like a whistle;
 *   - a short filtered noise rasp under it for grain.
 *
 * It is deliberately quieter than the chest's chime. The chest is a reward and
 * should ring; the wheel is a control being turned and should sound like effort.
 *
 * @param ctx - The Web Audio context.
 * @param dest - The destination AudioNode to connect output to.
 */
export function playSfxPirateCoveWheelCreak(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // The axle taking the load.
  playTone(ctx, dest, 'sine', 150 + rand(-15, 15), 0.005, 0.14, 0.09, now);

  // The creak proper: two sines a few Hz apart so they beat against each other.
  const squeak = 520 + rand(-60, 60);
  playFreqSweep(ctx, dest, 'sine', squeak, squeak * 1.35, 0.02, 0.3, 0.05, now + 0.02);
  playFreqSweep(ctx, dest, 'sine', squeak * 1.01, squeak * 1.36, 0.02, 0.3, 0.04, now + 0.02);

  // Dry grain under the squeak.
  playFilteredNoiseBurst(ctx, dest, 1400, 3, 0.02, 0.22, 0.03, now + 0.02);
}
