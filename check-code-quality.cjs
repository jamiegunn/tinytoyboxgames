const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = __dirname;
const packageRoot = path.join(repoRoot, 'src');
const prettierBin = path.join(packageRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
const eslintBin = path.join(packageRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');
const prettierConfig = path.join(packageRoot, '.prettierrc');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(path.join(packageRoot, 'package.json'))) {
  fail(`Code quality check failed: expected package.json under ${packageRoot}`);
}

if (!fs.existsSync(prettierBin)) {
  fail(`Code quality check failed: missing Prettier binary at ${prettierBin}`);
}

if (!fs.existsSync(eslintBin)) {
  fail(`Code quality check failed: missing ESLint binary at ${eslintBin}`);
}

const prettierTargets = ['*.{js,cjs,mjs,md,json}', 'docs/**/*.md', 'src/**/*.{ts,tsx,js,jsx,cjs,mjs,md}', 'src/package.json', 'src/tsconfig.json'];

function runNodeCheck(label, binPath, args, cwd) {
  process.stdout.write(`\n== ${label} ==\n`);
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runNodeCheck('Prettier', prettierBin, ['--config', prettierConfig, '--check', ...prettierTargets], repoRoot);
runNodeCheck('ESLint', eslintBin, ['.', '--max-warnings', '0'], packageRoot);

process.stdout.write('\nCode quality checks passed.\n');
