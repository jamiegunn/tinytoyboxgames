/**
 * The CI workflow may not enumerate test directories.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `scripts/precommit-check.cjs` states the rule in its own docblock — "an
 * enumeration is an exclusion criterion doing unchecked work" — and
 * `precommitGate.test.mjs` pins it for the hook and for package.json. Nobody
 * pinned it for CI, and on 2026-08-01 an audit found `.github/workflows/ci.yml`
 * running five of the eight test directories: 145 of 429 tests. The 284 it
 * skipped were `framework/`, `minigames/` and `particles/` — which is to say
 * every architectural guard in this directory, including the one that forbids
 * exactly this mistake.
 *
 * The guard could not see the problem it was written to prevent, because the
 * guard lived in a directory the enumeration excluded. That is the failure mode
 * worth remembering: a rule enforced in one place and violated in another,
 * where the enforcement cannot reach.
 *
 * WHAT IS ASSERTED, AND WHAT IS NOT
 * ---------------------------------
 * These assertions read the workflow as text. They prove the file SAYS the
 * right thing; they cannot prove GitHub ran it. Comments are stripped before
 * matching, so prose that mentions a directory path — including the prose in
 * ci.yml explaining this very history — cannot trip the check. Only the
 * executable `run:` lines are examined.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TESTS_DIR = path.join(PACKAGE_ROOT, 'tests');
const CI_PATH = path.join(PACKAGE_ROOT, '..', '.github', 'workflows', 'ci.yml');

/**
 * The executable `run:` lines of the workflow, with YAML comments removed.
 *
 * A comment cannot fail a build, so grading one would make the check fire on
 * documentation — and the fastest way to silence a check that fires on
 * documentation is to delete the check.
 *
 * @returns {string[]} Every `run:` line, comment-stripped.
 */
function runLines() {
  return readFileSync(CI_PATH, 'utf8')
    .split('\n')
    .map((line) => line.replace(/(^|\s)#.*$/, ''))
    .filter((line) => /^\s*(run:|- run:)/.test(line) || /^\s{8,}\S/.test(line))
    .map((line) => line.trim())
    .filter(Boolean);
}

test('the CI workflow exists where this test expects it', () => {
  assert.ok(existsSync(CI_PATH), `expected a CI workflow at ${CI_PATH}. If it moved, move this pin with it rather than deleting it.`);
});

test('CI runs the contract suite by recursive glob, not by directory list', () => {
  const testStep = runLines().find((line) => line.includes('node --test'));
  assert.ok(testStep, 'ci.yml must run `node --test` somewhere in a run: step');
  assert.match(
    testStep,
    /tests\/\*\*\/\*\.test\.mjs/,
    `CI must use the recursive glob so a ninth test directory is picked up automatically. Found: ${testStep}`,
  );
});

test('no executable CI line names an individual test directory', () => {
  const directories = readdirSync(TESTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.ok(directories.length > 0, 'expected at least one test directory');

  const offenders = [];
  for (const line of runLines()) {
    for (const directory of directories) {
      if (line.includes(`tests/${directory}/`)) offenders.push(`${directory} -> ${line}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `ci.yml names specific test directories in an executable line:\n  ${offenders.join('\n  ')}\n\n` +
      `Every directory named here is one that a future directory will NOT be added to. Use tests/**/*.test.mjs.`,
  );
});

test('CI grades everything the pre-commit hook grades', () => {
  const lines = runLines().join('\n');
  for (const [what, pattern] of [
    ['the type-check', /tsc -b/],
    ['the probe harness type-check', /tsconfig\.probe\.json/],
    ['the zero-warning lint', /eslint .*--max-warnings 0/],
    ['the formatting gate', /check-code-quality\.cjs/],
    ['the contract suite', /node --test/],
    ['the production build', /vite build/],
  ]) {
    assert.match(
      lines,
      pattern,
      `CI must run ${what}. The pre-commit hook does, and a hook is opt-in: it needs core.hooksPath set, it is per-clone, and --no-verify skips it. CI is the only gate that applies to everyone.`,
    );
  }
});
