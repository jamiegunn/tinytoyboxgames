import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { generateMiniGame } from '../../scripts/lib/minigameGenerator.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

/**
 * Creates a minimal temporary package root containing only the files the
 * minigame generator needs for template-only tests.
 *
 * @returns {Promise<{ tempRoot: string, cleanup: () => Promise<void> }>}
 */
export async function createFixturePackageRoot() {
  const tempRoot = await fs.mkdtemp(path.join(tmpdir(), 'minigame-template-'));

  await fs.mkdir(path.join(tempRoot, 'templates'), { recursive: true });
  await fs.mkdir(path.join(tempRoot, 'src', 'minigames', 'games'), { recursive: true });
  await fs.mkdir(path.join(tempRoot, 'src', 'minigames', 'framework'), { recursive: true });

  await fs.cp(path.join(packageRoot, 'templates', 'minigame'), path.join(tempRoot, 'templates', 'minigame'), {
    recursive: true,
  });

  await fs.copyFile(
    path.join(packageRoot, 'src', 'minigames', 'framework', 'MiniGameManifest.ts'),
    path.join(tempRoot, 'src', 'minigames', 'framework', 'MiniGameManifest.ts'),
  );

  return {
    tempRoot,
    cleanup: () => fs.rm(tempRoot, { recursive: true, force: true }),
  };
}

/**
 * Generates a minigame inside a fresh temporary fixture package.
 *
 * @param {{ gameId: string, displayName: string }} options - Generation options.
 * @returns {Promise<{ tempRoot: string, gameDir: string, cleanup: () => Promise<void> }>}
 */
export async function generateFixtureMiniGame({ gameId, displayName }) {
  const fixture = await createFixturePackageRoot();
  await generateMiniGame({
    packageRoot: fixture.tempRoot,
    gameId,
    displayName,
  });

  return {
    tempRoot: fixture.tempRoot,
    gameDir: path.join(fixture.tempRoot, 'src', 'minigames', 'games', gameId),
    cleanup: fixture.cleanup,
  };
}

/**
 * Reads a UTF-8 file from the temporary fixture package.
 *
 * @param {string} root - Temporary package root.
 * @param {string[]} segments - Relative file path segments.
 * @returns {Promise<string>} File contents.
 */
export async function readFixtureFile(root, ...segments) {
  return fs.readFile(path.join(root, ...segments), 'utf8');
}

/**
 * Recursively collects all files beneath a directory.
 *
 * @param {string} root - Directory to scan.
 * @returns {Promise<string[]>} Absolute file paths.
 */
export async function collectFiles(root) {
  const results = [];
  const entries = await fs.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(fullPath)));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Returns true when a file exists.
 *
 * @param {string} filePath - Candidate file path.
 * @returns {Promise<boolean>} True when the file exists.
 */
export async function exists(filePath) {
  return Boolean(await fs.stat(filePath).catch(() => null));
}
