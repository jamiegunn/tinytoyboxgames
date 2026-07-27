/**
 * Procedural audio synthesis functions for the Baby Shark mini-game.
 * All sounds are generated at runtime using the Web Audio API — no binary assets.
 */

/**
 * Plays a continuous gentle bubbling sound using staggered sine oscillators.
 * @param ctx - The Web Audio API AudioContext.
 * @returns Duration in seconds (0.6).
 */
function synthBubbleStream(ctx: AudioContext): number {
  const now = ctx.currentTime;
  const duration = 0.6;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.15;
  masterGain.connect(ctx.destination);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1000;
  lp.connect(masterGain);

  const oscCount = 3 + Math.floor(Math.random() * 3); // 3-5 oscillators
  for (let i = 0; i < oscCount; i++) {
    const freq = 200 + Math.random() * 600;
    const offset = (i / oscCount) * 0.5;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now + offset);
    env.gain.linearRampToValueAtTime(1, now + offset + 0.01);
    env.gain.linearRampToValueAtTime(0.3, now + offset + 0.01 + 0.1);
    env.gain.linearRampToValueAtTime(0, now + offset + 0.01 + 0.1 + 0.05);

    osc.connect(env).connect(lp);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);
  }

  return duration;
}

/**
 * Plays a satisfying bite/chomp sound with a noise burst and low-frequency thump.
 * @param ctx - The Web Audio API AudioContext.
 * @returns Duration in seconds (0.2).
 */
function synthSharkChomp(ctx: AudioContext): number {
  const now = ctx.currentTime;
  const duration = 0.2;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.3;
  masterGain.connect(ctx.destination);

  // Noise burst through band-pass
  const noiseBuffer = createNoise(ctx, 0.1);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 300;
  bp.Q.value = 2;

  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, now);
  noiseEnv.gain.linearRampToValueAtTime(1, now + 0.005);
  noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  noiseSrc.connect(bp).connect(noiseEnv).connect(masterGain);
  noiseSrc.start(now);
  noiseSrc.stop(now + 0.1);

  // Low sine thump
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 80;

  const thumpEnv = ctx.createGain();
  thumpEnv.gain.setValueAtTime(0, now + 0.03);
  thumpEnv.gain.linearRampToValueAtTime(1, now + 0.04);
  thumpEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(thumpEnv).connect(masterGain);
  osc.start(now + 0.03);
  osc.stop(now + 0.2);

  return duration;
}

/**
 * Plays a light water splash sound using filtered white noise with a frequency sweep.
 * @param ctx - The Web Audio API AudioContext.
 * @returns Duration in seconds (0.15).
 */
function synthFishSplash(ctx: AudioContext): number {
  const now = ctx.currentTime;
  const duration = 0.15;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.12;
  masterGain.connect(ctx.destination);

  const noiseBuffer = createNoise(ctx, 0.15);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(3000, now);
  hp.frequency.exponentialRampToValueAtTime(1000, now + 0.1);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(1, now + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  noiseSrc.connect(hp).connect(env).connect(masterGain);
  noiseSrc.start(now);
  noiseSrc.stop(now + 0.15);

  return duration;
}

/**
 * Plays a magical bell chime using harmonically related sine oscillators with long decay.
 * @param ctx - The Web Audio API AudioContext.
 * @returns Duration in seconds (1.0).
 */
function synthGoldenChime(ctx: AudioContext): number {
  const now = ctx.currentTime;
  const duration = 1.0;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.2;
  masterGain.connect(ctx.destination);

  const freqs = [880, 1320, 1760];
  const detunes = [-3, 0, 3];

  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freqs[i];
    osc.detune.value = detunes[i];

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.8 + 0.01);

    osc.connect(env).connect(masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  return duration;
}

/**
 * Plays an ascending tone that rises in pitch with combo level.
 * @param ctx - The Web Audio API AudioContext.
 * @param level - Combo level from 1 to 10; higher levels produce higher base pitch.
 * @returns Duration in seconds (0.2).
 */
function synthComboRise(ctx: AudioContext, level: number): number {
  const now = ctx.currentTime;
  const duration = 0.2;
  const clampedLevel = Math.max(1, Math.min(10, level));
  const baseFreq = 440 + clampedLevel * 60;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.18;
  masterGain.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq + 100, now + 0.15);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(1, now + 0.01);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.connect(env).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.22);

  return duration;
}

/**
 * Plays a whooshing wave arrival sound using band-pass filtered noise with a frequency sweep.
 * @param ctx - The Web Audio API AudioContext.
 * @returns Duration in seconds (0.5).
 */
function synthWaveArrival(ctx: AudioContext): number {
  const now = ctx.currentTime;
  const duration = 0.5;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.15;
  masterGain.connect(ctx.destination);

  const noiseBuffer = createNoise(ctx, 0.6);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.5;
  bp.frequency.setValueAtTime(200, now);
  bp.frequency.exponentialRampToValueAtTime(1000, now + 0.25);
  bp.frequency.exponentialRampToValueAtTime(200, now + 0.5);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(1, now + 0.05);
  env.gain.setValueAtTime(1, now + 0.35);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  noiseSrc.connect(bp).connect(env).connect(masterGain);
  noiseSrc.start(now);
  noiseSrc.stop(now + 0.6);

  return duration;
}

/**
 * Plays a layered underwater ambient pad with low oscillators, LFO modulation, and water texture noise.
 * @param ctx - The Web Audio API AudioContext.
 * @returns Duration in seconds (3.0).
 */
function synthUnderwaterAmbient(ctx: AudioContext): number {
  const now = ctx.currentTime;
  const duration = 3.0;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.08;
  masterGain.connect(ctx.destination);

  // Two low sine oscillators with LFO amplitude modulation
  const lowFreqs = [60, 90];
  for (const freq of lowFreqs) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.5;

    // LFO for amplitude modulation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.3 + Math.random() * 0.4;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;

    lfo.connect(lfoGain).connect(oscGain.gain);

    // Envelope for slow attack/release
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + 0.5);
    env.gain.setValueAtTime(1, now + duration - 0.5);
    env.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(oscGain).connect(env).connect(masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
    lfo.start(now);
    lfo.stop(now + duration + 0.05);
  }

  // Filtered noise layer for water texture
  const noiseBuffer = createNoise(ctx, duration + 0.1);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;

  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0, now);
  noiseEnv.gain.linearRampToValueAtTime(0.4, now + 0.5);
  noiseEnv.gain.setValueAtTime(0.4, now + duration - 0.5);
  noiseEnv.gain.linearRampToValueAtTime(0, now + duration);

  noiseSrc.connect(lp).connect(noiseEnv).connect(masterGain);
  noiseSrc.start(now);
  noiseSrc.stop(now + duration + 0.05);

  return duration;
}

/**
 * Plays a celebratory ascending 4-note arpeggio (C5-E5-G5-C6) using filtered square waves.
 * @param ctx - The Web Audio API AudioContext.
 * @returns Duration in seconds (0.7).
 */
function synthVictoryFanfare(ctx: AudioContext): number {
  const now = ctx.currentTime;
  const duration = 0.7;
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.22;
  masterGain.connect(ctx.destination);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2000;
  lp.connect(masterGain);

  const notes = [523, 659, 784, 1047];
  const noteLength = 0.15;
  const overlap = 0.03;

  for (let i = 0; i < notes.length; i++) {
    const noteStart = now + i * (noteLength - overlap);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = notes[i];

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, noteStart);
    env.gain.linearRampToValueAtTime(1, noteStart + 0.01);
    env.gain.setValueAtTime(1, noteStart + noteLength * 0.6);
    env.gain.exponentialRampToValueAtTime(0.001, noteStart + noteLength + 0.05);

    osc.connect(env).connect(lp);
    osc.start(noteStart);
    osc.stop(noteStart + noteLength + 0.1);
  }

  return duration;
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Creates a white noise AudioBuffer of the specified duration.
 * @param ctx - The Web Audio API AudioContext.
 * @param duration - Buffer length in seconds.
 * @returns A mono AudioBuffer filled with white noise samples.
 */
function createNoise(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all baby shark audio synthesis functions with the provided audio context.
 * Call once during game setup.
 * @param ctx - The Web Audio API AudioContext.
 * @returns A record mapping sound IDs to play functions. Each function plays the sound
 *          immediately and returns its duration in seconds.
 */
export function createSharkAudioBank(ctx: AudioContext): Record<string, () => number> {
  return {
    'bubble-stream': () => synthBubbleStream(ctx),
    'shark-chomp': () => synthSharkChomp(ctx),
    'fish-splash': () => synthFishSplash(ctx),
    'golden-chime': () => synthGoldenChime(ctx),
    'combo-rise': () => synthComboRise(ctx, 1),
    'wave-arrival': () => synthWaveArrival(ctx),
    'underwater-ambient': () => synthUnderwaterAmbient(ctx),
    'victory-fanfare': () => synthVictoryFanfare(ctx),
  };
}

/**
 * Creates a combo-rise play function bound to a specific combo level.
 * Use this when you need to vary the pitch based on the current combo.
 * @param ctx - The Web Audio API AudioContext.
 * @param level - Combo level from 1 to 10.
 * @returns Duration in seconds (0.2).
 */
export function playComboRise(ctx: AudioContext, level: number): number {
  return synthComboRise(ctx, level);
}
