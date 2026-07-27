/**
 * No module may be unreachable from the app without saying so out loud.
 *
 * WHY THIS EXISTS
 * ---------------
 * A static-analysis sweep found 2,000+ lines under `src/` that nothing loads.
 * The worst of it was not fragments or stubs — it was `little-shark/fish/`'s
 * five-species roster: 963 lines, complete, documented, internally consistent,
 * and answering a complaint the game had actually received. Every signal said
 * "finished feature, someone forgot the wire". Measurement said wiring it in
 * would have cost 72% of the reef's worst-case legibility.
 *
 * That is the defect class this guards. Not "unused code is untidy" — unused
 * code that READS AS SHIPPED, so the next reader (human or model) concludes the
 * app does something it does not, or worse, helpfully connects it.
 *
 * WHY REACHABILITY AND NOT AN UNUSED-EXPORT CHECK
 * -----------------------------------------------
 * An unused-symbol search has a hole it cannot see past: file A imports a
 * symbol from file B, so B's export is "used" — but nothing imports A either.
 * The reference is real and the code is still unreachable. That is exactly how
 * the species cluster hid: `fish/meshes.ts` and `waves/templates.ts` both
 * imported `FishSpeciesId` from `fish/species.ts`, so species.ts looked
 * referenced from two directions while all three were orphans together.
 *
 * The same hole is live in the allowlist below. Three of the four `utils/*`
 * barrels ARE imported — only by `utils/scene/`, which is itself unreachable.
 * One connected dead component, not four independent facts.
 *
 * WHAT THIS CAN AND CANNOT PROVE
 * ------------------------------
 * It follows static imports, `export ... from`, and `import()` with a literal
 * specifier, starting from the real browser entry point. It CANNOT follow an
 * `import()` with a computed specifier, or a path that is not an import at all
 * (a worker URL, a string handed to a bundler plugin). If one of those ever
 * appears, this test will call its target unreachable and be WRONG — so it
 * fails loudly on any computed `import()` it finds rather than quietly
 * widening the graph, and the fix is to judge that edge by hand, not to
 * allowlist its target.
 *
 * Modules reached only by `tests/` or `.probe/` are not defects and are not
 * flagged; those roots are walked and their reach subtracted.
 *
 * THE CONVENTION THIS DEPENDS ON
 * ------------------------------
 * The allowlist is a list of ADMISSIONS, not permissions. Each entry states
 * why the module is unreachable and what the live mechanism is instead. Adding
 * an entry is cheap and that is deliberate: the point is not to forbid dead
 * code, it is to make dead code impossible to leave lying around SILENTLY.
 *
 * The list is checked in both directions. An unreachable module missing from
 * it fails; an entry naming a module that is no longer unreachable ALSO fails.
 * Without that second check the list rots into a graveyard of names that were
 * dead once, and a stale allowlist is worse than none — it is a document
 * asserting the codebase is in a state it has since left.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'src');

/**
 * Modules the app never loads, each with the reason it is still here.
 *
 * Keep the key as a repo-relative path from `src/`. Keep the reason specific
 * enough that a reader can act on it without re-deriving the analysis.
 */
const ALLOWED = {
  // ── One connected dead component: a generic descriptor-driven scene builder,
  // plus the three barrels whose ONLY importer is that builder. The standards
  // doc already discloses this cluster ("the schema and builder exist; nothing
  // calls the builder") — every scene composes imperatively instead. Listed
  // per-file so that partially reviving it cannot pass unnoticed.
  'utils/scene/buildScene.ts': 'Descriptor-driven scene builder; every scene composes imperatively instead. Disclosed in architecture-standards.md.',
  'utils/scene/sceneDescriptor.ts': 'Schema for the unused builder above.',
  'utils/scene/sceneDescriptors.ts': 'Per-scene data for the unused builder above.',
  'utils/scene/index.ts': 'Barrel for the unused builder above.',
  'utils/camera/index.ts':
    'Public-surface barrel. Sole importers are utils/scene/*, which is itself dead; live code imports utils/camera/cameraDescriptor directly.',
  'utils/interaction/index.ts': 'Public-surface barrel. Sole importers are utils/scene/*, which is itself dead; live code imports the deep paths directly.',
  'utils/lighting/index.ts':
    'Public-surface barrel. Sole importers are utils/scene/*, which is itself dead; live code imports utils/lighting/lightingRig directly.',
  'utils/idle/index.ts': 'Public-surface barrel with NO importer at all, dead or alive: all 17 consumers import utils/idle/idleAnimator directly.',

  // ── Known debt, triaged and not yet resolved. Each of these is a candidate
  // for the same delete-with-doctrine treatment the species roster got; none
  // has been measured yet, and none is being wired in on a hunch.
  'minigames/games/bubble-pop/animation/spring.ts': 'Spring solver; bubble-pop animates from balance curves instead.',
  'minigames/games/bubble-pop/animation/index.ts': 'Barrel for the spring solver above.',
  'utils/animationPresets.ts': 'Preset table; scenes call the idle animator directly.',
  'utils/scatterDecoratives.ts': 'Scatter helper; scenes place decoratives explicitly.',
  'scenes/immersive-toybox-scenes/pirate-cove/parent-scene-stubs/playroom.toybox.stub.ts': 'Generator-emitted parent-scene stub.',
};

const EXTS = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
const ALIASES = [
  ['@app/', 'src/'],
  ['@scenes/', 'src/scenes/'],
  ['@game/', 'src/minigames/'],
];

/** Every source file under a directory, recursively. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'out') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.includes(path.extname(entry))) out.push(full);
  }
  return out;
}

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** Static import specifiers in a file, plus any computed `import()` found. */
function specifiersOf(src) {
  const body = stripComments(src);
  const literal = [];
  const patterns = [
    /(?:^|\n)\s*import\s[^;'"]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s[^;'"]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of body.matchAll(re)) literal.push(m[1]);
  const computed = [...body.matchAll(/\bimport\s*\(\s*[^'")][^)]*\)/g)].map((m) => m[0].trim());
  return { literal, computed };
}

/** Resolves a specifier to a real file, or null for anything outside the repo. */
function resolve(spec, fromFile) {
  let rel = null;
  if (spec.startsWith('.')) {
    rel = path.resolve(path.dirname(fromFile), spec);
  } else {
    for (const [alias, target] of ALIASES) {
      if (spec.startsWith(alias)) {
        rel = path.join(ROOT, target, spec.slice(alias.length));
        break;
      }
    }
    if (rel === null) return null;
  }
  if (existsSync(rel) && statSync(rel).isFile()) return rel;
  for (const ext of EXTS) if (existsSync(rel + ext)) return rel + ext;
  for (const ext of EXTS) {
    const idx = path.join(rel, 'index' + ext);
    if (existsSync(idx)) return idx;
  }
  return null;
}

const computedImports = [];

/** Walks the import graph from a set of roots and returns every file reached. */
function reachFrom(roots, recordComputed) {
  const seen = new Set();
  const queue = roots.filter((r) => existsSync(r));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const { literal, computed } = specifiersOf(readFileSync(file, 'utf8'));
    if (recordComputed) for (const c of computed) computedImports.push({ file: path.relative(ROOT, file), expr: c });
    for (const spec of literal) {
      const target = resolve(spec, file);
      if (target) queue.push(target);
    }
  }
  return seen;
}

const appReach = reachFrom([path.join(SRC, 'main.tsx'), path.join(SRC, 'main.ts')], true);
const otherReach = new Set([...reachFrom(walk(path.join(ROOT, 'tests')), false), ...reachFrom(walk(path.join(ROOT, '.probe')), false)]);

const unreachable = walk(SRC)
  .filter((f) => !appReach.has(f) && !otherReach.has(f))
  .map((f) => path.relative(SRC, f).split(path.sep).join('/'));

test('the reachability graph is complete enough to trust', () => {
  assert.equal(
    computedImports.length,
    0,
    `A computed import() was found, so the module graph below it is invisible to this test and\n` +
      `every "unreachable" verdict it produces is suspect. Judge the edge by hand — do NOT\n` +
      `allowlist its target:\n` +
      computedImports.map((c) => `   ${c.file}  ${c.expr}`).join('\n'),
  );
});

test('no module is unreachable from the app without an allowlist entry explaining why', () => {
  const undeclared = unreachable.filter((f) => !(f in ALLOWED));
  assert.deepEqual(
    undeclared,
    [],
    `These modules are under src/ but nothing — not the app, not a test, not a probe — loads them:\n` +
      undeclared.map((f) => `   ${f}`).join('\n') +
      `\n\nThat usually means one of three things, and they need different fixes:\n` +
      `  1. It was meant to be wired in and never was. MEASURE whether connecting it helps\n` +
      `     before connecting it — the last one that looked obviously good would have made\n` +
      `     the game 72% worse on its own headline metric.\n` +
      `  2. It was superseded and the replacement lives elsewhere. Delete it, and leave a\n` +
      `     NOT-HERE-DELIBERATELY block saying what it claimed and what is true instead.\n` +
      `  3. It is knowingly parked. Add it to ALLOWED in this file with a reason specific\n` +
      `     enough to act on.\n`,
  );
});

test('every allowlist entry still names a module that is actually unreachable', () => {
  const live = new Set(unreachable);
  const stale = Object.keys(ALLOWED).filter((f) => !live.has(f));
  assert.deepEqual(
    stale,
    [],
    `These allowlist entries no longer describe reality — each names a module that is now\n` +
      `either wired in or deleted:\n` +
      stale.map((f) => `   ${f}`).join('\n') +
      `\n\nRemove them. An allowlist that outlives its subjects stops being a record of known\n` +
      `debt and becomes a document asserting a state the codebase has already left, which is\n` +
      `the exact failure this whole suite exists to prevent.\n`,
  );
});
