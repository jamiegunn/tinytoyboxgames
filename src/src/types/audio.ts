/** Read-only snapshot of the audio system state. */
export interface AudioState {
  /** True once the Web Audio context has been unlocked by a user gesture. */
  isAudioUnlocked: boolean;
  /** True when the user has toggled audio off via the UI. */
  isMuted: boolean;
}

/** Actions exposed by the AudioProvider for controlling audio playback. */
export interface AudioActions {
  /** Toggles the global mute state. */
  toggleMute: () => void;
  /** Triggers a one-shot procedural sound effect by identifier. */
  playSound: (soundId: string) => void;
  /** Starts looping background music by identifier, crossfading from any current track. */
  playMusic: (soundId: string) => void;
  /** Stops any currently playing background music. */
  stopMusic: () => void;
  /** Starts a looping ambient bed by identifier, crossfading from any current bed. */
  playAmbient: (soundId: string) => void;
  /** Stops any currently playing ambient bed. */
  stopAmbient: () => void;
  /** Starts both music and ambient for a scene by name, with crossfade. */
  startSceneAudio: (sceneName: string) => void;
  /** Stops all scene audio (music + ambient). */
  stopSceneAudio: () => void;
}
