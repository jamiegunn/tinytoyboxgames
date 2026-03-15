import type { Group } from 'three';
import { Vector3 } from 'three';
import { startIdleLoop } from '@app/utils/animationHelpers';
import gsap from 'gsap';
import {
  STALK_SWAY_ANGLE,
  STALK_SWAY_BASE_DURATION,
  STALK_SWAY_SIDE_OFFSET,
  CRAWL_OFFSET_X,
  CRAWL_OFFSET_Z,
  CRAWL_MID_FRAME,
  CRAWL_FULL_FRAME,
} from './constants';

/**
 * Starts idle sway animation on an eye stalk group.
 * @param stalkGroup - The eye stalk group to animate.
 * @param side - Side multiplier (-1 or 1) used for timing offset.
 * @returns A cleanup function that kills the sway tween.
 */
export function startEyeStalkSway(stalkGroup: Group, side: number): () => void {
  const tween = gsap.to(stalkGroup.rotation, {
    x: STALK_SWAY_ANGLE,
    duration: STALK_SWAY_BASE_DURATION + side * STALK_SWAY_SIDE_OFFSET,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });
  return () => tween.kill();
}

/**
 * Starts the snail's idle crawl loop between home and a nearby offset.
 * @param root - The snail root group to animate.
 * @param homePosition - The snail's rest position.
 * @returns A cleanup function that stops the crawl loop.
 */
export function startCrawlLoop(root: Group, homePosition: Vector3): () => void {
  const crawlMidpoint = homePosition.clone().add(new Vector3(CRAWL_OFFSET_X, 0, CRAWL_OFFSET_Z));
  const handle = startIdleLoop(root, 'position', [
    { frame: 0, value: homePosition.clone() },
    { frame: CRAWL_MID_FRAME, value: crawlMidpoint },
    { frame: CRAWL_FULL_FRAME, value: homePosition.clone() },
  ]);
  return () => handle.stop();
}
