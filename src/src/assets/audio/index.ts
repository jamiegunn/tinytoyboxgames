/**
 * Sound registry — maps sound IDs from the design inventory to their
 * procedural synthesis functions. All sounds are runtime-generated via Web Audio.
 */

import { getSceneAudioDefinition } from '@app/scenes/sceneCatalog';

// Shared
import { playSfxSharedTapFallback, playSfxSharedButtonPress } from './shared/uiSounds';
import { playSfxSharedTransitionWhoosh, playSfxSharedTransitionArrive } from './shared/transitionSounds';
import { playSfxSharedOwlHoot, playSfxSharedOwlHappyChirp, playSfxSharedOwlPoint, playSfxSharedOwlSleepy } from './shared/owlSounds';
import { playSfxSharedSparkleBurst, playSfxSharedStarChime } from './shared/rewardSounds';
import {
  playSfxSharedPop,
  playSfxSharedChime,
  playSfxSharedFanfare,
  playSfxSharedWhoosh,
  playSfxSharedChomp,
  playSfxSharedSplash,
} from './shared/celebrationSounds';

// Hub
import { playMusHubBackground } from './hub/hubMusic';
import { playMusKitchenBackground } from './hub/kitchenMusic';
import { playMusLivingRoomBackground } from './hub/livingRoomMusic';
import { playAmbHubRoomTone } from './hub/hubAmbient';
import {
  playSfxHubToyboxTap,
  playSfxHubToyboxOpen,
  playSfxHubMusicPlayerTap,
  playSfxHubMusicPlayerTune,
  playSfxHubAmbientScurry,
  playSfxHubAmbientHop,
  playSfxHubTrainHorn,
  playSfxHubTrainChugga,
} from './hub/hubSfx';

// Nature
import {
  playMusNatureBackground,
  playAmbNatureStream,
  playSfxNatureMushroomBounce,
  playSfxNatureLeafFlip,
  playSfxNatureStreamSplash,
  playSfxNatureButterflyFlutter,
} from './nature';

// Bubble Pop
import {
  playSfxBubblePopPopSmall,
  playSfxBubblePopPopMedium,
  playSfxBubblePopPopLarge,
  playSfxBubblePopAppear,
  playSfxBubblePopChainPop,
  playSfxBubblePopTwinkle,
  playAmbBubblePopNightSky,
  playMusBubblePopBackground,
} from './bubblePop';

// Pirate Cove
import { playMusPirateCoveBackground, playAmbPirateCoveShore } from './pirateCove';

// Little Shark
import {
  playSfxSharkCoralBonk,
  playSfxSharkSeaweedRustle,
  playSfxSharkTreasureJingle,
  playSfxSharkWaterBloop,
  playSfxSharkCrabSkitter,
  playSfxSharkBarrelRoll,
  playSfxSharkGulp,
  playSfxSharkGoldenCatch,
  playSfxSharkHappy,
  playMusOceanAmbient,
  playMusLittleSharkBackground,
} from './games/littleShark';

// Cannonball Splash
import { playSfxCannonballFire, playMusCannonballSplashBackground } from './games/cannonballSplash';

// Per-game music beds
import { playMusFirefliesBackground } from './games/firefliesMusic';
import { playMusStarCatcherBackground } from './games/starCatcherMusic';

type SfxFn = (ctx: AudioContext, destination: AudioNode) => void;
type LoopFn = (ctx: AudioContext, destination: AudioNode) => () => void;

/** Registry of one-shot sound effects keyed by sound ID. */
export const SFX_REGISTRY: Record<string, SfxFn> = {
  // Shared UI
  sfx_shared_tap_fallback: playSfxSharedTapFallback,
  sfx_shared_button_press: playSfxSharedButtonPress,
  sfx_shared_transition_whoosh: playSfxSharedTransitionWhoosh,
  sfx_shared_transition_arrive: playSfxSharedTransitionArrive,
  // Shared Owl
  sfx_shared_owl_hoot: playSfxSharedOwlHoot,
  sfx_shared_owl_happy_chirp: playSfxSharedOwlHappyChirp,
  sfx_shared_owl_point: playSfxSharedOwlPoint,
  sfx_shared_owl_sleepy: playSfxSharedOwlSleepy,
  // Shared Rewards
  sfx_shared_sparkle_burst: playSfxSharedSparkleBurst,
  sfx_shared_star_chime: playSfxSharedStarChime,
  // Shared Celebrations (CelebrationSystem sound map)
  sfx_shared_pop: playSfxSharedPop,
  sfx_shared_chime: playSfxSharedChime,
  sfx_shared_fanfare: playSfxSharedFanfare,
  sfx_shared_whoosh: playSfxSharedWhoosh,
  sfx_shared_chomp: playSfxSharedChomp,
  sfx_shared_splash: playSfxSharedSplash,
  // Hub
  sfx_hub_toybox_tap: playSfxHubToyboxTap,
  sfx_hub_toybox_open: playSfxHubToyboxOpen,
  sfx_hub_music_player_tap: playSfxHubMusicPlayerTap,
  sfx_hub_music_player_tune: playSfxHubMusicPlayerTune,
  sfx_hub_ambient_scurry: playSfxHubAmbientScurry,
  sfx_hub_ambient_hop: playSfxHubAmbientHop,
  sfx_hub_train_horn: playSfxHubTrainHorn,
  sfx_hub_train_chugga: playSfxHubTrainChugga,
  // Nature
  sfx_nature_mushroom_bounce: playSfxNatureMushroomBounce,
  sfx_nature_leaf_flip: playSfxNatureLeafFlip,
  sfx_nature_stream_splash: playSfxNatureStreamSplash,
  sfx_nature_butterfly_flutter: playSfxNatureButterflyFlutter,
  // Bubble Pop
  sfx_bubble_pop_pop_small: playSfxBubblePopPopSmall,
  sfx_bubble_pop_pop_medium: playSfxBubblePopPopMedium,
  sfx_bubble_pop_pop_large: playSfxBubblePopPopLarge,
  sfx_bubble_pop_appear: playSfxBubblePopAppear,
  sfx_bubble_pop_chain_pop: playSfxBubblePopChainPop,
  sfx_bubble_pop_twinkle: playSfxBubblePopTwinkle,
  // Little Shark (IDs match the game's interaction call sites)
  'coral-bonk': playSfxSharkCoralBonk,
  'seaweed-rustle': playSfxSharkSeaweedRustle,
  'treasure-jingle': playSfxSharkTreasureJingle,
  'water-bloop': playSfxSharkWaterBloop,
  'crab-skitter': playSfxSharkCrabSkitter,
  'shark-barrel-roll': playSfxSharkBarrelRoll,
  'shark-gulp': playSfxSharkGulp,
  'golden-catch': playSfxSharkGoldenCatch,
  'shark-happy': playSfxSharkHappy,
  // Cannonball Splash
  sfx_cannonball_fire: playSfxCannonballFire,
};

/**
 * Registry of looping music tracks keyed by sound ID.
 *
 * Rule (docs/ai-guidance/audio-standards.md): every scene and every minigame
 * has its own music bed registered here. The music-coverage contract test
 * fails the suite if a scene or manifest entry points at a missing id.
 */
export const MUSIC_REGISTRY: Record<string, LoopFn> = {
  // Scenes
  mus_hub_background: playMusHubBackground,
  mus_kitchen_background: playMusKitchenBackground,
  mus_living_room_background: playMusLivingRoomBackground,
  mus_nature_background: playMusNatureBackground,
  mus_pirate_cove_background: playMusPirateCoveBackground,
  // Minigames
  mus_bubble_pop_background: playMusBubblePopBackground,
  mus_fireflies_background: playMusFirefliesBackground,
  mus_little_shark_background: playMusLittleSharkBackground,
  mus_star_catcher_background: playMusStarCatcherBackground,
  mus_cannonball_splash_background: playMusCannonballSplashBackground,
  // Shared default for freshly generated games, and back-compat aliases
  mus_shared_music_box: playMusHubBackground,
  'ocean-ambient': playMusOceanAmbient,
};

/** Registry of looping ambient beds keyed by sound ID. */
export const AMBIENT_REGISTRY: Record<string, LoopFn> = {
  amb_hub_room_tone: playAmbHubRoomTone,
  amb_nature_stream: playAmbNatureStream,
  amb_bubble_pop_night_sky: playAmbBubblePopNightSky,
  amb_pirate_cove_shore: playAmbPirateCoveShore,
};

/**
 * Maps a scene name to its music and ambient sound IDs.
 *
 * @param sceneName - The scene identifier (playroom, nature).
 * @returns Object with musicId and ambientId, or null if the scene has no audio.
 */
export function getSceneAudio(sceneName: string): { musicId: string; ambientId: string } | null {
  return getSceneAudioDefinition(sceneName);
}
