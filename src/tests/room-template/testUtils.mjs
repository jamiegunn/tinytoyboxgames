import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { generateRoomScene } from '../../scripts/lib/roomSceneGenerator.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

/**
 * Creates a minimal temporary package root containing only the files the room
 * scene generator needs for template-only tests.
 *
 * @returns {Promise<{ tempRoot: string, cleanup: () => Promise<void> }>}
 */
export async function createFixturePackageRoot() {
  const tempRoot = await fs.mkdtemp(path.join(tmpdir(), 'room-scene-template-'));

  await fs.mkdir(path.join(tempRoot, 'templates'), { recursive: true });
  await fs.mkdir(path.join(tempRoot, 'src', 'scenes', 'world', 'places', 'house', 'subplaces'), { recursive: true });

  await fs.cp(path.join(packageRoot, 'templates', 'room-scene'), path.join(tempRoot, 'templates', 'room-scene'), {
    recursive: true,
  });

  await fs.copyFile(path.join(packageRoot, 'src', 'scenes', 'sceneCatalog.ts'), path.join(tempRoot, 'src', 'scenes', 'sceneCatalog.ts'));

  return {
    tempRoot,
    cleanup: () => fs.rm(tempRoot, { recursive: true, force: true }),
  };
}

/**
 * Generates a room scene inside a fresh temporary fixture package.
 *
 * @param {{ sceneId: string, displayName: string }} options - Generation options.
 * @returns {Promise<{ tempRoot: string, sceneDir: string, cleanup: () => Promise<void> }>}
 */
export async function generateFixtureRoom({ sceneId, displayName }) {
  const fixture = await createFixturePackageRoot();
  await generateRoomScene({
    packageRoot: fixture.tempRoot,
    sceneId,
    displayName,
  });

  return {
    tempRoot: fixture.tempRoot,
    sceneDir: path.join(fixture.tempRoot, 'src', 'scenes', 'world', 'places', 'house', 'subplaces', sceneId),
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
 * Returns true when a file exists.
 *
 * @param {string} filePath - Candidate file path.
 * @returns {Promise<boolean>} True when the file exists.
 */
export async function exists(filePath) {
  return Boolean(await fs.stat(filePath).catch(() => null));
}
