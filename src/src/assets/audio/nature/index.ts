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
  const loopDuration = 16;

  // Gentle, flowing pentatonic melody (scale degree indices)
  const melodyPattern = [0, 2, 4, 3, 1, 0, 3, 2, 4, 1, 0, 2, 3, 4, 2, 0];
  // Long, legato rhythm
  const rhythmPattern = [1.5, 1, 1, 1.5, 1, 1.5, 1, 1, 1.5, 1, 1.5, 1, 1, 1.5, 1, 1.5];

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const playLoop = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    let offset = 0;
    for (let i = 0; i < melodyPattern.length; i++) {
      if (stopped) break;
      const noteTime = now + offset;
      const scaleIndex = melodyPattern[i];
      const freq = midiToFreq(D_PENTA[scaleIndex % D_PENTA.length]);
      const noteDur = beatDur * rhythmPattern[i];
      // Sine fundamental — flute body
      playTone(ctx, dest, 'sine', freq, 0.02, noteDur * 0.8, 0.12, noteTime);
      // Soft overtone for breathy quality
      playTone(ctx, dest, 'sine', freq * 2, 0.03, noteDur * 0.4, 0.03, noteTime);
      offset += noteDur;
    }
  };

  playLoop();
  intervalId = setInterval(playLoop, loopDuration * 1000);

  return () => {
    stopped = true;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
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
