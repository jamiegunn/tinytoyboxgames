const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const packageRoot = path.resolve(__dirname, '..');
const prettierBin = path.join(packageRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
const eslintBin = path.join(packageRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');
const stagedFileListPath = process.argv[2];

if (!stagedFileListPath || !fs.existsSync(stagedFileListPath)) {
  process.stderr.write('pre-commit failed: staged file list was not provided.\n');
  process.exit(1);
}

const stagedFiles = fs.readFileSync(stagedFileListPath, 'utf8').split(/\r?\n/).filter(Boolean);

const supportedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const stagedSourceFiles = stagedFiles
  .filter((file) => file.startsWith('src/'))
  .filter((file) => supportedExtensions.has(path.extname(file)))
  .map((file) => path.relative(packageRoot, path.join(repoRoot, file)));

if (stagedSourceFiles.length === 0) {
  process.exit(0);
}

function runCheck(label, binPath, extraArgs) {
  const result = spawnSync(process.execPath, [binPath, ...extraArgs, ...stagedSourceFiles], {
    cwd: packageRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.stderr.write(`\npre-commit failed during ${label}.\n`);
    process.exit(result.status ?? 1);
  }
}

runCheck('Prettier', prettierBin, ['--check']);
runCheck('ESLint', eslintBin, []);
