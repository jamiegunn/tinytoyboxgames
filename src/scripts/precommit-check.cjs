/**
 * Pre-commit quality gate. A commit is blocked unless ALL of these pass:
 *
 *   1. Prettier --check on staged source files (formatting)
 *   2. ESLint --max-warnings 0 on staged source files (new code stays pristine)
 *   3. tsc -b (project-wide type-check of the app + node projects)
 *   4. tsc -p .probe/tsconfig.probe.json --noEmit (the probe harness)
 *   5. ESLint on the whole package (zero warnings)
 *   6. node --test (the whole contract suite)
 *   7. vite build (production bundle must build)
 *
 * The whole package is held to zero warnings — the legacy jsdoc-warning
 * backlog was cleared on 2026-07-18, so any new warning is a regression.
 *
 * Gates 5 and 6 were added on 2026-07-31, and the reason is worth keeping
 * because the docblock above them lied for months. This file's opening
 * sentence — "A commit is blocked unless ALL of these pass" — reads as
 * exhaustive, and a list that reads as exhaustive is how a missing gate
 * hides. Two mutations proved the hole rather than arguing for it:
 *
 *   A. `const __gateProbe: number = 'this is a string, not a number';`
 *      dropped into `.probe/render/room.ts`. `tsc -p .probe/tsconfig.probe.json`
 *      reports TS2322. This gate, with that file staged, printed
 *      "all gates passed" and exited 0. `src/tsconfig.json` references only
 *      tsconfig.app.json and tsconfig.node.json, so `tsc -b` never sees the
 *      probe project at all — the harness that grades every round was the one
 *      body of code nothing type-checked.
 *
 *   B. the Nature stone's `tapSoundId` changed back to
 *      `'sfx_shared_tap_fallback'` — the exact Round 3 defect the rooms review
 *      exists to prevent. `npm test` reports `not ok 20`, 402 pass / 1 fail.
 *      This gate, with that file staged, printed "all gates passed" and
 *      exited 0.
 *
 * Mutation B is the expensive one. Every contract pin written and
 * mutation-verified across five rounds of review was enforced by nothing but
 * a human remembering to type `npm test`. A pin nobody runs is a comment.
 *
 * Ordering is deliberate, and was retuned on 2026-08-01 by measurement rather
 * than by intuition. Gates 3 and 4 (the type-checks, 9-13s and ~11s) now run
 * before gate 5 (whole-package ESLint, 32-43s), because a type error is the
 * most common thing a commit gets wrong and it used to take ~56s to surface
 * behind a lint pass that was not going to fail. The contract suite stays ahead
 * of `vite build` for the original reason: tests are by far the most
 * informative failure a commit can get, and the bundle build is the slowest
 * gate and the least likely to be the thing that is broken.
 *
 * NOTHING WAS REMOVED, and that is a decision rather than an omission. The
 * whole set costs roughly 100-130s per commit, which is a real tax and a real
 * temptation to reach for `--no-verify` — and a gate bypassed by habit is
 * absent on the commit that needed it. Since 2026-08-01 CI runs every one of
 * these gates AND the Pages deploy is gated on them (`.github/workflows/ci.yml`,
 * pinned by `tests/framework/ciWorkflow.test.mjs`), so nothing broken can reach
 * players even if this hook never runs. That makes trimming this file to the
 * staged-file checks plus `tsc -b` a defensible ~15s alternative. It is not
 * done here because which side of that trade to take is the repo owner's call,
 * not an inference from the code.
 *
 * Escape hatch (emergencies only): git commit --no-verify
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const packageRoot = path.resolve(__dirname, '..');
const prettierBin = path.join(packageRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
const eslintBin = path.join(packageRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');
const tscBin = path.join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const viteBin = path.join(packageRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const stagedFileListPath = process.argv[2];

// Kept as a package-root-relative path because that is what tsc is handed, and
// because the string is duplicated in tests/framework/precommitGate.test.mjs —
// a pin that reads this file's source cannot know whether the line is REACHED,
// so the two must at least agree on what is being looked for.
const PROBE_TSCONFIG_REL = path.join('.probe', 'tsconfig.probe.json');
const TEST_GLOB = 'tests/**/*.test.mjs';

function fail(message) {
  process.stderr.write(`\n${message}\n`);
  process.stderr.write('Commit blocked. Fix the issue above and try again (or use --no-verify in an emergency).\n');
  process.exit(1);
}

for (const [label, bin] of [
  ['Prettier', prettierBin],
  ['ESLint', eslintBin],
  ['TypeScript', tscBin],
  ['Vite', viteBin],
]) {
  if (!fs.existsSync(bin)) {
    fail(`pre-commit: ${label} is not installed at ${bin}.\nRun "npm install" (or "bun install") inside src/ first — the hook needs local dev dependencies.`);
  }
}

if (!fs.existsSync(path.join(packageRoot, PROBE_TSCONFIG_REL))) {
  fail(
    `pre-commit: the probe TypeScript project is missing at ${PROBE_TSCONFIG_REL}.\nIt is a gate, not an optional extra — restore it rather than removing the check that noticed.`,
  );
}

if (!stagedFileListPath || !fs.existsSync(stagedFileListPath)) {
  fail('pre-commit failed: staged file list was not provided.');
}

const stagedFiles = fs.readFileSync(stagedFileListPath, 'utf8').split(/\r?\n/).filter(Boolean);

const supportedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const stagedSourceFiles = stagedFiles
  .filter((file) => file.startsWith('src/'))
  .filter((file) => supportedExtensions.has(path.extname(file)))
  .map((file) => path.relative(packageRoot, path.join(repoRoot, file)))
  // Files can be staged as deletions; don't lint paths that no longer exist.
  .filter((file) => fs.existsSync(path.join(packageRoot, file)));

/**
 * Runs one gate as a node invocation; exits the process (blocking the commit)
 * on failure.
 *
 * @param {string} label Human-readable gate name.
 * @param {string[]} args Arguments passed to node itself. A tool gate puts the
 *   tool's bin path first; a gate that uses node's own runner (`--test`) puts
 *   the flag first and has no bin path at all.
 */
function runNode(label, args) {
  process.stdout.write(`\n== pre-commit: ${label} ==\n`);
  const result = spawnSync(process.execPath, args, {
    cwd: packageRoot,
    stdio: 'inherit',
  });

  // A gate killed by a signal reports status === null, not a number. Treating
  // that as a pass would mean an out-of-memory tsc silently waves a commit
  // through, so anything that is not an explicit zero blocks.
  if (result.status !== 0) {
    fail(`pre-commit failed during ${label}${result.signal ? ` (killed by ${result.signal})` : ''}.`);
  }
}

/**
 * Runs one gate that invokes a locally installed tool binary.
 *
 * @param {string} label Human-readable gate name.
 * @param {string} binPath Path to the node binary to execute.
 * @param {string[]} args Arguments for the binary.
 */
function runCheck(label, binPath, args) {
  runNode(label, [binPath, ...args]);
}

// 1 + 2: staged-file formatting and zero-warning lint
if (stagedSourceFiles.length > 0) {
  runCheck('Prettier (staged files)', prettierBin, ['--check', ...stagedSourceFiles]);
  runCheck('ESLint (staged files, zero warnings)', eslintBin, ['--max-warnings', '0', ...stagedSourceFiles]);
}

// 3: project-wide type-check
runCheck('TypeScript (tsc -b)', tscBin, ['-b']);

// 4: the probe harness type-checks too. `tsc -b` cannot reach it — tsconfig.json
// references only the app and node projects — so it needs its own invocation.
// The existence check above is not politeness: if this file goes missing the
// gate would otherwise fail in a way that reads like a tooling problem, and the
// tempting fix for a tooling problem is to delete the gate.
runCheck('TypeScript (probe project)', tscBin, ['-p', PROBE_TSCONFIG_REL, '--noEmit']);

// 5: whole-package lint must be warning-free.
//
// Moved after the type-checks on 2026-08-01 for time-to-first-failure, not for
// coverage — nothing was removed. ESLint over this package measured 32-43s
// against tsc's 9-13s, so putting it first meant a plain type error took ~56s
// to surface instead of ~13s. The slowest gate should not stand in front of the
// one most likely to catch the mistake you just made.
runCheck('ESLint (whole package, zero warnings)', eslintBin, ['.', '--max-warnings', '0']);

// 6: the contract suite. Deliberately NOT the enumerated directory list that
// package.json used to carry — an enumeration is an exclusion criterion doing
// unchecked work, and a ninth test directory would have been silently untested
// forever. node expands this glob itself; do not add a shell.
runNode('Tests (node --test)', ['--test', TEST_GLOB]);

// 7: production build must succeed
runCheck('Build (vite build)', viteBin, ['build']);

process.stdout.write('\npre-commit: all gates passed.\n');
