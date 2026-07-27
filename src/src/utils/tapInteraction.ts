import { type Mesh } from 'three';
import type { WorldTapDispatcher } from '@app/utils/worldTapDispatcher';
import type { TapOptions } from '@app/utils/interaction/interactionController';

/**
 * Registers a tap interaction on a mesh via the centralized dispatcher
 * and returns a cleanup function.
 *
 * Overload for a guaranteed non-null tap target – returns `() => void`.
 *
 * @param dispatcher - The world tap dispatcher.
 * @param tapTarget - The mesh that must be hit for the tap to fire.
 * @param callback - The effect to run when a tap lands on the target.
 * @param opts - Optional per-registration behaviour (see {@link TapOptions}).
 * @returns A cleanup function that unregisters the tap handler.
 */
export function createTapInteraction(dispatcher: WorldTapDispatcher, tapTarget: Mesh, callback: () => void, opts?: TapOptions): () => void;

/**
 * Registers a tap interaction on an optional mesh, returning a cleanup
 * function or `undefined` when no tap target was found.
 *
 * @param dispatcher - The world tap dispatcher.
 * @param tapTarget - The mesh to register on, or `undefined`/`null` if absent.
 * @param callback - The effect to run when a tap lands on the target.
 * @param opts - Optional per-registration behaviour (see {@link TapOptions}).
 * @returns A cleanup function, or `undefined` if `tapTarget` was falsy.
 */
export function createTapInteraction(
  dispatcher: WorldTapDispatcher,
  tapTarget: Mesh | undefined | null,
  callback: () => void,
  opts?: TapOptions,
): (() => void) | undefined;

export function createTapInteraction(
  dispatcher: WorldTapDispatcher,
  tapTarget: Mesh | undefined | null,
  callback: () => void,
  opts?: TapOptions,
): (() => void) | undefined {
  if (!tapTarget) return undefined;
  return dispatcher.register(tapTarget, callback, opts);
}
