/**
 * Pirate Cove must be composed for every screen it ships on, not merely fit on
 * every screen it ships on.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * Every staging file in this scene was solved against three rules — ON DECK, IN
 * FRAME, CLEAR — and IN FRAME was applied at all nine shipping aspects at once.
 * That makes the layout the INTERSECTION of nine framings, and
 * `.probe/pc-aspect-binding.mjs` measured that the intersection IS the narrowest
 * framing: `extreme 360x900` bound 6 stations out of 6. Landscape surrendered 75%
 * of its own usable width so one 360x900 phone could see the same props.
 *
 * What that cost, from `.probe/pc-deck-composition.mjs`: deck coverage fell
 * monotonically as the viewport widened — 48.8% of visible deck furnished at
 * aspect 0.40, 21.5% at 1.78 — leaving a bare column of planking 30% of the frame
 * width on landscape and 35% on tablet. The scene was precisely as well composed
 * as the device was narrow. vision.md asks for "scene composition intentional at
 * all breakpoints".
 *
 * WHY THESE ASSERTIONS AND NOT A CAMERA ASSERTION
 * -----------------------------------------------
 * The obvious fix — let the camera close in on wide viewports — is dead, and it
 * is worth stating why here so nobody re-proposes it. `.probe/pc-frame-budget.mjs`
 * found the frame is HEIGHT-limited at all nine aspects with an identical worst
 * |ndc.y| of 0.911, set by the mast top. Identical because a PerspectiveCamera
 * holds VERTICAL fov fixed and varies HORIZONTAL fov with aspect: vertical framing
 * is aspect-invariant by construction. Distance is a scalar, so it shrinks both
 * axes together, and the axis with 83% slack is held hostage by the axis with 9%.
 * The whole available push-in is 10.2% and it buys landscape 6% relative coverage.
 *
 * Spreading the existing props outboard per aspect is also dead
 * (`.probe/pc-spread-sim.mjs`): coverage is AREA and translation preserves area,
 * so landscape moved 4.0% to 4.0%, while CLEAR broke and every real phone's props
 * moved.
 *
 * THE RULE BEING ENFORCED
 * -----------------------
 * The old IN FRAME rule conflated two things:
 *
 *   REACHABLE — anything a child can tap must project inside NDC at EVERY
 *     shipping aspect. An interaction a phone cannot reach does not exist for
 *     that player. Test 1 holds this line; it is the rule that must NOT relax.
 *
 *   SCENERY — need only be in frame where its deck is in frame. Requiring
 *     scenery to be visible on a screen that cannot see the planking it stands on
 *     is a category error, and it is what produced the intersection layout.
 *
 * Which scenery may take that licence is not a free choice. A prop standing
 * outboard of the narrowest frame WILL be cut by the frame edge at some aspect —
 * viewport aspect is continuous, so a prop wholly in frame at 1.78 and wholly out
 * at 0.40 passes through every state between, by the intermediate value theorem.
 * The scene's own precedent says which kinds of thing survive that: the side rails
 * and the plank seams run off the frame at every aspect and nobody calls it a
 * defect, because they are SELF-SIMILAR along their length. Cut a barrel and you
 * get an unidentifiable strip of brown against the screen edge.
 *
 * HOW THE THRESHOLDS BELOW WERE SET, WHICH IS THE PART WORTH READING
 * -----------------------------------------------------------------
 * Three silhouette metrics were built to score "does a clipped prop still read",
 * and they contradicted one another. Visible-AREA-fraction condemned the ship's
 * own side rails (out of band over 44.4% of the aspect range) worse than the
 * spars (23.5%) and far worse than a forbidden barrel (5.0%). `spanFill` — the
 * residue's area over the whole silhouette's area across the residue's own span —
 * condemned the spars at worst 3.4% against the rails' 98.1%. Residue SIZE
 * reversed the ranking a third time.
 *
 * So the question was settled by rendering it. `.probe/render/diff.mjs` draws the
 * real frame through the real renderer with each subject shown and hidden and
 * counts the pixels that change — which is not a proxy for "is it on screen", it
 * IS "is it on screen", including its shadow and everything in front of it:
 *
 *   aspect            1.778  1.333  1.000  0.750  0.562  0.461  0.450  0.400
 *   spare spars        4.42   5.45   4.11   2.40   0.29      0      0      0
 *   ship's own rail    4.64   5.84   5.21   4.51   4.04   3.26   3.08   2.71
 *   forbidden barrel   0.47   0.63   0.83   0.13      0      0      0      0
 *
 * The assertions below therefore avoid inventing a legibility threshold. They
 * assert what the render measured and what a compact prop would fail: the run is
 * ELONGATED (test 5, against a barrel measured the same way) and it is GONE by
 * the narrowest shipping aspect (test 7), ending in absence rather than in a
 * fragment.
 *
 * WHICH OF THESE TESTS CAN ACTUALLY FAIL
 * --------------------------------------
 * Every test here went green on its first run, which is when a suite deserves
 * the least trust, so each was mutation-tested against four deliberately broken
 * stagings. `x` = this mutation turns this test red.
 *
 *   test                                   empty  1:1 stub  inboard  outboard
 *   0 subject exists                         x        -        -         -
 *   1 tappables in frame                     -        -        -         -
 *   2 inside the hull outline                -        -        -         x
 *   3 clear of other props                   -        -        x         -
 *   4 elongated                              -        x        -         -
 *   5 painted area never rises               -        -        -         -
 *   6 gone by the narrowest aspect           -        -        x         -
 *   7 narrow viewports see nothing           -        -        x         -
 *   8 no bare column on wide frames          x        x        x         x
 *   9 worth its draw calls                   x        x        -         -
 *  10 occupancy not worst on landscape       x        x        x         -
 *
 * Two tests are killed by nothing, and both are deliberate. Test 1 guards the
 * OTHER props and is invariant to the stowage by design. Test 5 is a theorem
 * about the projection rather than a claim about the staging — it CANNOT fail
 * for a staging reason, `.probe/pc-monotone-tautology.mjs` failed to break it
 * over 600 random subjects, and the comment above it says so at length rather
 * than letting a green tick be mistaken for evidence.
 *
 * Test 0 exists because the empty mutation exposed a worse failure than a wrong
 * threshold: with no runs staged, every for-all rule test passed on nothing and
 * the suite reported the rules holding over an empty set.
 *
 * Every number is measured off the REAL prop factories at their REAL staged
 * placements, with poses from the app's own `resolveSceneCameraPose`, and every
 * footprint is a convex hull of real mesh vertices (`tests/framework/_footprint`).
 * Nothing here re-derives the camera, and nothing models a slanted spar as an
 * axis-aligned box — that mistake reported the run 1.41 wide where it is 0.84,
 * and 4.3 : 1 elongated where it is 7.2 : 1.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';
import { worldFootprintPoints, convexHull2D, minAreaRect, hullsOverlap } from '../framework/_footprint.mjs';
import { visiblePixels } from '../framework/_project.mjs';

const M = await bundleEntry(
  'pirate-cove-composition',
  `
  export { SCENE_CAMERA_FOV, resolveSceneCameraPose } from './src/utils/cameraPresets';
  export { createPirateCoveMaterials } from './src/scenes/immersive-toybox-scenes/pirate-cove/materials';
  export { HULL_Z_AFT, HULL_Z_FWD, hullHalfWidthAt } from './src/scenes/immersive-toybox-scenes/pirate-cove/hullPlan';
  export { ANCHOR_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/anchor';
  export { BARREL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/barrels';
  export { CANNON_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/cannon';
  export { ROPE_COIL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/ropeCoils';
  export { SHIP_WHEEL_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/shipWheel';
  export { TREASURE_CHEST_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/treasureChest';
  export { RAIL_STOWAGE_STAGING } from './src/scenes/immersive-toybox-scenes/pirate-cove/staging/railStowage';
  export { createBarrel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/barrels/create';
  export { createRopeCoil } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/ropeCoils/create';
  export { createAnchor } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/anchor/create';
  export { createRailStowage } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/simple/railStowage/create';
  export { createCannon } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/cannon/create';
  export { createShipWheel } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/shipWheel/create';
  export { createTreasureChest } from './src/scenes/immersive-toybox-scenes/pirate-cove/factory/props/interactive/treasureChest/create';
`,
);

const { hullHalfWidthAt, HULL_Z_AFT, HULL_Z_FWD } = M;

/** The nine shipping aspects, sorted widest first — test 5 depends on that order. */
const ASPECTS = [
  ['landscape 1280x720', 1280 / 720],
  ['tablet 1024x768', 1024 / 768],
  ['square 1x1', 1],
  ['iPad portrait 768x1024', 768 / 1024],
  ['iPhone SE 375x667', 375 / 667],
  ['viewport 480x854', 480 / 854],
  ['iPhone 15 393x852', 393 / 852],
  ['Pixel 8 412x915', 412 / 915],
  ['extreme 360x900', 0.4],
].sort((a, b) => b[1] - a[1]);

/** Aspects narrow enough that the stowage runs are outside the frame entirely. */
const NARROW = ASPECTS.filter(([, a]) => a <= 0.47);
/** Aspects wide enough to reveal the outboard quarters the stowage furnishes. */
const WIDE = ASPECTS.filter(([, a]) => a >= 1);

const materials = M.createPirateCoveMaterials();
const opts = { materials };

/**
 * Builds one prop with its real factory and takes its true footprint: the convex
 * hull of its mesh vertices in world space, plus those vertices for projection.
 */
const build = (name, make) => {
  const root = make(new Scene());
  root.updateMatrixWorld(true);
  const { pts } = worldFootprintPoints(root);
  const verts = [];
  const v = new Vector3();
  root.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) verts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  return { name, hull: convexHull2D(pts), verts };
};

/** Everything that was on deck before this round. */
const EXISTING = [
  ...M.ANCHOR_STAGING.map((p, i) => [`anchor${i}`, (s) => M.createAnchor(s, p, opts)]),
  ...M.BARREL_STAGING.map((p, i) => [`barrel${i}`, (s) => M.createBarrel(s, p, opts)]),
  ...M.ROPE_COIL_STAGING.map((p, i) => [`ropeCoil${i}`, (s) => M.createRopeCoil(s, p, opts)]),
  ...M.CANNON_STAGING.map((p, i) => [`cannon${i}`, (s) => M.createCannon(s, p, opts).root]),
  ...M.SHIP_WHEEL_STAGING.map((p, i) => [`shipWheel${i}`, (s) => M.createShipWheel(s, p, opts).root]),
  ...M.TREASURE_CHEST_STAGING.map((p, i) => [`treasureChest${i}`, (s) => M.createTreasureChest(s, p, opts).root]),
].map(([name, make]) => build(name, make));

/** The scenery this round adds outboard: spare spars along both side rails. */
const STOWAGE = M.RAIL_STOWAGE_STAGING.map((run, i) => build(`stowage${i}`, (s) => M.createRailStowage(s, run, opts)));

/**
 * The FORBIDDEN control: a barrel standing at the starboard run's own centroid.
 * It is the exact prop the outboard rule bans, in the exact place, built by the
 * same factory the deck's own barrels use. It exists so the elongation threshold
 * in test 4 is a comparison rather than a number somebody liked.
 */
const CTRL_BARREL = build('ctrlBarrel', (s) => M.createBarrel(s, { position: new Vector3(3.6, 0, -3.5), rotY: 0, scale: 1 }, opts));

/** Staged positions of the props a child can tap — the ones the frame rule still binds. */
const REACHABLE = [
  ...M.CANNON_STAGING.map((p, i) => [`cannon${i}`, p.position]),
  ...M.SHIP_WHEEL_STAGING.map((p, i) => [`shipWheel${i}`, p.position]),
  ...M.TREASURE_CHEST_STAGING.map((p, i) => [`treasureChest${i}`, p.position]),
];

const cameraFor = (aspect) => {
  const pose = M.resolveSceneCameraPose('pirate-cove', aspect);
  const cam = new PerspectiveCamera(M.SCENE_CAMERA_FOV, aspect, 0.1, 100);
  cam.position.copy(pose.position);
  cam.lookAt(pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
};

// ── screen-space deck occupancy ─────────────────────────────────────────────
//
// Measured in SCREEN space, not world space, and that choice is load-bearing: the
// eye stands on the deck, so a square metre at z -5 covers hundreds of times the
// pixels of a square metre at the stem. A world-area answer would call the far
// half of the deck important and the near foreground negligible, which is the
// exact opposite of what a player sees.
const GRID = 220;
const deckHit = (cam, i, j) => {
  const p = new Vector3(-1 + ((i + 0.5) / GRID) * 2, -1 + ((j + 0.5) / GRID) * 2, 0.5).unproject(cam);
  const dir = p.sub(cam.position);
  if (dir.y >= -1e-9) return null;
  const t = -cam.position.y / dir.y;
  return t > 0 ? new Vector3().copy(cam.position).addScaledVector(dir, t) : null;
};
const onDeck = (p) => p.z >= HULL_Z_AFT && p.z <= HULL_Z_FWD && Math.abs(p.x) <= hullHalfWidthAt(p.z);

/** Is `(x, z)` inside this prop's true footprint? */
const underProp = (prop, x, z) => {
  const h = prop.hull;
  for (let i = 0; i < h.length; i++) {
    const a = h[i];
    const b = h[(i + 1) % h.length];
    if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < -1e-9) return false;
  }
  return true;
};

/**
 * Fraction of visible deck standing under some prop, and the widest run of frame
 * columns that show deck but no furniture — the bare column of planking that was
 * the charge.
 */
const occupancy = (cam, props) => {
  let deck = 0;
  let covered = 0;
  const colProp = new Array(GRID).fill(false);
  const colDeck = new Array(GRID).fill(false);
  for (let i = 0; i < GRID; i++)
    for (let j = 0; j < GRID; j++) {
      const h = deckHit(cam, i, j);
      if (!h || !onDeck(h)) continue;
      deck++;
      colDeck[i] = true;
      for (const p of props)
        if (underProp(p, h.x, h.z)) {
          covered++;
          colProp[i] = true;
          break;
        }
    }
  let run = 0;
  let worst = 0;
  for (let i = 0; i < GRID; i++) {
    if (colDeck[i] && !colProp[i]) {
      run++;
      worst = Math.max(worst, run);
    } else run = 0;
  }
  return { covered: deck ? covered / deck : 0, band: worst / GRID };
};

// ── 0. the suite has a subject at all ───────────────────────────────────────

test('there is stowage to test, so the rule tests below cannot pass vacuously', () => {
  // Mutation testing caught this: emptying RAIL_STOWAGE_STAGING left the ON
  // DECK, CLEAR, ELONGATED and LEAVES-THE-FRAME tests all green, because each
  // iterates over the runs and zero runs satisfy every for-all. Only the three
  // gain tests went red. A suite that reports "the rules hold" when there is
  // nothing to hold them is worse than no suite, so the subject is asserted once
  // here and the for-alls above it are honest again.
  assert.ok(STOWAGE.length > 0, 'RAIL_STOWAGE_STAGING is empty; every for-all in this file would pass on nothing.');
  assert.equal(STOWAGE.length, 2, `expected a run down each side, found ${STOWAGE.length}.`);
});

// ── 1. the rule that must not relax ─────────────────────────────────────────

test('every tappable prop is in frame at all nine shipping aspects', () => {
  // This is the half of the old IN FRAME rule that was always right. Relaxing it
  // for scenery is this round's fix; relaxing it here would mean shipping an
  // interaction a phone player cannot reach.
  for (const [label, aspect] of ASPECTS) {
    const cam = cameraFor(aspect);
    for (const [name, position] of REACHABLE) {
      const n = position.clone().project(cam);
      assert.ok(
        Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1,
        `${name} is outside the frame at ${label}: ndc (${n.x.toFixed(3)}, ${n.y.toFixed(3)}). ` +
          `Tappable props must be reachable on every device; only SCENERY may stand outboard of the narrowest framing.`,
      );
    }
  }
});

// ── 2 and 3. the stowage is really on the ship ──────────────────────────────

test('every stowage run lies wholly inside the hull outline', () => {
  // Checked at EVERY vertex of the run's true footprint, not at its centre and
  // not at the corners of a box around it. The run is a chord, so its box is 1.41
  // wide where the run is 0.84, and a box test reports overhang at stations where
  // there is none.
  for (const p of STOWAGE) {
    for (const [x, z] of p.hull) {
      const half = hullHalfWidthAt(z);
      assert.ok(half !== null, `${p.name} reaches z ${z.toFixed(2)}, off the ends of the hull.`);
      assert.ok(
        Math.abs(x) <= half,
        `${p.name} overhangs the rail at z ${z.toFixed(2)}: it reaches |x| ${Math.abs(x).toFixed(2)} where the hull is ${half.toFixed(2)} half-wide.`,
      );
    }
  }
});

test('no stowage run overlaps any other prop', () => {
  const all = [...EXISTING, ...STOWAGE];
  for (const p of STOWAGE)
    for (const q of all) {
      if (p === q) continue;
      assert.ok(!hullsOverlap(p.hull, q.hull), `${p.name} intersects ${q.name}.`);
    }
});

// ── 4. only an elongated thing may stand outboard ───────────────────────────

test('anything staged outboard is elongated enough to survive being cut', () => {
  // The rule the fix rests on: the frame edge SHORTENS a self-similar run and
  // MUTILATES a compact object. The threshold is not a taste — it is stated
  // against the control, a barrel from the deck's own factory standing at the
  // run's centroid, which measures 1.0 : 1. The runs measure 7.2 : 1.
  const ctrl = minAreaRect(CTRL_BARREL.hull);
  const ctrlRatio = ctrl.length / ctrl.width;
  assert.ok(ctrlRatio < 2, `the forbidden control is meant to be a compact object, but it measures ${ctrlRatio.toFixed(1)} : 1.`);
  for (const p of STOWAGE) {
    const r = minAreaRect(p.hull);
    const ratio = r.length / r.width;
    assert.ok(
      ratio >= 5,
      `${p.name} is only ${ratio.toFixed(1)} : 1 (${r.length.toFixed(2)} long, ${r.width.toFixed(2)} wide). ` +
        `Outboard scenery must read as a run at any length, the way the side rails and plank seams do; ` +
        `the barrel this rule forbids is ${ctrlRatio.toFixed(1)} : 1.`,
    );
  }
});

// ── 5. it leaves the frame by shrinking, and ends in absence ────────────────

/**
 * READ THIS BEFORE TRUSTING THE NEXT TEST. It guards the PROJECTION, not the
 * staging, and it was very nearly mislabelled as evidence for the fix.
 *
 * Monotone decay sounds like a property the spars have and a barrel might not.
 * It is not. `visiblePixels` clips a PIXEL-space hull to a rectangle whose half
 * width is `aspect * CANVAS_H / 2`; pixel geometry is aspect-invariant to
 * 2.27e-13 px, so the hull is the SAME polygon at every aspect and only the
 * frame edge moves. Clipping a fixed polygon to a rectangle that only grows
 * wider cannot yield less area — so painted pixels are non-increasing FOR ANY
 * STAGING WHATSOEVER, including the compact barrel the outboard rule forbids.
 *
 * `.probe/pc-monotone-tautology.mjs` tried to break it: 400 random stowage runs
 * (inset -1.5 to 4.5, spans 0.2 to 8, both sides) and 200 randomly placed and
 * scaled barrels. Zero violations. Three separate mutations of the real staging
 * — emptied, stubbed to 1 : 1, dragged inboard — never turned this clause red
 * either; only the `ends at zero` clause below ever fires.
 *
 * So it stays, because a violation would mean the aspect-invariance this whole
 * round rests on had broken, which is worth catching. But it is NOT a reason to
 * believe the spars are well behaved, and this suite must not be read as if it
 * were: everything that actually discriminates the fix is in tests 4 and 6-9.
 */
test('painted area never RISES as the frame narrows (guards aspect-invariance, not the staging)', () => {
  let prev = Infinity;
  let prevLabel = 'a frame of unbounded width';
  for (const [label, aspect] of ASPECTS) {
    const cam = cameraFor(aspect);
    const px = STOWAGE.reduce((t, p) => t + visiblePixels(cam, p.verts, aspect), 0);
    assert.ok(
      px <= prev + 1,
      `the stowage paints MORE at ${label} (${px.toFixed(0)} px) than at ${prevLabel} (${prev.toFixed(0)} px). ` +
        `That is not a staging problem — it is impossible under aspect-invariant projection, so either ` +
        `_project.mjs or the camera preset has started changing shape with the viewport.`,
    );
    prev = px;
    prevLabel = label;
  }
});

test('the stowage has left the frame entirely by the narrowest shipping aspect', () => {
  // THIS is the falsifiable half, and the one the fix has to earn. Asserted on
  // absolute pixels rather than share of frame: the share RISES from landscape
  // to tablet (4.42% to 5.45% in the render) while the run is LOSING pixels,
  // because the frame is shrinking faster than the run is.
  //
  // Killed by mutation: dragging the runs inboard to inset 2.6 leaves 43 060 px
  // still painted at 360x900, and this goes red.
  const [label, aspect] = ASPECTS[ASPECTS.length - 1];
  const cam = cameraFor(aspect);
  const px = STOWAGE.reduce((t, p) => t + visiblePixels(cam, p.verts, aspect), 0);
  assert.equal(px, 0, `the stowage still paints ${px.toFixed(0)} px at ${label}; it is supposed to have left the frame entirely by then.`);
});

test('the narrowest viewports see nothing of the stowage at all', () => {
  // The non-regression argument, measured rather than argued: on the three
  // narrowest shipping devices the deck must be bit-identical with and without
  // the new furniture. No phone frame can be made worse by this round.
  for (const [label, aspect] of NARROW) {
    const cam = cameraFor(aspect);
    for (const p of STOWAGE) {
      const px = visiblePixels(cam, p.verts, aspect);
      assert.equal(px, 0, `${p.name} paints ${px.toFixed(0)} px at ${label}; it is outboard of that frame and must be wholly outside it.`);
    }
    const before = occupancy(cam, EXISTING);
    const after = occupancy(cam, [...EXISTING, ...STOWAGE]);
    assert.equal(after.covered, before.covered, `deck coverage changed at ${label}; the stowage is not visible there and must not count.`);
    assert.equal(after.band, before.band, `the bare-planking band changed at ${label}; the stowage is not visible there and must not count.`);
  }
});

// ── 6. the gain the fix exists to deliver ───────────────────────────────────

test('the wide viewports no longer show a bare column of planking a third of the frame wide', () => {
  // The charge measured 30.0% of frame width on landscape and 35.5% on tablet.
  // The threshold is 18% — comfortably below the defect and comfortably above
  // where the fix lands — so this fails if the runs are removed or pulled back
  // inboard, and does not fail on the grid noise of a slightly different sampling.
  for (const [label, aspect] of WIDE) {
    const cam = cameraFor(aspect);
    const { band } = occupancy(cam, [...EXISTING, ...STOWAGE]);
    assert.ok(
      band <= 0.18,
      `at ${label} the widest bare column of deck is ${(band * 100).toFixed(1)}% of the frame width, over the 18% budget. ` +
        `The wide viewports reveal outboard deck the narrow ones do not; it has to be furnished.`,
    );
  }
});

test('the stowage is actually worth its draw calls on the wide viewports', () => {
  // The mirror of the test above. Scenery nobody ever sees is dead weight, not
  // composition. The rendered differential put the runs at 4.11% to 5.45% of the
  // frame across these aspects, against 4.64% to 5.84% for a whole side rail;
  // 1.5% of frame is a floor well under that and well over nothing.
  for (const [label, aspect] of WIDE) {
    const cam = cameraFor(aspect);
    const frame = aspect * 1000 * 1000;
    const share = STOWAGE.reduce((t, p) => t + visiblePixels(cam, p.verts, aspect), 0) / frame;
    assert.ok(share >= 0.015, `the stowage paints only ${(share * 100).toFixed(2)}% of the frame at ${label}; it exists to furnish exactly this frame.`);
  }
});

test('deck occupancy no longer falls monotonically as the viewport widens', () => {
  // The shape of the original charge: the scene was precisely as well composed as
  // the device was narrow — 48.8% of visible deck furnished at aspect 0.40 down to
  // 21.5% at 1.78, falling at every step. The fix does not need to make wide
  // screens the BEST composed; it needs to break the rule that wider is always
  // worse. Asserted as: landscape must not be the worst-furnished aspect.
  const covered = ASPECTS.map(([label, aspect]) => [label, occupancy(cameraFor(aspect), [...EXISTING, ...STOWAGE]).covered]);
  const worst = covered.reduce((a, b) => (b[1] < a[1] ? b : a));
  assert.notEqual(worst[0], 'landscape 1280x720', `landscape is still the worst-furnished aspect (${(worst[1] * 100).toFixed(1)}% of visible deck covered).`);
});
