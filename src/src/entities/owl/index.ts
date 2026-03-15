import { type Scene, type Vector3 } from 'three';
import { createOwlActions } from './actions';
import { buildOwl } from './build';
import { disposeOwl } from './dispose';
import { createOwlRuntimeDisposer } from './disposer';
import { startOwlIdle } from './idle';
import type { OwlCompanion, OwlCompanionOptions } from './types';

export type { OwlCompanion } from './types';

/**
 * Creates the owl companion and wires together geometry assembly, ambient idle
 * behavior, and explicit high-priority actions behind the existing public API.
 *
 * @param scene - The Three.js scene to build the owl in.
 * @param startPosition - Initial world-space position for the owl.
 * @param options - Optional scene-owned overrides for perch orientation and flight bounds.
 * @returns The companion handle with root, actions, and teardown.
 */
export function createOwlCompanion(scene: Scene, startPosition: Vector3, options: OwlCompanionOptions = {}): OwlCompanion {
  const runtime = createOwlRuntimeDisposer();
  const parts = buildOwl(scene, startPosition, options.restFacingY);
  const idle = startOwlIdle(parts, runtime);
  const actions = createOwlActions(scene, startPosition, parts, idle, runtime, options);

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    runtime.disposeAll();
    disposeOwl(parts);
  };

  return {
    root: parts.root,
    flyTo: actions.flyTo,
    tapReaction: actions.tapReaction,
    dispose,
  };
}
