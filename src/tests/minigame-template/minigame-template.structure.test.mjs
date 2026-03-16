import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { exists, generateFixtureMiniGame } from './testUtils.mjs';

test('generator creates the canonical minigame folder structure', async () => {
  const fixture = await generateFixtureMiniGame({
    gameId: 'template-demo',
    displayName: 'Template Demo',
  });

  try {
    const requiredRelativePaths = [
      'README.md',
      'index.ts',
      'types.ts',
      'helpers.ts',
      path.join('environment', 'README.md'),
      path.join('environment', 'index.ts'),
      path.join('environment', 'setup.ts'),
      path.join('entities', 'README.md'),
      path.join('entities', 'index.ts'),
      path.join('entities', 'lifecycle.ts'),
      path.join('entities', 'effects.ts'),
      path.join('rules', 'README.md'),
      path.join('rules', 'index.ts'),
      path.join('rules', 'scoring.ts'),
      path.join('rules', 'spawning.ts'),
    ];

    for (const relativePath of requiredRelativePaths) {
      assert.equal(await exists(path.join(fixture.gameDir, relativePath)), true, `expected generated minigame to contain ${relativePath}`);
    }
  } finally {
    await fixture.cleanup();
  }
});
