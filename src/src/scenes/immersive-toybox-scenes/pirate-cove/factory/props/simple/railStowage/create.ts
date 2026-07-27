/**
 * Builds one run of rail stowage: a pair of spare spars chocked and lashed
 * along the inboard face of a side rail.
 *
 * The run is derived from `hullHalfWidthAt`, never from restated hull numbers,
 * so the stowage follows the rail it is lashed to by construction. It is a
 * straight chord between its two stations because a spar is rigid — where the
 * hull kinks at maximum beam the spar lies across the kink, which is what a spar
 * actually does.
 */

import { BoxGeometry, CylinderGeometry, Group, Mesh, TorusGeometry, type Scene } from 'three';
import type { PirateCoveMaterials } from '../../../../materials';
import { hullHalfWidthAt } from '../../../../hullPlan';
import { CHOCK_HALF_WIDTH, CHOCK_HEIGHT, CHOCK_LENGTH, CHOCK_SPACING, LASHING_SPACING, LASHING_TUBE, SPAR_RADIUS } from './constants';

/** One run of spare spars lashed along a side rail. */
export interface RailStowageRun {
  /** -1 for the port rail, +1 for the starboard rail. */
  side: -1 | 1;
  /** Aft end of the run, in world z. */
  zAft: number;
  /** Forward end of the run, in world z. */
  zFwd: number;
  /** How far inboard of the rail line the spars are chocked. */
  inset: number;
}

/** Shared dependencies required to build one stowage run. */
export interface RailStowageBuildOptions {
  materials: Pick<PirateCoveMaterials, 'weatheredWood' | 'shellTrim' | 'rope'>;
}

/**
 * Creates one staged run of rail stowage.
 *
 * @param scene - Scene that should receive the stowage.
 * @param run - Which rail, and which stretch of it, to stow along.
 * @param options - Shared materials.
 * @returns The root group for the run.
 */
export function createRailStowage(scene: Scene, run: RailStowageRun, options: RailStowageBuildOptions): Group {
  const root = new Group();
  root.name = 'rail_stowage';
  scene.add(root);

  const halfAft = hullHalfWidthAt(run.zAft);
  const halfFwd = hullHalfWidthAt(run.zFwd);
  // Off the ends of the hull there is no rail to stow against, so there is
  // nothing to build. Returning an empty root keeps the caller's dispose path
  // uniform rather than making every call site test for null.
  if (halfAft === null || halfFwd === null) return root;

  const xAft = run.side * (halfAft - run.inset);
  const xFwd = run.side * (halfFwd - run.inset);
  const dx = xFwd - xAft;
  const dz = run.zFwd - run.zAft;
  const length = Math.hypot(dx, dz);
  if (length <= 0) return root;

  // The group's local +z runs along the stowage, so everything inside is
  // authored in run coordinates: local z is distance along the run, local x is
  // offboard/inboard across it.
  root.position.set((xAft + xFwd) / 2, 0, (run.zAft + run.zFwd) / 2);
  root.rotation.y = Math.atan2(dx, dz);

  const sparY = CHOCK_HEIGHT + SPAR_RADIUS;
  const sparOffset = SPAR_RADIUS * 1.06;

  for (const lateral of [-sparOffset, sparOffset]) {
    const spar = new Mesh(new CylinderGeometry(SPAR_RADIUS, SPAR_RADIUS * 0.88, length, 10), options.materials.weatheredWood);
    spar.name = 'stowed_spar';
    // A cylinder is built along +y; laying it on its side puts it along local z.
    spar.rotation.x = Math.PI / 2;
    spar.position.set(lateral, sparY, 0);
    spar.castShadow = true;
    spar.receiveShadow = true;
    root.add(spar);
  }

  const chockCount = Math.max(2, Math.round(length / CHOCK_SPACING));
  for (let i = 0; i < chockCount; i++) {
    // Inset from both ends so a chock never overhangs the end of the spars.
    const t = chockCount === 1 ? 0.5 : (i + 0.5) / chockCount;
    const chock = new Mesh(new BoxGeometry(CHOCK_HALF_WIDTH * 2, CHOCK_HEIGHT, CHOCK_LENGTH), options.materials.shellTrim);
    chock.name = 'spar_chock';
    chock.position.set(0, CHOCK_HEIGHT / 2, (t - 0.5) * length);
    chock.castShadow = true;
    chock.receiveShadow = true;
    root.add(chock);
  }

  const lashingCount = Math.max(2, Math.round(length / LASHING_SPACING));
  for (let i = 0; i < lashingCount; i++) {
    const t = lashingCount === 1 ? 0.5 : (i + 0.5) / lashingCount;
    // A torus is built in the local xy plane with its axis along +z, which is
    // already along the run — so it wraps the spars without further rotation.
    const lashing = new Mesh(new TorusGeometry(sparOffset + SPAR_RADIUS * 1.1, LASHING_TUBE, 6, 14), options.materials.rope);
    lashing.name = 'spar_lashing';
    lashing.position.set(0, sparY, (t - 0.5) * length);
    lashing.scale.y = 0.72;
    lashing.castShadow = true;
    root.add(lashing);
  }

  return root;
}
