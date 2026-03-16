import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

test('room runtime centralizes shared lifecycle concerns', async () => {
  const roomFactory = await fs.readFile(path.join(packageRoot, 'src', 'utils', 'roomSceneFactory.ts'), 'utf8');

  assert.match(roomFactory, /createWorldTapDispatcher/);
  assert.match(roomFactory, /registerUserDataClickTargets/);
  assert.match(roomFactory, /createOwlCompanion/);
  assert.match(roomFactory, /wireFloorTap\(scene, dispatcher, content\.floorTargets, config\.floorTap, owl\)/);
  assert.match(roomFactory, /disposeSceneResources/);
});
