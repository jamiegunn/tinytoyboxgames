/**
 * Hub sound effects for the Whimsical Toybox World.
 * All sounds are procedurally generated via Web Audio synthesis — no audio files.
 */

import { playTone, playFilteredNoiseBurst, playFreqSweep, midiToFreq, pentatonicScale, pick, rand } from '@app/assets/audio/utils/synthHelpers';

/** Minimum fade-in time in seconds to avoid clicks (per spec). */
const MIN_ATTACK_S = 0.005;

/**
 * Plays an anticipation/excitement tap sound for toybox interaction.
 * Duration: ~0.3s. Wooden knock via filtered noise burst plus a soft sine tone.
 * Includes 2 variations via frequency randomization.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxHubToyboxTap(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const variation = pick([0, 1]);

  // Wooden knock — filtered noise burst
  const knockFreq = variation === 0 ? 800 : 900;
  playFilteredNoiseBurst(ctx, dest, knockFreq, 2, MIN_ATTACK_S, 0.25, 0.18, now);

  // Soft sine undertone
  const toneFreq = variation === 0 ? 400 : 440;
  playTone(ctx, dest, 'sine', toneFreq, MIN_ATTACK_S, 0.2, 0.1, now);
}

/**
 * Plays a grand reveal/wonder sound when a toybox opens.
 * Duration: ~0.8s. Layered creaky wooden thunk followed by an ascending chime sweep.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxHubToyboxOpen(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // Creaky wooden thunk — low noise burst
  playFilteredNoiseBurst(ctx, dest, 300, 1.5, MIN_ATTACK_S, 0.3, 0.2, now);

  // Low thump undertone
  playTone(ctx, dest, 'sine', 150, MIN_ATTACK_S, 0.15, 0.12, now);

  // Ascending chime sweep — delayed slightly for layered reveal feel
  const chimeDelay = 0.15;
  playFreqSweep(ctx, dest, 'sine', 400, 800, 0.02, 0.5, 0.18, now + chimeDelay);

  // Sparkle overtone on the chime
  playTone(ctx, dest, 'sine', 1200, 0.01, 0.4, 0.08, now + chimeDelay + 0.05);
}

/**
 * Plays a bright melodic tap sound for music player interaction.
 * Duration: ~0.5s. Quick ascending three-note arpeggio (C5, E5, G5) using triangle waves.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxHubMusicPlayerTap(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // C5, E5, G5 arpeggio
  const notes = [72, 76, 79]; // MIDI: C5, E5, G5
  const noteSpacing = 0.08;
  const noteRelease = 0.2;
  const noteGain = 0.15;

  for (let i = 0; i < notes.length; i++) {
    const freq = midiToFreq(notes[i]);
    playTone(ctx, dest, 'triangle', freq, MIN_ATTACK_S, noteRelease, noteGain, now + i * noteSpacing);
  }
}

/**
 * Plays a delightful music-box melody phrase for the music player.
 * Duration: ~2.5s. Short music-box melody of 8-10 notes from C major pentatonic (C5-C6 range).
 * Uses sine waves with quick attack and medium decay. Includes 3 variations via random melody selection.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxHubMusicPlayerTune(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // C major pentatonic scale from C5 (MIDI 72) and C6 (MIDI 84)
  const scaleC5 = pentatonicScale(72); // C5, D5, E5, G5, A5
  const scaleC6 = pentatonicScale(84); // C6, D6, E6, G6, A6
  const fullScale = [...scaleC5, scaleC6[0]]; // C5 through C6

  // Generate 3 possible melodies
  const variation = pick([0, 1, 2]);
  let melody: number[];

  if (variation === 0) {
    // Ascending then descending contour
    melody = [fullScale[0], fullScale[1], fullScale[2], fullScale[4], fullScale[5], fullScale[4], fullScale[2], fullScale[1], fullScale[0]];
  } else if (variation === 1) {
    // Playful jumping pattern
    melody = [fullScale[0], fullScale[3], fullScale[1], fullScale[4], fullScale[2], fullScale[5], fullScale[3], fullScale[1], fullScale[0], fullScale[2]];
  } else {
    // Gentle descending with a lift at the end
    melody = [fullScale[5], fullScale[4], fullScale[3], fullScale[2], fullScale[1], fullScale[0], fullScale[1], fullScale[3]];
  }

  const noteSpacing = 0.28;
  const noteAttack = 0.01;
  const noteRelease = 0.22;
  const noteGain = 0.15;

  for (let i = 0; i < melody.length; i++) {
    const freq = midiToFreq(melody[i]);
    playTone(ctx, dest, 'sine', freq, noteAttack, noteRelease, noteGain, now + i * noteSpacing);
  }
}

/**
 * Plays a whimsical tiny scurry sound (like small creature feet).
 * Duration: ~0.7s. Quick bursts of high-frequency filtered noise with rapid on-off envelope pattern.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxHubAmbientScurry(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // Create a rapid series of tiny noise bursts to simulate scurrying feet
  const burstCount = pick([5, 6, 7, 8]);
  const totalDuration = rand(0.5, 0.9);
  const burstSpacing = totalDuration / burstCount;

  for (let i = 0; i < burstCount; i++) {
    const burstFreq = rand(3000, 5000);
    const burstTime = now + i * burstSpacing;
    const burstAttack = MIN_ATTACK_S;
    const burstRelease = burstSpacing * 0.5;
    const burstGain = rand(0.06, 0.12);

    playFilteredNoiseBurst(ctx, dest, burstFreq, 3, burstAttack, burstRelease, burstGain, burstTime);
  }
}

/**
 * Plays a toy train horn — a cheerful two-tone toot.
 * Duration: ~0.6s. Two overlapping sine tones (F4, A4) with slight vibrato.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxHubTrainHorn(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const variation = pick([0, 1]);

  // First toot — lower note
  const freq1 = variation === 0 ? 349 : 370; // ~F4 or ~F#4
  playTone(ctx, dest, 'sine', freq1, MIN_ATTACK_S, 0.3, 0.18, now);
  playTone(ctx, dest, 'triangle', freq1 * 1.01, MIN_ATTACK_S, 0.25, 0.06, now); // slight detune for warmth

  // Second toot — higher, slightly delayed
  const freq2 = variation === 0 ? 440 : 466; // ~A4 or ~A#4
  playTone(ctx, dest, 'sine', freq2, MIN_ATTACK_S, 0.25, 0.16, now + 0.2);
  playTone(ctx, dest, 'triangle', freq2 * 1.01, MIN_ATTACK_S, 0.2, 0.05, now + 0.2);
}

/**
 * Plays a "chugga chugga choo choo" train rhythm.
 * Duration: ~1.6s. Four quick "chugga" noise bursts followed by two pitched "choo" tones.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxHubTrainChugga(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // "Chugga chugga chugga chugga" — 4 rhythmic filtered noise bursts (steam pistons)
  const chuggaSpacing = 0.18;
  for (let i = 0; i < 4; i++) {
    const t = now + i * chuggaSpacing;
    const freq = i % 2 === 0 ? 600 : 500; // alternating pitch for "CHUG-ga" feel
    const gain = i % 2 === 0 ? 0.12 : 0.08;
    playFilteredNoiseBurst(ctx, dest, freq, 2.5, MIN_ATTACK_S, 0.1, gain, t);
    // Subtle metallic clank undertone
    playTone(ctx, dest, 'square', freq * 0.5, MIN_ATTACK_S, 0.06, 0.03, t);
  }

  // "Choo choo" — two descending whistle tones
  const chooStart = now + 4 * chuggaSpacing + 0.05;
  playFreqSweep(ctx, dest, 'sine', 800, 600, MIN_ATTACK_S, 0.25, 0.14, chooStart);
  playTone(ctx, dest, 'triangle', 810, MIN_ATTACK_S, 0.2, 0.05, chooStart); // warmth

  const choo2Start = chooStart + 0.3;
  playFreqSweep(ctx, dest, 'sine', 750, 550, MIN_ATTACK_S, 0.25, 0.12, choo2Start);
  playTone(ctx, dest, 'triangle', 760, MIN_ATTACK_S, 0.2, 0.04, choo2Start);
}

/**
 * Plays a light bouncy hop sound.
 * Duration: ~0.3s. Quick sine sweep up (200-500 Hz) then down (500-300 Hz).
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxHubAmbientHop(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // Upward sweep: 200Hz -> 500Hz
  const upAttack = MIN_ATTACK_S;
  const upRelease = 0.12;
  playFreqSweep(ctx, dest, 'sine', 200, 500, upAttack, upRelease, 0.15, now);

  // Downward sweep: 500Hz -> 300Hz, slightly overlapping
  const downDelay = 0.1;
  const downAttack = MIN_ATTACK_S;
  const downRelease = 0.15;
  playFreqSweep(ctx, dest, 'sine', 500, 300, downAttack, downRelease, 0.12, now + downDelay);
}
