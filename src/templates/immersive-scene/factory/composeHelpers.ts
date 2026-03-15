/**
 * Shared composition helpers for the generated immersive scene.
 *
 * These helpers preserve the same composer contract used in Nature:
 *
 * - simple composers return a no-op dispose function
 * - interactive composers return one cleanup that tears down every handler they
 *   registered
 *
 * That consistency is valuable because it keeps `index.ts` stable as scenes
 * grow.
 */

import type { Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import type { ComposeContext } from '../types';

export type DisposeFn = () => void;

/** Shared no-op cleanup used by simple composers that register nothing. */
export const NOOP_DISPOSE: DisposeFn = () => {};

/**
 * Builds a collection of simple props from staging data.
 *
 * @typeParam TStaging - Placement or staging record type for the prop.
 * @param scene - Scene that should receive the built props.
 * @param staging - Immutable staging data for the prop family.
 * @param create - Builder for a single staged entry.
 * @returns A no-op cleanup to preserve the shared composer contract.
 */
export function composeCollection<TStaging>(
  scene: Scene,
  staging: readonly TStaging[],
  create: (scene: Scene, placement: TStaging) => void,
): DisposeFn {
  staging.forEach((entry) => create(scene, entry));
  return NOOP_DISPOSE;
}

/**
 * Builds a collection of interactive props and aggregates their cleanup paths.
 *
 * @typeParam TStaging - Placement or staging record type for the prop.
 * @typeParam TResult - Typed create result forwarded into interaction wiring.
 * @param ctx - Minimal compose context needed for interaction registration.
 * @param staging - Immutable staging data for the prop family.
 * @param create - Builder for one staged entry.
 * @param attach - Interaction wiring for one created entry.
 * @returns One cleanup function that unregisters every created interaction.
 */
export function composeInteractiveCollection<TStaging, TResult>(
  ctx: Pick<ComposeContext, 'scene' | 'dispatcher'>,
  staging: readonly TStaging[],
  create: (scene: Scene, placement: TStaging) => TResult,
  attach: (scene: Scene, dispatcher: WorldTapDispatcher, result: TResult) => DisposeFn | undefined,
): DisposeFn {
  const cleanups: DisposeFn[] = [];

  staging.forEach((entry) => {
    const result = create(ctx.scene, entry);
    const cleanup = attach(ctx.scene, ctx.dispatcher, result);
    if (cleanup) {
      cleanups.push(cleanup);
    }
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}
