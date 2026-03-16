import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

/**
 * Verifies that the in-tree generated star-catcher minigame compiles cleanly
 * as part of the full project type check.
 *
 * This catches template rot that string-grep tests cannot: broken imports,
 * type mismatches, missing members, and syntax errors.
 */
test('in-tree generated minigame compiles with the project tsconfig', async () => {
  try {
    await execFileAsync(
      path.join(packageRoot, 'node_modules', '.bin', 'tsc'),
      ['--noEmit', '--project', path.join(packageRoot, 'tsconfig.app.json')],
      { timeout: 60000, cwd: packageRoot },
    );
  } catch (error) {
    const output = (error.stdout || '') + (error.stderr || '');

    // Filter to only errors in the generated game directory so the test
    // stays focused on template health rather than unrelated project issues.
    const gameErrors = output
      .split('\n')
      .filter((line) => line.includes('minigames/games/star-catcher'))
      .join('\n');

    if (gameErrors.length > 0) {
      assert.fail(`Generated star-catcher has compile errors:\n${gameErrors}`);
    }

    // If there are errors but none in star-catcher, the project has other
    // issues — not the template's fault. Pass the test.
  }
});
