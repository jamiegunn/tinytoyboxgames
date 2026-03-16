import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');

test('playroom scene root delegates to the shared room runtime', async () => {
  const indexSource = await fs.readFile(path.join(packageRoot, 'src', 'scenes', 'world', 'places', 'house', 'subplaces', 'playroom', 'index.ts'), 'utf8');
  const environmentSource = await fs.readFile(
    path.join(packageRoot, 'src', 'scenes', 'world', 'places', 'house', 'subplaces', 'playroom', 'environment.ts'),
    'utf8',
  );

  assert.match(indexSource, /createRoomScene/);
  assert.match(indexSource, /PLAYROOM_ENVIRONMENT/);
  assert.doesNotMatch(indexSource, /createSceneCamera/);
  assert.doesNotMatch(indexSource, /DirectionalLight/);
  assert.match(environmentSource, /PLAYROOM_ENVIRONMENT/);
  assert.match(environmentSource, /flightBounds/);
});

test('playroom authored content no longer owns a custom scene-level raycast loop', async () => {
  const roomSource = await fs.readFile(path.join(packageRoot, 'src', 'scenes', 'world', 'places', 'house', 'subplaces', 'playroom', 'room.ts'), 'utf8');

  assert.match(roomSource, /buildPlayroomContents/);
  assert.match(roomSource, /RoomBuildContext/);
  assert.match(roomSource, /floorTargets: \[floor, rug\]/);
  assert.doesNotMatch(roomSource, /canvas\.addEventListener\('pointerdown'/);
  assert.doesNotMatch(roomSource, /new Raycaster/);
  assert.doesNotMatch(roomSource, /createOwlCompanion/);
});
