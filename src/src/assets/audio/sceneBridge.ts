/**
 * Lightweight bridge allowing Three.js scene code to trigger sound effects
 * and music without depending on React context. The AudioProvider registers
 * itself as the handler; scenes call `triggerSound` / `triggerMusic` directly.
 */

type SoundHandler = (soundId: string) => void;
type MusicHandler = (soundId: string) => void;
type StopMusicHandler = () => void;

let handler: SoundHandler | null = null;
let musicHandler: MusicHandler | null = null;
let stopMusicHandler: StopMusicHandler | null = null;

/**
 * Monotonic count of sound effects requested through this bridge.
 *
 * Exists so the InteractionController can enforce soul.md#6 ("Every Tap
 * Matters") without every tap handler having to remember it: the controller
 * samples this before firing a handler and again after, and plays the shared
 * fallback when the handler made no sound of its own. It counts REQUESTS, not
 * audible output, and deliberately so — it must tick even when the handler is
 * null (audio not yet armed) or the child has muted, because the question it
 * answers is "did this interaction try to speak", not "was anything heard".
 */
let soundRequests = 0;

/**
 * Registers the sound handler (called by AudioProvider on mount).
 *
 * @param fn - The sound handler callback to register.
 */
export function registerSoundHandler(fn: SoundHandler): void {
  handler = fn;
}

/** Unregisters the sound handler (called by AudioProvider on unmount). */
export function unregisterSoundHandler(): void {
  handler = null;
}

/**
 * Registers the music handler (called by AudioProvider on mount).
 *
 * @param fn - The music handler callback to register.
 */
export function registerMusicHandler(fn: MusicHandler): void {
  musicHandler = fn;
}

/** Unregisters the music handler (called by AudioProvider on unmount). */
export function unregisterMusicHandler(): void {
  musicHandler = null;
}

/**
 * Registers the stop music handler (called by AudioProvider on mount).
 *
 * @param fn - The stop-music handler callback to register.
 */
export function registerStopMusicHandler(fn: StopMusicHandler): void {
  stopMusicHandler = fn;
}

/** Unregisters the stop music handler (called by AudioProvider on unmount). */
export function unregisterStopMusicHandler(): void {
  stopMusicHandler = null;
}

/**
 * Triggers a one-shot sound effect from scene code.
 * Safe to call even when audio is not available — silently no-ops.
 *
 * @param soundId - The sound identifier from the design inventory.
 */
export function triggerSound(soundId: string): void {
  soundRequests += 1;
  if (handler) handler(soundId);
}

/**
 * Reads the monotonic sound-request counter.
 *
 * @returns The number of `triggerSound` calls made since load.
 */
export function soundsRequested(): number {
  return soundRequests;
}

/**
 * Starts looping music from scene code (e.g. record player interaction).
 * Safe to call even when audio is not available — silently no-ops.
 *
 * @param soundId - The music track identifier.
 */
export function triggerMusic(soundId: string): void {
  if (musicHandler) musicHandler(soundId);
}

/**
 * Stops currently playing music from scene code.
 * Safe to call even when audio is not available — silently no-ops.
 */
export function triggerStopMusic(): void {
  if (stopMusicHandler) stopMusicHandler();
}
