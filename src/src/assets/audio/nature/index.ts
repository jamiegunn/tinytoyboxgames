/**
 * Nature World procedural audio modules.
 * All sounds are generated via Web Audio synthesis — no audio files.
 * Themed around serene enchanted forests: streams, mushrooms, butterflies, and leaves.
 */

import {
  playTone,
  playFilteredNoiseBurst,
  playFreqSweep,
  applyAR,
  createPinkNoiseBuffer,
  createNoiseBuffer,
  rand,
  midiToFreq,
  pentatonicScale,
} from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';

/** Minimum fade-in time in seconds to avoid clicks. */
const MIN_ATTACK_S = 0.005;

// D major pentatonic starting at D4 (MIDI 62)
const D_PENTA = pentatonicScale(62);

/**
 * Plays a serene, enchanted background melody for the Nature World.
 * Uses flute-like timbre (sine + soft overtone). D major pentatonic, very slow ~60bpm, loops ~16s.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A stop function that halts playback and cleans up resources
 */
export function playMusNatureBackground(ctx: AudioContext, dest: AudioNode): () => void {
  const bpm = 60;
  const beatDur = 60 / bpm;

  // Two-bar motif stated, then varied — repetition young ears can hold onto.
  const motif = [0, 2, 4, 3, 2, 0];
  const motifRhythm = [1.5, 1, 1.5, 1, 1.5, 2.5];
  const variation = [4, 3, 2, 4, 1, 0];
  const variationRhythm = [1.5, 1, 1.5, 1, 1.5, 2.5];

  const phrases: Array<{ degrees: number[]; rhythm: number[] }> = [
    { degrees: motif, rhythm: motifRhythm },
    { degrees: variation, rhythm: variationRhythm },
  ];

  // Cycle length derived from the actual scheduled content so the loop seam
  // is exact — the previous version overlapped itself every 16 seconds.
  const cycleSeconds = phrases.reduce((sum, p) => sum + p.rhythm.reduce((s, r) => s + r * beatDur, 0), 0);

  const scheduleCycle = (startTime: number) => {
    // Soft root-and-fifth drone under the whole cycle — the cheapest and most
    // idiomatic harmony for a pentatonic forest melody.
    const droneRoot = midiToFreq(D_PENTA[0] - 12);
    playTone(ctx, dest, 'sine', droneRoot, 1.2, cycleSeconds - 1.2, 0.05, startTime);
    playTone(ctx, dest, 'sine', droneRoot * 1.5, 1.6, cycleSeconds - 2.0, 0.03, startTime + 0.4);

    let offset = 0;
    for (const phrase of phrases) {
      for (let i = 0; i < phrase.degrees.length; i++) {
        const noteTime = startTime + offset;
        const freq = midiToFreq(D_PENTA[phrase.degrees[i] % D_PENTA.length]);
        const noteDur = beatDur * phrase.rhythm[i];
        // Sine fundamental — flute body
        playTone(ctx, dest, 'sine', freq, 0.02, noteDur * 0.8, 0.12, noteTime);
        // Soft overtone for breathy quality
        playTone(ctx, dest, 'sine', freq * 2, 0.03, noteDur * 0.4, 0.03, noteTime);
        offset += noteDur;
      }
    }
  };

  return startAudioLoop(ctx, cycleSeconds, scheduleCycle);
}

/**
 * Plays a babbling brook ambient for the Nature World.
 * Filtered noise layers: low rumble (200Hz lowpass) + high trickle (bandpass 3000Hz, Q=3,
 * with random gain modulation).
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A stop function that halts playback and cleans up resources
 */
export function playAmbNatureStream(ctx: AudioContext, dest: AudioNode): () => void {
  const bufferDuration = 4;

  // Layer 1: Low rumble
  const rumbleBuffer = createPinkNoiseBuffer(ctx, bufferDuration);
  const rumbleSource = ctx.createBufferSource();
  rumbleSource.buffer = rumbleBuffer;
  rumbleSource.loop = true;

  const rumbleLp = ctx.createBiquadFilter();
  rumbleLp.type = 'lowpass';
  rumbleLp.frequency.value = 200;
  rumbleLp.Q.value = 0.5;

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.1;

  rumbleSource.connect(rumbleLp).connect(rumbleGain).connect(dest);

  // Layer 2: High trickle
  const trickleBuffer = createNoiseBuffer(ctx, bufferDuration);
  const trickleSource = ctx.createBufferSource();
  trickleSource.buffer = trickleBuffer;
  trickleSource.loop = true;

  const trickleBp = ctx.createBiquadFilter();
  trickleBp.type = 'bandpass';
  trickleBp.frequency.value = 3000;
  trickleBp.Q.value = 3;

  const trickleGain = ctx.createGain();
  trickleGain.gain.value = 0.06;

  // Random gain modulation via LFO
  const trickleLfo = ctx.createOscillator();
  trickleLfo.type = 'sine';
  trickleLfo.frequency.value = 0.8;
  const trickleLfoGain = ctx.createGain();
  trickleLfoGain.gain.value = 0.03;
  trickleLfo.connect(trickleLfoGain).connect(trickleGain.gain);

  trickleSource.connect(trickleBp).connect(trickleGain).connect(dest);

  rumbleSource.start();
  trickleSource.start();
  trickleLfo.start();

  return () => {
    try {
      rumbleSource.stop();
      trickleSource.stop();
      trickleLfo.stop();
    } catch {
      // Already stopped
    }
    rumbleSource.disconnect();
    rumbleLp.disconnect();
    rumbleGain.disconnect();
    trickleSource.disconnect();
    trickleBp.disconnect();
    trickleGain.disconnect();
    trickleLfo.disconnect();
    trickleLfoGain.disconnect();
  };
}

/**
 * Plays a springy, rubbery mushroom bounce (boing) sound effect.
 * Sine sweep down from 600Hz to 200Hz in 200ms with a slight bounce re-trigger at 150ms.
 * Includes 3 variations via randomized parameters.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxNatureMushroomBounce(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const startFreq = 600 + rand(-80, 80);
  const endFreq = 200 + rand(-30, 30);

  // Main boing sweep
  playFreqSweep(ctx, dest, 'sine', startFreq, endFreq, MIN_ATTACK_S, 0.2, 0.18, now);
  // Bounce re-trigger (smaller, softer)
  playFreqSweep(ctx, dest, 'sine', startFreq * 0.7, endFreq * 0.8, MIN_ATTACK_S, 0.1, 0.08, now + 0.15);
}

/**
 * Plays a papery leaf flip sound effect.
 * Quick filtered noise at 2500Hz with 10ms attack, 150ms release.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxNatureLeafFlip(ctx: AudioContext, dest: AudioNode): void {
  playFilteredNoiseBurst(ctx, dest, 2500, 2, 0.01, 0.15, 0.12);
}

/**
 * Plays a gentle stream splash sound effect.
 * Pink noise burst through bandpass at 1500Hz, 300ms.
 * Includes 3 variations via randomized parameters.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxNatureStreamSplash(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const dur = 0.3;
  const freqVariation = rand(-200, 200);
  const pinkBuffer = createPinkNoiseBuffer(ctx, dur + 0.05);

  const source = ctx.createBufferSource();
  source.buffer = pinkBuffer;

  const bpFilter = ctx.createBiquadFilter();
  bpFilter.type = 'bandpass';
  bpFilter.frequency.value = 1500 + freqVariation;
  bpFilter.Q.value = 1.5 + rand(-0.3, 0.3);

  const env = ctx.createGain();
  applyAR(ctx, env, MIN_ATTACK_S, dur, now, 0.15);

  source.connect(bpFilter).connect(env).connect(dest);
  source.start(now);
  source.stop(now + dur + 0.05);
}

/**
 * Plays an airy butterfly wingbeat flutter sound effect.
 * Very soft high-pass noise at 4000Hz with tremolo (10Hz amplitude modulation), 300ms.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxNatureButterflyFlutter(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const dur = 0.3;
  const noiseBuffer = createNoiseBuffer(ctx, dur + 0.05);

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;

  const hpFilter = ctx.createBiquadFilter();
  hpFilter.type = 'highpass';
  hpFilter.frequency.value = 4000;
  hpFilter.Q.value = 0.5;

  // Tremolo: 10Hz amplitude modulation
  const tremGain = ctx.createGain();
  tremGain.gain.value = 0.06;

  const tremoloLfo = ctx.createOscillator();
  tremoloLfo.type = 'sine';
  tremoloLfo.frequency.value = 10;
  const tremoloDepth = ctx.createGain();
  tremoloDepth.gain.value = 0.04;
  tremoloLfo.connect(tremoloDepth).connect(tremGain.gain);

  const env = ctx.createGain();
  applyAR(ctx, env, MIN_ATTACK_S, dur, now, 0.08);

  source.connect(hpFilter).connect(tremGain).connect(env).connect(dest);
  tremoloLfo.start(now);
  tremoloLfo.stop(now + dur + 0.05);
  source.start(now);
  source.stop(now + dur + 0.05);
}

// ---------------------------------------------------------------------------
// ROUND 5 (2026-07-30). THE THREE VOICES THE SHARED LIBRARY COULD NOT SUPPLY.
//
// Round 5's charge was that every interactive prop in this scene answered a tap
// with `sfx_shared_tap_fallback` — the cue for a tap that hit nothing — while
// four sounds written for this scene's exact props sat in this file, registered
// and never called. Wiring those four was most of the fix. Four other props had
// nothing written for them at all: the flowers, the stones, the fireflies and
// the log.
//
// The flowers got a shared cue and needed no new synth: `sfx_shared_sparkle_burst`
// is four staggered tones cascading UPWARD out of a pentatonic pool, and the
// flower blooms its petals on a per-petal stagger, so the structure of the cue
// and the structure of the animation are the same shape. That is the good case
// for reaching into the shared library, and it is recorded here so the three
// below are not read as a house preference for bespoke work.
//
// The other three are here because the library's nearest candidates were wrong
// in ways that reading the docblock makes obvious, and each rejection is written
// down beside the sound that replaced it. The stones and the log needed
// materials — earth and hollow wood — that nothing in a shared catalogue built
// around chimes, pops and whooshes contains. The fireflies needed a cue that a
// child would NOT confuse with the one Round 4 gave the game portals.
// ---------------------------------------------------------------------------

/**
 * Plays a low, gritty stone shift — the sound of a rock being nudged aside in
 * soil. Duration: ~0.28s. A band-passed noise scrape whose filter falls from
 * 900 Hz to 300 Hz (the grit running out as the stone settles) over a soft
 * low sine thud (90 Hz) for the stone's own mass.
 *
 * REJECTED: `sfx_shared_chomp`. Acoustically it is close — a 300 Hz noise bite
 * over an 80 Hz thump is not far from a rock landing — but it is the shared
 * celebration cue for EATING, wired into `CelebrationSystem`, and a stone that
 * says "chomp" in the source is a trap for the next reader even if the child
 * cannot tell. REJECTED: `sfx_shared_pop`, which is a 900 Hz sine chirp; stones
 * do not chirp.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxNatureStoneShift(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const dur = 0.28;

  // The scrape: broadband grit, band-passed and swept downward.
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, dur + 0.05);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(900 + rand(-120, 120), now);
  bp.frequency.exponentialRampToValueAtTime(300, now + dur);

  const env = ctx.createGain();
  applyAR(ctx, env, MIN_ATTACK_S, dur, now, 0.13);

  source.connect(bp).connect(env).connect(dest);
  source.start(now);
  source.stop(now + dur + 0.05);

  // The mass: a soft low thud as it comes to rest, slightly after the scrape
  // starts so the two read as one event rather than a chord.
  playTone(ctx, dest, 'sine', 90 + rand(-8, 8), MIN_ATTACK_S, 0.12, 0.1, now + 0.04);
}

/**
 * Plays a hollow wooden knock — a knuckle on a fallen log. Duration: ~0.3s.
 * A short band-passed noise transient for the contact, a 165 Hz triangle body
 * tone for the wood, and a quiet fifth above it (~247 Hz) for the hollowness a
 * solid block would not have.
 *
 * REJECTED: `sfx_hub_toybox_tap`, whose own docblock says "wooden knock via
 * filtered noise burst" and which is therefore the closest thing in the whole
 * registry. It is rejected on identity rather than on timbre: it is a named
 * prop's voice, in use, and Round 4's rule is that a cue belonging to one prop
 * must not be handed to another — a child who taps the toybox and the log and
 * hears the same thing has been taught that the log is a toybox. It is also
 * pitched for a small crisp lid at 800-900 Hz, where a log is low and boomy.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxNatureLogKnock(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  const bodyFreq = 165 + rand(-12, 12);

  // Contact transient — the knuckle, not the wood.
  playFilteredNoiseBurst(ctx, dest, 1400, 2, MIN_ATTACK_S, 0.05, 0.09, now);

  // The wood itself: a fast-decaying low body tone.
  playTone(ctx, dest, 'triangle', bodyFreq, MIN_ATTACK_S, 0.22, 0.16, now);

  // The hollow: a quiet fifth, decaying faster than the body so it reads as
  // resonance rather than as a second note.
  playTone(ctx, dest, 'sine', bodyFreq * 1.5, MIN_ATTACK_S, 0.14, 0.05, now);
}

/**
 * Plays a tiny firefly twinkle — one very short, very high, very soft bell ping
 * that lifts slightly in pitch, like a light coming on. Duration: ~0.2s.
 * The pitch is drawn from the same C-major pentatonic pool as the shared
 * sparkle so fourteen fireflies tapped in a row stay consonant with each other
 * and with the scene's bed (audio-standards.md, "one musical family").
 *
 * REJECTED: `sfx_shared_chime`. It is the obvious pick and it is the dangerous
 * one — it is a near-twin of `sfx_shared_star_chime` (both draw a random tone
 * from the same C6/E6/G6 triad on a triangle with two harmonics above it), and
 * `sfx_shared_star_chime` is the voice Round 4 gave the GAME PORTALS. A firefly
 * that sounds like the door into a minigame is precisely the confusion soul.md's
 * Promise forbids, and it would have been bought at no saving at all.
 *
 * Deliberately the quietest cue in this bank (peak 0.07). There are fourteen
 * fireflies, they are small, and they drift within reach of each other.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxNatureFireflyTwinkle(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;
  // C major pentatonic from C7 up — above every other cue in the scene, so the
  // twinkle sits in its own register instead of competing with the flute bed.
  const pool = pentatonicScale(96);
  const base = midiToFreq(pool[Math.floor(rand(0, pool.length))]);

  // The lift: a small rise, not a sweep. A firefly brightens, it does not swoop.
  playFreqSweep(ctx, dest, 'sine', base, base * 1.12, MIN_ATTACK_S, 0.18, 0.07, now);
  // A single soft octave above for the glassy edge that makes it read as light.
  playTone(ctx, dest, 'sine', base * 2, MIN_ATTACK_S, 0.1, 0.02, now);
}
