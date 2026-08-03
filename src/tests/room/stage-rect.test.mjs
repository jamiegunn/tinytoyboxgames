/**
 * The letterbox: how much of the viewport the scene gets, and what is left over.
 *
 * WHY THIS EXISTS
 * ---------------
 * The canvas used to be 100% x 100%, so the camera was handed whatever aspect
 * the device had — as narrow as 0.40. The scene sets are landscape shaped and
 * cannot fill that, so the camera was pulled back until the frame ran off the
 * edge of the floor and a child saw sky below their own feet, with the room a
 * small island in the middle. Every framing guard in this directory now depends
 * on the camera never being given an aspect outside the band, so the band itself
 * needs a test that does not depend on any scene.
 *
 * WHAT IS ASSERTED
 * ----------------
 * The rule as arithmetic (tests 1-7), the property every other suite leans on —
 * that the aspect is ALWAYS in the band, swept over a wide range of viewports
 * rather than over a handful of chosen ones (test 8) — and that the stage never
 * exceeds the viewport it is inside (test 9), because a stage larger than the
 * window is a scrollbar, and on a touch device a scrollbar is a scene that
 * slides away under a child's finger.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleEntry } from '../framework/_tsload.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT, MIN_CHROME_BAND, resolveStageRect, stageAspectFor, resolveChromeBand } = await bundleEntry(
  'stage-rect',
  `export { MIN_STAGE_ASPECT, MAX_STAGE_ASPECT, MIN_CHROME_BAND, resolveStageRect, stageAspectFor, resolveChromeBand } from './src/utils/scene/stageRect';`,
);

test('the band is a band: the floor is below the ceiling and both are sane', () => {
  // A floor above the ceiling would make `resolveStageRect` return whichever
  // branch it tested first, silently, for every viewport.
  assert.ok(MIN_STAGE_ASPECT < MAX_STAGE_ASPECT, `floor ${MIN_STAGE_ASPECT} is not below ceiling ${MAX_STAGE_ASPECT}`);
  assert.ok(MIN_STAGE_ASPECT > 0);
});

test('a viewport inside the band gets the whole viewport', () => {
  const rect = resolveStageRect(1200, 1000); // aspect 1.2
  assert.deepEqual(rect, { width: 1200, height: 1000, offsetX: 0, offsetY: 0 });
  assert.deepEqual(resolveChromeBand(1200, 1000), { below: 0, beside: 0 });
});

test('a viewport too narrow keeps its width and loses height to the band', () => {
  // A tall phone. The scene must not be squeezed sideways to fit; it keeps the
  // width it has and the leftover height stops being scene.
  const rect = resolveStageRect(393, 852);
  assert.equal(rect.width, 393, 'the stage gives up height, never width');
  assert.equal(rect.height, 393 / MIN_STAGE_ASPECT);
  assert.equal(rect.offsetY, 0, 'the stage sits at the top so the band is thumb-reachable');
  assert.equal(resolveChromeBand(393, 852).below, 852 - 393 / MIN_STAGE_ASPECT);
  assert.equal(resolveChromeBand(393, 852).beside, 0);
});

test('a viewport too wide keeps its height and loses width to two bands', () => {
  const rect = resolveStageRect(2560, 1080);
  assert.equal(rect.height, 1080, 'the stage gives up width, never height');
  assert.equal(rect.width, 1080 * MAX_STAGE_ASPECT);
  assert.equal(rect.offsetX, (2560 - 1080 * MAX_STAGE_ASPECT) / 2, 'centred, not flush left');
  assert.equal(resolveChromeBand(2560, 1080).below, 0);
});

test('the band edges themselves are inside, not outside', () => {
  // Exactly at the floor or the ceiling, nothing is taken away. An off-by-one
  // here is invisible on every real device and shows up only as a one-pixel
  // band on the one machine that happens to sit on the boundary.
  const atFloor = resolveStageRect(1000 * MIN_STAGE_ASPECT, 1000);
  assert.equal(atFloor.height, 1000);
  const atCeiling = resolveStageRect(1000 * MAX_STAGE_ASPECT, 1000);
  assert.equal(atCeiling.width, 1000 * MAX_STAGE_ASPECT);
  assert.equal(atCeiling.offsetX, 0);
});

test('a degenerate viewport yields zeroes, not NaN', () => {
  // A browser really does report a zero height for a frame or two through an
  // orientation change, and a renderer handed NaN throws deep inside WebGL with
  // nothing pointing back at where the NaN came from.
  for (const [w, h] of [
    [0, 800],
    [800, 0],
    [-100, 800],
    [Number.NaN, 800],
  ]) {
    const rect = resolveStageRect(w, h);
    assert.deepEqual(rect, { width: 0, height: 0, offsetX: 0, offsetY: 0 }, `viewport ${w}x${h}`);
  }
  assert.equal(stageAspectFor(0, 800), 0, 'and the aspect is 0 rather than a division by zero');
});

test('stageAspectFor agrees with the rect it is derived from', () => {
  // Two ways to ask the same question is two things that can drift. This is the
  // assertion that says they may not.
  for (const [w, h] of [
    [1280, 720],
    [393, 852],
    [2560, 1080],
    [1000, 900],
  ]) {
    const rect = resolveStageRect(w, h);
    assert.ok(Math.abs(stageAspectFor(w, h) - rect.width / rect.height) < 1e-12, `${w}x${h}`);
  }
});

test('EVERY viewport produces an aspect inside the band', () => {
  // The property every framing guard in this directory leans on, swept rather
  // than sampled: 1,000 shapes from a 3:1 sliver to a 3:1 letterbox.
  for (let i = 0; i < 1000; i++) {
    const width = 200 + i;
    for (const height of [Math.round(width / 3), Math.round(width / 1.2), width, Math.round(width * 1.2), width * 3]) {
      const aspect = stageAspectFor(width, height);
      assert.ok(
        aspect >= MIN_STAGE_ASPECT - 1e-9 && aspect <= MAX_STAGE_ASPECT + 1e-9,
        `viewport ${width}x${height} produced a stage aspect of ${aspect.toFixed(4)}, outside [${MIN_STAGE_ASPECT}, ${MAX_STAGE_ASPECT}]`,
      );
    }
  }
});

test('the stage never exceeds the viewport it sits in', () => {
  // A stage wider or taller than the window is a scrollbar, and on a touch
  // device a scrollbar is a scene that slides away under a child's finger.
  for (let width = 200; width <= 3000; width += 37) {
    for (const height of [Math.round(width / 3), Math.round(width / 1.05), width, width * 2, width * 3]) {
      const rect = resolveStageRect(width, height);
      assert.ok(rect.width <= width + 1e-9, `stage ${rect.width} wider than viewport ${width}`);
      assert.ok(rect.height <= height + 1e-9, `stage ${rect.height} taller than viewport ${height}`);
      assert.ok(rect.offsetX >= 0 && rect.offsetY >= 0);
      assert.ok(rect.offsetX + rect.width <= width + 1e-9, 'the stage runs off the right edge');
      assert.ok(rect.offsetY + rect.height <= height + 1e-9, 'the stage runs off the bottom edge');
    }
  }
});

test('the band floor is at least as large as the control it exists to hold', () => {
  // The two constants live in different files and neither imports the other, so
  // nothing but this stops them drifting apart. A band shorter than a button is
  // a band that puts buttons back on the scene — the exact arrangement the
  // letterbox was built to end.
  const overlay = readFileSync(path.join(packageRoot, 'src/components/UIOverlay.tsx'), 'utf8');
  const match = /const MIN_CONTROL = ([0-9.]+);/.exec(overlay);
  if (!match) throw new Error('UIOverlay.tsx no longer declares MIN_CONTROL, so this relation cannot be checked');
  assert.ok(
    MIN_CHROME_BAND >= Number(match[1]),
    `MIN_CHROME_BAND is ${MIN_CHROME_BAND} but the HUD's smallest control is ${match[1]}: the band cannot hold what it exists for`,
  );
});

test('a near-square viewport gets a usable band, not a sliver', () => {
  // 400x420 is the case that made this necessary: capping the stage at the band
  // EDGE leaves 20 pixels of chrome. The stage gives up more than it has to so
  // the band clears its floor, and the aspect it lands on is still inside the
  // band it was solved for.
  for (const [width, height] of [
    [400, 420],
    [1000, 700],
    [393, 852],
    [2560, 1080],
  ]) {
    const band = resolveChromeBand(width, height);
    const extent = Math.max(band.below, band.beside);
    assert.ok(extent >= MIN_CHROME_BAND, `viewport ${width}x${height} left a ${extent.toFixed(1)}px chrome band, below the ${MIN_CHROME_BAND}px floor`);
    const aspect = stageAspectFor(width, height);
    assert.ok(
      aspect >= MIN_STAGE_ASPECT - 1e-9 && aspect <= MAX_STAGE_ASPECT + 1e-9,
      `${width}x${height} bought its band with an out-of-band aspect of ${aspect.toFixed(3)}`,
    );
  }
});
