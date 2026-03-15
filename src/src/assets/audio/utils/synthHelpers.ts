/**
 * Shared Web Audio synthesis primitives used by all procedural audio modules.
 * Provides envelope shaping, noise generation, oscillator factories, and frequency utilities.
 */

/**
 * Applies an ADSR amplitude envelope to a GainNode.
 *
 * @param _ctx - The AudioContext (unused, reserved for future use).
 * @param gain - The GainNode to shape.
 * @param attack - Attack time in seconds.
 * @param decay - Decay time in seconds.
 * @param sustain - Sustain level (0–1).
 * @param release - Release time in seconds.
 * @param startTime - AudioContext time to begin the envelope.
 * @param duration - Total envelope duration in seconds.
 * @param peakGain - Peak amplitude during attack.
 */
export function applyEnvelope(
  _ctx: AudioContext,
  gain: GainNode,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  startTime: number,
  duration: number,
  peakGain = 1.0,
): void {
  const g = gain.gain;
  g.setValueAtTime(0, startTime);
  g.linearRampToValueAtTime(peakGain, startTime + attack);
  g.linearRampToValueAtTime(peakGain * sustain, startTime + attack + decay);
  g.setValueAtTime(peakGain * sustain, startTime + duration - release);
  g.linearRampToValueAtTime(0, startTime + duration);
}

/**
 * Applies a simple attack-release envelope (no sustain phase).
 *
 * @param _ctx - The AudioContext (unused, reserved for future use).
 * @param gain - The GainNode to shape.
 * @param attack - Attack time in seconds.
 * @param release - Release time in seconds.
 * @param startTime - AudioContext time to begin the envelope.
 * @param peakGain - Peak amplitude during attack.
 */
export function applyAR(_ctx: AudioContext, gain: GainNode, attack: number, release: number, startTime: number, peakGain = 1.0): void {
  const g = gain.gain;
  g.setValueAtTime(0, startTime);
  g.linearRampToValueAtTime(peakGain, startTime + attack);
  g.exponentialRampToValueAtTime(0.001, startTime + attack + release);
}

/**
 * Creates a white noise AudioBuffer of the given duration.
 *
 * @param ctx - The AudioContext for buffer creation.
 * @param duration - Buffer duration in seconds.
 * @returns A mono AudioBuffer filled with white noise.
 */
export function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Creates a pink noise AudioBuffer (lower frequencies boosted).
 *
 * @param ctx - The AudioContext for buffer creation.
 * @param duration - Buffer duration in seconds.
 * @returns A mono AudioBuffer filled with pink noise.
 */
export function createPinkNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

/**
 * Plays a noise burst through a bandpass filter with envelope.
 *
 * @param ctx - The AudioContext.
 * @param destination - The AudioNode to route output to.
 * @param frequency - Centre frequency of the bandpass filter in Hz.
 * @param q - Q factor of the bandpass filter.
 * @param attack - Attack time in seconds.
 * @param release - Release time in seconds.
 * @param gain - Peak gain of the burst.
 * @param startTime - Optional AudioContext time to schedule the burst.
 */
export function playFilteredNoiseBurst(
  ctx: AudioContext,
  destination: AudioNode,
  frequency: number,
  q: number,
  attack: number,
  release: number,
  gain: number,
  startTime?: number,
): void {
  const t = startTime ?? ctx.currentTime;
  const dur = attack + release;
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, dur + 0.05);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = q;

  const env = ctx.createGain();
  applyAR(ctx, env, attack, release, t, gain);

  source.connect(filter).connect(env).connect(destination);
  source.start(t);
  source.stop(t + dur + 0.05);
}

/**
 * Creates a simple oscillator with envelope, auto-disconnects after playing.
 *
 * @param ctx - The AudioContext.
 * @param destination - The AudioNode to route output to.
 * @param type - Oscillator waveform type.
 * @param frequency - Oscillator frequency in Hz.
 * @param attack - Attack time in seconds.
 * @param release - Release time in seconds.
 * @param gain - Peak gain of the tone.
 * @param startTime - Optional AudioContext time to schedule the tone.
 * @param detune - Optional detune in cents.
 * @returns The created OscillatorNode.
 */
export function playTone(
  ctx: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  frequency: number,
  attack: number,
  release: number,
  gain: number,
  startTime?: number,
  detune?: number,
): OscillatorNode {
  const t = startTime ?? ctx.currentTime;
  const dur = attack + release;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  if (detune) osc.detune.value = detune;

  const env = ctx.createGain();
  applyAR(ctx, env, attack, release, t, gain);

  osc.connect(env).connect(destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  return osc;
}

/**
 * Plays a frequency sweep (glissando) from startFreq to endFreq.
 *
 * @param ctx - The AudioContext.
 * @param destination - The AudioNode to route output to.
 * @param type - Oscillator waveform type.
 * @param startFreq - Starting frequency in Hz.
 * @param endFreq - Ending frequency in Hz.
 * @param attack - Attack time in seconds.
 * @param release - Release time in seconds.
 * @param gain - Peak gain of the sweep.
 * @param startTime - Optional AudioContext time to schedule the sweep.
 */
export function playFreqSweep(
  ctx: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  startFreq: number,
  endFreq: number,
  attack: number,
  release: number,
  gain: number,
  startTime?: number,
): void {
  const t = startTime ?? ctx.currentTime;
  const dur = attack + release;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);

  const env = ctx.createGain();
  applyAR(ctx, env, attack, release, t, gain);

  osc.connect(env).connect(destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/**
 * Converts a MIDI note number to frequency in Hz.
 *
 * @param note - MIDI note number (0–127).
 * @returns Frequency in Hz.
 */
export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Returns a musical scale as MIDI note numbers starting from the given root.
 *
 * @param root - MIDI note number of the root note.
 * @returns Array of MIDI note numbers in the major scale.
 */
export function majorScale(root: number): number[] {
  const intervals = [0, 2, 4, 5, 7, 9, 11];
  return intervals.map((i) => root + i);
}

/**
 * Returns a pentatonic scale as MIDI note numbers.
 *
 * @param root - MIDI note number of the root note.
 * @returns Array of MIDI note numbers in the pentatonic scale.
 */
export function pentatonicScale(root: number): number[] {
  const intervals = [0, 2, 4, 7, 9];
  return intervals.map((i) => root + i);
}

/**
 * Picks a random element from an array.
 *
 * @param arr - The source array.
 * @returns A randomly selected element.
 */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns a random float between min and max.
 *
 * @param min - Minimum value (inclusive).
 * @param max - Maximum value (exclusive).
 * @returns A random float in the range [min, max).
 */
export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
