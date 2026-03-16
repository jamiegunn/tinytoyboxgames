import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFixtureMiniGame, readFixtureFile } from './testUtils.mjs';

test('generated minigame exposes the expected shell lifecycle shape', async () => {
  const fixture = await generateFixtureMiniGame({
    gameId: 'template-demo',
    displayName: 'Template Demo',
  });

  try {
    const source = await readFixtureFile(fixture.tempRoot, 'src', 'minigames', 'games', 'template-demo', 'index.ts');

    assert.match(source, /export function createGame\(context: MiniGameContext\): IMiniGame/);
    assert.match(source, /async setup\(\): Promise<void>/);
    assert.match(source, /start\(\): void/);
    assert.match(source, /update\(deltaTime: number\): void/);
    assert.match(source, /pause\(\): void/);
    assert.match(source, /resume\(\): void/);
    assert.match(source, /teardown\(\): void/);
    assert.match(source, /onResize\(viewport: ViewportInfo\): void/);
    assert.match(source, /onTap\(event: MiniGameTapEvent\): void/);
    assert.match(source, /onDrag\(_event: MiniGameDragEvent\): void/);
    assert.match(source, /onDragEnd\(_event: MiniGameDragEndEvent\): void/);
  } finally {
    await fixture.cleanup();
  }
});
