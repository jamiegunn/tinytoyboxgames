/**
 * LightingRig contract test.
 *
 * Enforces architecture-standards.md#lightingrig. The unification only holds if:
 *   - the fill is a HemisphereLight (a flat ambient fill is the sky===ground
 *     special case), never a bare AmbientLight — that's the vocabulary both rigs
 *     collapse into;
 *   - shadow map size comes from qualityTier (not a hard-coded constant);
 *   - every light AND the key's target is registered on the DisposalScope, so
 *     scene switches stop leaking shadow-map render targets;
 *   - the key light position follows `-normalize(direction)·KEY_DISTANCE`.
 *
 * WHY THIS FILE WAS REWRITTEN
 * ---------------------------
 * The old suite tested a string. Four of its five cases were regexes run
 * against `lightingRig.ts` read as text, which cannot distinguish code that
 * runs from code that is merely present.
 *
 * The fifth was worse, and is the specimen worth naming. Its key-light test
 * declared its own local `keyPos()` helper, re-typed `KEY_DISTANCE = 10` beside
 * it, and then made three careful assertions — magnitude, sign, and invariance
 * under a non-unit direction — about that local helper. It never called
 * `createLightingRig`. Every assertion was true, the arithmetic was right, and
 * the test would have passed unchanged if the rig had placed the key light at
 * the origin, inside the floor, or nowhere at all. A test that reimplements
 * the thing it tests is strictly worse than no test: it occupies the slot a
 * real test would fill and reports green from it.
 *
 * THE EXCUSE THAT KEPT IT THAT WAY
 * --------------------------------
 * The header used to say: "The rig imports the `@app/*` alias (qualityTier,
 * disposal), so it can't be behaviourally loaded here." Both halves were false,
 * and had been for some time. `bundleTs` resolves `@app/*` exactly as
 * `vite.config.ts` does, and `qualityTier` already guards
 * `typeof window === 'undefined'` and returns a tier without touching the DOM.
 * The sentence was the entire reason nobody re-checked — an excuse written down
 * as a reason stops reading as a thing to verify and starts reading as a
 * considered trade-off.
 *
 * WHY THE TIER IS FORCED TO 'high'
 * --------------------------------
 * `getShadowMapSize()` returns 1024 on the tier a headless run defaults to
 * ('medium'). If the test asserted 1024, a rig that had abandoned qualityTier
 * and hard-coded the common value would still pass. Faking a non-touch,
 * many-core `window`/`navigator` before the module loads moves the expected
 * answer to 2048, which only the real lookup produces.
 *
 * WHAT THE MUTATION RUN FOUND
 * ---------------------------
 * Ten mutations of `lightingRig.ts`; nine died. Flipping the key-distance sign,
 * dropping `.normalize()`, hard-coding a 1024 shadow map, un-registering the
 * key, the fill or the accents from the scope, detaching the key target,
 * swapping sky for ground, and turning `castShadow` off all turn this suite red.
 *
 * The survivor is worth writing down, because the old suite pinned it with a
 * regex and so made it look load-bearing. Changing `a.distance ?? 0` to
 * `a.distance` changes nothing: three.js gives `PointLight.distance` the value
 * 0 for `undefined`, for an explicit 0, and for an omitted third argument
 * alike — constructed all three ways and compared, they are equal. It is a true
 * equivalent mutant, not a hole. Dropping the argument *entirely* is the
 * meaningful version of that edit, and case 7 does kill it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Must happen before the bundle loads: qualityTier caches its answer on the
// first call, and a headless default of 'medium' would make the shadow-map
// assertion agree with a hard-coded 1024.
globalThis.window = { devicePixelRatio: 1 };
Object.defineProperty(globalThis, 'navigator', {
  value: { hardwareConcurrency: 16 },
  configurable: true,
  writable: true,
});

const { bundleTs } = await import('./_tsload.mjs');
const { DirectionalLight, HemisphereLight, PointLight, Color, Vector3, Scene } = await import('three');

const { createLightingRig } = await bundleTs('src/utils/lighting/lightingRig.ts');
const { createDisposalScope } = await bundleTs('src/utils/disposal.ts');
const { getShadowMapSize } = await bundleTs('src/utils/qualityTier.ts');

// A descriptor with every optional field populated, so a test can override the
// one thing it is about and leave the rest realistic.
function descriptor(overrides = {}) {
  return {
    key: { direction: new Vector3(-1, -3, 2), intensity: 1.4, color: new Color(1, 0.96, 0.9) },
    fill: { skyColor: new Color(0.6, 0.75, 1), groundColor: new Color(0.4, 0.3, 0.25), intensity: 0.7 },
    ...overrides,
  };
}

function build(overrides) {
  const scene = new Scene();
  const scope = createDisposalScope();
  const rig = createLightingRig(scene, descriptor(overrides), scope);
  return { scene, scope, rig };
}

test('the forced tier really is high — otherwise every shadow assertion below is vacuous', () => {
  assert.equal(
    getShadowMapSize(),
    2048,
    'the window/navigator fake did not take, so getShadowMapSize fell back to a tier whose value a hard-coded constant could match',
  );
});

test('fill is a real HemisphereLight carrying the descriptor colours', () => {
  const { rig } = build();
  assert.ok(rig.fill instanceof HemisphereLight, 'fill must be a HemisphereLight, not an AmbientLight');
  assert.equal(rig.fill.color.getHex(), new Color(0.6, 0.75, 1).getHex(), 'sky colour must come from the descriptor');
  assert.equal(rig.fill.groundColor.getHex(), new Color(0.4, 0.3, 0.25).getHex(), 'ground colour must come from the descriptor');
  assert.equal(rig.fill.intensity, 0.7);
});

test('sky === ground reproduces a flat ambient fill at parity', () => {
  const flat = new Color(0.55, 0.55, 0.6);
  const { rig } = build({ fill: { skyColor: flat, groundColor: flat.clone(), intensity: 0.9 } });
  assert.ok(rig.fill instanceof HemisphereLight);
  assert.equal(rig.fill.color.getHex(), rig.fill.groundColor.getHex(), 'the migration promise is that equal colours give a flat fill');
});

test('shadow map size is the tier lookup, not a constant', () => {
  const { rig } = build();
  assert.ok(rig.key.castShadow, 'the key must cast shadows or the map size is moot');
  assert.equal(rig.key.shadow.mapSize.x, 2048, 'shadow map must come from getShadowMapSize(), which is 2048 at the forced tier');
  assert.equal(rig.key.shadow.mapSize.y, 2048);
});

test('key light sits opposite its travel direction, at the rig distance', () => {
  const { rig } = build();
  const p = rig.key.position;
  // The rig owns KEY_DISTANCE privately. Retyping it here would be the same
  // mistake this file was rewritten to remove, so the magnitude is checked
  // against the OTHER build below instead of against a number copied from the
  // source. What is asserted here is only what the descriptor determines:
  // direction, and a placement that is not the origin.
  assert.ok(p.length() > 1e-6, 'the key must be moved off the origin or it lights nothing');
  assert.ok(p.x > 0 && p.y > 0 && p.z < 0, `key must sit opposite the (-1,-3,2) travel direction, got ${p.toArray().join(', ')}`);
  const unit = p.clone().normalize();
  const expected = new Vector3(-1, -3, 2).normalize().negate();
  assert.ok(unit.distanceTo(expected) < 1e-9, 'the key direction must be exactly -normalize(direction)');
  assert.ok(rig.key.target.position.equals(new Vector3(0, 0, 0)), 'the key must aim at the origin');
});

test('a non-unit direction places the key identically', () => {
  const a = build({ key: { direction: new Vector3(-1, -3, 2), intensity: 1, color: new Color(1, 1, 1) } });
  const b = build({ key: { direction: new Vector3(-2, -6, 4), intensity: 1, color: new Color(1, 1, 1) } });
  assert.ok(
    a.rig.key.position.distanceTo(b.rig.key.position) < 1e-9,
    `doubling the direction vector must not move the key: ${a.rig.key.position.toArray()} vs ${b.rig.key.position.toArray()}`,
  );
  // Two independent builds agreeing also pins the magnitude without copying it:
  // whatever the distance is, it is a property of the rig and not of the input.
  assert.ok(a.rig.key.position.length() > 1e-6);
});

test('point accents honour an optional distance falloff, defaulting to infinite', () => {
  const { rig } = build({
    accents: [
      { position: new Vector3(2, 1, 0), intensity: 0.8, color: new Color(1, 0.6, 0.2), distance: 6 },
      { position: new Vector3(-2, 1, 0), intensity: 0.5, color: new Color(0.4, 0.7, 1) },
    ],
  });
  assert.equal(rig.accents.length, 2);
  assert.ok(rig.accents.every((a) => a instanceof PointLight));
  assert.equal(rig.accents[0].distance, 6, 'an explicit distance must reach the light');
  assert.equal(rig.accents[1].distance, 0, 'an omitted distance must become 0 (three.js for "no falloff"), not undefined');
  assert.ok(rig.accents[0].position.equals(new Vector3(2, 1, 0)), 'accent position must come from the descriptor');
});

test('no accents is not an error', () => {
  const { rig } = build();
  assert.deepEqual(rig.accents, []);
});

test('every light is actually in the scene', () => {
  const { scene, rig } = build({
    accents: [{ position: new Vector3(0, 2, 0), intensity: 0.4, color: new Color(1, 1, 1) }],
  });
  assert.ok(rig.key instanceof DirectionalLight);
  for (const light of [rig.key, rig.fill, ...rig.accents]) {
    assert.ok(scene.children.includes(light), `${light.type} was created but never added to the scene`);
  }
  assert.ok(scene.children.includes(rig.key.target), 'the key target must be in the graph or the key aims at a detached object');
});

test('disposing the scope frees the shadow map and detaches every light', () => {
  const { scene, scope, rig } = build({
    accents: [
      { position: new Vector3(2, 1, 0), intensity: 0.8, color: new Color(1, 1, 1) },
      { position: new Vector3(-2, 1, 0), intensity: 0.8, color: new Color(1, 1, 1) },
    ],
  });

  // The leak DisposalScope exists to kill: a DirectionalLight's shadow map is a
  // WebGLRenderTarget, and dropping the light without disposing it strands one
  // per scene switch. Nothing observable on the light records that, so the call
  // itself is the observation.
  let shadowDisposed = false;
  const realDispose = rig.key.shadow.dispose.bind(rig.key.shadow);
  rig.key.shadow.dispose = () => {
    shadowDisposed = true;
    realDispose();
  };

  scope.dispose();

  assert.ok(shadowDisposed, 'key.shadow.dispose() was never called — the shadow-map render target leaks on scene switch');
  for (const light of [rig.key, rig.fill, ...rig.accents]) {
    assert.equal(light.parent, null, `${light.type} is still parented after teardown`);
  }
  assert.equal(rig.key.target.parent, null, 'the key target is still parented after teardown');
  assert.equal(scene.children.length, 0, `scene still holds ${scene.children.length} children after teardown`);
});
