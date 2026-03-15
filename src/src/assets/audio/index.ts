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

// Hub
import { playMusHubBackground } from './hub/hubMusic';
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
};

/** Registry of looping music tracks keyed by sound ID. */
export const MUSIC_REGISTRY: Record<string, LoopFn> = {
  mus_hub_background: playMusHubBackground,
  mus_nature_background: playMusNatureBackground,
  mus_bubble_pop_background: playMusBubblePopBackground,
};

/** Registry of looping ambient beds keyed by sound ID. */
export const AMBIENT_REGISTRY: Record<string, LoopFn> = {
  amb_hub_room_tone: playAmbHubRoomTone,
  amb_nature_stream: playAmbNatureStream,
  amb_bubble_pop_night_sky: playAmbBubblePopNightSky,
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
