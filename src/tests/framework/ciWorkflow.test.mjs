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

/**
 * The deployed sub-path is written down once, and everything reads it.
 *
 * THE DEPLOY THIS PINS
 * --------------------
 * The Pages job built the game with `--base=/tinytoyboxgames/game/`, which is
 * right for a project page at `jamiegunn.github.io/tinytoyboxgames/`. The site
 * has a custom domain, and a custom domain serves the repo from the DOMAIN
 * root — GitHub proves it by redirecting
 * `jamiegunn.github.io/tinytoyboxgames/game/` to `tinytoyboxgames.com/game`
 * with the repo prefix stripped. So every bundle was fetched from
 * `tinytoyboxgames.com/tinytoyboxgames/game/assets/…`, which 404s, and the page
 * mounted nothing: a blank white screen, shipped green.
 *
 * WHY THE VALIDATION STEP DID NOT CATCH IT
 * ----------------------------------------
 * It grepped `index.html` for the very string the build had just been told to
 * write. Input and expected value were the same literal, so it could only ever
 * confirm that Vite obeyed its flag — never that the result works at the URL it
 * is served from. **A check whose expected value is copied from the input is
 * not a check**, and it is worth noticing that this one read like the strictest
 * step in the file.
 *
 * So the assertions below are about the SHAPE of the wiring, not the value: one
 * definition, every consumer reading it, and the specific wrong value gone.
 */

test('the Pages base is defined once and never written as a literal again', () => {
  const raw = readFileSync(CI_PATH, 'utf8');
  const declared = /^\s*PAGES_BASE:\s*(\S+)\s*$/m.exec(raw);
  assert.ok(declared, 'ci.yml no longer declares PAGES_BASE. It is the one place the deployed sub-path is written down.');

  // Two things must read the variable rather than restate it: the build's
  // `--base`, and the grep that validates the URLs the build wrote. Those are
  // the pair that disagreed. Filesystem paths under `_site/` are deliberately
  // NOT included — where a file is copied on disk has nothing to do with the URL
  // it is served from, and conflating the two is how a rule like this starts
  // firing on correct lines and gets deleted.
  const lines = runLines();
  const baseFlags = lines.filter((line) => /--base=/.test(line));
  assert.ok(baseFlags.length > 0, 'no run: line passes --base to the build');
  for (const line of baseFlags) {
    assert.match(line, /PAGES_BASE/, `the build restates the base instead of reading PAGES_BASE:\n  ${line}`);
  }

  const assetGreps = lines.filter((line) => /grep -q/.test(line) && /assets\//.test(line));
  assert.ok(assetGreps.length > 0, 'nothing validates that the emitted asset URLs carry the base');
  const positive = assetGreps.filter((line) => !/tinytoyboxgames\/game/.test(line));
  assert.ok(
    positive.length > 0 && positive.every((line) => /PAGES_BASE/.test(line)),
    `the asset-URL check restates the base instead of reading PAGES_BASE:\n  ${positive.join('\n  ')}\n` +
      `Its expected value has to come from the same place the build's input does, or it can only ever confirm that Vite obeyed its flag.`,
  );
});

test('the build and the CNAME cannot describe different sites', () => {
  const raw = readFileSync(CI_PATH, 'utf8');
  const domain = /^\s*PAGES_DOMAIN:\s*(\S+)\s*$/m.exec(raw);
  assert.ok(domain, 'ci.yml no longer declares PAGES_DOMAIN');

  // A custom domain must be in the ARTIFACT: with an Actions deploy it is not
  // carried over from the previous publish, and a missing CNAME is how a custom
  // domain reverts to <user>.github.io/<repo>/ — which makes the base wrong
  // again, in the other direction.
  // WRITING it and CHECKING it are separate assertions, and the write is matched
  // on the redirect rather than on the filename. A mutation that deleted the
  // write survived a version of this test that only looked for a line mentioning
  // both `_site/CNAME` and `PAGES_DOMAIN` — because the line that VALIDATES the
  // CNAME mentions both too, and happily validated a file nothing had created.
  const lines = runLines();
  assert.ok(
    lines.some((line) => />\s*_site\/CNAME/.test(line) && /PAGES_DOMAIN/.test(line)),
    'no run: line writes $PAGES_DOMAIN into _site/CNAME. Without it the custom domain can drop on a deploy, and the base above becomes wrong in the other direction.',
  );
  assert.ok(
    lines.some((line) => /cat _site\/CNAME/.test(line) && /PAGES_DOMAIN/.test(line)),
    'nothing checks the CNAME actually landed in the artifact with the right contents.',
  );
});

test('the base that shipped a blank page is asserted gone, not merely replaced', () => {
  // The positive grep passes for whatever the build was told to use, correct or
  // not. This is the assertion that names the specific mistake.
  const raw = readFileSync(CI_PATH, 'utf8');
  const guard = /if grep -q '\/tinytoyboxgames\/game\/assets\/' _site\/game\/index\.html; then/.test(raw);
  assert.ok(guard, 'the validation step no longer rejects the repo-prefixed asset base that shipped a blank deploy');
  assert.doesNotMatch(
    runLines().join('\n'),
    /--base=\/tinytoyboxgames/,
    'the build is using the repo-prefixed base again. The site is served from a custom domain, which strips the repo prefix.',
  );
});

test('something loads the built site in a browser before it ships', () => {
  // Every other check in the Pages job inspects the ARTIFACT — files exist,
  // bundles are non-empty, URLs contain a string. The blank deploy satisfied all
  // of them. The only check that could have caught it is one that opens the page
  // and looks at the result, so this pins that such a step exists and that it is
  // wired to the same base as the build.
  const lines = runLines();
  assert.ok(
    lines.some((line) => /smoke-site\.mjs/.test(line)),
    "no run: line invokes scripts/smoke-site.mjs. An artifact check is not a render check — see that script's docblock.",
  );
  const smokeCalls = lines.filter((line) => /node scripts\/smoke-site\.mjs/.test(line));
  assert.ok(
    smokeCalls.some((line) => /PAGES_BASE/.test(line)),
    `the smoke test does not visit the base the site is built for:\n  ${smokeCalls.join('\n  ')}`,
  );
  assert.ok(existsSync(path.join(PACKAGE_ROOT, '..', 'scripts', 'smoke-site.mjs')), 'ci.yml calls scripts/smoke-site.mjs but the script is not in the repo');
});

test('the smoke test runs before the artifact is uploaded, not after', () => {
  // A check that runs after upload-pages-artifact is a report, not a gate.
  const raw = readFileSync(CI_PATH, 'utf8');
  const smokeAt = raw.indexOf('smoke-site.mjs');
  const uploadAt = raw.indexOf('upload-pages-artifact');
  assert.ok(smokeAt > 0 && uploadAt > 0, 'expected both a smoke step and an artifact upload in ci.yml');
  assert.ok(smokeAt < uploadAt, 'the smoke test runs after the artifact is uploaded, so a blank page would still ship');
});
