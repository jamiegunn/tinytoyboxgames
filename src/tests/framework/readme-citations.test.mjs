/**
 * A README may not cite an identifier that does not exist.
 *
 * WHY THIS EXISTS
 * ---------------
 * bubble-pop/README.md documented `SPAWN_INTERVAL`, `SHOWER_SPAWN_INTERVAL`,
 * `SCORE_MILESTONE_INTERVAL`, `GIANT_TAPS`, `MIN_RESPAWN_DELAY`,
 * `MAX_RESPAWN_DELAY`, `CAMERA_RADIUS_PORTRAIT`, `CAMERA_RADIUS_LANDSCAPE`,
 * `getPhase` and `pickBubbleKind` as the live difficulty system. Every one was
 * dead, and the numbers they named disagreed with the numbers the game used.
 *
 * That is the worst version of this defect class. Dead code at least sits next
 * to the live code that contradicts it; a README is read *instead of* the
 * source, by exactly the reader who cannot check it — a new contributor, or a
 * model asked to change the balance.
 *
 * WHAT THIS CAN AND CANNOT PROVE
 * ------------------------------
 * Only that a cited identifier exists somewhere in that game's source, or in
 * the shared/framework code a game may legitimately reference. It cannot tell
 * you whether a real identifier is described *correctly* — no mechanical check
 * can. It catches the strictly worse failure, which needs no judgement to call.
 *
 * THE CONVENTION THIS DEPENDS ON
 * ------------------------------
 * Backticks mean "this exists". A README that wants to talk about something
 * deleted writes the name in plain text. Without that rule, a paragraph
 * explaining a removal is indistinguishable from a paragraph asserting it is
 * still there — which is the very confusion being fixed.
 *
 * WHAT IT COVERS, AND WHY THAT CHANGED
 * ------------------------------------
 * This walked `src/minigames/games/<game>/README.md` only. There is exactly one
 * such file, so the suite was guarding a single document while five scene
 * READMEs — including the Playroom's, which sits beside the `layout.ts` whose
 * eighteen dead exports started this whole hunt — went unchecked. It now finds
 * every README under `src/` by walking the tree, so a new one is covered the
 * day it is written rather than the day someone remembers to add a glob.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const PKG = new URL('../../', import.meta.url).pathname;
const SRC = join(PKG, 'src');

// `IDENT`, `IDENT(...)` — SCREAMING_CASE, camelCase or PascalCase only.
const TICK = /`([A-Za-z_][A-Za-z0-9_]*)\s*(?:\([^`]*\))?`/g;
const DECL = /\b(?:const|let|function|class|interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
// Object-literal keys and interface members. Both cases, because a scene
// README legitimately names config properties like `enableLegacyClickScan`
// and `buildContents`, which are declared as `name?: type` inside an
// interface and so are invisible to DECL.
const KEY = /^\s*(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]{2,})\??\s*:/gm;

// Platform globals and method names — not declarations anywhere in this repo.
const IGNORE = new Set([
  'kind',
  'colorIndex',
  'count',
  'target',
  'phase',
  'start',
  'teardown',
  'update',
  'ed',
  'p',
  'if',
  'true',
  'false',
  'null',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'setRGB',
  'onComplete',
  'meshBuilders',
  'activeCount',
  'celebrationSound',
  'intervalSeconds',
  'jitterSeconds',
  'clearAll',
  'pauseAll',
  'resumeAll',
]);

function tsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsFiles(full, out);
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function declarations(dir) {
  const names = new Set();
  if (!existsSync(dir)) return names;
  for (const file of tsFiles(dir)) {
    const body = readFileSync(file, 'utf8');
    for (const m of body.matchAll(DECL)) names.add(m[1]);
    for (const m of body.matchAll(KEY)) names.add(m[1]);
  }
  return names;
}

// What any README may reference without owning: the framework layers every
// game and every scene is built on top of.
const shared = new Set([
  ...declarations(join(PKG, 'src/minigames/shared')),
  ...declarations(join(PKG, 'src/minigames/framework')),
  ...declarations(join(PKG, 'src/toyboxes')),
  ...declarations(join(PKG, 'src/utils')),
]);

// Every README under src/, wherever it is. Found by walking rather than by a
// glob per directory, so the suite cannot quietly stop covering a document
// that moved.
function readmes(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) readmes(full, out);
    else if (entry === 'README.md') out.push(full);
  }
  return out;
}

const docs = readmes(SRC).map((file) => ({ file, dir: dirname(file), label: relative(SRC, file) }));

test('there are READMEs to check — a silent zero would make this suite vacuous', () => {
  assert.ok(docs.length >= 5, `expected the game and scene READMEs, found ${docs.length}`);
});

for (const { file, dir, label } of docs) {
  test(`${label} cites only identifiers that exist`, () => {
    // A README is answerable for its own subtree plus the shared framework.
    // Scoping to the subtree is what makes this more than "exists somewhere":
    // a doc that drifted onto a neighbour's identifier still fails.
    const own = declarations(dir);
    const readme = readFileSync(file, 'utf8');

    const ghosts = [];
    for (const m of readme.matchAll(TICK)) {
      const name = m[1];
      if (IGNORE.has(name)) continue;
      // Only judge things that look like code identifiers, not prose in ticks.
      const looksLikeIdent = name === name.toUpperCase() || /^[a-z]+[A-Z]/.test(name) || /^[A-Z]/.test(name);
      if (!looksLikeIdent) continue;
      if (!own.has(name) && !shared.has(name)) ghosts.push(name);
    }

    assert.deepEqual(
      [...new Set(ghosts)].sort(),
      [],
      `${label} names these in backticks but nothing declares them, not in its own directory tree and not in the shared framework. Either they were deleted and the README was not updated, or they never existed. Backticks mean "this exists" — write deleted names in plain text.`,
    );
  });
}
