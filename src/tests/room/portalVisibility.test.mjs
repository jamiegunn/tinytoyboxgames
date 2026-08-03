/**
 * A game portal must be VISIBLE, not merely present and in frame.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * Pirate Cove's ship wheel stands at x = 0 and its Cannonball Splash portal
 * stood at x = 0. The scene camera also sits on x = 0. Three collinear points,
 * with the wheel nearer the eye than the portal, so the wheel stood squarely in
 * front of the only thing in that scene a child could tap to start a game.
 * Measured at 72% of the portal's silhouette covered at square aspect.
 *
 * Nature had the same defect twice without anyone reporting it: Bubble Pop 41%
 * behind a tree and Little Shark 51%, both at shipping aspects.
 *
 * NOTHING CAUGHT IT, AND THE REASON IS WORTH WRITING DOWN
 * -------------------------------------------------------
 * The stage solver that placed the wheel DID check clearance, and passed. It
 * checked deck FOOTPRINT overlap — do two props' outlines intersect on the deck
 * plane — and the wheel and the portal do not overlap on the deck. They are 3.5
 * units apart in Z.
 *
 * Footprint clearance and line-of-sight clearance are different questions, and
 * only the second one is the question a player experiences. Two props can be
 * arbitrarily far apart on the floor and still be exactly on top of one another
 * on screen; that is what depth is. Every existing composition test in this repo
 * — `pirate-cove-composition`, `scene-ground-coverage`, `playroom-toybox-framing`
 * — asks where things are, and `scene-ground-coverage` asks whether portals are
 * inside the frame. None of them asks what is standing in front of them.
 *
 * WHY THE FIRST VERSION OF THIS MEASUREMENT WAS WRONG, TWICE
 * ----------------------------------------------------------
 * 1. It took each prop's WHOLE projected bounding rectangle as the occluder. A
 *    tree's canopy is 4 units above the ground and its rect therefore spans
 *    everything beneath it, so the model reported a portal 97% hidden by a tree
 *    that nothing was standing in front of. Only geometry NEARER THE EYE than
 *    the portal can hide it, and the vertex filter below is that fix.
 *
 * 2. It used axis-aligned rectangles for both silhouettes. A rectangle is a
 *    generous over-approximation of a tree and a poor one of a portal disc. This
 *    version projects real mesh vertices into pixels, hulls them, and samples the
 *    portal's own silhouette — so "40% occluded" means 40% of the pixels a child
 *    would see are covered, not 40% of a box drawn around them.
 *
 * WHY IT BUILDS REAL GEOMETRY AND NOT A DISC
 * ------------------------------------------
 * The portal silhouette comes from `buildGamePortal`, the same function the
 * scenes call. A test that models the portal as a 0.55-radius disc is asserting
 * against its own copy of the pedestal's dimensions, and would keep passing
 * after someone doubled the pedestal — the classic failure `noCopiedConstants`
 * exists to prevent.
 *
 * The occluders come from each scene's own `compose*` list, run against a stub
 * context. That is deliberate: enumerating prop factories here would make this
 * suite silently stale the day someone adds a prop, and a new large prop is
 * exactly the change most likely to reintroduce the defect. Test 4 pins the
 * composer list against the scene entrypoints so adding a composer there without
 * adding it here is a FAILURE rather than a quiet gap in coverage.
 *
 * A COARSER CHECK WAS TRIED HERE AND IS NOT COMING BACK
 * ------------------------------------------------------
 * The first draft carried a second, cheaper assertion alongside the pixel one: a
 * `sharesViewRay(eye, portal, prop, tolerance)` helper in `utils/scene/placement`
 * asserting that no prop's centre sits inside the cone the portal subtends. It
 * reads well and it is the check an author can do in their head, which is why it
 * was written.
 *
 * It reported 23 violations in scenes with zero measured occlusion, and every one
 * was a pebble. An angular test knows where a thing is and not how big it is, so
 * a 4 cm stone lying on the ground between the eye and the disc is "on the ray"
 * in exactly the way a mast is. Adding a size gate to fix that would have made it
 * a worse, thresholded copy of the measurement below — so the helper was deleted
 * rather than kept warm behind a test written to justify it. Occlusion is a
 * question about AREA and this file answers it in area.
 *
 * THRESHOLDS
 * ----------
 * `MAX_OCCLUSION` is not a taste judgement. With the portals at their current
 * placements every portal in both scenes measures 0.0% covered at all nine
 * shipping aspects, so any non-zero number is headroom for geometry tweaks
 * rather than a tolerance for hiding. It is set at 0.10 — a tenth of the icon —
 * which is an order of magnitude below the 41%, 51% and 72% this suite was
 * written to catch, and the failure message reports the measured worst so a
 * regression reads as a number rather than as a boolean.
 */

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import gsap from 'gsap';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';
import { convexHull2D, pointInHull } from '../framework/_footprint.mjs';
import { projectedHull } from '../framework/_project.mjs';

const M = await bundleEntry(
  'portal-visibility',
  `
  export { stageAspectFor } from './src/utils/scene/stageRect';
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { buildGamePortal } from './src/minigames/framework/gamePortal';

  export { PIRATE_COVE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/pirate-cove/environment';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { composeBarrels } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels';
  export { composeAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor';
  export { composeRopeCoils } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils';
  export { composeRailStowage } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/railStowage';
  export { composeParrots } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/parrot';
  export { composeCannons } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon';
  export { composeTreasureChests } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest';
  export { composeShipWheels } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel';
  export { createSceneShell } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/scaffold/sceneShell';

  export { NATURE_ENVIRONMENT } from './src/scenes/immersive-toybox-scenes/naturescene/environment';
  export { createNatureMaterials } from './src/scenes/immersive-toybox-scenes/naturescene/materials';
  export { composeAcorns } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/acorns';
  export { composeFerns } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/ferns';
  export { composeGrassPatches } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/grassPatch';
  export { composeLeafLitter } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/leafLitter';
  export { composeMossPatches } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/mossPatch';
  export { composeToadstools } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/simple/toadstools';
  export { composeButterflies } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/butterflies';
  export { composeFlowers } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/flowers';
  export { composeLeaves } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/leaves';
  export { composeLog } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/log';
  export { composeMushrooms } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/mushrooms';
  export { composeSnail } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/snail';
  export { composeStones } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/interactive/stones';
  export { composeStream } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/complex/stream';
  export { composeTrees } from './src/scenes/immersive-toybox-scenes/naturescene/factory/props/complex/trees';
`,
);

/**
 * The nine shipping aspects. Same list as `scene-ground-coverage` and
 * `pirate-cove-composition`; occlusion is aspect-sensitive because the camera
 * pulls BACK on narrow viewports, which compresses depth separation on screen.
 */
// THE ASPECTS THE CAMERA CAN ACTUALLY BE GIVEN, not the aspects a device can
// have. The stage is letterboxed (see src/utils/scene/stageRect.ts): outside a
// 1.0-1.4 band the leftover viewport becomes chrome rather than scene, so a
// 0.40 phone renders a 1.00 stage. This list used to be nine raw device aspects,
// five of which the camera can no longer be handed at all — and asserting
// against a state the app cannot reach is how a suite comes to look thorough
// while covering less than it claims. Derived from `stageAspectFor` so that
// widening the band cannot leave it behind.
const SHIPPING_VIEWPORTS = [
  ['landscape 1280x720', 1280, 720],
  ['tablet 1024x768', 1024, 768],
  ['square 800x800', 800, 800],
  ['iPad portrait 768x1024', 768, 1024],
  ['viewport 480x854', 480, 854],
  ['iPhone SE 375x667', 375, 667],
  ['iPhone 15 393x852', 393, 852],
  ['Pixel 8 412x915', 412, 915],
  ['extreme 400x1000', 400, 1000],
];
const ASPECTS = SHIPPING_VIEWPORTS.map(([label, w, h]) => [`${label} -> stage ${M.stageAspectFor(w, h).toFixed(2)}`, M.stageAspectFor(w, h)]);

/** Fraction of a portal's own silhouette that may be covered. See the header. */
const MAX_OCCLUSION = 0.1;

/**
 * Minimum world-space gap between two portals in one scene, in units.
 *
 * Set from the pedestal, not from taste: `buildGamePortal` draws a 1.4-unit
 * pedestal, so 3.0 units leaves a clear pedestal-and-a-bit of planking between
 * two discs. Nature's tightest pair was 1.80 units — touching rims — which is
 * the crowding this number exists to forbid.
 */
const MIN_PORTAL_SEPARATION = 3;

// Every composer and every portal starts `repeat: -1` idle tweens — a butterfly
// flutter, a portal's float and spin. Each hands back a teardown and this suite
// calls all of them, but gsap's ticker installs a timer of its own the first
// time any tween is created, and that timer holds the event loop open after the
// last assertion. Without this the suite passes and then hangs, which in CI is
// indistinguishable from a suite that never finished.
after(() => gsap.ticker.sleep());

// ── stub compose context ──────────────────────────────────────────────────
//
// Composers destructure `scene`, `dispatcher`, `materials` and occasionally
// `canvas`/`camera`. None of them need those objects to DO anything for the
// geometry to be built — a tap that never happens is a handler that never runs —
// so the stubs record instead of behaving. If a composer ever starts requiring
// real canvas behaviour at build time, this throws rather than silently building
// a smaller scene.

/** A `WorldTapDispatcher` that accepts registrations and never dispatches. */
function stubDispatcher() {
  const noop = () => {};
  return {
    register: () => noop,
    registerWithPoint: () => noop,
    setMissHandler: noop,
    dispose: noop,
  };
}

/** Minimal canvas stand-in: enough surface for listener wiring, no behaviour. */
function stubCanvas() {
  return {
    width: 1280,
    height: 720,
    clientWidth: 1280,
    clientHeight: 720,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }),
  };
}

/**
 * Every world-space vertex of every mesh under `root`, grouped one entry per
 * mesh.
 *
 * Per MESH and not per prop: a tree's trunk and its canopy are separate
 * silhouettes with different depths, and hulling them together would put a
 * phantom occluder in the empty air between them.
 *
 * @param {import('three').Object3D} root Scene or subtree to walk.
 * @returns {Array<{name: string, verts: import('three').Vector3[]}>} One entry per mesh with geometry.
 */
function meshVertices(root) {
  root.updateMatrixWorld(true);
  const out = [];
  const v = new Vector3();
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    const verts = [];
    for (let i = 0; i < pos.count; i++) verts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
    if (verts.length) out.push({ name: o.name || o.type, verts });
  });
  return out;
}

/**
 * Builds one immersive scene's props into a bare `Scene` using the scene's own
 * composers, and returns every mesh silhouette in it.
 *
 * Vertices are read BEFORE the composers' teardowns run: a teardown is entitled
 * to detach what it built, and this needs the geometry, not the live scene.
 *
 * @param {Record<string, (ctx: unknown) => (() => void) | void>} composers The scene's composer map.
 * @param {unknown} materials The scene's material set.
 * @param {((scene: import('three').Scene, materials: unknown) => unknown) | null} extra Non-composer scenery.
 * @returns {Array<{name: string, verts: import('three').Vector3[]}>} Mesh silhouettes.
 */
function buildOccluders(composers, materials, extra) {
  const scene = new Scene();
  const ctx = { scene, canvas: stubCanvas(), camera: new PerspectiveCamera(), dispatcher: stubDispatcher(), materials };
  const teardowns = [];
  for (const compose of Object.values(composers)) {
    const off = compose(ctx);
    if (typeof off === 'function') teardowns.push(off);
  }
  if (extra) extra(scene, materials);
  const meshes = meshVertices(scene);
  for (const off of teardowns) off();
  return meshes;
}

/**
 * Builds one portal's real geometry at its staged position.
 *
 * Uses `buildGamePortal` so the silhouette is the pedestal and icon the scene
 * actually draws. The infinite float and spin tweens it starts are killed
 * immediately — this measures the portal at rest, and a live `repeat: -1` tween
 * on a detached object keeps the node process awake.
 *
 * @param {{gameId: string, position: import('three').Vector3, color: unknown}} portal Portal config.
 * @returns {import('three').Vector3[]} World-space vertices.
 */
function buildPortalSilhouette(portal) {
  const scene = new Scene();
  const built = M.buildGamePortal(scene, portal, { launchMiniGame: () => {} });
  const verts = meshVertices(scene).flatMap((m) => m.verts);
  built.dispose();
  return verts;
}

/**
 * The camera at a scene's own opening pose for one aspect.
 *
 * `resolveSceneCameraPose` is the app's function, not a re-derivation. See the
 * argument in `tests/room/camera-pullback-rule.test.mjs`.
 */
function camFor(sceneId, aspect) {
  const pose = M.resolveSceneCameraPose(sceneId, aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 200);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  return cam;
}

/** Axis-aligned bounds of a pixel polygon. */
function bounds(poly) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, x1, y0, y1 };
}

/** Grid resolution used to sample a portal silhouette. 60x60 over its bounds. */
const SAMPLES = 60;

/**
 * What fraction of `portalVerts` is hidden by nearer geometry, and by what.
 *
 * The measurement is a raster of the portal's own silhouette rather than an
 * area ratio between two hulls, because occluders OVERLAP: two branches each
 * covering the same 30% of a disc cover 30% of it, not 60%. Sampling counts the
 * union for free, which is the quantity a child's eye reports.
 *
 * @param {import('three').PerspectiveCamera} cam Camera at the pose under test.
 * @param {number} aspect Viewport aspect.
 * @param {import('three').Vector3[]} portalVerts Portal world vertices.
 * @param {Array<{name: string, verts: import('three').Vector3[]}>} occluders Candidate mesh silhouettes.
 * @returns {{covered: number, by: string[]}} Covered fraction and the mesh names responsible.
 */
function occlusionOf(cam, aspect, portalVerts, occluders) {
  const pj = projectedHull(cam, portalVerts, aspect);
  // A portal partly behind the eye is not a visibility question, it is a framing
  // question, and `scene-ground-coverage` already owns that one.
  if (!pj) return { covered: 0, by: [] };
  const portal = pj.hull;
  const pb = bounds(portal);

  // Nothing further from the eye than the portal's NEAREST vertex can hide any
  // part of it. One scalar, computed once, culls almost every mesh in the scene.
  let portalNear = Infinity;
  for (const w of portalVerts) portalNear = Math.min(portalNear, cam.position.distanceTo(w));

  const blockers = [];
  for (const mesh of occluders) {
    const near = [];
    for (const w of mesh.verts) {
      if (cam.position.distanceTo(w) >= portalNear) continue;
      near.push(w);
    }
    if (near.length < 3) continue;
    const mj = projectedHull(cam, near, aspect);
    if (!mj) continue;
    const mb = bounds(mj.hull);
    if (mb.x1 < pb.x0 || mb.x0 > pb.x1 || mb.y1 < pb.y0 || mb.y0 > pb.y1) continue;
    blockers.push({ name: mesh.name, hull: mj.hull });
  }
  if (!blockers.length) return { covered: 0, by: [] };

  let inside = 0;
  let hidden = 0;
  const hit = new Set();
  for (let i = 0; i < SAMPLES; i++) {
    const x = pb.x0 + ((i + 0.5) * (pb.x1 - pb.x0)) / SAMPLES;
    for (let j = 0; j < SAMPLES; j++) {
      const y = pb.y0 + ((j + 0.5) * (pb.y1 - pb.y0)) / SAMPLES;
      if (!pointInHull(portal, x, y)) continue;
      inside++;
      for (const b of blockers) {
        if (!pointInHull(b.hull, x, y)) continue;
        hidden++;
        hit.add(b.name);
        break;
      }
    }
  }
  return { covered: inside ? hidden / inside : 0, by: [...hit] };
}

// ── the two immersive scenes ──────────────────────────────────────────────

const SCENES = [
  {
    sceneId: 'pirate-cove',
    env: M.PIRATE_COVE_ENVIRONMENT,
    entrypoint: 'src/scenes/immersive-toybox-scenes/pirate-cove/index.ts',
    composers: {
      composeBarrels: M.composeBarrels,
      composeAnchor: M.composeAnchor,
      composeRopeCoils: M.composeRopeCoils,
      composeRailStowage: M.composeRailStowage,
      composeParrots: M.composeParrots,
      composeCannons: M.composeCannons,
      composeTreasureChests: M.composeTreasureChests,
      composeShipWheels: M.composeShipWheels,
    },
    materials: M.createPirateCoveMaterials(),
    // The hull, rails, mast and sail are not composers, but the mast IS the
    // tallest thing on the deck and a portal behind it would be split in two.
    extra: (scene, materials) => M.createSceneShell(scene, { wallHeight: 2, materials }),
  },
  {
    sceneId: 'nature',
    env: M.NATURE_ENVIRONMENT,
    entrypoint: 'src/scenes/immersive-toybox-scenes/naturescene/index.ts',
    composers: {
      composeStream: M.composeStream,
      composeMushrooms: M.composeMushrooms,
      composeFlowers: M.composeFlowers,
      composeLeaves: M.composeLeaves,
      composeLog: M.composeLog,
      composeStones: M.composeStones,
      composeButterflies: M.composeButterflies,
      composeTrees: M.composeTrees,
      composeGrassPatches: M.composeGrassPatches,
      composeLeafLitter: M.composeLeafLitter,
      composeToadstools: M.composeToadstools,
      composeMossPatches: M.composeMossPatches,
      composeFerns: M.composeFerns,
      composeAcorns: M.composeAcorns,
      composeSnail: M.composeSnail,
    },
    materials: M.createNatureMaterials(),
    extra: null,
  },
];

for (const scene of SCENES) {
  const occluders = buildOccluders(scene.composers, scene.materials, scene.extra);

  test(`${scene.sceneId}: the scene under test is actually populated`, () => {
    // Every for-all assertion below passes vacuously against an empty scene, and
    // a stub context that silently built nothing is exactly the way this suite
    // would go green while measuring air. Same reason `pirate-cove-composition`
    // opens with test 0.
    assert.ok(occluders.length > 20, `${scene.sceneId}: only ${occluders.length} occluder meshes built — the compose stubs are not building the scene`);
    assert.ok(scene.env.portals.length > 0, `${scene.sceneId}: no portals to check`);
  });

  test(`${scene.sceneId}: no portal is hidden behind scenery at any shipping aspect`, () => {
    // Reports the WORST aspect rather than the first failing one, for the reason
    // spelled out in scene-ground-coverage: an assert inside the loop stops at
    // whichever aspect happens to be listed first, which is not information.
    let worst = null;
    for (const portal of scene.env.portals) {
      const verts = buildPortalSilhouette(portal);
      for (const [label, aspect] of ASPECTS) {
        const { covered, by } = occlusionOf(camFor(scene.sceneId, aspect), aspect, verts, occluders);
        if (!worst || covered > worst.covered) worst = { label, gameId: portal.gameId, covered, by };
      }
    }
    assert.ok(
      worst.covered <= MAX_OCCLUSION,
      `${scene.sceneId}: portal '${worst.gameId}' is ${(worst.covered * 100).toFixed(1)}% hidden at ${worst.label} by ${worst.by.join(', ')} — limit ${(MAX_OCCLUSION * 100).toFixed(0)}%`,
    );
  });

  test(`${scene.sceneId}: portals are far enough apart to be separate targets`, () => {
    const ps = scene.env.portals;
    let closest = null;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const d = ps[i].position.distanceTo(ps[j].position);
        if (!closest || d < closest.d) closest = { d, a: ps[i].gameId, b: ps[j].gameId };
      }
    }
    if (!closest) return;
    assert.ok(
      closest.d >= MIN_PORTAL_SEPARATION,
      `${scene.sceneId}: '${closest.a}' and '${closest.b}' are ${closest.d.toFixed(2)} units apart — minimum ${MIN_PORTAL_SEPARATION}`,
    );
  });

  test(`${scene.sceneId}: this suite measures every composer the scene runs`, () => {
    // Without this, adding a prop to the scene adds it to the game and not to
    // this measurement, and the suite reports "no occlusion" over a scene that
    // is missing the thing that was just added. Admissions, not permissions: the
    // scene's own entrypoint is the source of truth and this list must match it.
    const source = readFileSync(new URL(`../../${scene.entrypoint}`, import.meta.url), 'utf8');
    const declared = [...source.matchAll(/^import \{ (compose\w+) \}/gm)].map((m) => m[1]).sort();
    const measured = Object.keys(scene.composers).sort();
    assert.deepEqual(
      measured,
      declared,
      `${scene.sceneId}: composer list drift — ${scene.entrypoint} imports [${declared.join(', ')}], this suite builds [${measured.join(', ')}]`,
    );
  });
}
