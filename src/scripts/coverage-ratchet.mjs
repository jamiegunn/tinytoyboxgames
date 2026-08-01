/**
 * Coverage ratchet — gates on what is stable, records what is not.
 *
 * WHY THIS GATES ON MODULES AND NOT ON A PERCENTAGE
 * -------------------------------------------------
 * Line coverage in this repository is NOT deterministic. Three identical runs
 * of tests/room on 2026-08-01 covered 3994, 4022 and 4045 lines of the same
 * 28338 — a spread of 51 lines — because the code under test calls
 * Math.random() (randomPick, randomRange, variant and placement selection), so
 * each run walks different branches. A gate on covered-line count would fail
 * roughly at random, and a gate that fails at random gets deleted within a week.
 *
 * What IS deterministic is which modules get loaded at all: the same 349
 * modules appeared in all three runs, byte-identical set. So the ratchet is:
 *
 *   modulesObserved          may only RISE
 *   modulesWithZeroCoverage  may only FALL
 *
 * Line coverage is printed every run and written to the baseline as a record,
 * never compared. It is there to be read by a human, not to block a commit.
 *
 * WHY A RATCHET AND NOT A THRESHOLD
 * ---------------------------------
 * An absolute threshold gets lowered the first time it blocks a release. A
 * ratchet can only be raised — and when it must come down, the number changes
 * in this file, in the same commit, with a line in `justifications` saying why.
 * That leaves a trail instead of a deletion.
 *
 * Usage:
 *   node scripts/coverage-ratchet.mjs            # check against the baseline
 *   node scripts/coverage-ratchet.mjs --update   # record a new baseline
 *   node scripts/coverage-ratchet.mjs --glob 'tests/room/*.test.mjs'   # subset, for development
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { reachFrom, walk, ROOT, SRC } from '../tests/framework/_moduleGraph.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = path.join(PACKAGE_ROOT, 'coverage-baseline.json');
const argv = process.argv.slice(2);
const UPDATE = argv.includes('--update');
const globIndex = argv.indexOf('--glob');
const TEST_GLOB = globIndex >= 0 ? argv[globIndex + 1] : 'tests/**/*.test.mjs';

const rel = (absolute) => path.relative(ROOT, absolute).split(path.sep).join('/');
const isProduction = (p) => p.startsWith('src/') && /\.(ts|tsx)$/.test(p);

/**
 * Runs the suite under V8 coverage and returns the merged per-file line hits.
 *
 * `--enable-source-maps` is not optional: _tsload.mjs emits inline maps, and
 * without this flag node ignores them and attributes every line to the temp
 * bundle under .tstest-tmp instead of to the .ts source.
 *
 * @returns {Map<string, Map<number, number>>} file -> line -> hit count.
 */
function measure() {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'covratchet-'));
  const info = path.join(outDir, 'coverage.info');
  const result = spawnSync(
    process.execPath,
    ['--enable-source-maps', '--test', '--experimental-test-coverage', '--test-reporter=lcov', `--test-reporter-destination=${info}`, TEST_GLOB],
    { cwd: PACKAGE_ROOT, encoding: 'utf8', stdio: ['ignore', 'ignore', 'inherit'], timeout: 15 * 60 * 1000 },
  );
  if (result.status !== 0) {
    process.stderr.write('\ncoverage ratchet: the suite is not green, so there is nothing to measure. Fix the tests first.\n');
    process.exit(result.status ?? 1);
  }
  const files = new Map();
  let current = null;
  for (const line of readFileSync(info, 'utf8').split('\n')) {
    if (line.startsWith('SF:')) {
      current = line.slice(3).trim();
      if (!isProduction(current)) current = null;
      else if (!files.has(current)) files.set(current, new Map());
    } else if (line.startsWith('DA:') && current) {
      const [lineNumber, hits] = line.slice(3).split(',').map(Number);
      const perFile = files.get(current);
      perFile.set(lineNumber, (perFile.get(lineNumber) ?? 0) + hits);
    }
  }
  return files;
}

const observed = measure();
const reachable = new Set([...reachFrom([path.join(ROOT, 'src/main.tsx')])].map(rel).filter(isProduction));
const everySource = new Set(walk(SRC).map(rel).filter(isProduction));
const zeroCoverage = [...reachable].filter((f) => !observed.has(f)).sort();

let lines = 0;
let covered = 0;
for (const perFile of observed.values()) {
  for (const hits of perFile.values()) {
    lines += 1;
    if (hits > 0) covered += 1;
  }
}

const current = {
  modulesObserved: observed.size,
  modulesWithZeroCoverage: zeroCoverage.length,
  reachableModules: reachable.size,
  sourceModules: everySource.size,
};

// Conservation: every reachable module is either observed or not. If these do
// not add up, the measurement is wrong and no verdict from it is worth having.
const accounted = [...reachable].filter((f) => observed.has(f)).length + zeroCoverage.length;
if (accounted !== reachable.size) {
  process.stderr.write(`coverage ratchet: internal accounting error (${accounted} != ${reachable.size}). Refusing to report a number I cannot reconcile.\n`);
  process.exit(1);
}

process.stdout.write(
  `\ncoverage ratchet (glob: ${TEST_GLOB})\n` +
    `  modules under src/ .................. ${current.sourceModules}\n` +
    `  reachable from src/main.tsx ......... ${current.reachableModules}\n` +
    `  observed by at least one test ....... ${current.modulesObserved}\n` +
    `  reachable with ZERO coverage ........ ${current.modulesWithZeroCoverage}\n` +
    `  lines covered (RECORD ONLY, not gated, varies run to run) ... ${covered} / ${lines} (${((100 * covered) / lines).toFixed(1)}%)\n`,
);

if (UPDATE) {
  const previous = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : { justifications: [] };
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        _readme:
          'Ratcheted by scripts/coverage-ratchet.mjs. modulesObserved may only rise; modulesWithZeroCoverage may only fall. To move a number the wrong way, edit it here in the same commit and add a line to justifications saying why.',
        ...current,
        lineCoverageRecordOnly: {
          covered,
          lines,
          pct: Number(((100 * covered) / lines).toFixed(1)),
          note: 'NOT gated — nondeterministic, see the docblock in scripts/coverage-ratchet.mjs',
        },
        justifications: previous.justifications ?? [],
      },
      null,
      2,
    )}\n`,
  );
  process.stdout.write(`\nbaseline written to ${path.relative(PACKAGE_ROOT, BASELINE_PATH)}\n`);
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  process.stderr.write(`\ncoverage ratchet: no baseline at ${BASELINE_PATH}. Run with --update to record one.\n`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const failures = [];
if (current.modulesObserved < baseline.modulesObserved) {
  failures.push(
    `modulesObserved fell from ${baseline.modulesObserved} to ${current.modulesObserved} — ${baseline.modulesObserved - current.modulesObserved} module(s) that used to be exercised no longer are.`,
  );
}
if (current.modulesWithZeroCoverage > baseline.modulesWithZeroCoverage) {
  failures.push(
    `modulesWithZeroCoverage rose from ${baseline.modulesWithZeroCoverage} to ${current.modulesWithZeroCoverage} — new code shipped with no test touching it at all.`,
  );
}

if (failures.length > 0) {
  process.stderr.write(
    `\ncoverage ratchet FAILED:\n  ${failures.join('\n  ')}\n\nEither add a test, or lower the baseline in coverage-baseline.json in this commit with a justification.\n`,
  );
  process.exit(1);
}

process.stdout.write('\ncoverage ratchet: passed.\n');
