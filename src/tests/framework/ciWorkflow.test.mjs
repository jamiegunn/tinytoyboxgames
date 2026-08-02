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
const WORKFLOW_DIR = path.join(PACKAGE_ROOT, '..', '.github', 'workflows');

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

// ── The deploy must follow the gates, not race them ─────────────────────────
//
// Until 2026-08-01, ci.yml and a separate deploy-pages.yml both triggered on
// `push: [main]` with nothing connecting them. deploy-pages.yml did carry a
// `needs:`, which is why this looked fine at a glance — but it was an INTERNAL
// job dependency (its deploy job waiting on its own build job), not a
// dependency on the quality gates in the other file. The two workflows ran in
// parallel, so a push whose suite went red published anyway.
//
// These assertions are about reachability in the job graph, not about the
// presence of the word `needs`. That distinction is the whole bug.

/**
 * Job name -> its `needs` list, parsed structurally from a workflow file.
 *
 * Deliberately not js-yaml: that is a transitive dependency of ESLint here, not
 * a declared one, and a contract test should not rest on something nothing
 * promises to keep installed.
 *
 * @param {string} yml Workflow file contents.
 * @returns {Map<string, {needs: string[], body: string}>} Jobs by name.
 */
function parseJobs(yml) {
  const lines = yml.split('\n');
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  assert.ok(jobsIndex >= 0, 'workflow has no jobs: block');

  const jobs = new Map();
  let current = null;
  for (const line of lines.slice(jobsIndex + 1)) {
    const header = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (header) {
      current = header[1];
      jobs.set(current, { needs: [], body: '' });
      continue;
    }
    if (!current) continue;
    if (/^\S/.test(line)) break; // dedented out of jobs:
    jobs.get(current).body += line + '\n';
    const needs = line.match(/^ {4}needs:\s*(.+)$/);
    if (needs) {
      const raw = needs[1].trim();
      const list = raw.startsWith('[') ? raw.slice(1, -1).split(',') : [raw];
      jobs.get(current).needs = list.map((n) => n.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    }
  }
  return jobs;
}

/**
 * Every job reachable by following `needs` from a starting job.
 *
 * @param {Map<string, {needs: string[]}>} jobs Parsed jobs.
 * @param {string} start Job to walk back from.
 * @returns {Set<string>} Job names this job transitively depends on.
 */
function upstreamOf(jobs, start) {
  const seen = new Set();
  const queue = [...(jobs.get(start)?.needs ?? [])];
  while (queue.length) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    queue.push(...(jobs.get(name)?.needs ?? []));
  }
  return seen;
}

test('the job that deploys to Pages transitively depends on the job that runs the tests', () => {
  const yml = readFileSync(CI_PATH, 'utf8');
  const jobs = parseJobs(yml);

  const deployJob = [...jobs].find(([, job]) => /actions\/deploy-pages/.test(job.body))?.[0];
  assert.ok(deployJob, 'no job in ci.yml uses actions/deploy-pages');

  const testJob = [...jobs].find(([, job]) => /node --test/.test(job.body))?.[0];
  assert.ok(testJob, 'no job in ci.yml runs the contract suite');

  const upstream = upstreamOf(jobs, deployJob);
  assert.ok(
    upstream.has(testJob),
    `the '${deployJob}' job does not depend, even transitively, on '${testJob}'.\n` +
      `It reaches: ${[...upstream].join(', ') || '(nothing)'}.\n\n` +
      `A deploy that does not wait for the gates is a deploy that races them, and the tests lose ` +
      `roughly half the time. Add 'needs:' so the chain reaches the quality job.`,
  );
});

test('no workflow publishes to Pages outside that gated chain', () => {
  const offenders = [];
  for (const name of readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f))) {
    if (name === path.basename(CI_PATH)) continue;
    const body = readFileSync(path.join(WORKFLOW_DIR, name), 'utf8');
    if (/actions\/(deploy-pages|upload-pages-artifact)/.test(body)) offenders.push(name);
  }
  assert.deepEqual(
    offenders,
    [],
    `these workflows publish to Pages independently of ci.yml: ${offenders.join(', ')}.\n` +
      `A second publishing path is a second way to ship past the gates — that is exactly how ` +
      `deploy-pages.yml raced the test suite until 2026-08-01.`,
  );
});

test('the deploy chain does not run on pull requests', () => {
  const jobs = parseJobs(readFileSync(CI_PATH, 'utf8'));
  for (const [name, job] of jobs) {
    if (!/actions\/(deploy-pages|upload-pages-artifact)/.test(job.body)) continue;
    assert.match(
      job.body,
      /if:\s*.*pull_request/,
      `job '${name}' publishes to Pages but has no guard against pull_request events — ` + `a PR from a fork would deploy.`,
    );
  }
});
