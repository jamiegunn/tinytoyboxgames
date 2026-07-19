/**
 * Shared procedural instruments — the building blocks behind every music bed.
 *
 * Every track in the game is expected to meet the quality bar set by the hub
 * music box (see docs/ai-guidance/audio-standards.md): a real three-layer
 * arrangement (melody + harmony + bass), phrase structure with cadences, and
 * humanized, characterful timbres. These instruments make that cheap: a new
 * track is a melody table, a chord table, and a few instrument calls.
 *
 * All schedule functions take an explicit audio-clock startTime so they can be
 * driven by the lookahead loop scheduler (loopScheduler.ts).
 */

import { midiToFreq } from './synthHelpers';

/** Inharmonic music-box partial ratio (real music boxes ring near 4.2x). */
const MUSIC_BOX_PARTIAL_RATIO = 4.2;

/**
 * Schedules a single music-box note: sine fundamental, fast-decaying
 * inharmonic partial, and a soft octave shimmer, with slight velocity
 * humanization so repeated notes never sound mechanical.
 *
 * @param ctx - The Web Audio context.
 * @param destination - The destination AudioNode.
 * @param frequency - Note frequency in Hz.
 * @param startTime - Audio-clock time to start the note.
 * @param durationS - Nominal note duration in seconds.
 * @param gain - Peak melody gain before humanization.
 */
export function scheduleMusicBoxNote(ctx: AudioContext, destination: AudioNode, frequency: number, startTime: number, durationS: number, gain: number): void {
  const velocity = gain * (0.85 + Math.random() * 0.3);
  const ringS = Math.max(durationS * 1.4, 0.5);

  // Fundamental — pure music-box tone
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = frequency;
  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(0, startTime);
  gain1.gain.linearRampToValueAtTime(velocity, startTime + 0.008);
  gain1.gain.exponentialRampToValueAtTime(0.001, startTime + ringS);
  osc1.connect(gain1).connect(destination);
  osc1.start(startTime);
  osc1.stop(startTime + ringS + 0.05);

  // Inharmonic partial — fast-decaying metallic ping
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = frequency * MUSIC_BOX_PARTIAL_RATIO;
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, startTime);
  gain2.gain.linearRampToValueAtTime(velocity * 0.22, startTime + 0.005);
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);
  osc2.connect(gain2).connect(destination);
  osc2.start(startTime);
  osc2.stop(startTime + 0.25);

  // Octave shimmer — quiet, rounds out the tone
  const osc3 = ctx.createOscillator();
  osc3.type = 'triangle';
  osc3.frequency.value = frequency * 2;
  const gain3 = ctx.createGain();
  gain3.gain.setValueAtTime(0, startTime);
  gain3.gain.linearRampToValueAtTime(velocity * 0.18, startTime + 0.01);
  gain3.gain.exponentialRampToValueAtTime(0.001, startTime + ringS * 0.7);
  osc3.connect(gain3).connect(destination);
  osc3.start(startTime);
  osc3.stop(startTime + ringS + 0.05);
}

/** Options for {@link schedulePadChord}. */
export interface PadOptions {
  /** Per-voice gain. @default 0.045 */
  gain?: number;
  /** Lowpass cutoff in Hz. @default 850 */
  lowpassHz?: number;
  /** Detune spread in cents applied as +/- to each voice pair. @default 4 */
  detuneCents?: number;
}

/**
 * Schedules one soft pad chord: detuned triangle voice pairs through a
 * lowpass filter with slow attack/release — the harmony layer.
 *
 * @param ctx - The Web Audio context.
 * @param destination - The destination AudioNode.
 * @param chordMidi - MIDI notes of the chord voicing.
 * @param startTime - Audio-clock time the chord begins.
 * @param durationS - Chord duration in seconds.
 * @param options - Optional gain/filter/detune overrides.
 */
export function schedulePadChord(
  ctx: AudioContext,
  destination: AudioNode,
  chordMidi: number[],
  startTime: number,
  durationS: number,
  options: PadOptions = {},
): void {
  const gain = options.gain ?? 0.045;
  const detune = options.detuneCents ?? 4;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = options.lowpassHz ?? 850;
  lowpass.connect(destination);

  const attackS = Math.min(1.1, durationS * 0.4);
  const releaseS = Math.min(1.4, durationS * 0.5);
  const endTime = startTime + durationS + releaseS;

  for (const midi of chordMidi) {
    for (const cents of [-detune, detune]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midiToFreq(midi);
      osc.detune.value = cents;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(gain, startTime + attackS);
      env.gain.setValueAtTime(gain, startTime + durationS - 0.05);
      env.gain.linearRampToValueAtTime(0, endTime);

      osc.connect(env).connect(lowpass);
      osc.start(startTime);
      osc.stop(endTime + 0.05);
    }
  }
}

/**
 * Schedules one soft bass note (sine) — the foundation layer. Typically the
 * chord root played an octave below the pad voicing.
 *
 * @param ctx - The Web Audio context.
 * @param destination - The destination AudioNode.
 * @param midi - MIDI note to play (already at bass register).
 * @param startTime - Audio-clock time the note begins.
 * @param durationS - Note duration in seconds.
 * @param gain - Peak gain. @default 0.06
 */
export function scheduleBassNote(ctx: AudioContext, destination: AudioNode, midi: number, startTime: number, durationS: number, gain = 0.06): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = midiToFreq(midi);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(gain, startTime + 0.08);
  env.gain.setValueAtTime(gain, startTime + durationS * 0.7);
  env.gain.linearRampToValueAtTime(0, startTime + durationS);

  osc.connect(env).connect(destination);
  osc.start(startTime);
  osc.stop(startTime + durationS + 0.05);
}

/**
 * Schedules one concertina-style note: two detuned triangles plus a quiet saw
 * through a lowpass for a soft reedy quality. The lead voice of the pirate
 * family of tracks.
 *
 * @param ctx - The Web Audio context.
 * @param destination - The destination AudioNode.
 * @param frequency - Note frequency in Hz.
 * @param startTime - Audio-clock start time.
 * @param durationS - Note duration in seconds.
 * @param gain - Peak gain.
 */
export function scheduleConcertinaNote(ctx: AudioContext, destination: AudioNode, frequency: number, startTime: number, durationS: number, gain: number): void {
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 1400;
  lowpass.connect(destination);

  const voices: Array<{ type: OscillatorType; detune: number; level: number }> = [
    { type: 'triangle', detune: -6, level: 1 },
    { type: 'triangle', detune: 6, level: 1 },
    { type: 'sawtooth', detune: 0, level: 0.25 },
  ];

  for (const voice of voices) {
    const osc = ctx.createOscillator();
    osc.type = voice.type;
    osc.frequency.value = frequency;
    osc.detune.value = voice.detune;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(gain * voice.level, startTime + 0.03);
    env.gain.setValueAtTime(gain * voice.level, startTime + durationS * 0.75);
    env.gain.linearRampToValueAtTime(0, startTime + durationS);

    osc.connect(env).connect(lowpass);
    osc.start(startTime);
    osc.stop(startTime + durationS + 0.05);
  }
}

/**
 * Schedules a soft marimba-like note: sine fundamental with a woody 4th
 * harmonic and quick decay. Used for underwater and playful motifs.
 *
 * @param ctx - The Web Audio context.
 * @param destination - The destination AudioNode.
 * @param frequency - Note frequency in Hz.
 * @param startTime - Audio-clock start time.
 * @param gain - Peak gain.
 */
export function scheduleMarimbaNote(ctx: AudioContext, destination: AudioNode, frequency: number, startTime: number, gain: number): void {
  const velocity = gain * (0.85 + Math.random() * 0.3);

  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = frequency;
  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(0, startTime);
  gain1.gain.linearRampToValueAtTime(velocity, startTime + 0.006);
  gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.55);
  osc1.connect(gain1).connect(destination);
  osc1.start(startTime);
  osc1.stop(startTime + 0.65);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = frequency * 4;
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, startTime);
  gain2.gain.linearRampToValueAtTime(velocity * 0.15, startTime + 0.004);
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);
  osc2.connect(gain2).connect(destination);
  osc2.start(startTime);
  osc2.stop(startTime + 0.15);
}
