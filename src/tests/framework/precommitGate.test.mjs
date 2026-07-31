/**
 * The gate that runs the tests is itself a test.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-07-31 the pre-commit gate was found to run neither the contract
 * suite nor the probe harness's type-check. Its docblock opened with "A commit
 * is blocked unless ALL of these pass" and then listed five gates, and the
 * sentence was false — not because the list was wrong about the five, but
 * because nothing tied the list to the calls beneath it.
 *
 * The cost of that is easy to understate, so state it plainly: every contract
 * pin authored and mutation-verified across five rounds of scene review was
 * enforced by a human remembering to type `npm test`. Including this one. A
 * pin nobody runs is a comment with a heavier syntax.
 *
 * WHAT THIS CAN PROVE, AND WHAT IT EMPHATICALLY CANNOT
 * ----------------------------------------------------
 * This is a SOURCE-TEXT pin. It reads `scripts/precommit-check.cjs` as a
 * string. That is apparatus defect (xi) in the rooms review, and it applies
 * here in full force: a source-text pin cannot tell whether the body it is
 * reading is ever REACHED. Every assertion below would still pass if someone
 * wrapped the whole gate list in `if (false) { ... }`.
 *
 * So this file is not the proof. The proof is two mutations, run against the
 * real gate, recorded in docs/reviews/2026-07-30-rooms-five-rounds.md:
 *
 *   A. a type error injected into `.probe/render/room.ts`
 *   B. the Nature stone's `tapSoundId` reverted to the shared fallback
 *
 * Both walked through the old gate with "all gates passed" and exit 0. Both
 * are blocked by the new one, at gate 5 and gate 6 respectively, by name.
 *
 * What this file adds on top of that is DRIFT protection, which a one-time
 * mutation run cannot give: the mutations prove the gate worked on the day it
 * was run, and these assertions notice the day someone quietly removes a line.
 * The two halves are complementary and neither is sufficient alone.
 *
 * THE DOCBLOCK ASSERTION IS THE POINT
 * -----------------------------------
 * The last assertion — that the numbered list in the docblock has exactly as
 * many entries as there are gate invocations — looks like pedantry about a
 * comment. It is the pin aimed most precisely at the actual defect. The gate
 * did not fail because someone wrote a bad check; it failed because the
 * PROSE claimed a coverage the CODE did not have, and prose that overclaims is
 * how a missing gate stays missing: every reader who checks the docblock comes
 * away reassured.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const gateSource = readFileSync(path.join(packageRoot, 'scripts', 'precommit-check.cjs'), 'utf8');
const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

test('the pre-commit gate runs the contract suite', () => {
  assert.match(
    gateSource,
    /runNode\('Tests \(node --test\)', \['--test', TEST_GLOB\]\)/,
    'the gate must invoke the test suite — without this line every pin in tests/ is enforced by memory alone',
  );
});

test('the pre-commit gate type-checks the probe harness, which tsc -b cannot reach', () => {
  // Not a redundant check against `tsc -b`. tsconfig.json references only the
  // app and node projects, so the probe project is invisible to the build —
  // which made the harness that grades every round the one body of code in the
  // repo that nothing type-checked. If that reference is ever added, this gate
  // becomes redundant and should be deleted deliberately, not left to rot.
  const rootTsconfig = JSON.parse(readFileSync(path.join(packageRoot, 'tsconfig.json'), 'utf8'));
  const referenced = (rootTsconfig.references ?? []).map((r) => r.path);
  assert.ok(
    !referenced.some((p) => p.includes('probe')),
    'tsconfig.json now references the probe project — `tsc -b` covers it, so the separate gate below is redundant and this test should be retired on purpose',
  );
  assert.match(
    gateSource,
    /runCheck\('TypeScript \(probe project\)', tscBin, \['-p', PROBE_TSCONFIG_REL, '--noEmit'\]\)/,
    'the gate must type-check the probe project separately',
  );
});

test('the gate and `npm test` cannot drift apart, and neither enumerates directories', () => {
  // The enumeration this replaced listed eight test directories by name. There
  // were exactly eight, so it had no live gap — it had a latent one, of the
  // same family as apparatus defects (iii), (xv) and (xviii): an exclusion
  // criterion doing unchecked work. A ninth directory would have been silently
  // untested, and silently is the whole problem.
  const globMatch = gateSource.match(/const TEST_GLOB = '([^']+)'/);
  assert.ok(globMatch, 'the gate must define TEST_GLOB');
  const glob = globMatch[1];
  assert.match(glob, /\*\*/, 'the test glob must be recursive rather than a list of known directories');

  const script = pkg.scripts.test;
  assert.ok(
    script.includes(glob),
    `package.json's test script must run the same glob as the gate (gate: ${glob}, script: ${script}) — two spellings of "all the tests" is one spelling too many`,
  );
  assert.ok(!/tests\/[a-z-]+\/\*\.test\.mjs\s+tests\//.test(script), 'package.json must not enumerate test directories');
});

test('the docblock claims exactly as many gates as the file runs', () => {
  const docblock = gateSource.slice(0, gateSource.indexOf('*/'));
  const claimed = docblock.match(/^\s*\*\s+\d+\.\s/gm) ?? [];
  // The trailing `'` is load-bearing and was not there in the first draft. A
  // bare `run(Check|Node)\(` also matches `runNode(label, ...)` inside
  // `runCheck`'s own body — the delegation between the two helpers — and the
  // first run of this test therefore reported eight gates against seven, an
  // off-by-one entirely of the instrument's own making. Requiring a quoted
  // literal label counts gate DECLARATIONS and not the plumbing between them.
  // Logged with the rest: an instrument that miscounts by one in the direction
  // of "you have more coverage than you do" is the same species as the defect
  // this file exists to pin.
  const invoked = gateSource.match(/^\s*run(?:Check|Node)\('/gm) ?? [];
  assert.equal(
    claimed.length,
    invoked.length,
    `the docblock lists ${claimed.length} gates and the file runs ${invoked.length}. ` +
      'That gap is not a documentation nit — it is the exact shape of the 2026-07-31 defect, ' +
      'where a list that read as exhaustive was how two missing gates stayed missing for months.',
  );
  assert.ok(invoked.length >= 7, `expected at least 7 gates, found ${invoked.length}`);
});

test('a non-zero exit is not the only way a gate can fail', () => {
  // spawnSync reports status === null for a process killed by a signal. `!== 0`
  // catches that; `> 0` would not, and an out-of-memory tsc would then wave the
  // commit through wearing a pass.
  assert.match(gateSource, /result\.status !== 0/, 'the gate must treat anything other than an explicit zero as a failure, including a signal kill');
});
