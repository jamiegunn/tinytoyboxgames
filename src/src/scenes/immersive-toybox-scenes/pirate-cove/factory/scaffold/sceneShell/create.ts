/**
 * Creates the ship shell for Pirate Cove: rails, mast, yardarm, sail, rigging.
 *
 * The hull outline is NOT described here. It comes from `../../../hullPlan`,
 * which is the only file that knows how wide or how long this ship is. This
 * module used to derive it a second time from `environment.ground` — the same
 * five constants, written out again, alongside a comment in `index.ts` claiming
 * the two copies matched. See that file for what changed and why.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three';
import type { PirateCoveMaterials } from '../../../materials';
import { HULL_RAIL_RUNS, MAST, hullHalfWidthAt } from '../../../hullPlan';

/** Options controlling the ship shell's rail height and materials. */
export interface SceneShellBuildOptions {
  /** Height of the railing above the deck. */
  wallHeight: number;
  materials: Pick<PirateCoveMaterials, 'shellWall' | 'shellTrim' | 'weatheredWood'>;
}

// A taut rope between two world points, as a thin cylinder. Ropes are the
// cheapest cue that a mast is rigged rather than planted, and they are the one
// element that reads at phone resolution because they are long and straight.
function makeRope(from: Vector3, to: Vector3, radius: number, material: MeshStandardMaterial, name: string): Mesh {
  const delta = to.clone().sub(from);
  const rope = new Mesh(new CylinderGeometry(radius, radius, delta.length(), 5), material);
  rope.name = name;
  rope.position.copy(from).add(to).multiplyScalar(0.5);
  rope.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.clone().normalize());
  rope.castShadow = true;
  return rope;
}

// A trapezoidal sheet: wider at the head than at the foot, billowed toward the
// camera. A `PlaneGeometry` cannot taper, and an untapered sheet is why the
// shipped sail measured 190.9 px wide with a 5 px spread over 61 rows -- a
// rectangle by construction, which is a paper cup, not a sail.
function makeSailSheet(headWidth: number, footWidth: number, height: number, vTop: number, vBottom: number, billow: number): BufferGeometry {
  const geo = new PlaneGeometry(1, 1, 12, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    // PlaneGeometry(1,1) spans -0.5..0.5 in both axes; v = 1 at the head.
    const u = pos.getX(i) + 0.5;
    const v = pos.getY(i) + 0.5;
    const vWorld = vBottom + (vTop - vBottom) * v;
    const width = footWidth + (headWidth - footWidth) * vWorld;
    pos.setX(i, (u - 0.5) * width);
    pos.setY(i, (vWorld - 0.5) * height);
    // Belly toward the open front (-z local face), deepest amidships.
    pos.setZ(i, -Math.cos((u - 0.5) * Math.PI) * billow);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the ship: railings around the hull outline, a masted and rigged sail
 * plan, and a masthead pennant.
 *
 * @param scene - Scene that should receive the shell geometry.
 * @param options - Rail height and shared materials.
 * @returns The root group containing every shell mesh.
 */
export function createSceneShell(scene: Scene, options: SceneShellBuildOptions): Group {
  const root = new Group();
  root.name = 'scene_shell';

  const railHeight = options.wallHeight;

  // ── Railings ─────────────────────────────────────────────────────────────
  const postRadius = 0.12;
  const postHeight = railHeight + 0.15;
  const plankThick = 0.08;
  const plankH = 0.22;
  const topRailH = 0.14;
  const topRailW = 0.18;
  const postSpacing = 1.2;

  HULL_RAIL_RUNS.forEach((run) => {
    const dx = run.x2 - run.x1;
    const dz = run.z2 - run.z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const rotY = Math.atan2(dx, dz);
    const numPosts = Math.max(2, Math.round(length / postSpacing) + 1);

    for (let i = 0; i < numPosts; i++) {
      const t = i / (numPosts - 1);
      const px = run.x1 + dx * t;
      const pz = run.z1 + dz * t;

      const post = new Mesh(new CylinderGeometry(postRadius, postRadius * 1.15, postHeight, 8), options.materials.shellTrim);
      post.name = `railing_post_${run.name}_${i}`;
      post.position.set(px, postHeight / 2, pz);
      post.castShadow = true;
      root.add(post);

      const ball = new Mesh(new SphereGeometry(postRadius * 1.3, 8, 6), options.materials.shellTrim);
      ball.name = `railing_ball_${run.name}_${i}`;
      ball.position.set(px, postHeight + postRadius * 0.3, pz);
      ball.castShadow = true;
      root.add(ball);
    }

    const plankRows = [
      { y: plankH * 0.7, h: plankH },
      { y: railHeight * 0.5, h: plankH },
    ];

    plankRows.forEach((row, ri) => {
      const plank = new Mesh(new BoxGeometry(plankThick, row.h, length), options.materials.shellWall);
      plank.name = `railing_plank_${run.name}_${ri}`;
      plank.position.set((run.x1 + run.x2) / 2, row.y, (run.z1 + run.z2) / 2);
      plank.rotation.y = rotY;
      plank.castShadow = true;
      plank.receiveShadow = true;
      root.add(plank);
    });

    const topRail = new Mesh(new BoxGeometry(topRailW, topRailH, length + postRadius * 2), options.materials.shellTrim);
    topRail.name = `railing_top_${run.name}`;
    topRail.position.set((run.x1 + run.x2) / 2, railHeight + topRailH / 2, (run.z1 + run.z2) / 2);
    topRail.rotation.y = rotY;
    topRail.castShadow = true;
    root.add(topRail);
  });

  // ── Mast, nest, yardarm ──────────────────────────────────────────────────
  const mast = new Mesh(new CylinderGeometry(0.15, 0.22, MAST.height, 12), options.materials.weatheredWood);
  mast.name = 'ship_mast';
  mast.position.set(0, MAST.height / 2, MAST.z);
  mast.castShadow = true;
  root.add(mast);

  const nestRadius = MAST.nestRadius;
  const nest = new Mesh(new CylinderGeometry(nestRadius, nestRadius * 0.9, 0.15, 12), options.materials.shellTrim);
  nest.name = 'crows_nest';
  nest.position.set(0, MAST.nestY, MAST.z);
  nest.castShadow = true;
  root.add(nest);

  // A hoop around the nest, so the platform reads as something a parrot could
  // sit ON rather than a disc floating through the mast. Its thickness and its
  // centre height are chosen so that the top of it lands exactly on
  // `MAST.nestRailTopY`, which is the y `staging/parrot.ts` perches the bird at.
  // Neither file may restate that number; see the plan for why.
  const nestRailThickness = 0.06;
  const nestRail = new Mesh(new CylinderGeometry(nestRadius * 1.02, nestRadius * 1.02, nestRailThickness, 12, 1, true), options.materials.shellTrim);
  nestRail.name = 'crows_nest_rail';
  nestRail.position.set(0, MAST.nestRailTopY - nestRailThickness / 2, MAST.z);
  root.add(nestRail);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const stanchion = new Mesh(new CylinderGeometry(0.035, 0.035, 0.34, 5), options.materials.shellTrim);
    stanchion.name = `crows_nest_stanchion_${i}`;
    stanchion.position.set(Math.sin(a) * nestRadius * 0.95, MAST.nestY + 0.15, MAST.z + Math.cos(a) * nestRadius * 0.95);
    root.add(stanchion);
  }

  const yardarm = new Mesh(new CylinderGeometry(0.06, 0.06, MAST.yardSpan, 8), options.materials.weatheredWood);
  yardarm.name = 'ship_yardarm';
  yardarm.position.set(0, MAST.yardY, MAST.z);
  yardarm.rotation.z = Math.PI / 2;
  yardarm.castShadow = true;
  root.add(yardarm);

  // ── Main sail ────────────────────────────────────────────────────────────
  // The canvas and its red band hang in a shared group rather than sitting side
  // by side in the shell root. They are two coplanar sheets a centimetre apart,
  // so anything that moves one has to move the other by exactly the same amount
  // or the stripe slides off the sail. The ambient-motion rig luffs this group;
  // giving the pair a real parent is what makes that safe.
  //
  // The group's origin is the HEAD of the sail (the yardarm), not its middle, so
  // a rotation about it swings the canvas from where it is actually tied. A
  // centre pivot would push the head backwards through the mast.
  const sailHead = 3.4;
  const sailFoot = 2.6;
  const sailH = 3.2;
  const sailBillow = 0.5;
  const sailGroup = new Group();
  sailGroup.name = 'ship_sailGroup';
  sailGroup.position.set(0, MAST.yardY - 0.05, MAST.z - 0.14);
  root.add(sailGroup);

  // A SECOND group inside the first, holding exactly the same two sheets.
  //
  // It looks redundant and it is not. The ambient rig owns `ship_sailGroup`'s
  // `scale.z` (`sail-luff-depth`) and `rotation.x` (`sail-luff-swing`) — the two
  // channels a tap on the sail most obviously wants: belly it out, swing it.
  // `playAnimations` clears the way for itself with `gsap.killTweensOf(target)`
  // plus the target's position/rotation/scale, so a tap animation written
  // directly onto `ship_sailGroup` would silently kill the idle and leave the
  // sail dead for the rest of the session — the scene's ambient motion traded
  // for one animation, permanently, on the first tap.
  //
  // Nesting sidesteps that instead of coordinating around it. Transforms
  // compose, so the tap's belly-snap rides on top of the idle luff, and the
  // kill is scoped to the object it is handed and therefore cannot reach the
  // parent. This is the same separation the parrot already uses, where the idle
  // owns head ROTATION and the tap owns head POSITION; the difference is only
  // that here the two want the same channel, so the split has to be by object.
  const sailSnap = new Group();
  sailSnap.name = 'ship_sailSnap';
  sailGroup.add(sailSnap);

  const sailMat = new MeshStandardMaterial({ color: new Color(0.95, 0.91, 0.82), roughness: 0.92, metalness: 0, side: DoubleSide });
  sailMat.name = 'ship_sailMat';
  const sail = new Mesh(makeSailSheet(sailHead, sailFoot, sailH, 1, 0, sailBillow), sailMat);
  sail.name = 'ship_mainsail';
  sail.position.set(0, -sailH / 2, 0);
  sail.castShadow = true;
  sailSnap.add(sail);

  // A red band across the sail — the classic toy-pirate look. It is cut from the
  // same taper as the canvas (band rows 0.30..0.56 up the sail), so it follows
  // the edges instead of overhanging them.
  const bandMat = new MeshStandardMaterial({ color: new Color(0.82, 0.24, 0.2), roughness: 0.9, metalness: 0, side: DoubleSide });
  bandMat.name = 'ship_sailBandMat';
  const band = new Mesh(makeSailSheet(sailHead, sailFoot, sailH, 0.56, 0.3, sailBillow + 0.012), bandMat);
  band.name = 'ship_sailBand';
  band.position.set(0, -sailH / 2, 0);
  sailSnap.add(band);

  // ── Rigging ──────────────────────────────────────────────────────────────
  // Lifts from the yardarm tips to the masthead, shrouds from the masthead down
  // to the rails, and sheets from the sail's foot corners to the deck rail. Four
  // long diagonals converging on one point is the second-strongest "ship" cue
  // after the rails, and unlike the rails it works at the top of the frame,
  // which is where the mast now is.
  const ropeMat = new MeshStandardMaterial({ color: new Color(0.42, 0.34, 0.24), roughness: 1, metalness: 0 });
  ropeMat.name = 'ship_ropeMat';
  const masthead = new Vector3(0, MAST.height - 0.12, MAST.z);
  const halfYard = MAST.yardSpan / 2;

  root.add(makeRope(new Vector3(-halfYard, MAST.yardY, MAST.z), masthead, 0.035, ropeMat, 'ship_lift_port'));
  root.add(makeRope(new Vector3(halfYard, MAST.yardY, MAST.z), masthead, 0.035, ropeMat, 'ship_lift_starboard'));

  // Shrouds land on the rail at two stations either side. `hullHalfWidthAt` is
  // what puts their feet ON the rail rather than near it.
  for (const z of [-2, 1.5]) {
    const halfWidth = hullHalfWidthAt(z);
    if (halfWidth === null) continue;
    root.add(makeRope(masthead, new Vector3(-halfWidth, railHeight, z), 0.03, ropeMat, `ship_shroud_port_${z}`));
    root.add(makeRope(masthead, new Vector3(halfWidth, railHeight, z), 0.03, ropeMat, `ship_shroud_starboard_${z}`));
  }

  // Sheets run from the clews (the sail's lower corners) forward to the rail.
  const clewY = MAST.yardY - 0.05 - sailH;
  const sheetZ = 6.5;
  const sheetHalfWidth = hullHalfWidthAt(sheetZ) ?? 2;
  root.add(
    makeRope(
      new Vector3(-sailFoot / 2, clewY, MAST.z - 0.14 - sailBillow),
      new Vector3(-sheetHalfWidth, railHeight, sheetZ),
      0.028,
      ropeMat,
      'ship_sheet_port',
    ),
  );
  root.add(
    makeRope(
      new Vector3(sailFoot / 2, clewY, MAST.z - 0.14 - sailBillow),
      new Vector3(sheetHalfWidth, railHeight, sheetZ),
      0.028,
      ropeMat,
      'ship_sheet_starboard',
    ),
  );

  // ── Masthead pennant ─────────────────────────────────────────────────────
  // A tapered triangle, flown from the truck. It is the only element above the
  // crow's nest, so it is what tells a child where the top of the ship is.
  const pennantMat = new MeshStandardMaterial({ color: new Color(0.85, 0.26, 0.24), roughness: 0.85, metalness: 0, side: DoubleSide });
  pennantMat.name = 'ship_pennantMat';
  const pennantGeo = new BufferGeometry();
  pennantGeo.setAttribute('position', new Float32BufferAttribute([0, 0.16, 0, 0, -0.16, 0, 1.1, 0, 0.06], 3));
  pennantGeo.computeVertexNormals();
  const pennant = new Mesh(pennantGeo, pennantMat);
  pennant.name = 'ship_pennant';
  pennant.position.set(0.14, MAST.height - 0.1, MAST.z);
  root.add(pennant);

  // The ocean used to be built here. It is not part of the ship, and keeping it
  // in the hull's group meant the water could only move if the deck moved with
  // it. It now lives in `../sea` and is parented to the sea-and-sky group that
  // `../ambientMotion` rocks.

  scene.add(root);
  return root;
}
