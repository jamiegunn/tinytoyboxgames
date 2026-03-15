/**
 * Hub background music module for the Whimsical Toybox World.
 * Procedurally generates a gentle music-box style lullaby via Web Audio synthesis — no audio files.
 */

import { midiToFreq } from '@app/assets/audio/utils/synthHelpers';

/** MIDI note numbers for C major scale notes used in the melody. */
const C4 = 60;
const D4 = 62;
const E4 = 64;
const G4 = 67;
const A4 = 69;

/** Primary melody pattern (MIDI notes). */
const MELODY_A: number[] = [C4, E4, G4, A4, G4, E4, C4, D4];

/** Variation melody pattern for alternating loops. */
const MELODY_B: number[] = [E4, G4, A4, G4, E4, D4, C4, E4];

/** Second variation for added interest. */
const MELODY_C: number[] = [G4, E4, C4, D4, E4, G4, A4, G4];

/** All melody patterns cycled through in order. */
const MELODIES: number[][] = [MELODY_A, MELODY_B, MELODY_A, MELODY_C];

/** Duration of each note in seconds. */
const NOTE_DURATION_S = 0.35;

/** Attack time per note in seconds (gentle fade-in). */
const NOTE_ATTACK_S = 0.02;

/** Release time per note in seconds (soft tail). */
const NOTE_RELEASE_S = 0.2;

/** Overall gain for the music (very soft for background). */
const MASTER_GAIN = 0.15;

/** Slight detuning in cents for the warmth oscillator. */
const WARMTH_DETUNE_CENTS = 3;

/** Total loop length in seconds (~8s for 4 patterns of 8 notes at 0.35s each, with a small gap). */
const LOOP_INTERVAL_MS = NOTE_DURATION_S * 8 * MELODIES.length * 1000 + 200;

/**
 * Schedules a single music-box note with two layered oscillators for warmth.
 *
 * @param ctx - The Web Audio context
 * @param destination - The destination AudioNode to connect output to
 * @param frequency - Note frequency in Hz
 * @param startTime - Audio context time to start the note
 * @param masterGain - Peak gain level for the note
 */
function scheduleNote(ctx: AudioContext, destination: AudioNode, frequency: number, startTime: number, masterGain: number): void {
  const totalDuration = NOTE_ATTACK_S + NOTE_RELEASE_S + 0.15;

  // Primary oscillator — sine for pure music-box tone
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = frequency;

  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(0, startTime);
  gain1.gain.linearRampToValueAtTime(masterGain, startTime + NOTE_ATTACK_S);
  gain1.gain.exponentialRampToValueAtTime(0.001, startTime + NOTE_ATTACK_S + NOTE_RELEASE_S);

  osc1.connect(gain1).connect(destination);
  osc1.start(startTime);
  osc1.stop(startTime + totalDuration);

  // Warmth oscillator — triangle with slight detune
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = frequency;
  osc2.detune.value = WARMTH_DETUNE_CENTS;

  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, startTime);
  gain2.gain.linearRampToValueAtTime(masterGain * 0.5, startTime + NOTE_ATTACK_S);
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime + NOTE_ATTACK_S + NOTE_RELEASE_S);

  osc2.connect(gain2).connect(destination);
  osc2.start(startTime);
  osc2.stop(startTime + totalDuration);
}

/**
 * Schedules one full cycle of the hub melody (all melody patterns back-to-back).
 *
 * @param ctx - The Web Audio context
 * @param destination - The destination AudioNode to connect output to
 * @param baseTime - Audio context time at which to begin the cycle
 */
function scheduleMelodyCycle(ctx: AudioContext, destination: AudioNode, baseTime: number): void {
  let offset = 0;
  for (const melody of MELODIES) {
    for (const note of melody) {
      scheduleNote(ctx, destination, midiToFreq(note), baseTime + offset, MASTER_GAIN);
      offset += NOTE_DURATION_S;
    }
  }
}

/**
 * Plays a looping music-box style background melody for the Playroom Hub.
 * Uses sine and triangle oscillators with slight detuning for warmth.
 * The melody loops approximately every 8 seconds with gentle dynamics.
 *
 * @param ctx - The Web Audio context
 * @param destination - The destination AudioNode to connect output to
 * @returns A cleanup function that stops all oscillators and clears the loop interval
 */
export function playMusHubBackground(ctx: AudioContext, destination: AudioNode): () => void {
  let stopped = false;

  // Schedule the first cycle immediately
  scheduleMelodyCycle(ctx, destination, ctx.currentTime + 0.05);

  // Schedule subsequent cycles on a repeating interval
  const intervalId = setInterval(() => {
    if (stopped) return;
    scheduleMelodyCycle(ctx, destination, ctx.currentTime + 0.05);
  }, LOOP_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
