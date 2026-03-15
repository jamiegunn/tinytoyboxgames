import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AudioState, AudioActions } from '@app/types/audio';
import {
  initEngine,
  setMuted as engineSetMuted,
  getSfxGain,
  crossfadeMusic,
  crossfadeAmbient,
  stopCategory,
  registerSound,
  unregisterSound,
  disposeEngine,
  getCtx,
} from '@app/assets/audio/utils/audioEngine';
import { SFX_REGISTRY, MUSIC_REGISTRY, AMBIENT_REGISTRY, getSceneAudio } from '@app/assets/audio';
import {
  registerSoundHandler,
  unregisterSoundHandler,
  registerMusicHandler,
  unregisterMusicHandler,
  registerStopMusicHandler,
  unregisterStopMusicHandler,
} from '@app/assets/audio/sceneBridge';

interface AudioContextValue extends AudioState, AudioActions {}

const AudioCtx = createContext<AudioContextValue | null>(null);

/**
 * Provides access to the audio system state and playback actions.
 *
 * @returns Combined audio state and actions from AudioProvider context.
 * @throws If called outside of an AudioProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}

/**
 * Manages the Web Audio context lifecycle, gesture-based unlock, global mute state,
 * and delegates playback to the procedural audio engine.
 * Audio is always optional — the app remains fully playable without sound.
 *
 * @param children - React children that consume audio context.
 * @returns A context provider wrapping the children.
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const musicStopRef = useRef<(() => void) | null>(null);
  const ambientStopRef = useRef<(() => void) | null>(null);

  // Unlock audio context on first user gesture and initialize engine
  useEffect(() => {
    const unlock = () => {
      if (audioCtxRef.current) return;
      try {
        const webAudioCtx = new AudioContext();
        audioCtxRef.current = webAudioCtx;
        initEngine(webAudioCtx);
        if (webAudioCtx.state === 'suspended') {
          webAudioCtx.resume().then(() => setIsAudioUnlocked(true));
        } else {
          setIsAudioUnlocked(true);
        }
      } catch {
        // Audio not available — app remains playable
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      disposeEngine();
    };
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      engineSetMuted(next);
      return next;
    });
  }, []);

  const playSound = useCallback((soundId: string) => {
    const ctx = getCtx();
    const dest = getSfxGain();
    if (!ctx || !dest) return;

    const synthFn = SFX_REGISTRY[soundId];
    if (!synthFn) return;

    const stopFn = () => {};
    registerSound(soundId, 'sfx', stopFn);
    try {
      synthFn(ctx, dest);
    } catch (e) {
      console.warn('[audio] SFX synthesis failed:', soundId, e);
    }
    // Auto-unregister after a generous timeout
    setTimeout(() => unregisterSound(stopFn), 5000);
  }, []);

  const playMusic = useCallback((soundId: string) => {
    const ctx = getCtx();
    if (!ctx) return;

    // Stop current music
    if (musicStopRef.current) {
      musicStopRef.current();
      musicStopRef.current = null;
    }

    const synthFn = MUSIC_REGISTRY[soundId];
    if (!synthFn) return;

    const fadeGain = crossfadeMusic();
    if (!fadeGain) return;

    try {
      const stop = synthFn(ctx, fadeGain);
      musicStopRef.current = stop;
      registerSound(soundId, 'music', stop);
    } catch (e) {
      console.warn('[audio] Music synthesis failed:', soundId, e);
    }
  }, []);

  const stopMusic = useCallback(() => {
    if (musicStopRef.current) {
      musicStopRef.current();
      musicStopRef.current = null;
    }
    stopCategory('music');
  }, []);

  const playAmbient = useCallback((soundId: string) => {
    const ctx = getCtx();
    if (!ctx) return;

    if (ambientStopRef.current) {
      ambientStopRef.current();
      ambientStopRef.current = null;
    }

    const synthFn = AMBIENT_REGISTRY[soundId];
    if (!synthFn) return;

    const fadeGain = crossfadeAmbient();
    if (!fadeGain) return;

    try {
      const stop = synthFn(ctx, fadeGain);
      ambientStopRef.current = stop;
      registerSound(soundId, 'ambient', stop);
    } catch (e) {
      console.warn('[audio] Ambient synthesis failed:', soundId, e);
    }
  }, []);

  const stopAmbient = useCallback(() => {
    if (ambientStopRef.current) {
      ambientStopRef.current();
      ambientStopRef.current = null;
    }
    stopCategory('ambient');
  }, []);

  const startSceneAudio = useCallback(
    (sceneName: string) => {
      const audio = getSceneAudio(sceneName);
      if (!audio) return;
      playMusic(audio.musicId);
      playAmbient(audio.ambientId);
    },
    [playMusic, playAmbient],
  );

  const stopSceneAudio = useCallback(() => {
    stopMusic();
    stopAmbient();
  }, [stopMusic, stopAmbient]);

  // Register the bridge so Three.js scenes can trigger sounds/music without React context
  useEffect(() => {
    registerSoundHandler(playSound);
    registerMusicHandler(playMusic);
    registerStopMusicHandler(stopMusic);
    return () => {
      unregisterSoundHandler();
      unregisterMusicHandler();
      unregisterStopMusicHandler();
    };
  }, [playSound, playMusic, stopMusic]);

  const value: AudioContextValue = {
    isAudioUnlocked,
    isMuted,
    toggleMute,
    playSound,
    playMusic,
    stopMusic,
    playAmbient,
    stopAmbient,
    startSceneAudio,
    stopSceneAudio,
  };

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
}
