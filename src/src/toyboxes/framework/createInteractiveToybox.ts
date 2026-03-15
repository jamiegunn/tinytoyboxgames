import type { Group } from 'three';
import { buildToyboxVariant } from '@app/toyboxes/variants';
import { applyToyboxPlacement, resolveToyboxInteractionOptions } from './runtime';
import type { CreateInteractiveToyboxArgs, InteractiveToyboxHandle } from './types';
import { wireToyboxInteractions } from './wireToyboxInteractions';

/**
 * Marks every mesh in a toybox subtree as blocking the playroom's fallback floor tap.
 *
 * The playroom still uses one scene-level floor listener, so toyboxes need to
 * advertise that they consumed the click path before the floor handler moves
 * the owl elsewhere.
 *
 * @param root - Root object for the toybox being marked.
 * @param active - Whether floor-tap blocking should be enabled or removed.
 */
function setBlocksFloorTap(root: Group, active: boolean): void {
  root.traverse((object) => {
    if (active) {
      object.userData.blocksFloorTap = true;
    } else {
      delete object.userData.blocksFloorTap;
    }
  });
}

/**
 * Builds a toybox variant, adds it to the scene, and wires the shared interaction flow.
 *
 * @param args - Scene, runtime, owl, navigation, and authored toybox spec dependencies.
 * @returns A handle containing the toybox root and a cleanup function.
 */
export function createInteractiveToybox({ scene, canvas, camera, owl, nav, spec }: CreateInteractiveToyboxArgs): InteractiveToyboxHandle {
  const runtime = buildToyboxVariant(spec);
  applyToyboxPlacement(runtime.root, spec.placement);
  setBlocksFloorTap(runtime.root, true);
  scene.add(runtime.root);

  const interactionOptions = resolveToyboxInteractionOptions(spec);
  const dispose = wireToyboxInteractions({
    canvas,
    camera,
    runtime,
    destination: spec.destination,
    nav,
    owl,
    options: interactionOptions,
  });

  return {
    root: runtime.root,
    dispose: () => {
      setBlocksFloorTap(runtime.root, false);
      dispose();
    },
  };
}
