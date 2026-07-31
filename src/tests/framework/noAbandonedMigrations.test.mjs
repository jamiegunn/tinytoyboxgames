/**
 * Every unification this codebase has attempted, with the number that says how
 * far it actually got.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT ANOTHER ALLOWLIST
 * ---------------------------------------------------
 * `noUnreachableModules.test.mjs` holds a list of admissions, one per file,
 * each with its own sentence of justification. That granularity is what this
 * file is a reaction to. Thirteen entries read as thirteen unrelated bits of
 * untidiness — a spring solver here, a preset table there, four barrels, a
 * generated stub — and every one of those sentences was true. Read together
 * they were one fact: this repo does not finish migrations, and every mechanism
 * that makes a migration safe to start is also a mechanism that makes not
 * finishing it free. An optional parameter. A barrel that can coexist with the
 * deep paths. An old function kept "for its existing callers". Each is a way to
 * ship half of something and have nothing anywhere go red.
 *
 * A per-file list cannot show that, because the disease is not in any file.
 *
 * WHAT A NUMBER HERE MEANS — AND THE TRAP IN IT
 * ---------------------------------------------
 * The first pass of this register counted importers and concluded that six of
 * the seven migrations below had been abandoned. That was wrong, and wrong in
 * the more embarrassing direction: they had SUCCEEDED, and the import count
 * could not see it, because this codebase completes a migration by INVERSION.
 * The old function is rewritten to call the new engine and keeps its name and
 * its signature. `createGameLighting` builds its lights with `createLightingRig`.
 * `createDisposeCollector` delegates to `createDisposalScope`. The world tap
 * dispatcher is, in its own words, a thin adapter over the interaction
 * controller. Every call site keeps the import it already had, so the new
 * module ends up with two or three importers and looks stillborn while being
 * universal.
 *
 * So an importer count is evidence of NOTHING on its own. It is only meaningful
 * next to the answer to "and does the old API call the new one?" — which is why
 * every entry below carries both, and why the inverted entries assert the
 * delegation edge itself. Deleting `createLightingRig` out of
 * `createGameLighting` and pasting the light-building back in would leave every
 * other number in this file unchanged and every other test in the suite green.
 * That is the failure this register is for.
 *
 * There are two counts and they are not the same count. "Files importing this
 * MODULE" and "files importing this SYMBOL" differ wherever an importer takes
 * only a type: `minigames/shared/sceneSetup.ts` has 5 importers and
 * `createGameLighting` has 3 callers, and the gap is two files that want
 * `GameLightingRig` and `GameLights`. The first draft of this file filled the
 * `oldApiCallers` fields with module counts — 5, 3, 4 — and the second test
 * below rejected all three on its first run. Both numbers are honest; only one
 * answers "how many places still call the old function". The distinction has
 * now cost this review two wrong tables, so it is asserted rather than trusted.
 *
 * WHAT THIS DOES NOT CHECK
 * ------------------------
 * Import edges and function arity. Not behaviour. An entry marked `inverted` is
 * asserted to have the delegation edge; it is NOT asserted that the delegating
 * function produces the same lights, the same teardown order, or the same tap
 * forgiveness it did before. Three of the seven entries below rest on that
 * unchecked step, and the contract tests that would cover it exist for disposal
 * (LIFO, idempotence, exception isolation) and do not exist for lighting or
 * for camera. Two of seven, unguarded, named here so the gap carries a size.
 *
 * HOW TO USE IT WHEN IT FAILS
 * ---------------------------
 * A number moving is not a regression by itself — it is a migration changing
 * state, which is the event this file exists to make loud. Update the literal
 * AND the prose next to it in the same commit. An entry whose number has been
 * edited without its sentence being re-read is how the reachability allowlist
 * came to assert, for months, that seventeen files imported a module that one
 * file imports.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SRC, walk, reachFrom, namedImportsOf, resolve } from './_moduleGraph.mjs';

const liveFiles = reachFrom([path.join(SRC, 'main.tsx'), path.join(SRC, 'main.ts')]);
const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');

/**
 * Every (importer, target, symbol) edge under `src/`, with liveness attached.
 *
 * Edges, not text matches. `grep -c` on an identifier that is also an ordinary
 * English word has produced two wrong verdicts in this repo's review history —
 * "duck" matched 36 rubber ducks, "lifecycle" matched a docblock sentence — and
 * a third that shipped: the reachability allowlist's claim that 17 files import
 * `utils/idle/idleAnimator` directly. One does. The other 16 mention it.
 */
const EDGES = [];
for (const file of walk(SRC)) {
  const { named } = namedImportsOf(readFileSync(file, 'utf8'));
  for (const { spec, name } of named) {
    const target = resolve(spec, file);
    if (target) EDGES.push({ from: rel(file), live: liveFiles.has(file), to: rel(target), name });
  }
}

/** Live files importing anything from a module. */
const importersOf = (target) => new Set(EDGES.filter((e) => e.live && e.to === target).map((e) => e.from));

/** Live files importing one specific symbol, from wherever it is exported. */
const callersOf = (symbol) => new Set(EDGES.filter((e) => e.live && e.name === symbol).map((e) => e.from));

/** True if `fromModule` imports `symbol` from `toModule` — the delegation edge. */
const delegates = (fromModule, symbol, toModule) => EDGES.some((e) => e.from === fromModule && e.name === symbol && e.to === toModule);

/**
 * The register. `state` is the claim; the numbers are the evidence for it.
 *
 * - `inverted`  the old API was rewritten onto the new engine. Call sites kept
 *               their imports. Adoption is total and the importer count is low.
 * - `split`     two mechanisms, both live, neither calling the other.
 * - `abandoned` the seam exists, is reachable from nothing, and nothing routes
 *               through it by any path.
 * - `resolved`  decided and closed. Recorded so it cannot silently restart.
 */
const MIGRATIONS = [
  {
    id: 'lighting',
    state: 'inverted',
    seam: 'utils/lighting/lightingRig.ts — createLightingRig',
    supersedes: 'createSceneLighting (LightingConfig) and createGameLighting (flat AmbientLight misnamed hemisphericIntensity)',
    // 2 importers, and they are the two hubs: scenes go through sceneHelpers,
    // games through minigames/shared/sceneSetup. Nothing else needs to know.
    importers: 2,
    delegation: { from: 'minigames/shared/sceneSetup.ts', symbol: 'createLightingRig', to: 'utils/lighting/lightingRig.ts' },
    // The old name is not a survivor; it is the front of the new engine.
    // 3 games call it: fireflies, little-shark, star-catcher.
    oldApi: 'createGameLighting',
    oldApiCallers: 3,
  },
  {
    id: 'disposal',
    state: 'inverted',
    seam: 'utils/disposal.ts — createDisposalScope',
    supersedes: 'createDisposeCollector, disposeSceneResources, disposeMeshDeep, disposeGameRig',
    importers: 17,
    // sceneHelpers holds the legacy collector and builds it out of the scope.
    delegation: { from: 'utils/sceneHelpers.ts', symbol: 'createDisposalScope', to: 'utils/disposal.ts' },
    oldApi: 'createDisposeCollector',
    // All 5 scenes still say `createDisposeCollector`, and all 5 therefore get
    // LIFO, idempotent, exception-isolated teardown. The debt is the name.
    oldApiCallers: 5,
  },
  {
    id: 'interaction',
    state: 'inverted',
    seam: 'utils/interaction/interactionController.ts — createInteractionController',
    supersedes: 'createWorldTapDispatcher, createInputDispatcher, createTapInteraction, wireToyboxInteractions, the room userData.onClick scan',
    // 2 importers, both of them things it replaced. The chain is three deep:
    // 17 prop files -> createTapInteraction -> dispatcher (38) -> controller.
    importers: 2,
    delegation: { from: 'utils/worldTapDispatcher.ts', symbol: 'createInteractionController', to: 'utils/interaction/interactionController.ts' },
    oldApi: 'createTapInteraction',
    // 15 -> 17: the Kitchen's two new side-wall pieces (decor/plateRack.ts,
    // decor/wallPegs.ts). This ratchet fired on them and it fired correctly — they
    // ARE new call sites against a superseded name. Raising the number rather than
    // writing them against the controller is a deliberate choice with a reason:
    // this migration is `inverted`, so every one of these callers already runs on
    // the new engine and the only debt is the name. All 15 siblings in the same
    // decor families say `createTapInteraction`; two files saying something else
    // would not finish the migration, it would start a third convention inside one
    // room — which is the exact failure the entry above describes. The debt is
    // real and it is now 17 files wide instead of 15.
    oldApiCallers: 17,
  },
  {
    id: 'camera',
    state: 'split',
    seam: 'utils/camera/cameraDescriptor.ts — the one spherical convention',
    supersedes: 'the fixed shell camera, the orbit scene camera (θ+π carry-over), createGameCamera (Babylon beta/radius/alpha)',
    // The one that did NOT invert. All 3 importers are minigames/framework; no
    // scene imports it. Scenes use cameraPresets.createSceneCamera, which does
    // not call anything here — it builds its own Spherical. Two conventions,
    // split cleanly along the games/scenes line, both live.
    importers: 3,
    delegation: null,
    // Both scene factories call it; SceneFrame imports only the CameraHandle
    // type from the same module, which is why this is 2 and not 3.
    oldApi: 'createSceneCamera',
    oldApiCallers: 2,
  },
  {
    id: 'scene-composition',
    state: 'abandoned',
    seam: 'utils/scene/buildScene.ts — descriptor-driven scene composition',
    supersedes: 'nothing, yet — it is the proposal, not the replacement',
    // Zero importers, live or dead, after this round removed the barrels that
    // used to point at it. The five scenes compose through two imperative roots
    // instead: createWorldScene (naturescene, pirate-cove) and createRoomScene
    // (kitchen, living-room, playroom).
    importers: 0,
    delegation: null,
    // 2 world scenes here; createRoomScene carries the other 3. Both counts
    // matter and only one fits this field, so the second is asserted in its
    // own test below rather than left to a comment nothing checks.
    oldApi: 'createWorldScene',
    oldApiCallers: 2,
  },
  {
    id: 'scene-lifecycle',
    state: 'abandoned',
    seam: 'SceneFrame.tsx — the optional 4th `lifecycle` argument to createScene',
    supersedes: 'per-scene clock and disposal wiring',
    // Not measurable as an import edge: this one is an ARITY. SceneFrame calls
    // module.createScene(scene, canvas, nav, { clock, disposal }) on every
    // scene load, and all five createScene functions take three parameters, so
    // the fourth argument is constructed and discarded five times. It type
    // checks because sceneCatalog types its loaders () => Promise<unknown>,
    // SceneFrame casts, and the parameter is declared optional with the comment
    // "scenes that ignore it keep working". Six green instruments cannot see
    // a 0%-adopted optional parameter. See the arity test below.
    importers: null,
    delegation: null,
    oldApi: null,
    oldApiCallers: null,
  },
  {
    id: 'public-surface-barrels',
    state: 'resolved',
    seam: 'utils/{camera,lighting,interaction,idle,scene}/index.ts',
    supersedes: 'deep imports',
    // Closed by deletion, not by adoption. Live importers at time of deletion:
    // camera 0, lighting 0, interaction 0, scene 0, idle 0 — and idle's was 0
    // in both directions, since the 17 idle consumers go through
    // utils/idle/registry.ts and only ONE file imports idleAnimator at all.
    // A barrel is adopted the week it is written or never. Recorded so that
    // adding one back is a decision rather than a habit.
    importers: 0,
    delegation: null,
    oldApi: null,
    oldApiCallers: null,
  },
];

test('every migration entry still has the adoption it claims', () => {
  const drift = [];
  for (const m of MIGRATIONS) {
    if (m.importers === null) continue;
    const target = m.seam.split(' — ')[0];
    if (m.id === 'public-surface-barrels') continue;
    const actual = importersOf(target).size;
    if (actual !== m.importers) drift.push(`${m.id}: ${target} has ${actual} live importers, entry says ${m.importers}`);
  }
  assert.deepEqual(
    drift,
    [],
    `A migration changed state and this register still describes the old one:\n` +
      drift.map((d) => `   ${d}`).join('\n') +
      `\n\nUp is not automatically good and down is not automatically bad — three of the\n` +
      `entries here are at 2 or 3 importers BECAUSE they succeeded. Work out which\n` +
      `direction this is, then update the literal and the sentence beside it together.\n`,
  );
});

test('every superseded API still has the caller count the register admits to', () => {
  const drift = [];
  for (const m of MIGRATIONS) {
    if (m.oldApi === null) continue;
    const actual = callersOf(m.oldApi).size;
    if (actual !== m.oldApiCallers) drift.push(`${m.id}: ${m.oldApi} has ${actual} live callers, entry says ${m.oldApiCallers}`);
  }
  assert.deepEqual(
    drift,
    [],
    `The old side of a migration moved:\n` +
      drift.map((d) => `   ${d}`).join('\n') +
      `\n\nA count going UP means a new call site was written against the superseded API,\n` +
      `which is the thing this register exists to catch — it is always legal, always\n` +
      `silent, and it is how a migration stops being unfinished and starts being a\n` +
      `second convention. A count going DOWN means someone is finishing the job.\n`,
  );
});

test('every inverted migration still delegates to the engine it claims to use', () => {
  const broken = [];
  for (const m of MIGRATIONS) {
    if (m.state !== 'inverted') continue;
    const d = m.delegation;
    if (!delegates(d.from, d.symbol, d.to)) broken.push(`${m.id}: ${d.from} no longer imports ${d.symbol} from ${d.to}`);
  }
  assert.deepEqual(
    broken,
    [],
    `An "inverted" entry claims the old API is a front for the new engine, and the\n` +
      `delegation edge is gone:\n` +
      broken.map((b) => `   ${b}`).join('\n') +
      `\n\nThis is the failure mode the importer counts CANNOT see. If the light-building\n` +
      `(or teardown, or tap routing) was pasted back into the old function, every\n` +
      `number in this file stays correct, every other test in the suite stays green,\n` +
      `and the unification is silently undone. Either restore the delegation or change\n` +
      `the entry's state to 'split' and say why.\n`,
  );
});

test('the five scenes are still composed by exactly the two imperative roots, and no third', () => {
  const world = callersOf('createWorldScene');
  const room = callersOf('createRoomScene');
  const composed = new Set([...world, ...room]);

  assert.equal(world.size, 2, `createWorldScene: expected 2 callers (naturescene, pirate-cove), found ${world.size}.`);
  assert.equal(room.size, 3, `createRoomScene: expected 3 callers (kitchen, living-room, playroom), found ${room.size}.`);

  const sceneFiles = walk(SRC)
    .filter((f) => /export function createScene\(/.test(readFileSync(f, 'utf8')))
    .map(rel);

  const unaccounted = sceneFiles.filter((f) => !composed.has(f));
  assert.deepEqual(
    unaccounted,
    [],
    `A scene exports createScene but composes through neither imperative root:\n` +
      unaccounted.map((f) => `   ${f}`).join('\n') +
      `\n\nThat is either the third composition root — which is how two became two, and\n` +
      `is the exact event 'scene-composition' is parked waiting for — or it is\n` +
      `buildScene finally being used, in which case this register is out of date in\n` +
      `the good direction. Say which in the entry above before making this pass.\n`,
  );
});

test('the scene lifecycle argument is adopted by exactly as many scenes as the register says: none', () => {
  const arities = [];
  for (const file of walk(SRC)) {
    const m = readFileSync(file, 'utf8').match(/export function createScene\(([^)]*)\)/);
    if (m) arities.push({ file: rel(file), params: m[1].split(',').length });
  }

  assert.equal(
    arities.length,
    5,
    `Expected 5 exported createScene functions, found ${arities.length}. The register's 0-of-5 is stated against that denominator.`,
  );

  const accepting = arities.filter((a) => a.params >= 4);
  assert.deepEqual(
    accepting.map((a) => a.file),
    [],
    `A scene now accepts the lifecycle argument SceneFrame has been passing all along:\n` +
      accepting.map((a) => `   ${a.file} (${a.params} params)`).join('\n') +
      `\n\nThat is good news and it makes this entry stale. Move 'scene-lifecycle' off\n` +
      `'abandoned', record how many of the 5 have migrated, and check whether the\n` +
      `parameter can stop being optional — while it is optional, the next scene to be\n` +
      `written will omit it and nothing will say so.\n`,
  );
});
