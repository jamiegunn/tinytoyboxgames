import type { Scene } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import type { ComposeContext } from '@scenes/immersive-toybox-scenes/naturescene/types';

export type DisposeFn = () => void;
export const NOOP_DISPOSE: DisposeFn = () => {};

/**
 * Builds every entry in a staging array by forwarding each to the given
 * factory. Intended for simple (non-interactive) prop composers that
 * produce no cleanup obligations.
 *
 * @typeParam TStaging - The placement/staging record type for this entity.
 * @param scene - The Three.js scene that receives the created entities.
 * @param staging - Immutable array of placement entries to instantiate.
 * @param create - Factory that builds a single entity into the scene.
 * @returns A no-op dispose function so all composers share one contract.
 */
export function composeCollection<TStaging>(scene: Scene, staging: readonly TStaging[], create: (scene: Scene, placement: TStaging) => void): DisposeFn {
  staging.forEach((entry) => create(scene, entry));
  return NOOP_DISPOSE;
}

/**
 * Builds every entry in a staging array and wires each to a tap
 * interaction via the supplied {@link attach} callback. Returns a
 * single dispose function that tears down every registered listener.
 *
 * @typeParam TStaging - The placement/staging record type for this entity.
 * @typeParam TResult  - The value returned by the entity factory, forwarded
 *                       to {@link attach} for interaction wiring.
 * @param ctx     - Scene and dispatcher needed for tap registration.
 * @param staging - Immutable array of placement entries to instantiate.
 * @param create  - Factory that builds a single entity and returns the
 *                  result needed by {@link attach}.
 * @param attach  - Registers tap interaction for one entity. May return
 *                  `undefined` when the entity has no valid tap target.
 * @returns A dispose function that removes all registered tap listeners.
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
    if (cleanup) cleanups.push(cleanup);
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}
