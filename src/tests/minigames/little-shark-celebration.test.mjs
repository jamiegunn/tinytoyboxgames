// Contract tests for the little-shark eat celebration.
//
// These exist because of a defect no headless statistic and no single-frame
// capture caught in nine sessions: a 200-second watched playthrough showed the
// shark starting dark navy and finishing pale blue-white. The cause was the
// belly flash reading its "original" emissive off the live material at queue
// time and writing it back half a second later. Catches land much closer
// together than half a second -- the combo and the frenzy are built to make them
// -- and an overlapping pair makes the second celebration adopt the first one's
// flash colour as the value to restore. The shark's emissive then latches
// permanently at roughly twenty times its intended brightness.
//
// The property under test is therefore not "the flash happens" but "the flash is
// idempotent under overlap". Anything that reintroduces a captured-at-queue-time
// baseline fails these.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Color, Mesh, Scene, Vector3, MeshStandardMaterial, BoxGeometry } from 'three';
import { bundleTs } from '../framework/_tsload.mjs';

const M = await bundleTs('src/minigames/games/little-shark/celebrations.ts');

// The emissive `recolourShark` actually produces: body albedo (0.14, 0.23, 0.33)
// scaled by 0.04. See fish/lifecycle.ts.
const BASELINE = new Color(0.14 * 0.04, 0.23 * 0.04, 0.33 * 0.04);

// What the belly flash writes while it is running: the albedo again, at the
// measured gain. See the EAT_FLASH_GAIN comment in celebrations.ts for the
// frozen-session sweep that picked 0.18 -- the smallest gain that is still
// clearly perceptible through the fog (dE2000 7.9) while keeping 62% of the
// shark's shading and 10.6 L* of separation from the water behind it.
const FLASH_GAIN = 0.18;
const FLASH = new Color(0.14 * FLASH_GAIN, 0.23 * FLASH_GAIN, 0.33 * FLASH_GAIN);

function rig() {
  const material = new MeshStandardMaterial({ color: new Color(0.14, 0.23, 0.33) });
  material.emissive.copy(BASELINE);
  const sharkBody = new Mesh(new BoxGeometry(1, 1, 1), material);
  return {
    material,
    queue: M.createCelebrationQueue(),
    params: {
      scene: new Scene(),
      fishPos: new Vector3(1, 0, 1),
      fishColor: new Color(1, 0, 0),
      fishKind: 'standard',
      sharkBody,
      sharkRoot: null,
      sharkAnim: { tailPhase: 0, blinkTimer: 1, blinkDuration: -1, isHappySquint: false, barrelRollT: 0, barrelRollCooldown: 0, headLookT: -1 },
      comboStreak: 0,
      isFirstCatch: false,
      context: {
        audio: { playSound: () => {} },
        celebration: { milestone: () => {} },
        viewport: { width: 1200, height: 800 },
      },
    },
  };
}

// Steps the queue in 1/60 s frames, which is how it is driven in the game.
const run = (queue, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i += 1) queue.update(1 / 60);
};

const near = (a, b, eps = 1e-6) => Math.abs(a.r - b.r) < eps && Math.abs(a.g - b.g) < eps && Math.abs(a.b - b.b) < eps;

test('a single catch flashes the belly and then restores the true emissive', () => {
  const { material, queue, params } = rig();
  queue.playEatCelebration(params);

  run(queue, 0.2);
  assert.ok(near(material.emissive, FLASH), `expected the flash while it runs, got ${material.emissive.getHexString()}`);

  run(queue, 0.5);
  assert.ok(near(material.emissive, BASELINE), `expected the baseline after the flash, got ${material.emissive.getHexString()}`);
});

test('two catches 0.2s apart do not latch the flash colour', () => {
  const { material, queue, params } = rig();

  queue.playEatCelebration(params);
  run(queue, 0.2); // first flash is now on the material
  queue.playEatCelebration(params); // second celebration reads it as "original"

  run(queue, 1.5); // long past every scheduled restore

  assert.ok(near(material.emissive, BASELINE), `the belly flash latched: emissive is ${material.emissive.getHexString()}, expected ${BASELINE.getHexString()}`);
});

test('a frenzy-rate burst of catches leaves the emissive exactly where it started', () => {
  const { material, queue, params } = rig();

  // Twenty catches at 0.25 s intervals: every one of them overlaps its
  // neighbour's 0.15-0.5 s flash window, which is the worst case and also the
  // ordinary case during a feeding frenzy.
  for (let i = 0; i < 20; i += 1) {
    queue.playEatCelebration(params);
    run(queue, 0.25);
  }
  run(queue, 2);

  assert.ok(near(material.emissive, BASELINE), `after 20 rapid catches emissive is ${material.emissive.getHexString()}`);
});

test('the flash writes through the existing Color instance rather than replacing it', () => {
  const { material, queue, params } = rig();
  const instance = material.emissive;

  queue.playEatCelebration(params);
  run(queue, 1.5);

  assert.equal(material.emissive, instance, 'emissive was reassigned to a new Color; three.js may hold the old reference');
});

test("the flash is derived from the shark's albedo, not a hard-coded colour", () => {
  // A shark recoloured by a future skin, difficulty tier or event must still
  // flash in its own hue. An absolute emissive would paint every shark the same
  // grey-blue and, on a dark skin, would swamp it entirely.
  const { material, queue, params } = rig();
  material.color.setRGB(0.5, 0.1, 0.05);
  material.emissive.copy(material.color).multiplyScalar(0.04);

  queue.playEatCelebration(params);
  run(queue, 0.2);

  const expected = new Color(0.5 * FLASH_GAIN, 0.1 * FLASH_GAIN, 0.05 * FLASH_GAIN);
  assert.ok(near(material.emissive, expected), `flash ignored the albedo: got ${material.emissive.getHexString()}, expected ${expected.getHexString()}`);
});

test('the flash never emits more light than the surface reflects', () => {
  // Emissive is normal-independent: it adds the same radiance to a face turned
  // toward the light and one turned away, so once it approaches the albedo it
  // stops brightening the shading and starts erasing it. Measured: at gain 0.5
  // the shark's lightness matches the surrounding water to within 0.8 L* and
  // the silhouette disappears. Keeping emissive strictly under the albedo keeps
  // the reflected term dominant and the animal readable.
  const { material, queue, params } = rig();
  queue.playEatCelebration(params);
  run(queue, 0.2);

  const e = material.emissive;
  const c = material.color;
  assert.ok(e.r < c.r && e.g < c.g && e.b < c.b, `flash emissive ${e.getHexString()} is not below the albedo ${c.getHexString()}; it will flatten the shading`);
});

test('clearing the queue mid-flash does not strand the shark on the flash colour', () => {
  const { material, queue, params } = rig();
  queue.playEatCelebration(params);
  run(queue, 0.2);
  queue.clear();

  // `clear` drops the pending restore, so the material is left flashed. This is
  // the one case the WeakMap cannot fix on its own, and it is safe only because
  // `clear` is called from teardown, when the material is about to be disposed.
  // Pinned here so that a future caller of `clear` mid-session has to confront
  // it rather than discover it in a playthrough.
  assert.ok(near(material.emissive, FLASH), 'clear() is expected to leave the flash in place; see teardown');
});
