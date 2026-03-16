import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtureScene, readFixtureFile } from './testUtils.mjs';

test('generator updates the central scene catalog with games list', async () => {
  const fixture = await generateFixtureScene({
    sceneId: 'registration-demo',
    displayName: 'Registration Demo',
  });

  try {
    const sceneCatalog = await readFixtureFile(fixture.tempRoot, 'src', 'scenes', 'sceneCatalog.ts');

    assert.match(sceneCatalog, /'registration-demo': \{/);
    assert.match(sceneCatalog, /loader: \(\) => import\('@app\/scenes\/immersive-toybox-scenes\/registration-demo'\)/);
    assert.match(
      sceneCatalog,
      /cameraPreset: \{[\s\S]*azimuth: 0,[\s\S]*polar: 1\.2,[\s\S]*distance: 10,[\s\S]*target: \[0, 0\.3, 0\],[\s\S]*maxAzimuthRange: 0\.12,[\s\S]*ceilingY: 4\.8,[\s\S]*\}/,
    );
    assert.match(sceneCatalog, /games:\s*\['bubble-pop'\]/);
  } finally {
    await fixture.cleanup();
  }
});
