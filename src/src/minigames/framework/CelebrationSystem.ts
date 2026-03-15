import type { CelebrationIntensity, CelebrationSystem } from './types';

/** Maps celebration sound types to their procedural audio module IDs. */
const SOUND_MAP: Record<string, string> = {
  pop: 'sfx_shared_pop',
  chime: 'sfx_shared_chime',
  fanfare: 'sfx_shared_fanfare',
  whoosh: 'sfx_shared_whoosh',
  chomp: 'sfx_shared_chomp',
  splash: 'sfx_shared_splash',
};

/**
 * Creates a celebration system that triggers audio and visual feedback for player achievements.
 * Visual particle effects are stubbed and will be integrated when connected to a Babylon.js scene.
 * @param audioPlaySound - Function to play a sound effect by its procedural audio ID.
 * @returns A CelebrationSystem instance.
 */
export function createCelebrationSystem(audioPlaySound: (id: string) => void): CelebrationSystem {
  return {
    confetti(_screenX: number, _screenY: number, _intensity: CelebrationIntensity = 'medium'): void {
      // Visual particle burst will be added when integrated with Babylon.js scene
      audioPlaySound('sfx_shared_sparkle_burst');
    },

    celebrationSound(type: 'pop' | 'chime' | 'fanfare' | 'whoosh' | 'chomp' | 'splash'): void {
      const soundId = SOUND_MAP[type];
      if (soundId) {
        audioPlaySound(soundId);
      }
    },

    milestone(screenX: number, screenY: number, intensity: CelebrationIntensity = 'medium'): void {
      this.confetti(screenX, screenY, intensity);
      this.celebrationSound('fanfare');
    },
  };
}
