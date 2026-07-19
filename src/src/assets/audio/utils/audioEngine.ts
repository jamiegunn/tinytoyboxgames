/**
 * Core audio engine managing gain routing, polyphony limits, ducking,
 * and crossfade between music/ambient tracks.
 *
 * Gain chain: source → category gain → master gain → destination
 * Categories: music, ambient, sfx
 */

const MAX_SIMULTANEOUS = 8;
const MAX_SFX = 4;
const DUCK_AMOUNT = 0.35;
const DUCK_ATTACK = 0.08;
const DUCK_RELEASE = 0.4;
const CROSSFADE_DURATION = 1.5;

/** Base category levels. Music sits close enough to SFX to stay audible under taps. */
const MUSIC_LEVEL = 0.35;
const AMBIENT_LEVEL = 0.18;
const SFX_LEVEL = 0.45;

/** Reverb send levels per category (pre-fader sends into the shared convolver). */
const MUSIC_REVERB_SEND = 0.35;
const AMBIENT_REVERB_SEND = 0.12;
const SFX_REVERB_SEND = 0.18;

/** Generated impulse-response length in seconds. */
const REVERB_TAIL_S = 1.8;

interface ActiveSound {
  id: string;
  category: 'sfx' | 'music' | 'ambient';
  startTime: number;
  stop: () => void;
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let ambientGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let muted = false;
let currentMusicFadeGain: GainNode | null = null;
let currentAmbientFadeGain: GainNode | null = null;
const activeSounds: ActiveSound[] = [];

/**
 * Initializes the audio engine with the given AudioContext.
 *
 * @param audioContext - The Web Audio AudioContext to use.
 */
export function initEngine(audioContext: AudioContext): void {
  if (ctx === audioContext) return;
  ctx = audioContext;

  // Safety limiter: gentle bus compression protects small ears from
  // stacked simultaneous events (celebration + music + ambient + taps).
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 30;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  compressor.connect(ctx.destination);

  masterGain = ctx.createGain();
  masterGain.connect(compressor);

  musicGain = ctx.createGain();
  musicGain.gain.value = MUSIC_LEVEL;
  musicGain.connect(masterGain);

  ambientGain = ctx.createGain();
  ambientGain.gain.value = AMBIENT_LEVEL;
  ambientGain.connect(masterGain);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = SFX_LEVEL;
  sfxGain.connect(masterGain);

  // Shared generated-impulse reverb. One convolver fed by per-category sends
  // gives every dry synth voice a soft, cohesive space at negligible cost.
  try {
    const convolver = ctx.createConvolver();
    convolver.buffer = createReverbImpulse(ctx, REVERB_TAIL_S);
    convolver.connect(masterGain);
    connectReverbSend(musicGain, convolver, MUSIC_REVERB_SEND);
    connectReverbSend(ambientGain, convolver, AMBIENT_REVERB_SEND);
    connectReverbSend(sfxGain, convolver, SFX_REVERB_SEND);
  } catch {
    // Reverb is a polish layer — the app remains fully audible without it.
  }
}

/**
 * Connects a post-category reverb send into the shared convolver.
 *
 * @param source - The category gain node to tap.
 * @param convolver - The shared ConvolverNode.
 * @param level - Send level (0-1).
 */
function connectReverbSend(source: GainNode, convolver: ConvolverNode, level: number): void {
  if (!ctx) return;
  const send = ctx.createGain();
  send.gain.value = level;
  source.connect(send);
  send.connect(convolver);
}

/**
 * Generates a stereo exponentially-decaying noise impulse response.
 *
 * @param audioContext - The AudioContext used to allocate the buffer.
 * @param seconds - Tail length in seconds.
 * @returns A stereo AudioBuffer suitable for a ConvolverNode.
 */
function createReverbImpulse(audioContext: AudioContext, seconds: number): AudioBuffer {
  const rate = audioContext.sampleRate;
  const length = Math.ceil(rate * seconds);
  const impulse = audioContext.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  return impulse;
}

/**
 * Returns the underlying AudioContext, or null if not initialized.
 *
 * @returns The AudioContext, or null if the engine has not been initialized.
 */
export function getCtx(): AudioContext | null {
  return ctx;
}

/**
 * Returns the master gain node.
 *
 * @returns The master GainNode, or null if not initialized.
 */
export function getMasterGain(): GainNode | null {
  return masterGain;
}

/**
 * Returns the music gain node.
 *
 * @returns The music GainNode, or null if not initialized.
 */
export function getMusicGain(): GainNode | null {
  return musicGain;
}

/**
 * Returns the ambient gain node.
 *
 * @returns The ambient GainNode, or null if not initialized.
 */
export function getAmbientGain(): GainNode | null {
  return ambientGain;
}

/**
 * Returns the SFX gain node.
 *
 * @returns The SFX GainNode, or null if not initialized.
 */
export function getSfxGain(): GainNode | null {
  return sfxGain;
}

/**
 * Sets the global mute state. When muted, master gain drops to 0.
 *
 * @param value - Whether to mute the engine.
 */
export function setMuted(value: boolean): void {
  muted = value;
  if (!masterGain || !ctx) return;
  const t = ctx.currentTime;
  masterGain.gain.setTargetAtTime(value ? 0 : 1, t, 0.02);
}

/**
 * Returns true if the engine is currently muted.
 *
 * @returns Whether the engine is muted.
 */
export function isMuted(): boolean {
  return muted;
}

/**
 * Registers an active sound for polyphony tracking.
 * Returns false if the polyphony limit is exceeded and the sound should not play.
 *
 * @param id - Unique identifier for the sound.
 * @param category - The sound category (sfx, music, or ambient).
 * @param stopFn - Callback to stop the sound when evicted.
 * @returns Whether the sound was successfully registered.
 */
export function registerSound(id: string, category: 'sfx' | 'music' | 'ambient', stopFn: () => void): boolean {
  // Clean up finished sounds (rough heuristic: older than 30s for SFX)
  pruneFinished();

  const sfxCount = activeSounds.filter((s) => s.category === 'sfx').length;
  const totalCount = activeSounds.length;

  if (category === 'sfx' && sfxCount >= MAX_SFX) {
    // Drop oldest non-looping SFX
    const oldest = activeSounds.find((s) => s.category === 'sfx');
    if (oldest) {
      oldest.stop();
      activeSounds.splice(activeSounds.indexOf(oldest), 1);
    }
  } else if (totalCount >= MAX_SIMULTANEOUS) {
    const oldest = activeSounds.find((s) => s.category === 'sfx');
    if (oldest) {
      oldest.stop();
      activeSounds.splice(activeSounds.indexOf(oldest), 1);
    }
  }

  activeSounds.push({
    id,
    category,
    startTime: ctx?.currentTime ?? 0,
    stop: stopFn,
  });
  return true;
}

/**
 * Removes a sound from the active tracking list.
 *
 * @param stopFn - The stop callback used when the sound was registered.
 */
export function unregisterSound(stopFn: () => void): void {
  const idx = activeSounds.findIndex((s) => s.stop === stopFn);
  if (idx !== -1) activeSounds.splice(idx, 1);
}

/**
 * Stops all sounds of a given category.
 *
 * @param category - The sound category to stop.
 */
export function stopCategory(category: 'sfx' | 'music' | 'ambient'): void {
  const toStop = activeSounds.filter((s) => s.category === category);
  for (const s of toStop) {
    s.stop();
    const idx = activeSounds.indexOf(s);
    if (idx !== -1) activeSounds.splice(idx, 1);
  }
}

/** Ducks music and ambient volumes briefly (for prominent SFX). */
export function duck(): void {
  if (!ctx || !musicGain || !ambientGain) return;
  const t = ctx.currentTime;
  musicGain.gain.setTargetAtTime(MUSIC_LEVEL * DUCK_AMOUNT, t, DUCK_ATTACK);
  ambientGain.gain.setTargetAtTime(AMBIENT_LEVEL * DUCK_AMOUNT, t, DUCK_ATTACK);
  musicGain.gain.setTargetAtTime(MUSIC_LEVEL, t + DUCK_ATTACK + 0.2, DUCK_RELEASE);
  ambientGain.gain.setTargetAtTime(AMBIENT_LEVEL, t + DUCK_ATTACK + 0.2, DUCK_RELEASE);
}

/**
 * Fades the current music bed to silence and releases its fade gain.
 * Unlike a bare stop, this also silences notes that were already scheduled
 * into the audio graph (loops schedule a full cycle ahead, so up to several
 * seconds of audio would otherwise keep ringing).
 *
 * @param fadeDuration - Fade-out duration in seconds.
 */
export function fadeOutMusic(fadeDuration = 0.8): void {
  fadeOutAndDisconnect(currentMusicFadeGain, fadeDuration);
  currentMusicFadeGain = null;
}

/**
 * Fades the current ambient bed to silence and releases its fade gain.
 *
 * @param fadeDuration - Fade-out duration in seconds.
 */
export function fadeOutAmbient(fadeDuration = 0.8): void {
  fadeOutAndDisconnect(currentAmbientFadeGain, fadeDuration);
  currentAmbientFadeGain = null;
}

/**
 * Crossfades from the current music to a new music synthesis function.
 * The old music fades out while the new fades in over CROSSFADE_DURATION.
 *
 * @param fadeDuration - Duration of the crossfade in seconds.
 * @returns A new GainNode for the incoming music, or null if unavailable.
 */
export function crossfadeMusic(fadeDuration = CROSSFADE_DURATION): GainNode | null {
  if (!ctx || !musicGain) return null;
  const t = ctx.currentTime;

  // Stop all tracked music loops, then genuinely fade the old bed out.
  // Notes already scheduled into the old fade gain ring out under the ramp
  // instead of being cut by an instant disconnect (which clicks audibly).
  stopCategory('music');
  fadeOutAndDisconnect(currentMusicFadeGain, fadeDuration);
  currentMusicFadeGain = null;

  // Create a sub-gain for the new music that fades in
  const fadeIn = ctx.createGain();
  fadeIn.gain.setValueAtTime(0, t);
  fadeIn.gain.linearRampToValueAtTime(1, t + fadeDuration);
  fadeIn.connect(musicGain);
  currentMusicFadeGain = fadeIn;
  return fadeIn;
}

/**
 * Ramps an outgoing fade gain to silence, then disconnects it after the ramp.
 *
 * @param fadeGain - The outgoing gain node (may be null).
 * @param fadeDuration - Fade-out duration in seconds.
 */
function fadeOutAndDisconnect(fadeGain: GainNode | null, fadeDuration: number): void {
  if (!fadeGain || !ctx) return;
  const t = ctx.currentTime;
  try {
    fadeGain.gain.cancelScheduledValues(t);
    fadeGain.gain.setValueAtTime(fadeGain.gain.value, t);
    fadeGain.gain.linearRampToValueAtTime(0, t + fadeDuration);
    setTimeout(
      () => {
        try {
          fadeGain.disconnect();
        } catch {
          /* already disconnected */
        }
      },
      (fadeDuration + 0.1) * 1000,
    );
  } catch {
    try {
      fadeGain.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}

/**
 * Crossfades ambient bed similarly to music crossfade.
 *
 * @param fadeDuration - Duration of the crossfade in seconds.
 * @returns A new GainNode for the incoming ambient track, or null if unavailable.
 */
export function crossfadeAmbient(fadeDuration = CROSSFADE_DURATION): GainNode | null {
  if (!ctx || !ambientGain) return null;
  const t = ctx.currentTime;

  stopCategory('ambient');
  fadeOutAndDisconnect(currentAmbientFadeGain, fadeDuration);
  currentAmbientFadeGain = null;

  const fadeIn = ctx.createGain();
  fadeIn.gain.setValueAtTime(0, t);
  fadeIn.gain.linearRampToValueAtTime(1, t + fadeDuration);
  fadeIn.connect(ambientGain);
  currentAmbientFadeGain = fadeIn;
  return fadeIn;
}

/** Cleans up the engine on app teardown. */
export function disposeEngine(): void {
  for (const s of activeSounds) {
    try {
      s.stop();
    } catch {
      /* noop */
    }
  }
  activeSounds.length = 0;
  if (currentMusicFadeGain) {
    try {
      currentMusicFadeGain.disconnect();
    } catch {
      /* noop */
    }
  }
  if (currentAmbientFadeGain) {
    try {
      currentAmbientFadeGain.disconnect();
    } catch {
      /* noop */
    }
  }
  currentMusicFadeGain = null;
  currentAmbientFadeGain = null;
  ctx = null;
  masterGain = null;
  musicGain = null;
  ambientGain = null;
  sfxGain = null;
}

function pruneFinished(): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  // Remove SFX older than 10 seconds (they're short one-shots)
  for (let i = activeSounds.length - 1; i >= 0; i--) {
    if (activeSounds[i].category === 'sfx' && now - activeSounds[i].startTime > 10) {
      activeSounds.splice(i, 1);
    }
  }
}
