/**
 * The ocean Pirate Cove floats on.
 *
 * This used to live inside `sceneShell`, next to the railings and the mast. It
 * does not belong there: the sea is not part of the ship, and putting it there
 * meant the only way to move the water was to move the hull with it.
 *
 * It is now built separately so the caller can parent it to the sea-and-sky
 * group that the ambient-motion rig rocks. See `../ambientMotion` for why the
 * water moves and the deck does not.
 */

import { Color, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';

/** Deck-relative height of the waterline, in world units. */
export const OCEAN_Y = -0.6;

/**
 * Half-extent of the sea plane in x and z, in world units.
 *
 * This is the scene's real opaque floor. The deck is the hull described in
 * `pirate-cove/hullPlan.ts` sitting on top of it — deliberately not restated
 * here as a width and a depth, which is how this comment came to describe a
 * "16x14 hull" that no longer existed. A view ray that misses the deck is not
 * looking at sky; it is looking at water, which is correct and is the whole
 * point of a ship. Ground-coverage checks assert against this plane at
 * {@link OCEAN_Y}, not against the hull. Exported so no test has to hardcode
 * `400 / 2`.
 */
export const OCEAN_HALF_EXTENT = 200;

/**
 * Builds the wide sea plane. The caller owns parenting and disposal.
 *
 * @returns The ocean mesh, not yet added to any parent.
 */
export function createOcean(): Mesh {
  const material = new MeshStandardMaterial({ color: new Color(0.16, 0.42, 0.56), roughness: 0.5, metalness: 0.12 });
  material.name = 'ship_oceanMat';
  const ocean = new Mesh(new PlaneGeometry(OCEAN_HALF_EXTENT * 2, OCEAN_HALF_EXTENT * 2), material);
  ocean.name = 'ship_ocean';
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = OCEAN_Y;
  ocean.receiveShadow = true;
  return ocean;
}
