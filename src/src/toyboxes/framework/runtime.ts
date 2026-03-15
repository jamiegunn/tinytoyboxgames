import type { Group } from 'three';
import { DEFAULT_TOYBOX_INTERACTION_OPTIONS } from './defaults';
import type { ToyboxInteractionOptions, ToyboxPlacement, ToyboxSpec } from './types';

/**
 * Merges scene-level interaction overrides with the shared toybox defaults.
 *
 * @param spec - Authored toybox specification for one scene-local toybox.
 * @returns Fully resolved interaction options for the runtime wiring layer.
 */
export function resolveToyboxInteractionOptions(spec: ToyboxSpec): ToyboxInteractionOptions {
  return {
    ...DEFAULT_TOYBOX_INTERACTION_OPTIONS,
    ...(spec.interaction ?? {}),
  };
}

/**
 * Applies scene placement after the variant builder's local offsets have been established.
 *
 * @param root - Root group returned by the toybox variant builder.
 * @param placement - Authored world placement for the toybox instance.
 */
export function applyToyboxPlacement(root: Group, placement: ToyboxPlacement): void {
  root.position.x += placement.x;
  root.position.y += placement.y;
  root.position.z += placement.z;
  root.rotation.y += placement.rotationY;

  if (placement.scale && placement.scale !== 1) {
    const offsetY = root.position.y - placement.y;
    root.position.y = placement.y + offsetY * placement.scale;
    root.scale.setScalar(placement.scale);
  }
}
