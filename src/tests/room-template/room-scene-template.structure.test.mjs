import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { exists, generateFixtureRoom } from './testUtils.mjs';

test('generator creates the canonical room scene folder structure', async () => {
  const fixture = await generateFixtureRoom({
    sceneId: 'kitchen-demo',
    displayName: 'Kitchen Demo',
  });

  try {
    const requiredRelativePaths = [
      'README.md',
      'index.ts',
      'environment.ts',
      'layout.ts',
      'room.ts',
      path.join('room', 'README.md'),
      path.join('room', 'walls.ts'),
      path.join('room', 'ceiling.ts'),
      path.join('room', 'floor.ts'),
      path.join('decor', 'README.md'),
      path.join('decor', 'sampleCounter.ts'),
      path.join('toyboxes', 'README.md'),
      path.join('toyboxes', 'manifest.ts'),
    ];

    for (const relativePath of requiredRelativePaths) {
      assert.equal(await exists(path.join(fixture.sceneDir, relativePath)), true, `expected generated room to contain ${relativePath}`);
    }
  } finally {
    await fixture.cleanup();
  }
});
