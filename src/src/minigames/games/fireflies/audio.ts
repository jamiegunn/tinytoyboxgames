/**
 * Procedural audio for the Fireflies mini-game.
 *
 * - Pentatonic catch chimes (each catch plays a note; combos build chords)
 * - Ambient nighttime soundscape (crickets, wind) that layers with illumination tiers
 * - Tier transition ascending chimes
 * - Tap-empty-space sparkle sound
 *
 * All synthesis uses Web Audio API directly. Sounds route through the shared
 * audio engine when available, or create a standalone AudioContext.
 */

import { getCtx, getSfxGain } from '@app/assets/audio/utils/audioEngine';
import {
  playTone,
  playFilteredNoiseBurst,
  playFreqSweep,
  pentatonicScale,
  midiToFreq,
  rand,
  createPinkNoiseBuffer,
} from '@app/assets/audio/utils/synthHelpers';

// ── Pentatonic scale: C5 root for bright, bell-like chimes ──────────────────

/** MIDI notes for C5 pentatonic: C5(72), D5(74), E5(76), G5(79), A5(81). */
const PENTATONIC = pentatonicScale(72);

/** Frequencies pre-computed for the 5 pentatonic notes. */
const CHIME_FREQS = PENTATONIC.map(midiToFreq);

/** Perfect fifth interval (7 semitones up) for golden firefly. */
const GOLDEN_INTERVAL = 7;

// ── Ambient state ───────────────────────────────────────────────────────────

/** Target ambient volume per illumination tier (0-5). */
const AMBIENT_TIER_VOLUME = [0.0, 0.0, 0.02, 0.04, 0.06, 0.08];

/** Cricket chirp rate per tier (chirps per second). */
const CRICKET_RATE = [0, 0, 2, 4, 6, 8];

export interface FirefliesAudio {
  /** Play a catch chime — picks a random pentatonic note. */
  playCatchChime(): void;
  /** Play the golden firefly catch (root + fifth). */
  playGoldenCatch(): void;
  /** Play a soft sparkle for tapping empty space. */
  playTapSparkle(): void;
  /** Play ascending chime when illumination tier changes. */
  playTierTransition(newTier: number): void;
  /** Update ambient soundscape for current tier (call each frame). */
  updateAmbient(tier: number, deltaTime: number): void;
  /** Start the ambient soundscape loops. */
  start(): void;
  /** Stop and dispose all audio resources. */
  dispose(): void;
}

/**
 * Creates the fireflies audio system.
 *
 * @param isMuted - Function returning true when audio should be suppressed.
 * @returns A FirefliesAudio controller.
 */
export function createFirefliesAudio(isMuted: () => boolean): FirefliesAudio {
  let disposed = false;
  let ambientGain: GainNode | null = null;
  let windSource: AudioBufferSourceNode | null = null;
  let cricketTimer = 0;
  let currentAmbientVolume = 0;
  let lastTier = -1;

  /**
   * Gets the shared AudioContext, or null if unavailable.
   * @returns The shared AudioContext, or null.
   */
  function ctx(): AudioContext | null {
    return getCtx();
  }

  /**
   * Gets the SFX destination gain node.
   * @returns The SFX gain node, or null.
   */
  function dest(): AudioNode | null {
    return getSfxGain();
  }

  /**
   * Plays a bell-like chime at the given frequency.
   * Uses fundamental + 2nd and 3rd harmonics for richness.
   * @param frequency - Base frequency in Hz.
   * @param volume - Playback volume (0–1).
   * @param time - Optional AudioContext time to schedule playback.
   */
  function playBellChime(frequency: number, volume: number, time?: number): void {
    const c = ctx();
    const d = dest();
    if (!c || !d || isMuted()) return;

    const t = time ?? c.currentTime;
    // Fundamental
    playTone(c, d, 'sine', frequency, 0.008, 0.6, volume, t);
    // 2nd harmonic (octave above, softer)
    playTone(c, d, 'sine', frequency * 2, 0.008, 0.4, volume * 0.3, t);
    // 3rd harmonic (very subtle)
    playTone(c, d, 'sine', frequency * 3, 0.005, 0.25, volume * 0.1, t);
  }

  /** Plays a single cricket chirp (short filtered noise burst at high frequency). */
  function playCricketChirp(): void {
    const c = ctx();
    if (!c || !ambientGain || isMuted()) return;

    const freq = rand(4000, 6500);
    const t = c.currentTime + rand(0, 0.05);
    // Two rapid bursts = cricket chirp pattern
    playFilteredNoiseBurst(c, ambientGain, freq, 8, 0.003, 0.025, 0.06, t);
    playFilteredNoiseBurst(c, ambientGain, freq * 1.02, 8, 0.003, 0.025, 0.04, t + 0.04);
  }

  /** Starts the continuous low wind sound. */
  function startWind(): void {
    const c = ctx();
    if (!c || !ambientGain) return;

    const buffer = createPinkNoiseBuffer(c, 4.0);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;
    filter.Q.value = 0.5;

    const windGain = c.createGain();
    windGain.gain.value = 0.015;

    source.connect(filter).connect(windGain).connect(ambientGain);
    source.start();
    windSource = source;
  }

  return {
    playCatchChime(): void {
      if (isMuted()) return;
      const noteIdx = Math.floor(Math.random() * CHIME_FREQS.length);
      playBellChime(CHIME_FREQS[noteIdx], 0.12);
    },

    playGoldenCatch(): void {
      if (isMuted()) return;
      const c = ctx();
      if (!c) return;
      const t = c.currentTime;
      // Root note
      playBellChime(CHIME_FREQS[0], 0.15, t);
      // Perfect fifth, slightly delayed for shimmer
      const fifthFreq = midiToFreq(PENTATONIC[0] + GOLDEN_INTERVAL);
      playBellChime(fifthFreq, 0.12, t + 0.06);
    },

    playTapSparkle(): void {
      const c = ctx();
      const d = dest();
      if (!c || !d || isMuted()) return;

      const t = c.currentTime;
      // Soft crystalline tink — high sine with very short decay
      playTone(c, d, 'sine', rand(2800, 3500), 0.005, 0.12, 0.06, t);
      playTone(c, d, 'sine', rand(3500, 4200), 0.005, 0.08, 0.03, t + 0.02);
    },

    playTierTransition(newTier: number): void {
      const c = ctx();
      const d = dest();
      if (!c || !d || isMuted() || newTier <= 0) return;

      const t = c.currentTime;
      // Ascending arpeggio — play notes up to the tier number
      const notesToPlay = Math.min(newTier, CHIME_FREQS.length);
      for (let i = 0; i < notesToPlay; i++) {
        playBellChime(CHIME_FREQS[i], 0.08, t + i * 0.12);
      }
      // Final shimmer sweep
      playFreqSweep(c, d, 'sine', CHIME_FREQS[0], CHIME_FREQS[notesToPlay - 1] * 2, 0.01, 0.4, 0.04, t + notesToPlay * 0.12);
    },

    updateAmbient(tier: number, deltaTime: number): void {
      if (disposed || !ambientGain) return;

      // Smoothly interpolate ambient volume toward target
      const targetVol = isMuted() ? 0 : AMBIENT_TIER_VOLUME[Math.min(tier, 5)];
      currentAmbientVolume += (targetVol - currentAmbientVolume) * (1 - Math.exp(-deltaTime * 1.5));
      ambientGain.gain.value = currentAmbientVolume;

      // Play tier transition sound on tier change
      if (tier !== lastTier && lastTier >= 0 && tier > lastTier) {
        this.playTierTransition(tier);
      }
      lastTier = tier;

      // Cricket chirps — random timing based on tier rate
      const rate = CRICKET_RATE[Math.min(tier, 5)];
      if (rate > 0) {
        cricketTimer += deltaTime;
        const interval = 1.0 / rate + rand(-0.1, 0.1);
        if (cricketTimer >= interval) {
          cricketTimer = 0;
          playCricketChirp();
        }
      }
    },

    start(): void {
      const c = ctx();
      if (!c || disposed) return;

      // Create ambient gain node routed to SFX output
      const d = dest();
      if (!d) return;
      ambientGain = c.createGain();
      ambientGain.gain.value = 0;
      ambientGain.connect(d);

      startWind();
    },

    dispose(): void {
      disposed = true;
      if (windSource) {
        try {
          windSource.stop();
        } catch {
          /* already stopped */
        }
        windSource.disconnect();
        windSource = null;
      }
      if (ambientGain) {
        ambientGain.disconnect();
        ambientGain = null;
      }
    },
  };
}
