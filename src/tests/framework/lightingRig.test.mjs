/**
 * LightingRig contract test.
 *
 * Enforces architecture-standards.md#lightingrig. The unification only holds if:
 *   - the fill is a HemisphereLight (a flat ambient fill is the sky===ground
 *     special case), never a bare AmbientLight — that's the vocabulary both rigs
 *     collapse into;
 *   - shadow map size comes from qualityTier (not a hard-coded constant);
 *   - every light AND the key's target is registered on the DisposalScope, so
 *     scene switches stop leaking shadow-map render targets;
 *   - the key light position follows `-normalize(direction)·KEY_DISTANCE`.
 *
 * The rig imports the `@app/*` alias (qualityTier, disposal), so it can't be
 * behaviourally loaded here; structure is parsed and the pure key-position math
 * is checked in isolation. (See the "Testing & rollout" rule.)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(path.join(packageRoot, 'src', 'utils', 'lighting', 'lightingRig.ts'), 'utf8');

test('fill is a hemisphere light, not a flat AmbientLight', () => {
  assert.ok(/new HemisphereLight\(/.test(src), 'fill must be a HemisphereLight');
  assert.ok(!/new AmbientLight\(/.test(src), 'the rig must not fall back to AmbientLight (flat = sky===ground hemisphere)');
});

test('shadow map size comes from qualityTier', () => {
  assert.ok(/getShadowMapSize\(\)/.test(src), 'shadow map size must come from qualityTier.getShadowMapSize');
  assert.ok(!/mapSize\.set\(\s*\d/.test(src), 'shadow map size must not be a hard-coded number');
});

test('every light and the key target is registered on the disposal scope', () => {
  // key, fill, and each accent go through scope.object3D; the target is removed too.
  const registrations = src.match(/scope\.object3D\(/g) ?? [];
  assert.ok(registrations.length >= 3, 'key, fill, and accents must each be scope-registered');
  assert.ok(/scope\.add\(\(\) => key\.target\.removeFromParent\(\)\)/.test(src), 'the key target must be removed on teardown');
});

test('point accents honour an optional distance falloff', () => {
  assert.ok(/new PointLight\(a\.color, a\.intensity, a\.distance \?\? 0\)/.test(src), 'accents must pass color, intensity, distance');
});

test('key light position math: -normalize(direction)·KEY_DISTANCE', () => {
  const KEY_DISTANCE = 10;
  const keyPos = (dir) => {
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const n = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
    return { x: -n.x * KEY_DISTANCE, y: -n.y * KEY_DISTANCE, z: -n.z * KEY_DISTANCE };
  };
  // Opposite the light's travel direction, at KEY_DISTANCE from the origin.
  const p = keyPos({ x: -1, y: -3, z: 2 });
  const mag = Math.hypot(p.x, p.y, p.z);
  assert.ok(Math.abs(mag - KEY_DISTANCE) < 1e-9, `key light must sit at distance ${KEY_DISTANCE}, got ${mag}`);
  // Direction from key to origin equals the light's travel direction (normalized).
  assert.ok(p.x > 0 && p.y > 0 && p.z < 0, 'key position must be opposite the (−1,−3,2) travel direction');
  // Non-unit direction gives the same placement (lighting depends only on direction).
  const p2 = keyPos({ x: -2, y: -6, z: 4 });
  assert.ok(Math.abs(p2.x - p.x) < 1e-9 && Math.abs(p2.y - p.y) < 1e-9, 'non-unit direction must place the key identically');
});
