/**
 * SceneDescriptor contract tests.
 *
 * Enforces architecture-standards.md#scenedescriptor — the capstone schema and
 * its one builder. Three guarantees are pinned:
 *
 *  1. Every REGISTERED descriptor validates (non-empty audio per
 *     audio-standards.md, a resolvable backdrop when present, a valid camera) —
 *     run behaviourally against the *actual* registry via `_tsload`.
 *  2. The validator actually REJECTS malformed descriptors — ruthless boundary
 *     cases, so the guarantee above can't pass vacuously.
 *  3. Each descriptor agrees with `sceneCatalog.ts` (camera pose + audio ids) so
 *     the declarative registry and the generator-owned catalog can never drift;
 *     and every immersive-toybox scene in the catalog has a descriptor.
 *
 * Plus a source-contract check that `buildScene` composes the standardized
 * primitives (camera, lighting rig, scene-runtime publish, interaction
 * controller) and routes teardown through the DisposalScope.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTs } from './_tsload.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const catalogSource = readFileSync(path.join(packageRoot, 'src', 'scenes', 'sceneCatalog.ts'), 'utf8');
const buildSceneSource = readFileSync(path.join(packageRoot, 'src', 'utils', 'scene', 'buildScene.ts'), 'utf8');

const { validateSceneDescriptor } = await loadTs('src/utils/scene/sceneDescriptor.ts');
const { SCENE_DESCRIPTORS } = await loadTs('src/utils/scene/sceneDescriptors.ts');

// ── Test fixtures (duck-typed to the validator's structural checks) ──────────
const vec = (x, y, z) => ({ x, y, z, lengthSq: () => x * x + y * y + z * z });
const col = (r, g, b) => ({ r, g, b });

/** A minimal, fully-valid descriptor to mutate in the boundary tests. */
function validBase() {
  return {
    id: 'nature',
    camera: { kind: 'orbit', target: vec(0, 0.3, 0), azimuth: Math.PI, polar: 1.2, distance: 10, fov: 50 },
    lighting: {
      key: { direction: vec(-0.4, -1, 0.6), intensity: 0.7, color: col(0.95, 0.9, 0.7) },
      fill: { skyColor: col(0.6, 0.8, 0.55), groundColor: col(0.15, 0.12, 0.08), intensity: 0.45 },
    },
    ground: { color: col(0.28, 0.4, 0.18), width: 16, depth: 14 },
    audio: { musicId: 'mus_nature_background', ambientId: 'amb_nature_stream' },
  };
}

// ── 1. Every registered descriptor is valid ──────────────────────────────────
test('every registered scene descriptor validates', () => {
  const ids = Object.keys(SCENE_DESCRIPTORS);
  assert.ok(ids.length >= 2, `expected at least 2 registered descriptors, found ${ids.length}`);
  for (const id of ids) {
    const problems = validateSceneDescriptor(SCENE_DESCRIPTORS[id]);
    assert.deepEqual(problems, [], `descriptor "${id}" has validation problems:\n  ${problems.join('\n  ')}`);
    assert.equal(SCENE_DESCRIPTORS[id].id, id, `descriptor keyed "${id}" must carry id "${id}"`);
  }
});

// ── 2. The validator rejects malformed descriptors (ruthless boundaries) ──────
test('rejects empty audio ids (audio-standards.md: every scene ships music AND ambient)', () => {
  const noMusic = validBase();
  noMusic.audio.musicId = '';
  assert.ok(
    validateSceneDescriptor(noMusic).some((p) => p.includes('musicId')),
    'empty musicId must be rejected',
  );
  const noAmbient = validBase();
  noAmbient.audio.ambientId = '';
  assert.ok(
    validateSceneDescriptor(noAmbient).some((p) => p.includes('ambientId')),
    'empty ambientId must be rejected',
  );
});

test('rejects an out-of-range camera fov', () => {
  for (const badFov of [0, -10, 180, 200, Number.NaN]) {
    const d = validBase();
    d.camera.fov = badFov;
    assert.ok(
      validateSceneDescriptor(d).some((p) => p.includes('fov')),
      `fov ${badFov} must be rejected`,
    );
  }
});

test('rejects an orbit camera with polar outside (0, π) or distance <= 0', () => {
  const flatPolar = validBase();
  flatPolar.camera.polar = Math.PI; // exactly π — degenerate (looking straight down the pole)
  assert.ok(
    validateSceneDescriptor(flatPolar).some((p) => p.includes('polar')),
    'polar === π must be rejected',
  );

  const zeroPolar = validBase();
  zeroPolar.camera.polar = 0;
  assert.ok(
    validateSceneDescriptor(zeroPolar).some((p) => p.includes('polar')),
    'polar === 0 must be rejected',
  );

  const zeroDist = validBase();
  zeroDist.camera.distance = 0;
  assert.ok(
    validateSceneDescriptor(zeroDist).some((p) => p.includes('distance')),
    'distance === 0 must be rejected',
  );
});

test('rejects a zero-length key light direction', () => {
  const d = validBase();
  d.lighting.key.direction = vec(0, 0, 0);
  assert.ok(
    validateSceneDescriptor(d).some((p) => p.includes('direction') && p.includes('non-zero')),
    'a zero-length key direction gives no lighting and must be rejected',
  );
});

test('rejects a non-positive ground size', () => {
  const d = validBase();
  d.ground.width = 0;
  assert.ok(
    validateSceneDescriptor(d).some((p) => p.includes('ground.width')),
    'ground.width === 0 must be rejected',
  );
  const d2 = validBase();
  d2.ground.depth = -5;
  assert.ok(
    validateSceneDescriptor(d2).some((p) => p.includes('ground.depth')),
    'negative ground.depth must be rejected',
  );
});

test('rejects a backdrop with a non-positive radius or non-finite colour', () => {
  const badRadius = validBase();
  badRadius.backdrop = { radius: 0, center: vec(0, 0, 0), topColor: col(0, 0, 0), horizonColor: col(0, 0, 0), bottomColor: col(0, 0, 0) };
  assert.ok(
    validateSceneDescriptor(badRadius).some((p) => p.includes('backdrop.radius')),
    'backdrop.radius === 0 must be rejected',
  );

  const badColor = validBase();
  badColor.backdrop = { radius: 40, center: vec(0, 0, 0), topColor: col(Number.NaN, 0, 0), horizonColor: col(0, 0, 0), bottomColor: col(0, 0, 0) };
  assert.ok(
    validateSceneDescriptor(badColor).some((p) => p.includes('backdrop.topColor')),
    'a non-finite backdrop colour must be rejected',
  );
});

test('a descriptor with no backdrop is valid (backdrop is optional)', () => {
  const d = validBase(); // no backdrop field
  assert.deepEqual(validateSceneDescriptor(d), [], 'omitting the optional backdrop must not produce problems');
});

test('rejects a portal with an empty gameId', () => {
  const d = validBase();
  d.portals = [{ gameId: '', position: vec(1, 0, 1), color: col(1, 1, 1) }];
  assert.ok(
    validateSceneDescriptor(d).some((p) => p.includes('portals[0].gameId')),
    'an empty portal gameId must be rejected',
  );
});

// ── 3. Anti-drift: each descriptor agrees with the catalog ────────────────────

/** Returns the source slice for one scene entry in the catalog. */
function catalogBlock(id) {
  const key = id.includes('-') ? `'${id}'` : id;
  const start = catalogSource.indexOf(`\n  ${key}: {`);
  assert.ok(start >= 0, `catalog entry for "${id}" not found`);
  // The next 2-space-indented key, or the generator marker, ends the block.
  const rest = catalogSource.slice(start + 1);
  const nextKey = rest.slice(1).search(/\n {2}(?:'[^']+'|[A-Za-z0-9-]+): \{|\n {2}\/\/ __/);
  return nextKey >= 0 ? rest.slice(0, nextKey + 1) : rest;
}

/** Parses a numeric RHS token, mapping `Math.PI` to the real value. */
function num(token) {
  const t = token.trim();
  if (t === 'Math.PI') return Math.PI;
  return Number(t);
}

test('every registered descriptor matches the catalog camera preset and audio', () => {
  for (const [id, d] of Object.entries(SCENE_DESCRIPTORS)) {
    const block = catalogBlock(id);

    const music = block.match(/musicId:\s*'([^']*)'/);
    const ambient = block.match(/ambientId:\s*'([^']*)'/);
    assert.ok(music && ambient, `catalog "${id}" is missing audio ids`);
    assert.equal(d.audio.musicId, music[1], `descriptor "${id}" musicId drifted from the catalog`);
    assert.equal(d.audio.ambientId, ambient[1], `descriptor "${id}" ambientId drifted from the catalog`);

    const azimuth = block.match(/azimuth:\s*([^,\n]+)/);
    const polar = block.match(/polar:\s*([^,\n]+)/);
    const distance = block.match(/distance:\s*([^,\n]+)/);
    const target = block.match(/target:\s*\[([^\]]+)\]/);
    assert.ok(azimuth && polar && distance && target, `catalog "${id}" is missing a camera preset field`);

    assert.equal(d.camera.kind, 'orbit', `descriptor "${id}" should use an orbit camera to match the catalog preset`);
    assert.ok(Math.abs(d.camera.azimuth - num(azimuth[1])) < 1e-9, `descriptor "${id}" azimuth drifted from the catalog`);
    assert.ok(Math.abs(d.camera.polar - num(polar[1])) < 1e-9, `descriptor "${id}" polar drifted from the catalog`);
    assert.ok(Math.abs(d.camera.distance - num(distance[1])) < 1e-9, `descriptor "${id}" distance drifted from the catalog`);

    const [tx, ty, tz] = target[1].split(',').map((s) => Number(s));
    assert.ok(
      Math.abs(d.camera.target.x - tx) < 1e-9 && Math.abs(d.camera.target.y - ty) < 1e-9 && Math.abs(d.camera.target.z - tz) < 1e-9,
      `descriptor "${id}" camera target drifted from the catalog`,
    );
  }
});

test('every immersive-toybox scene in the catalog has a registered descriptor', () => {
  // Scene entries whose kind is immersive-toybox — the scenes the schema governs.
  const immersive = [];
  for (const m of catalogSource.matchAll(/\n {2}(?:'([^']+)'|([A-Za-z0-9-]+)): \{/g)) {
    const id = m[1] ?? m[2];
    const block = catalogBlock(id);
    if (/kind:\s*'immersive-toybox'/.test(block)) immersive.push(id);
  }
  assert.ok(immersive.length >= 2, `expected at least 2 immersive scenes, found ${immersive.length}: ${immersive}`);
  for (const id of immersive) {
    assert.ok(SCENE_DESCRIPTORS[id], `immersive scene "${id}" has no registered SceneDescriptor`);
  }
});

// ── 4. buildScene composes the standardized primitives ────────────────────────
test('buildScene composes camera, lighting, scene-runtime, interaction, and disposes via the scope', () => {
  const required = [
    ['createFrameClock(', 'must create the scene FrameClock'],
    ['createDisposalScope(', 'must create the scene DisposalScope'],
    ['setSceneRuntime(', 'must publish the clock+scope on the per-scene runtime registry'],
    ['createCamera(', 'must build the camera from the descriptor (§7)'],
    ['createLightingRig(', 'must build the lighting rig from the descriptor (§6)'],
    ['createGradientSkydome(', 'must build the backdrop from the sky rig when present'],
    ['createInteractionController(', 'must build the interaction controller'],
    ['scope.dispose()', 'dispose() must route through the scope'],
  ];
  for (const [needle, why] of required) {
    assert.ok(buildSceneSource.includes(needle), `buildScene ${why} (missing \`${needle}\`)`);
  }
  // The backdrop is only built when the descriptor declares one.
  assert.ok(/if \(d\.backdrop\)/.test(buildSceneSource), 'buildScene must guard skydome creation on d.backdrop');
});
