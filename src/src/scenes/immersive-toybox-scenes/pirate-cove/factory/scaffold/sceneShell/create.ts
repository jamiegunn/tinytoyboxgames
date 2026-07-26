/**
 * Creates the ship deck shell for Pirate Cove.
 *
 * Low wooden ship railings around the perimeter with rounded, toy-like
 * proportions. A ship mast rises from center-back. The front is open
 * (camera looks in from there).
 */

import { BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, type Scene } from 'three';
import type { PirateCoveMaterials } from '../../../materials';

/** Options controlling the ship shell dimensions and materials. */
export interface SceneShellBuildOptions {
  width: number;
  depth: number;
  wallHeight: number;
  materials: Pick<PirateCoveMaterials, 'shellWall' | 'shellTrim' | 'weatheredWood'>;
}

/**
 * Builds the ship deck railing shell plus a central mast.
 *
 * The railings are low wooden walls with trim along the top, giving the
 * impression of a toy ship deck. A tall mast rises from center-back.
 *
 * @param scene - Scene that should receive the shell geometry.
 * @param options - Dimensions and shared materials.
 * @returns The root group containing every shell mesh.
 */
export function createSceneShell(scene: Scene, options: SceneShellBuildOptions): Group {
  const root = new Group();
  root.name = 'scene_shell';

  const wallInset = 0.5;
  const halfW = Math.max(options.width / 2 - wallInset, 0.5);
  const halfD = Math.max(options.depth / 2 - wallInset, 0.5);
  const railHeight = options.wallHeight;

  // ── Ship railings — vertical posts with horizontal planks ────────────────
  // Each railing segment is defined by a start and end point along the perimeter.
  // Posts are placed at regular intervals, with thick horizontal planks between them
  // and a chunky top rail cap.

  const postRadius = 0.12;
  const postHeight = railHeight + 0.15;
  const plankThick = 0.08;
  const plankH = 0.22;
  const topRailH = 0.14;
  const topRailW = 0.18;
  const postSpacing = 1.2; // distance between posts along the rail

  // Ship hull shape — instead of a rectangle, the deck has:
  //   - Angled stern corners at the back (diagonal segments)
  //   - Sides that angle inward toward the front to form a bow shape
  // This creates a hexagonal hull outline viewed from above.

  const sternCut = halfW * 0.35; // how far the stern corners are cut
  const bowNarrow = halfW * 0.5; // how much the bow narrows at the front

  // Railing runs: each is a straight segment defined by two endpoints
  const railRuns: Array<{
    name: string;
    x1: number;
    z1: number;
    x2: number;
    z2: number;
  }> = [
    // Stern (back) — shorter center section between the two diagonal cuts
    { name: 'stern', x1: -(halfW - sternCut), z1: halfD, x2: halfW - sternCut, z2: halfD },
    // Stern corner — left diagonal
    { name: 'stern_left', x1: -halfW, z1: halfD - sternCut, x2: -(halfW - sternCut), z2: halfD },
    // Stern corner — right diagonal
    { name: 'stern_right', x1: halfW - sternCut, z1: halfD, x2: halfW, z2: halfD - sternCut },
    // Left side (from stern corner down to bow)
    { name: 'left', x1: -halfW, z1: halfD - sternCut, x2: -(halfW - bowNarrow), z2: -halfD },
    // Right side (from stern corner down to bow)
    { name: 'right', x1: halfW, z1: halfD - sternCut, x2: halfW - bowNarrow, z2: -halfD },
  ];

  railRuns.forEach((run) => {
    const dx = run.x2 - run.x1;
    const dz = run.z2 - run.z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const rotY = Math.atan2(dx, dz);
    const numPosts = Math.max(2, Math.round(length / postSpacing) + 1);

    // Vertical posts (chunky cylinders)
    for (let i = 0; i < numPosts; i++) {
      const t = i / (numPosts - 1);
      const px = run.x1 + dx * t;
      const pz = run.z1 + dz * t;

      const post = new Mesh(new CylinderGeometry(postRadius, postRadius * 1.15, postHeight, 8), options.materials.shellTrim);
      post.name = `railing_post_${run.name}_${i}`;
      post.position.set(px, postHeight / 2, pz);
      post.castShadow = true;
      root.add(post);

      // Decorative ball on top of each post
      const ball = new Mesh(new SphereGeometry(postRadius * 1.3, 8, 6), options.materials.shellTrim);
      ball.name = `railing_ball_${run.name}_${i}`;
      ball.position.set(px, postHeight + postRadius * 0.3, pz);
      ball.castShadow = true;
      root.add(ball);
    }

    // Horizontal planks between posts (two rows — lower and mid)
    const plankRows = [
      { y: plankH * 0.7, h: plankH }, // lower plank
      { y: railHeight * 0.5, h: plankH }, // middle plank
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

    // Top rail — thick flat cap running the full length
    const topRail = new Mesh(new BoxGeometry(topRailW, topRailH, length + postRadius * 2), options.materials.shellTrim);
    topRail.name = `railing_top_${run.name}`;
    topRail.position.set((run.x1 + run.x2) / 2, railHeight + topRailH / 2, (run.z1 + run.z2) / 2);
    topRail.rotation.y = rotY;
    topRail.castShadow = true;
    root.add(topRail);
  });

  // Ship mast — tall cylindrical pole rising from center-back
  const mastHeight = 6;
  const mast = new Mesh(new CylinderGeometry(0.15, 0.2, mastHeight, 12), options.materials.weatheredWood);
  mast.name = 'ship_mast';
  mast.position.set(0, mastHeight / 2, halfD * 0.6);
  mast.castShadow = true;
  root.add(mast);

  // Crow's nest platform at the top of the mast
  const nestRadius = 0.5;
  const nest = new Mesh(new CylinderGeometry(nestRadius, nestRadius * 0.9, 0.15, 12), options.materials.shellTrim);
  nest.name = 'crows_nest';
  nest.position.set(0, mastHeight * 0.85, halfD * 0.6);
  nest.castShadow = true;
  root.add(nest);

  // Cross beam (yardarm) on the mast
  const yardarmLength = 3;
  const yardarm = new Mesh(new CylinderGeometry(0.06, 0.06, yardarmLength, 8), options.materials.weatheredWood);
  yardarm.name = 'ship_yardarm';
  yardarm.position.set(0, mastHeight * 0.65, halfD * 0.6);
  yardarm.rotation.z = Math.PI / 2;
  yardarm.castShadow = true;
  root.add(yardarm);

  // ── Main sail — a billowed canvas sheet hung from the yardarm. The single
  // strongest "this is a sailing ship" cue; a warm cream canvas with a red band.
  const sailMat = new MeshStandardMaterial({ color: new Color(0.95, 0.91, 0.82), roughness: 0.92, metalness: 0, side: DoubleSide });
  sailMat.name = 'ship_sailMat';
  const sailW = 2.7;
  const sailH = 2.9;
  const sailGeo = new PlaneGeometry(sailW, sailH, 12, 6);
  const sp = sailGeo.attributes.position;
  for (let i = 0; i < sp.count; i += 1) {
    const x = sp.getX(i);
    // Billow: bulge the belly of the sail toward the open front (−z local face).
    sp.setZ(i, -Math.cos((x / (sailW / 2)) * (Math.PI / 2)) * 0.45);
  }
  sp.needsUpdate = true;
  sailGeo.computeVertexNormals();
  const sail = new Mesh(sailGeo, sailMat);
  sail.name = 'ship_mainsail';
  sail.position.set(0, mastHeight * 0.65 - sailH / 2 - 0.05, halfD * 0.6 - 0.12);
  sail.castShadow = true;
  root.add(sail);

  // A red band across the sail — the classic toy-pirate look.
  const bandMat = new MeshStandardMaterial({ color: new Color(0.82, 0.24, 0.2), roughness: 0.9, metalness: 0, side: DoubleSide });
  bandMat.name = 'ship_sailBandMat';
  const bandGeo = new PlaneGeometry(sailW, sailH * 0.26, 12, 2);
  const bp = bandGeo.attributes.position;
  for (let i = 0; i < bp.count; i += 1) {
    const x = bp.getX(i);
    bp.setZ(i, -Math.cos((x / (sailW / 2)) * (Math.PI / 2)) * 0.45 - 0.01);
  }
  bp.needsUpdate = true;
  bandGeo.computeVertexNormals();
  const band = new Mesh(bandGeo, bandMat);
  band.name = 'ship_sailBand';
  band.position.set(0, mastHeight * 0.65 - sailH / 2 - 0.05, halfD * 0.6 - 0.12);
  root.add(band);

  // ── Ocean — a wide sea plane below deck level so the ship reads as *at sea*
  // instead of a wooden patio floating in the sky.
  const oceanMat = new MeshStandardMaterial({ color: new Color(0.16, 0.42, 0.56), roughness: 0.5, metalness: 0.12 });
  oceanMat.name = 'ship_oceanMat';
  const ocean = new Mesh(new PlaneGeometry(400, 400), oceanMat);
  ocean.name = 'ship_ocean';
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.6;
  ocean.receiveShadow = true;
  root.add(ocean);

  scene.add(root);
  return root;
}
