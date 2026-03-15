import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { exists, generateFixtureScene } from './testUtils.mjs';

test('generator creates the canonical immersive scene folder structure', async () => {
  const fixture = await generateFixtureScene({
    sceneId: 'structure-demo',
    displayName: 'Structure Demo',
  });

  try {
    const requiredRelativePaths = [
      'README.md',
      'index.ts',
      'environment.ts',
      'materials.ts',
      'types.ts',
      path.join('parent-scene-stubs', 'README.md'),
      path.join('parent-scene-stubs', 'playroom.toybox.stub.ts'),
      path.join('staging', 'README.md'),
      path.join('staging', 'sampleSimple.ts'),
      path.join('staging', 'sampleInteractive.ts'),
      path.join('factory', 'README.md'),
      path.join('factory', 'composeHelpers.ts'),
      path.join('factory', 'scaffold', 'README.md'),
      path.join('factory', 'scaffold', 'sceneShell', 'README.md'),
      path.join('factory', 'scaffold', 'sceneShell', 'create.ts'),
      path.join('factory', 'scaffold', 'skyBackdrop', 'create.ts'),
      path.join('factory', 'props', 'simple', 'sampleSimple', 'compose.ts'),
      path.join('factory', 'props', 'interactive', 'sampleInteractive', 'interaction.ts'),
      path.join('factory', 'props', 'complex', 'README.md'),
      path.join('factory', 'systems', 'README.md'),
    ];

    for (const relativePath of requiredRelativePaths) {
      assert.equal(await exists(path.join(fixture.sceneDir, relativePath)), true, `expected generated scene to contain ${relativePath}`);
    }
  } finally {
    await fixture.cleanup();
  }
});
