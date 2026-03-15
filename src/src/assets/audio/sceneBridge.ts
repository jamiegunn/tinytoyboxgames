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
  if (handler) handler(soundId);
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
