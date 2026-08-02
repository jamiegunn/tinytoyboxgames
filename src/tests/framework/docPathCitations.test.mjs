/**
 * Every source path an AI-guidance document cites must resolve.
 *
 * THE DEFECT THIS GUARDS
 * ----------------------
 * `architecture-standards.md` cited `animationRunners.ts` — a file that has
 * never existed in this repo — while describing its import count. The number
 * was right; the filename was not. A reader following it finds nothing and has
 * no way to tell whether the file moved, was renamed, or the claim is fiction.
 *
 * A 2026-08-01 documentation audit found fourteen drifted references in that one
 * document. Line numbers among them cannot be guarded cheaply — a `:405` goes
 * stale the moment anything above it is edited, and a test that fails on every
 * unrelated edit gets deleted. But a dangling *path* is unambiguous, and it is
 * the class of error that misleads rather than merely annoys.
 *
 * WHAT IS ASSERTED, AND WHAT IS NOT
 * ---------------------------------
 * Only backticked tokens that look like a real source path: they carry a
 * directory separator or a known source extension, and they are not prose.
 * A trailing `:123` is stripped before resolving — the line number is not
 * checked, deliberately. Paths are resolved against both the package root and
 * the repo root, because the documents legitimately use both conventions.
 *
 * Deleted files named in plain text are fine and expected. Backticks are the
 * claim; this suite grades the claim.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..');
const DOCS = path.join(REPO_ROOT, 'docs', 'ai-guidance');

const SOURCE_EXT = /\.(ts|tsx|mjs|cjs|js|jsx|json|yml|yaml)$/;

// Modules these documents name in backticks that are deliberately GONE. This is
// a list of ADMISSIONS, not permissions, in the same spirit as the allowlist in
// noUnreachableModules.test.mjs: each entry states why the document is right to
// name something that does not exist. A migration register has to be able to
// say "this was deleted" — but the entry has to be written down, so the list
// cannot quietly absorb a genuine typo.
const ALLOWED_ABSENT = new Map([
  ['utils/particles.ts', 'deleted legacy particle module; §2 names all three by path to record what was replaced'],
  ['utils/particleFactory.ts', 'deleted legacy particle module, same register entry'],
  ['minigames/shared/particleFx.ts', 'deleted legacy particle module, same register entry'],
  ['utils/animationPresets.ts', 'deleted in the IdleAnimator migration; §5 names it to record the bet that lost'],
  // §10's dead-code sweep. Named to record what the reachability guard found —
  // the whole point of the passage is that these three imported each other and
  // so looked referenced while being orphans together.
  ['fish/meshes.ts', 'deleted orphan; §10 names it as part of the species cluster'],
  ['waves/templates.ts', 'deleted orphan, same cluster'],
  ['fish/species.ts', 'deleted orphan, same cluster'],
  ['utils/idle/index.ts', 'deleted barrel; §10 names it as the fifth one found at zero in both directions'],
]);

// Documentation paths whose absence is stated in the same sentence.
const KNOWN_ABSENT_PREFIXES = ['docs/adr/', 'docs/specs/', 'docs/features/', 'docs/plans/'];

/** Documents to grade: every markdown file directly under docs/ai-guidance/. */
function guidanceDocs() {
  return readdirSync(DOCS)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(DOCS, name))
    .filter((file) => statSync(file).isFile());
}

/**
 * Backticked tokens from a document that look like source paths.
 *
 * @param {string} body Document contents.
 * @returns {string[]} Candidate paths, line-number suffix already stripped.
 */
function citedPaths(body) {
  const out = new Set();
  for (const match of body.matchAll(/`([^`\s]+)`/g)) {
    let token = match[1];
    // Strip a trailing :123 or :123-456 — line numbers are not graded.
    token = token.replace(/:\d+(-\d+)?$/, '');
    if (!SOURCE_EXT.test(token)) continue;
    if (token.startsWith('http')) continue;
    // A bare filename with no directory is ambiguous (`index.ts` appears
    // hundreds of times); only grade tokens that carry a path.
    if (!token.includes('/')) continue;
    if (KNOWN_ABSENT_PREFIXES.some((prefix) => token.startsWith(prefix))) continue;
    if (ALLOWED_ABSENT.has(token)) continue;
    // `{propname}` / `{scene}` are authoring placeholders, not paths.
    if (/\{[a-z]+\}/.test(token)) continue;
    for (const expanded of expandBraces(token)) out.add(expanded);
    continue;
  }
  return [...out];
}

/**
 * Expands `dir/{a,b,c}.ts` into one path per alternative.
 *
 * The documents use this shorthand constantly and it is not a path as written,
 * so grading it verbatim reported four false dangles on the first run.
 *
 * @param {string} token Path possibly containing one brace group.
 * @returns {string[]} One concrete path per alternative.
 */
function expandBraces(token) {
  const match = token.match(/^(.*)\{([^}]+)\}(.*)$/);
  if (!match) return [token];
  return match[2].split(',').map((part) => `${match[1]}${part.trim()}${match[3]}`);
}

/** Every source file in the repo, as posix paths, built once. */
const ALL_FILES = (() => {
  const out = [];
  const skip = new Set(['node_modules', 'dist', '.git', '.tstest-tmp', '_to_delete', '_stage']);
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full.split(path.sep).join('/'));
    }
  };
  walk(REPO_ROOT);
  return out;
})();

/**
 * True when some real file's path ends with the cited path.
 *
 * Suffix matching rather than root-relative resolution, because these documents
 * legitimately cite context-relative shorthand — `hub/hubMusic.ts` inside a
 * document about the audio tree, `framework/types.ts` inside one about
 * minigames. Requiring a full path from a fixed root reported nine of those as
 * dangling on the first run. A suffix match still fails for a name no file
 * carries, which is the error worth catching.
 *
 * @param {string} cited Path as written in the document.
 * @returns {boolean} True when it resolves to a real file.
 */
function resolves(cited) {
  const trimmed = '/' + cited.replace(/^\.?\//, '');
  return ALL_FILES.some((file) => file.endsWith(trimmed));
}

const docs = guidanceDocs();

test('there are guidance documents to check', () => {
  assert.ok(docs.length >= 10, `expected the ai-guidance documents, found ${docs.length}`);
});

for (const file of docs) {
  const label = path.relative(REPO_ROOT, file);
  test(`${label} cites only source paths that resolve`, () => {
    const dangling = citedPaths(readFileSync(file, 'utf8')).filter((cited) => !resolves(cited));
    assert.deepEqual(
      dangling,
      [],
      `${label} names these source paths in backticks and none of them resolve:\n  ${dangling.join('\n  ')}\n\n` +
        `Either the file moved and the document did not, or the path was never real. ` +
        `If the file was deliberately deleted, write the name in plain text — backticks assert that it exists.`,
    );
  });
}
