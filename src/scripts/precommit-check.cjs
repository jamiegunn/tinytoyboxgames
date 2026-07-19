/**
 * Pre-commit quality gate. A commit is blocked unless ALL of these pass:
 *
 *   1. Prettier --check on staged source files (formatting)
 *   2. ESLint --max-warnings 0 on staged source files (new code stays pristine)
 *   3. ESLint on the whole package (zero warnings)
 *   4. tsc -b (project-wide type-check)
 *   5. vite build (production bundle must build)
 *
 * The whole package is held to zero warnings — the legacy jsdoc-warning
 * backlog was cleared on 2026-07-18, so any new warning is a regression.
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
 * Runs one gate; exits the process (blocking the commit) on failure.
 *
 * @param {string} label Human-readable gate name.
 * @param {string} binPath Path to the node binary to execute.
 * @param {string[]} args Arguments for the binary.
 */
function runCheck(label, binPath, args) {
  process.stdout.write(`\n== pre-commit: ${label} ==\n`);
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd: packageRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    fail(`pre-commit failed during ${label}.`);
  }
}

// 1 + 2: staged-file formatting and zero-warning lint
if (stagedSourceFiles.length > 0) {
  runCheck('Prettier (staged files)', prettierBin, ['--check', ...stagedSourceFiles]);
  runCheck('ESLint (staged files, zero warnings)', eslintBin, ['--max-warnings', '0', ...stagedSourceFiles]);
}

// 3: whole-package lint must be warning-free
runCheck('ESLint (whole package, zero warnings)', eslintBin, ['.', '--max-warnings', '0']);

// 4: project-wide type-check
runCheck('TypeScript (tsc -b)', tscBin, ['-b']);

// 5: production build must succeed
runCheck('Build (vite build)', viteBin, ['build']);

process.stdout.write('\npre-commit: all gates passed.\n');
