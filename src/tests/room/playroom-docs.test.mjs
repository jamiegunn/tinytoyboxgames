import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

test('playroom documentation explains the shared room pattern', async () => {
  const readmeSource = await fs.readFile(path.join(packageRoot, 'src', 'scenes', 'world', 'places', 'house', 'subplaces', 'playroom', 'README.md'), 'utf8');

  assert.match(readmeSource, /createRoomScene/);
  assert.match(readmeSource, /toyboxes\/manifest\.ts/);
  assert.match(readmeSource, /userData\.onClick/);
});
