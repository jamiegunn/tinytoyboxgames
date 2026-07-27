import { Scene, Group, InstancedMesh, ConeGeometry, CylinderGeometry, Matrix4, Quaternion, Vector3, Color, type Material } from 'three';
import { createFeltMaterial } from '@app/utils/materialFactory';
import { seededRng } from '@app/utils/seededRng';
import {
  TREELINE_BACK_ROWS,
  TREELINE_SIDE_COLUMNS,
  TREELINE_BACK_HALF_WIDTH,
  TREELINE_SIDE_Z_NEAR,
  TREELINE_SPACING,
  TREELINE_CANOPY_RADIUS,
  TREELINE_NEEDLE_COLOR,
  TREELINE_TRUNK_COLOR,
  TREELINE_HAZE_COLOR,
  type TreelineRow,
} from './constants';

// ── Treeline ───────────────────────────────────────────────────────────────────

export interface TreelineCreateResult {
  root: Group;
  /** Total conifers placed, across every row and column. */
  treeCount: number;
  dispose: () => void;
}

// One conifer is a trunk plus three stacked cones. Everything in a tint group
// shares two InstancedMeshes, so a row costs two draw calls no matter how many
// trees are in it.
interface TreePlacement {
  x: number;
  z: number;
  height: number;
  scale: number;
  spin: number;
}

// Aerial perspective, hand-authored: rows further back sit closer to the
// skydome's horizon colour, which is what makes a flat backdrop read as depth.
const hazed = (base: Color, haze: number): Color => base.clone().lerp(TREELINE_HAZE_COLOR, haze);

// Positions along one row, jittered off the lattice so the silhouette does not
// read as a comb. Jitter stays under half the spacing so neighbouring canopies
// still overlap and the row remains visually solid.
const rowPlacements = (row: TreelineRow, along: (t: number) => { x: number; z: number }, from: number, to: number, seed: number): TreePlacement[] => {
  const rand = seededRng(seed);
  const out: TreePlacement[] = [];
  for (let t = from; t <= to + 1e-6; t += TREELINE_SPACING) {
    const { x, z } = along(t + (rand() - 0.5) * TREELINE_SPACING * 0.5);
    out.push({ x, z, height: row.height, scale: 0.85 + rand() * 0.3, spin: rand() * Math.PI * 2 });
  }
  return out;
};

// Builds the two InstancedMeshes for one tint group and appends them to `root`.
const buildGroup = (root: Group, name: string, placements: TreePlacement[], haze: number, owned: Material[]): void => {
  if (placements.length === 0) return;

  const needleMat = createFeltMaterial(`treelineNeedle_${name}`, hazed(TREELINE_NEEDLE_COLOR, haze));
  const trunkMat = createFeltMaterial(`treelineTrunk_${name}`, hazed(TREELINE_TRUNK_COLOR, haze));
  owned.push(needleMat, trunkMat);

  // A unit conifer: trunk of height 1, cone of base radius 1 and height 1.
  // Per-instance matrices scale these into place, so the geometry is allocated
  // once for the whole treeline.
  const trunkGeo = new CylinderGeometry(0.06, 0.09, 1, 5);
  const coneGeo = new ConeGeometry(1, 1, 7);

  const trunks = new InstancedMesh(trunkGeo, trunkMat, placements.length);
  const cones = new InstancedMesh(coneGeo, needleMat, placements.length * 3);
  trunks.name = `treelineTrunks_${name}`;
  cones.name = `treelineCones_${name}`;
  // Background scenery: it neither casts nor receives shadows. The old toybox
  // walls did receive them, which is what put hard shadows of the diorama's own
  // trees on the enclosure.
  trunks.castShadow = false;
  trunks.receiveShadow = false;
  cones.castShadow = false;
  cones.receiveShadow = false;
  // Never a tap target, and never worth a raycast.
  trunks.raycast = () => {};
  cones.raycast = () => {};

  const m = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const scl = new Vector3();
  let coneIndex = 0;

  placements.forEach((p, i) => {
    const h = p.height * p.scale;
    q.setFromAxisAngle(new Vector3(0, 1, 0), p.spin);

    // Trunk: bare stem under the lowest cone.
    pos.set(p.x, h * 0.16, p.z);
    scl.set(1, h * 0.32, 1);
    trunks.setMatrixAt(i, m.compose(pos, q, scl));

    // Three cones, each shorter and narrower than the one below it. The lowest
    // starts near the ground so the row has no gap under the canopy.
    const tiers = [
      { base: h * 0.1, height: h * 0.46, radius: TREELINE_CANOPY_RADIUS * p.scale },
      { base: h * 0.42, height: h * 0.4, radius: TREELINE_CANOPY_RADIUS * p.scale * 0.78 },
      { base: h * 0.68, height: h * 0.34, radius: TREELINE_CANOPY_RADIUS * p.scale * 0.54 },
    ];
    tiers.forEach((tier) => {
      pos.set(p.x, tier.base + tier.height / 2, p.z);
      scl.set(tier.radius, tier.height, tier.radius);
      cones.setMatrixAt(coneIndex, m.compose(pos, q, scl));
      coneIndex += 1;
    });
  });

  trunks.instanceMatrix.needsUpdate = true;
  cones.instanceMatrix.needsUpdate = true;
  root.add(trunks, cones);
};

/**
 * Creates the background treeline that closes the Nature diorama: three
 * receding rows of conifers behind the forest floor and two staggered columns
 * down each side.
 *
 * This replaces the felt toybox walls. The walls were a lavender enclosure with
 * a wood rim; opening a box is meant to feel like diving into a miniature world
 * (vision.md), not like looking into the box from above. The rows also do real
 * work: they are what stops a camera ray from reaching the floor plane beside
 * the ground rectangle and rendering the inside of the skydome as scenery.
 *
 * @param scene - The Three.js scene to add the treeline to.
 * @returns The root group, the number of conifers placed, and a disposer.
 */
export function createTreeline(scene: Scene): TreelineCreateResult {
  const root = new Group();
  root.name = 'treeline_root';
  scene.add(root);

  const owned: Material[] = [];
  let treeCount = 0;

  TREELINE_BACK_ROWS.forEach((row, i) => {
    const placements = rowPlacements(row, (t) => ({ x: t, z: row.z }), -TREELINE_BACK_HALF_WIDTH, TREELINE_BACK_HALF_WIDTH, 8100 + i * 37);
    treeCount += placements.length;
    buildGroup(root, `back${i}`, placements, row.haze, owned);
  });

  const backZ = TREELINE_BACK_ROWS[TREELINE_BACK_ROWS.length - 1].z;
  TREELINE_SIDE_COLUMNS.forEach((col, i) => {
    [-1, 1].forEach((side) => {
      const placements = rowPlacements(col, (t) => ({ x: col.x * side, z: t }), TREELINE_SIDE_Z_NEAR, backZ, 8300 + i * 53 + (side > 0 ? 11 : 0));
      treeCount += placements.length;
      buildGroup(root, `side${i}${side > 0 ? 'R' : 'L'}`, placements, col.haze, owned);
    });
  });

  const dispose = () => {
    root.traverse((obj) => {
      if (obj instanceof InstancedMesh) obj.geometry.dispose();
    });
    owned.forEach((mat) => mat.dispose());
    root.removeFromParent();
  };

  return { root, treeCount, dispose };
}
