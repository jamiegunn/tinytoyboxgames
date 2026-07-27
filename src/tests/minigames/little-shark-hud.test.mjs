// Contract tests for the feeding-frenzy build meter's presence.
//
// WHY THIS FILE EXISTS. A player looked at the shipped game and reported "a
// weird black box on the top". It was this meter, empty. The plate is a dark
// plane at opacity 0.28 and the track a darker one at 0.45, and with the fill
// scaled to 0.0001 there is nothing else in the widget — so at score 0 the
// entire HUD is two dark rectangles sitting in the sky.
//
// The arithmetic says it could not have been anything else. The overlay plane
// sits 0.5 units in front of the lens and the manifest fov is 0.85 rad, so the
// visible half-height there is 0.5·tan(0.425) = 0.2265; at the reporter's 1.88
// aspect the visible width is 2·0.2265·1.88 = 0.851. The plate is
// METER_W + 2·PLATE_PAD = 0.14 wide, i.e. 16.5% of the frame. Measured off the
// screenshot: 450 px of 2560, or 17.6%.
//
// THE CLASS OF BUG, WHICH IS THE REAL REASON FOR THE TEST. This code shipped,
// type-checked, and had never once been drawn: nothing camera-parented rendered
// at all until the shell camera was added to the scene graph. The same omission
// produced the octagon speed-lines. Code whose first appearance on screen is in
// a bug report has no test that would have caught it, because "is it visible
// when it has nothing to say" is not a property anyone thinks to assert about
// something they have never seen. So it is asserted here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleTs } from '../framework/_tsload.mjs';
import { PerspectiveCamera } from 'three';

const H = await bundleTs('src/minigames/games/little-shark/frenzyHud.ts');

const build = () => H.createFrenzyHud(new PerspectiveCamera(48.7, 1.88, 0.1, 100));
const parts = (hud) => [hud.plate, hud.track, hud.fill];
// Runs the meter to steady state at a fixed intensity/phase. 2 s at 60 Hz is
// well past the 6/s fade-in and the 2.5/s fade-out.
const settle = (hud, intensity, phase, seconds = 2) => {
  for (let i = 0; i < Math.round(seconds * 60); i += 1) H.updateFrenzyHud(hud, intensity, phase, 1 / 60);
};

test('the meter is born hidden — an empty bar is a black box, not a quiet bar', () => {
  const hud = build();
  for (const mesh of parts(hud)) {
    assert.equal(mesh.visible, false, `${mesh.geometry.type} is visible before the first frame`);
  }
});

test('a calm session never shows the chassis', () => {
  const hud = build();
  settle(hud, 0, 'calm', 5);
  for (const mesh of parts(hud)) assert.equal(mesh.visible, false, 'the widget is drawn with nothing in it');
  assert.equal(hud.reveal, 0, `reveal settled at ${hud.reveal}, so the fade-out never reaches zero`);
});

test('the first catch brings the meter in', () => {
  const hud = build();
  // One catch of a five-catch goal.
  settle(hud, 0.2, 'building');
  for (const mesh of parts(hud)) assert.equal(mesh.visible, true, 'the meter stayed hidden once it had something to say');
  assert.ok(hud.reveal > 0.99, `reveal only reached ${hud.reveal}`);
});

test('reveal scales the chassis opacity, so it fades rather than pops', () => {
  const hud = build();
  // A single 1/60 s step: the fade-in factor is dt·6 = 0.1, so reveal is 0.1
  // and both backing planes must be at a tenth of their full opacity.
  H.updateFrenzyHud(hud, 1, 'building', 1 / 60);
  assert.ok(Math.abs(hud.reveal - 0.1) < 1e-9, `reveal was ${hud.reveal}, expected 0.1 after one 60 Hz step`);
  const plate = hud.plate.material.opacity;
  const track = hud.track.material.opacity;
  settle(hud, 1, 'building');
  // Relative, not absolute. The fade is exponential, so after 2 s reveal is
  // 1 - 0.9^120 = 1 - 3.2e-6 and never exactly 1. An absolute 1e-6 window passed
  // for the plate and failed for the track purely because the identical residual
  // is multiplied by 0.28 in one case and 0.45 in the other -- the first draft of
  // this test was measuring the base constants, not the scaling it claims to
  // check. A ratio measures the proportionality itself.
  const off = (a, b) => Math.abs(a / b - 1);
  assert.ok(
    off(plate * 10, hud.plate.material.opacity) < 1e-4,
    `plate opacity ${plate} at reveal 0.1 is not a tenth of ${hud.plate.material.opacity} at reveal 1`,
  );
  assert.ok(off(track * 10, hud.track.material.opacity) < 1e-4, 'track opacity does not scale with reveal');
  // And the planes keep their relative weight throughout, so a fade is the whole
  // widget dimming together rather than its parts crossing over each other.
  assert.ok(off(plate / track, hud.plate.material.opacity / hud.track.material.opacity) < 1e-9, 'plate and track fade at different rates');
});

test('the fill opacity is scaled by reveal too, or the bar arrives before its frame', () => {
  const hud = build();
  H.updateFrenzyHud(hud, 1, 'building', 1 / 60);
  const early = hud.fill.material.opacity;
  settle(hud, 1, 'building');
  assert.ok(early < hud.fill.material.opacity * 0.2, `fill was already at ${early} on the first frame of a fade-in`);
});

test('draining back to nothing takes the widget away again', () => {
  const hud = build();
  settle(hud, 1, 'frenzy');
  assert.equal(hud.plate.visible, true);
  settle(hud, 0, 'calm', 6);
  for (const mesh of parts(hud)) assert.equal(mesh.visible, false, 'the meter stayed on screen after the arc reset');
});

test('brewing and frenzy hold the meter open even at zero intensity', () => {
  // Belt and braces: the loud phases are the ones a child is watching, and a
  // rounding error in `intensity` must not blink the meter out mid-anticipation.
  for (const phase of ['brewing', 'frenzy']) {
    const hud = build();
    settle(hud, 0, phase);
    assert.equal(hud.plate.visible, true, `the meter vanished during ${phase}`);
  }
});

test('afterglow fades out on its own decaying intensity, without a special case', () => {
  const hud = build();
  settle(hud, 1, 'frenzy');
  settle(hud, 0, 'afterglow', 6);
  for (const mesh of parts(hud)) assert.equal(mesh.visible, false, 'afterglow left the chassis on screen');
});

test('the fill still tracks intensity, so hiding it did not disconnect it', () => {
  const hud = build();
  settle(hud, 0.4, 'building');
  assert.ok(Math.abs(hud.fill.scale.x - 0.4) < 0.01, `fill scale ${hud.fill.scale.x} does not follow intensity 0.4`);
  settle(hud, 1, 'frenzy');
  assert.ok(hud.fill.scale.x > 0.99, `fill scale ${hud.fill.scale.x} does not reach full at intensity 1`);
});

test('the meter never eats a tap — it is the only control the game has', () => {
  const hud = build();
  settle(hud, 1, 'frenzy');
  const hits = [];
  for (const mesh of parts(hud)) mesh.raycast({}, hits);
  assert.equal(hits.length, 0, 'a HUD plane returned a raycast hit and would swallow taps meant for the reef');
});

test('disposal detaches all three planes from the camera', () => {
  const camera = new PerspectiveCamera(48.7, 1.88, 0.1, 100);
  const hud = H.createFrenzyHud(camera);
  assert.equal(camera.children.length, 3);
  H.disposeFrenzyHud(hud);
  assert.equal(camera.children.length, 0, 'meter planes are still parented to the camera after disposal');
});
