/**
 * Hub ambient audio module for the Whimsical Toybox World.
 * Procedurally generates a cozy indoor room tone via Web Audio synthesis — no audio files.
 */

import { createPinkNoiseBuffer } from '@app/assets/audio/utils/synthHelpers';

/** Duration of the noise buffer in seconds (long enough for seamless looping). */
const BUFFER_DURATION_S = 4;

/** Lowpass filter cutoff frequency in Hz. */
const FILTER_CUTOFF_HZ = 150;

/** Overall gain — extremely soft background hum. */
const MASTER_GAIN = 0.05;

/** Fade-in time in seconds to avoid clicks on start. */
const FADE_IN_S = 0.1;

/** Fade-out time in seconds for smooth cleanup. */
const FADE_OUT_S = 0.3;

/**
 * Plays a continuous cozy indoor room hum for the Playroom Hub.
 * Creates brown-noise-like ambience by lowpass-filtering pink noise at 150 Hz.
 * The output is extremely soft (gain ~0.05) and loops seamlessly.
 *
 * @param ctx - The Web Audio context
 * @param destination - The destination AudioNode to connect output to
 * @returns A cleanup function that fades out and stops the noise source
 */
export function playAmbHubRoomTone(ctx: AudioContext, destination: AudioNode): () => void {
  const now = ctx.currentTime;

  // Create a looping pink noise source
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createPinkNoiseBuffer(ctx, BUFFER_DURATION_S);
  noiseSource.loop = true;

  // Lowpass filter to create brown-noise-like room hum
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = FILTER_CUTOFF_HZ;

  // Master gain with gentle fade-in
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(MASTER_GAIN, now + FADE_IN_S);

  // Connect the chain
  noiseSource.connect(filter).connect(gainNode).connect(destination);
  noiseSource.start(now);

  let stopped = false;

  return () => {
    if (stopped) return;
    stopped = true;

    const stopTime = ctx.currentTime;
    gainNode.gain.setValueAtTime(MASTER_GAIN, stopTime);
    gainNode.gain.linearRampToValueAtTime(0, stopTime + FADE_OUT_S);

    try {
      noiseSource.stop(stopTime + FADE_OUT_S + 0.05);
    } catch {
      // Source may already be stopped
    }
  };
}
