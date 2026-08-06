/**
 * MISS ACKNOWLEDGEMENT CONTRACT — soul.md#6 for a tap that matched nothing.
 *
 * soul.md#6 makes an answer to a tap on empty space a promise rather than a
 * feature: "A dead tap is a broken promise... Every tap — whether it lands on a
 * designated interaction or on empty space — must produce a response." The Sound
 * World clause decides which half of that response is load-bearing: "A muted
 * experience must be fully playable and emotionally complete." So the sparkle is
 * the contract and the sound is the garnish, not the other way round.
 *
 * WHAT THIS SUITE EXISTS TO CATCH, in the order the defects actually occurred:
 *
 * 1. WIRING. `roomSceneFactory.ts` never called `setMissHandler`, so a missed tap
 *    in Playroom, Living Room or Kitchen ran `audio?.playFallback()` and nothing
 *    else — measured at 26.2%-49.7% of the canvas, with a silent-tap fraction of
 *    0.0%, which is why a sound-counting probe passed all three rooms.
 *
 * 2. DEPTH. The obvious repair — copy the outdoor scene's `ray.at(12, point)` —
 *    emits on every missed tap and is still invisible over up to 22.0% of a room
 *    frame, because a room has side walls at |x| <= 5.4-6.0 and a ceiling slab at
 *    y = 6.2-6.75 while the camera orbits at 14. The same measurement found the
 *    already-shipped outdoor handler invisible over 11.6% of Nature's landscape
 *    frame, blocked by its own tree trunks. So the depth must be FOUND from the
 *    geometry, not chosen in advance, and the fix belongs to both factories.
 *
 * 3. STANDOFF SIZE. Lifting the burst off the surface by too little buries most
 *    of it in the surface; by too much detaches it from the finger. The window is
 *    not a matter of taste and this suite re-derives it from four constants that
 *    live in four different files, so that changing the sparkle's cone, the
 *    camera's field of view or the interaction slack fails HERE, at the decision
 *    that depends on them, instead of silently degrading the acknowledgement.
 *
 * Like the other contract suites this parses source text rather than importing
 * the TS modules (three needs a DOM), so it runs under plain `node --test`.
 */

import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => readFileSync(path.join(packageRoot, 'src', ...parts), 'utf8');

const ackSrc = read('utils', 'interaction', 'missAcknowledgement.ts');
const roomFactorySrc = read('utils', 'roomSceneFactory.ts');
const worldFactorySrc = read('utils', 'worldSceneFactory.ts');
const controllerSrc = read('utils', 'interaction', 'interactionController.ts');
const presetsSrc = read('utils', 'particles', 'presets.ts');
const gestureSrc = read('utils', 'interaction', 'gestureRules.ts');
const cameraSrc = read('utils', 'cameraPresets.ts');
const catalogSrc = read('scenes', 'sceneCatalog.ts');
// The grading instrument is a source of truth here too: the fix was accepted
// against a burst radius the probe chose, so a later change to that radius must
// be reconciled with the standoff it licensed rather than silently widening it.
const probeSrc = readFileSync(path.join(packageRoot, '.probe', 'render', 'room.ts'), 'utf8');

/**
 * A numeric constant parsed out of source, or a thrown error.
 *
 * No default and no fallback, deliberately. A probe that supplies its own value
 * when the parse fails is testing itself: it would keep passing after the
 * constant it claims to pin had been renamed, deleted, or moved.
 *
 * @param {string} src - Source text to search.
 * @param {string} name - Constant identifier.
 * @param {string} where - File name, for the failure message.
 * @returns {number} The parsed value.
 */
function constant(src, name, where) {
  const match = new RegExp(`const\\s+${name}\\s*=\\s*(-?[0-9.]+)`).exec(src);
  if (!match) throw new Error(`${name} is no longer a numeric const in ${where} — this suite's arithmetic is stale`);
  return Number(match[1]);
}

/**
 * The body of a named function or arrow, brace-matched.
 *
 * Scoping matters here for a concrete reason: `missAcknowledgement.ts` contains
 * both a no-hit branch that legitimately uses a chosen depth and a hit branch
 * that must not, and an unscoped regex cannot tell which one it matched.
 *
 * @param {string} src - Source text.
 * @param {string} signature - Text that begins the function.
 * @returns {string} The braced body, inclusive.
 */
function functionBody(src, signature) {
  const start = src.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is not in the source`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`${signature} is not brace-balanced`);
}

test('every scene factory that owns a tap dispatcher installs a miss handler', () => {
  // The original defect was an absence, and an absence is invisible to a test
  // that only checks the file it already knows about. So enumerate the factories
  // from the source tree's own shape: anything that creates a dispatcher owes the
  // child the visual half of soul.md#6.
  const factories = [
    ['roomSceneFactory.ts', roomFactorySrc],
    ['worldSceneFactory.ts', worldFactorySrc],
  ];
  for (const [name, src] of factories) {
    assert.match(src, /createWorldTapDispatcher\(/, `${name} is not a dispatcher owner — update this list`);
    assert.match(src, /setMissHandler\(createMissAcknowledgement\(scene\)\)/, `${name} must install the shared miss acknowledgement`);
    assert.match(src, /import \{ createMissAcknowledgement \} from '@app\/utils\/interaction\/missAcknowledgement'/, `${name} must import the shared handler`);
  }
});

test('neither factory keeps a chosen sparkle depth of its own', () => {
  // The fix is worth nothing if a factory quietly reintroduces a private depth
  // constant beside the shared handler, which is exactly how the rooms and the
  // outdoor scenes came to disagree in the first place.
  for (const [name, src] of [
    ['roomSceneFactory.ts', roomFactorySrc],
    ['worldSceneFactory.ts', worldFactorySrc],
  ]) {
    assert.doesNotMatch(src, /MISS_SPARKLE_DISTANCE/, `${name} still carries its own miss-sparkle depth`);
    assert.doesNotMatch(src, /ray\.at\(/, `${name} still places a miss sparkle at a depth of its own choosing`);
  }
});

test('the controller still treats the visual half as the half that must arrive', () => {
  // If `acknowledgeTap` ever stops calling the handler, every assertion above
  // becomes decoration: the handler would be installed and never invoked.
  const body = functionBody(controllerSrc, 'function acknowledgeTap(clientX: number, clientY: number): void');
  assert.match(body, /missHandler\(raycaster\.ray\)/, 'acknowledgeTap no longer invokes the scene miss handler');
  assert.match(body, /audio\?\.playFallback\(\)/, 'acknowledgeTap no longer plays the audible half');
});

test('a tap that FOUND a prop is never answered with less than a tap that found nothing', () => {
  // THE ASYMMETRY THIS PINS, because it shipped and survived a review round.
  // `fire` used to end its "the handler made no sound" branch at
  // `audio.playFallback()`, while the miss path ran the scene's sparkle handler
  // AND the same cue. So a latched prop — `webSlinger`, `lampBase`, `floor` and
  // both toy cars, all measured through the canvas in `r2-second-tap.mjs` on an
  // immediate second tap — answered a child who FOUND something with strictly
  // less than the wall behind it, and on a muted device with nothing at all.
  //
  // The pin is delegation, not duplication: `fire` must route through the very
  // function the miss routes through, so the two answers cannot drift apart
  // again. Asserting `fire` contains a sparkle of its own would permit exactly
  // the drift this exists to prevent.
  const body = functionBody(controllerSrc, 'function fire(obj: Object3D, entry: Entry, point: Vector3 | null, clientX: number, clientY: number): void');
  assert.match(body, /audio\.soundCount\(\)\s*===\s*before/, 'fire no longer detects a handler that made no sound');
  assert.match(
    body,
    /acknowledgeTap\(clientX, clientY\)/,
    'an unanswered hit no longer gets the shared acknowledgement, so it is answered with less than a miss',
  );
  assert.doesNotMatch(
    body,
    /audio\.playFallback\(\)/,
    'fire plays the cue directly again, which is how it came to give the audible half without the visible one',
  );

  // And the coordinates must be the tap's own, or the sparkle answers somewhere
  // the child did not touch. Three call sites, one per arbitration outcome.
  const up = functionBody(controllerSrc, 'function onPointerUp(e: PointerEvent): void');
  assert.equal([...up.matchAll(/fire\([^)]*e\.clientX, e\.clientY\)/g)].length, 3, 'every arbitration outcome must hand fire the tap position');
});

test('the acknowledgement finds its depth from the geometry, and chooses one only when nothing is hit', () => {
  const body = functionBody(ackSrc, 'export function createMissAcknowledgement(scene: Scene): (ray: Ray) => void');

  // Found, not chosen: the burst is anchored on the intersection point.
  assert.match(body, /caster\.intersectObjects\(scene\.children, true\)/, 'the handler no longer casts against the scene');
  assert.match(body, /point\.copy\(hit\.point\)/, 'the burst is no longer anchored on the surface it answers');

  // Chosen only in the branch where nothing was hit — brace-matched so that the
  // no-hit early return is the ONLY place the constant may appear.
  const noHit = body.slice(body.indexOf('if (!hit)'), body.indexOf('point.copy(hit.point)'));
  assert.match(noHit, /ray\.at\(SKY_SPARKLE_DISTANCE, point\)/, 'the no-geometry fallback no longer uses the chosen depth');
  const afterHit = body.slice(body.indexOf('point.copy(hit.point)'));
  assert.doesNotMatch(afterHit, /SKY_SPARKLE_DISTANCE/, 'the chosen depth leaked into the branch that hit something');
});

test('the acknowledgement ignores surfaces a child cannot see it against', () => {
  // Both exclusions are load-bearing and both were learned by measurement.
  // Nature's pond is a TRANSPARENT registered plane at y = 0.038; standing the
  // sparkle off it would answer a tap on water differently from a tap on the
  // grass beside it, for no reason a child could perceive. And `Raycaster` does
  // not test `visible`, so a hidden mesh is a hit as far as it is concerned.
  const occluder = functionBody(ackSrc, 'function isOccluder(object: Object3D): boolean');
  assert.match(occluder, /object\.type !== 'Mesh'/, 'non-mesh renderables are being treated as surfaces');
  assert.match(occluder, /transparent !== true \|\| \(m\?\.opacity \?\? 1\) >= OPAQUE_MIN_OPACITY/, 'transparent surfaces are being treated as occluders');
  assert.match(occluder, /isRendered\(object\)/, 'invisible meshes are being treated as surfaces');

  const rendered = functionBody(ackSrc, 'function isRendered(object: Object3D): boolean');
  assert.match(rendered, /node = node\.parent/, 'isRendered no longer walks the ancestor chain, so a hidden group still counts');
});

test('the surface standoff sits inside the window its four inputs define', () => {
  // THE ARITHMETIC, from four constants in four files. This is the assertion the
  // round actually turned on: the first attempt at the fix satisfied the upper
  // bound and ignored the lower one, and its burst core measured 0.464 visible
  // against a bar of 0.50.
  const standoff = constant(ackSrc, 'SURFACE_STANDOFF', 'missAcknowledgement.ts');
  const proximityPx = constant(gestureSrc, 'PROXIMITY_PX', 'gestureRules.ts');
  const fovDeg = constant(cameraSrc, 'SCENE_CAMERA_FOV', 'cameraPresets.ts');

  // The sparkle's own emission cone, from the preset rather than from memory.
  const sparkle = presetsSrc.slice(presetsSrc.indexOf('export const SCENE_SPARKLE'));
  const coneMatch = /cone:\s*\[([0-9.]+),\s*([0-9.]+)\]/.exec(sparkle);
  if (!coneMatch) throw new Error('SCENE_SPARKLE no longer declares a cone — the lower bound cannot be derived');
  const phiMax = Number(coneMatch[2]);
  const speedMatch = /speed:\s*\[([0-9.]+),\s*([0-9.]+)\]/.exec(sparkle);
  const lifeMatch = /lifetime:\s*\[([0-9.]+),\s*([0-9.]+)\]/.exec(sparkle);
  if (!speedMatch || !lifeMatch) throw new Error('SCENE_SPARKLE no longer declares speed and lifetime ranges');

  // Half the median travel is the radius at which the burst still has most of
  // its brightness; on a wall, the cone's lateral reach at that radius points
  // straight into the plaster.
  //
  // TWO RADII, NOT ONE, and the first run of this test caught me conflating them.
  // The preset's own arithmetic gives 1.75 u/s x 0.55 s / 2 = 0.481. The grading
  // probe samples the burst at a ROUNDED 0.5, and 0.5 is the radius the fix was
  // actually graded at, so 0.5 is the radius the standoff has to clear — 0.366
  // rather than 0.352. Rounding up is the safe direction (it asks the standoff to
  // clear slightly more than the physics demands), but it is only safe while it
  // stays rounded UP, so that relation is asserted rather than assumed.
  const medianSpeed = (Number(speedMatch[1]) + Number(speedMatch[2])) / 2;
  const medianLifetime = (Number(lifeMatch[1]) + Number(lifeMatch[2])) / 2;
  const derivedRadius = (medianSpeed * medianLifetime) / 2;
  const coreRadius = constant(probeSrc, 'CORE_RADIUS', '.probe/render/room.ts');
  assert.ok(
    coreRadius >= derivedRadius,
    `the probe samples the burst at ${coreRadius} but the preset's own speed and lifetime put its core at ${derivedRadius.toFixed(3)}: the instrument is now more lenient than the physics it stands in for`,
  );
  const lowerBound = coreRadius * Math.sin(phiMax);

  // The rooms' orbit radius, parsed from the catalog rather than assumed, is the
  // distance at which the on-screen displacement is largest for these scenes.
  // The catalog is keyed by scene id (`playroom: {`), not by an `id:` field, so
  // the anchor is the property name. Anchoring on the wrong token is not a
  // harmless miss: `indexOf` returns -1, `slice(-1)` yields the file's last
  // character, and the regex would then have failed for a reason that has nothing
  // to do with the constant under test. It threw, which is the point of throwing.
  // THE CLOSEST ROOM, NOT THE PLAYROOM. This used to read the playroom's orbit and
  // call it "the rooms' radius", which was true only while the playroom happened
  // to be the nearest camera. It is a coincidence, not a property: the three room
  // poses are solved together against the same aspect band and any of them can
  // come out closest. Whichever is nearest is the one where a fixed world standoff
  // covers the most screen, so that is the one this bound belongs to.
  const orbits = ['playroom: {', 'kitchen: {', "'living-room': {"].map((anchor) => {
    const at = catalogSrc.indexOf(anchor);
    if (at < 0) throw new Error(`sceneCatalog.ts no longer declares a \`${anchor}\` entry to read an orbit radius from`);
    const found = /cameraPreset:\s*\{[^}]*distance:\s*([0-9.]+)/.exec(catalogSrc.slice(at));
    if (!found) throw new Error(`the ${anchor} entry no longer declares a cameraPreset distance`);
    return Number(found[1]);
  });
  const orbit = Math.min(...orbits);
  const frameWorldHeight = 2 * orbit * Math.tan((fovDeg * Math.PI) / 360);
  const upperBound = (proximityPx / 720) * frameWorldHeight;

  assert.ok(
    standoff > lowerBound,
    `SURFACE_STANDOFF ${standoff} buries part of every burst: the sparkle cone reaches ${lowerBound.toFixed(3)} units sideways at the graded core radius ${coreRadius.toFixed(2)}`,
  );
  assert.ok(
    standoff < upperBound,
    `SURFACE_STANDOFF ${standoff} lifts the burst further than ${proximityPx}px of interaction slack allows at ${orbit} units (${upperBound.toFixed(3)})`,
  );

  // Pin the values as well as the relation, so a change to any of the four
  // inputs shows up as a diff to review rather than as a still-green test.
  assert.equal(standoff, 0.41);
  assert.equal(phiMax, 0.82);
  assert.equal(proximityPx, 70);
  assert.equal(fovDeg, 50);
  assert.equal(coreRadius, 0.5);
  assert.equal(derivedRadius.toFixed(3), '0.481');
  assert.equal(lowerBound.toFixed(3), '0.366');
  // 1.269, not the 1.268 the round's write-up first carried: that figure came from
  // rounding the frame height to 13.05 before multiplying. The unrounded chain is
  // 2 x 14 x tan(25 deg) = 13.0566, x 70/720 = 1.2694. It changes no decision — the
  // standoff is 0.45 — but a pin that encodes my arithmetic error rather than the
  // code's is a pin that will fail the next honest reader instead of the next bug.
  //
  // 2026-08-02: 1.269 -> 1.360 -> 0.861. Nothing about the sparkle moved. The
  // Playroom's orbit has been re-solved three times as the framing work went on
  // — 14, then 15, then 9.5 once the empty foreground was measured from a
  // screenshot — and this bound is proportional to it: a camera CLOSER in means
  // each pixel of interaction slack covers less world, so the standoff has less
  // room than it did.
  //
  // 2026-08-03: 0.861 -> 0.453, and THIS ONE ACTUALLY BROKE. Removing the
  // letterbox re-solved all three room poses at once and brought the closest
  // orbit to 5.0, which left the shipped 0.45 standoff 0.7% inside its own
  // ceiling — arithmetically passing, and no margin at all. The standoff came
  // down to 0.41 in response, which is the correct direction: the standoff is a
  // world distance standing in for a screen distance, and the screen it is
  // measured against just got closer to the wall.
  //
  // The warning the last entry ended on was right and is worth restating with
  // the number that now matters: the window closes completely at an orbit near
  // 4.0, because below that the interaction slack covers less world than the
  // sparkle cone needs to clear the plaster. A room pose solved any closer than
  // that has no admissible standoff, whatever the framing says.
  assert.equal(upperBound.toFixed(3), '0.453');
});

test('the chosen fallback depth is only reachable where nothing occupies the ray', () => {
  // The fallback still has to read at the size of a prop, so it is pinned. Its
  // justification changed completely, though: it is no longer "the sky has no
  // geometry" — which measurement refuted — but "this ray hit nothing at all",
  // which is true by construction of the branch it lives in.
  assert.equal(constant(ackSrc, 'SKY_SPARKLE_DISTANCE', 'missAcknowledgement.ts'), 12);
  const orbits = [...catalogSrc.matchAll(/distance:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
  assert.ok(orbits.length >= 4, 'sceneCatalog.ts no longer declares camera distances this test can bound against');
  assert.ok(
    12 >= Math.min(...orbits) && 12 <= Math.max(...orbits),
    `the fallback depth 12 must sit inside the orbit range actually shipped (${Math.min(...orbits)}..${Math.max(...orbits)})`,
  );
});
