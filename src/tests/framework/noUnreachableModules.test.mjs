/**
 * No module may be unreachable from the app without saying so out loud.
 *
 * See architecture-standards.md#nothinginert — this file is the enforcing half
 * of that section.
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
 * That hole used to be live in the allowlist below: three of the four `utils/*`
 * barrels were imported, only by `utils/scene/`, which is itself unreachable —
 * one connected dead component wearing four independent-looking entries. All
 * four barrels have since been deleted, along with five other entries.
 *
 * THE LIMIT THIS FILE HIT, AND WHERE IT IS ANSWERED
 * -------------------------------------------------
 * The allowlist got to thirteen entries and 862 lines before anyone read it as
 * a whole, and read whole it said something none of its entries said: this repo
 * starts unifications and does not finish them, and the per-file format is what
 * kept that invisible. Thirteen specific true sentences average out to no claim
 * at all. Worse, one of them was not true — "all 17 consumers import
 * utils/idle/idleAnimator directly" described a grep count as an import count;
 * exactly one file imports it — and a wrong sentence in a list of thirteen is
 * indistinguishable from a right one, because nothing checks the sentences.
 *
 * `noAbandonedMigrations.test.mjs` is the answer to that. It holds the same
 * subject matter aggregated by MIGRATION rather than by file, and every claim
 * in it carries a number that a test recomputes. Entries leave this file for
 * that one when what is wrong with them is not "unreachable" but "unfinished".
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
import path from 'node:path';
import { ROOT, SRC, walk, reachFrom } from './_moduleGraph.mjs';

/**
 * Modules the app never loads, each with the reason it is still here.
 *
 * Keep the key as a repo-relative path from `src/`. Keep the reason specific
 * enough that a reader can act on it without re-deriving the analysis.
 */
const ALLOWED = {
  // ── The descriptor-driven scene builder, and only it. KEPT, not parked: it
  // is the one place in the repo that states the intended scene composition in
  // a single readable form, and the repo has two imperative roots instead
  // (createWorldScene ×2, createRoomScene ×3) plus per-game environment
  // modules. Deleting these three files is the cheapest way to make this
  // allowlist empty, and it would delete the only written statement of the
  // target while leaving every root, every disposal mechanism and the unused
  // SceneLifecycle parameter exactly where they are — the codebase would be
  // measurably tidier and strictly less honest.
  //
  // Its adoption is tracked as a MIGRATION, with numbers a test recomputes, in
  // noAbandonedMigrations.test.mjs → entry 'scene-composition'. Do not wire it
  // in from this comment; the entry says what wiring it in would have to prove.
  'utils/scene/buildScene.ts':
    'Descriptor-driven scene builder, 0 importers. Kept as the written form of the intended composition — see noAbandonedMigrations.test.mjs.',
  'utils/scene/sceneDescriptor.ts': 'Schema for the builder above.',
  'utils/scene/sceneDescriptors.ts':
    'Per-scene data for the builder above. Holds almost no independent information: lighting, ground, backdrop and portals are references to the live scenes own objects, which sceneDescriptor.test.mjs asserts by identity rather than by value.',
};

const computedImports = [];

const appReach = reachFrom([path.join(SRC, 'main.tsx'), path.join(SRC, 'main.ts')], computedImports);
const otherReach = new Set([...reachFrom(walk(path.join(ROOT, 'tests'))), ...reachFrom(walk(path.join(ROOT, '.probe')))]);

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
