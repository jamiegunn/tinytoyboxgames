/**
 * Pirate Cove ambient motion — the scene must be alive before anybody taps it.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * A census of every animation call in the Pirate Cove tree found exactly one:
 * a `gsap.timeline` inside `parrot/interaction.ts`, i.e. inside a tap handler.
 * `getIdleAnimator` was called zero times. There was no per-frame update hook of
 * any kind. Until a child touched something, the scene was a photograph — a ship
 * at sea where the sea did not move.
 *
 * vision.md requires that at least two interactions animate before the player
 * taps, to invite exploration. soul.md §5 says the toybox world is never static.
 * Nothing enforced either, because "nothing moves" is not a malformed source
 * file: every line of the scene was individually correct.
 *
 * WHY THIS SUITE EXECUTES CODE
 * ----------------------------
 * A grep for `gsap.` in the scene tree would pass the moment anybody wrote the
 * word, whether or not a tween ever reached a scene object. So this suite builds
 * the real shell, the real parrot and the real sky rig, registers a REAL idle
 * animator on a REAL disposal scope, runs `startAmbientMotion`, and then asks
 * gsap which objects actually have tweens attached.
 *
 * WHY ONE BUNDLE ENTRY, WHICH IS THE SUBTLE PART
 * ---------------------------------------------
 * `idle/registry.ts` keeps a module-private `WeakMap`. Two separate `bundleTs`
 * calls produce two copies of it, so a test that bundles the rig separately from
 * the registry cannot register an animator the rig will find: `getIdleAnimator`
 * falls back to the no-op animator, which returns a well-formed `{stop()}` for
 * every preset. The id assertions below would ALL still pass with not a single
 * real tween in existence. `bundleEntry` puts both sides in one module graph so
 * the registry is shared, and the console.warn spy below fails the suite if the
 * fallback is ever taken anyway.
 */

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import gsap from 'gsap';
import { Group, Quaternion, Scene, Vector3 } from 'three';
import { bundleEntry } from '../framework/_tsload.mjs';

const PC = 'src/scenes/immersive-toybox-scenes/pirate-cove';

const {
  startAmbientMotion,
  AMBIENT_SOURCE_IDS,
  setSceneIdleAnimator,
  createDisposalScope,
  createSceneShell,
  createOcean,
  createParrot,
  createPirateCoveMaterials,
  createCelestialBody,
  createCloudPuff,
  PIRATE_COVE_ENVIRONMENT,
  PARROT_STAGING,
} = await bundleEntry(
  'pirate-cove-ambient',
  `
    export { startAmbientMotion, AMBIENT_SOURCE_IDS } from './${PC}/factory/scaffold/ambientMotion';
    export { createSceneShell } from './${PC}/factory/scaffold/sceneShell';
    export { createOcean } from './${PC}/factory/scaffold/sea';
    export { createParrot } from './${PC}/factory/props/simple/parrot/create';
    export { createPirateCoveMaterials } from './${PC}/materials';
    export { PIRATE_COVE_ENVIRONMENT } from './${PC}/environment';
    export { PARROT_STAGING } from './${PC}/staging/parrot';
    export { setSceneIdleAnimator } from './src/utils/idle/registry';
    export { createDisposalScope } from './src/utils/disposal';
    export { createCelestialBody, createCloudPuff } from './src/utils/skyRig';
  `,
);

// Builds a scene that matches what `pirate-cove/index.ts` assembles, minus the
// props the ambient rig does not touch. Returns the same handles the real scene
// passes to `startAmbientMotion`, plus the scope that owns teardown.
function buildCove({ withSail = true, withParrot = true, cloudCount = 3 } = {}) {
  const scene = new Scene();
  const scope = createDisposalScope();
  setSceneIdleAnimator(scene, scope);

  const materials = createPirateCoveMaterials();
  const shellRoot = withSail
    ? createSceneShell(scene, {
        width: PIRATE_COVE_ENVIRONMENT.ground.width,
        depth: PIRATE_COVE_ENVIRONMENT.ground.depth,
        wallHeight: 2,
        materials,
      })
    : new Group();

  const seaAndSky = new Group();
  seaAndSky.name = 'sea_and_sky';
  scene.add(seaAndSky);
  seaAndSky.add(createOcean());

  const sun = createCelestialBody({ radius: 2, emissiveIntensity: 1.2 });
  seaAndSky.add(sun.root);

  const clouds = [];
  for (let i = 0; i < cloudCount; i += 1) {
    const cloud = createCloudPuff({ scale: 1.8 });
    seaAndSky.add(cloud);
    clouds.push(cloud);
  }

  if (withParrot) createParrot(scene, PARROT_STAGING[0]);

  return { scene, scope, shellRoot, seaAndSky, sun, clouds, materials };
}

// Every gsap tween attached to any transform channel anywhere under a root.
// Deliberately does not care WHICH object is animated — that is the point.
function allTweensIn(root) {
  const found = new Set();
  root.traverse((obj) => {
    for (const channel of [obj.position, obj.rotation, obj.scale]) {
      for (const tween of gsap.getTweensOf(channel)) found.add(tween);
    }
  });
  return [...found];
}

// Silences and records the idle registry's fallback warning. A warning here
// means `getIdleAnimator` did NOT find the animator this suite registered, and
// every downstream assertion is being satisfied by the no-op animator.
function captureWarnings(fn) {
  const original = console.warn;
  const seen = [];
  console.warn = (...args) => seen.push(args.join(' '));
  try {
    return { result: fn(), warnings: seen };
  } finally {
    console.warn = original;
  }
}

after(() => {
  // gsap's ticker keeps a live timer while any `repeat: -1` tween has existed,
  // so the process never exits without this. Killing the tweens is not enough.
  gsap.ticker.sleep();
});

test('the rig starts every declared ambient source, through a real animator', () => {
  const cove = buildCove();
  const { result: sources, warnings } = captureWarnings(() => startAmbientMotion(cove.scene, cove));

  assert.deepEqual(warnings, [], 'the idle registry fell back to the no-op animator; nothing below proves anything');
  assert.deepEqual(
    sources.map((s) => s.id),
    [...AMBIENT_SOURCE_IDS],
    'started sources must match the published id list exactly',
  );
  assert.ok(AMBIENT_SOURCE_IDS.length >= 2, 'vision.md requires at least 2 pre-tap animations');

  cove.scope.dispose();
});

test('each source owns a real gsap tween on the channel its name claims', () => {
  const cove = buildCove();
  startAmbientMotion(cove.scene, cove);

  const sail = cove.shellRoot.getObjectByName('ship_sailGroup');
  const parrot = cove.scene.getObjectByName('parrot_prop');
  const head = parrot.getObjectByName('parrot_head');

  const channels = [
    ['sea roll', cove.seaAndSky.rotation, 1],
    ['sea heave', cove.seaAndSky.position, 1],
    ['sun glow', cove.sun.coreMaterial, 1],
    ['sail luff depth', sail.scale, 1],
    ['sail luff swing', sail.rotation, 1],
    ['parrot bob', parrot.position, 1],
    ['parrot look', head.rotation, 1],
  ];
  for (const [label, target, expected] of channels) {
    assert.equal(gsap.getTweensOf(target).length, expected, `${label} has no tween on its channel`);
  }
  for (const [i, cloud] of cove.clouds.entries()) {
    assert.equal(gsap.getTweensOf(cloud.position).length, 1, `cloud ${i} does not drift`);
  }

  cove.scope.dispose();
});

test('every ambient tween loops forever and is killed by scope disposal', () => {
  const cove = buildCove();
  startAmbientMotion(cove.scene, cove);

  const targets = [cove.seaAndSky.rotation, cove.seaAndSky.position, cove.sun.coreMaterial, ...cove.clouds.map((c) => c.position)];
  const tweens = targets.flatMap((t) => gsap.getTweensOf(t));
  assert.ok(tweens.length > 0, 'no tweens to inspect');
  for (const tween of tweens) {
    assert.equal(tween.repeat(), -1, 'an ambient idle that stops is not ambient');
  }

  cove.scope.dispose();

  for (const target of targets) {
    assert.equal(gsap.getTweensOf(target).length, 0, 'a tween survived scope disposal — this is the leak class IdleAnimator exists to prevent');
  }
});

test('the ids are discovered, not hardcoded: no sail group means no sail sources', () => {
  const cove = buildCove({ withSail: false });
  const sources = startAmbientMotion(cove.scene, cove).map((s) => s.id);

  assert.ok(!sources.includes('sail-luff-depth'), 'reported a sail idle with no sail present');
  assert.ok(!sources.includes('sail-luff-swing'), 'reported a sail idle with no sail present');
  assert.ok(sources.includes('sea-roll'), 'the sea should still move without a sail');

  cove.scope.dispose();
});

test('the cloud sources scale with the number of clouds', () => {
  const cove = buildCove({ cloudCount: 5 });
  const drifts = startAmbientMotion(cove.scene, cove)
    .map((s) => s.id)
    .filter((id) => id.startsWith('cloud-drift-'));

  assert.deepEqual(drifts, ['cloud-drift-0', 'cloud-drift-1', 'cloud-drift-2', 'cloud-drift-3', 'cloud-drift-4']);
  cove.scope.dispose();
});

/**
 * THE CENTRAL DESIGN CLAIM, ASSERTED RATHER THAN ASSUMED.
 *
 * The fix rocks the sea and sky around a rigid deck instead of rocking the ship.
 * The reason is not aesthetic: a three-year-old aims a whole hand at a target and
 * commits early, so a tap target that slides sideways during the reach is a
 * miss the child cannot understand. If somebody later "improves" this by rocking
 * the hull, every prop on deck starts moving under the finger — and nothing else
 * in the suite would notice. So drive the tweens through a full cycle and assert
 * the deck's own transform never budges.
 */
test('the deck never moves — tap targets stay where the child aimed', () => {
  const cove = buildCove();
  startAmbientMotion(cove.scene, cove);

  // WORLD space, not local. An earlier revision of this test read
  // `mast.position` and passed a deliberate mutation that rolled `shellRoot`:
  // rotating a parent leaves every child's LOCAL transform untouched, so the
  // assertion was blind to precisely the regression it was written for.
  const mast = cove.shellRoot.getObjectByName('ship_mast');
  const worldPos = () => {
    cove.scene.updateMatrixWorld(true);
    return mast.getWorldPosition(new Vector3());
  };
  const worldQuat = () => {
    cove.scene.updateMatrixWorld(true);
    return mast.getWorldQuaternion(new Quaternion());
  };
  const before = worldPos();
  const beforeQuat = worldQuat();

  // Drive EVERY tween in the scene, not a hand-listed few. Hand-listing the
  // sea-and-sky channels was the second hole this test had: a mutation that
  // moved the roll onto the hull left `seaAndSky.rotation` untweened, so the
  // hand-list simply did not include the tween that broke the contract and the
  // assertion sailed through. Asking the scene graph what is animated makes the
  // test blind to where the regression chooses to put itself.
  const tweens = allTweensIn(cove.scene);
  assert.ok(tweens.length > 0, 'nothing in the scene is animated at all');

  let sawMotion = false;
  for (const p of [0, 0.17, 0.33, 0.5, 0.71, 0.94]) {
    for (const tween of tweens) tween.progress(p);
    if (Math.abs(cove.seaAndSky.rotation.z) > 1e-6 || Math.abs(cove.seaAndSky.position.y) > 1e-6) sawMotion = true;
    assert.ok(worldPos().distanceTo(before) < 1e-6, `the mast moved in world space at progress ${p}`);
    assert.ok(worldQuat().angleTo(beforeQuat) < 1e-6, `the mast tilted in world space at progress ${p}`);
  }
  assert.ok(sawMotion, 'the sea and sky never moved either — the scene is still a photograph');

  cove.scope.dispose();
});

/**
 * soul.md: "alive, not demanding". A horizon that tilts hard is how you make a
 * small child feel unwell, so the roll amplitude has a ceiling as well as a
 * floor. 0.05 rad is 2.9°, which is about 64 px of horizon travel across a
 * 1280 px frame at this camera's 50° vertical fov.
 */
test('the swell is perceptible but gentle', () => {
  const cove = buildCove();
  startAmbientMotion(cove.scene, cove);

  const [roll] = gsap.getTweensOf(cove.seaAndSky.rotation);
  const seen = [];
  for (let i = 0; i <= 20; i += 1) {
    roll.progress(i / 20);
    seen.push(cove.seaAndSky.rotation.z);
  }
  const peak = Math.max(...seen.map(Math.abs));
  assert.ok(peak > 0.008, `roll peak ${peak} rad is too small to read on screen`);
  assert.ok(peak <= 0.05, `roll peak ${peak} rad tilts the horizon enough to be unpleasant`);

  cove.scope.dispose();
});
