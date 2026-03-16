import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

test('toybox interactions use the shared dispatcher for tap handling', async () => {
  const wireSource = await fs.readFile(path.join(packageRoot, 'src', 'toyboxes', 'framework', 'wireToyboxInteractions.ts'), 'utf8');
  const createSource = await fs.readFile(path.join(packageRoot, 'src', 'toyboxes', 'framework', 'createInteractiveToybox.ts'), 'utf8');

  assert.match(wireSource, /dispatcher\.register\(runtime\.root, onTap\)/);
  assert.doesNotMatch(wireSource, /canvas\.addEventListener\('pointerdown'/);
  assert.doesNotMatch(createSource, /blocksFloorTap/);
});
